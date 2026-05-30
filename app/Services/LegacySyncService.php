<?php

namespace App\Services;

use App\Models\Area;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Package;
use App\Models\Router;
use Carbon\Carbon;
use Generator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class LegacySyncService
{
    protected string $baseUrl;

    /**
     * @var array<string, int>
     */
    private array $lastCustomerAreaResolutionStats = [];

    /**
     * @var array<string, int>
     */
    private array $lastCustomerNetworkSyncStats = [];

    public function __construct(private LegacyAreaResolver $areaResolver)
    {
        $this->baseUrl = config('services.legacy_scraper.url', 'http://scraping-ebilling.103.156.128.102.sslip.io');
    }

    /**
     * Sync all data in the correct dependency order.
     */
    public function syncAll(): array
    {
        $stats = [
            'areas' => $this->syncAreas(),
            'packages' => $this->syncPackages(),
        ];
        $stats['customers'] = $this->syncCustomers();
        $stats['deleted_empty_areas'] = count($this->cleanupEmptyAreas());
        $stats['invoices'] = $this->syncInvoices();

        return $stats;
    }

    public function syncAreas(): int
    {
        $response = Http::timeout(30)->get("{$this->baseUrl}/api/v1/areas");
        if (! $response->successful()) {
            return $this->syncAreasFromCustomers();
        }

        return collect($response->json())
            ->pluck('name')
            ->filter()
            ->map(fn (string $name) => $this->areaResolver->normalizeAreaName($name))
            ->filter(fn (string $name) => $this->areaResolver->isApprovedArea($name))
            ->unique()
            ->sum(function (string $name) {
                Area::updateOrCreate(
                    ['name' => $name],
                    ['code' => Str::slug($name)]
                );

                return 1;
            });
    }

    public function syncPackages(): int
    {
        $response = Http::timeout(30)->get("{$this->baseUrl}/api/v1/packages");
        if (!$response->successful()) {
            throw new \Exception("Failed to fetch packages: " . $response->body());
        }

        $packages = $response->json();
        $count = 0;

        foreach ($packages as $data) {
            $code = 'PKG-' . strtoupper(substr(md5($data['name']), 0, 8));
            Package::updateOrCreate(
                ['name' => $data['name']],
                [
                    'code' => $code, // Ensures it passes strict DB constraints
                    'price' => $data['price'] ?? 0,
                ]
            );
            $count++;
        }

        return $count;
    }

    public function syncCustomers(): int
    {
        $response = Http::timeout(60)->get("{$this->baseUrl}/api/v1/customers");
        if (!$response->successful()) {
            throw new \Exception("Failed to fetch customers: " . $response->body());
        }

        $customers = $response->json();
        $packagesByName = Package::pluck('id', 'name');
        $areasByName = Area::pluck('id', 'name');
        $fallbackPkg = Package::firstOrCreate(
            ['name' => 'Legacy/Unknown Package'],
            [
                'code' => 'PKG-UNKNOWN',
                'price' => 0,
            ]
        );
        $seenPppoeUsers = [];
        $existingPppoeByCode = Customer::withTrashed()
            ->whereNotNull('pppoe_user')
            ->pluck('pppoe_user', 'code');
        $existingPppoeOwners = Customer::withTrashed()
            ->whereNotNull('pppoe_user')
            ->get(['id', 'code', 'pppoe_user', 'deleted_at'])
            ->keyBy('pppoe_user');
        $routersByScraperName = $this->routersByScraperName();
        $rows = [];
        $now = now();
        $areaResolutionStats = $this->emptyAreaResolutionStats();
        $networkSyncStats = $this->emptyNetworkSyncStats();

        foreach ($customers as $data) {
            $customerCode = (string) ($data['code'] ?? $data['id']);
            $source = strtolower((string) ($data['source'] ?? 'unknown'));
            $networkSyncStats["source_{$source}"] = ($networkSyncStats["source_{$source}"] ?? 0) + 1;

            $packageId = null;
            if (!empty($data['package'])) {
                $packageId = $packagesByName->get($data['package']['name']);
            }

            if (!$packageId) {
                $packageId = $fallbackPkg->id;
            }

            $areaId = null;
            $resolvedArea = $this->areaResolver->resolve($data);
            $areaResolutionStats[$resolvedArea['reason']] = ($areaResolutionStats[$resolvedArea['reason']] ?? 0) + 1;
            if ($resolvedArea['area']) {
                $areaId = $areasByName->get($resolvedArea['area']);
                if (! $areaId) {
                    $area = Area::firstOrCreate(
                        ['name' => $resolvedArea['area']],
                        ['code' => Str::slug($resolvedArea['area'])]
                    );
                    $areaId = $area->id;
                    $areasByName->put($resolvedArea['area'], $areaId);
                }
            } else {
                Log::warning('Legacy customer has no approved area mapping', [
                    'customer_id' => $data['id'] ?? null,
                    'customer_name' => $data['name'] ?? null,
                ]);
            }

            $joinDate = !empty($data['join_date']) ? Carbon::parse($data['join_date']) : null;

            $scrapedPppoeUser = $data['pppoe_username'] ?? $data['pppoe_user'] ?? null;
            $pppoeUser = $this->resolvePppoeUser(
                customerCode: $customerCode,
                scrapedPppoeUser: $scrapedPppoeUser,
                existingPppoeByCode: $existingPppoeByCode,
                existingPppoeOwners: $existingPppoeOwners,
                stats: $networkSyncStats
            );
            $attempts = 0;
            while (
                isset($seenPppoeUsers[$pppoeUser])
                && $seenPppoeUsers[$pppoeUser] !== $customerCode
            ) {
                $attempts++;
                $pppoeUser = $customerCode . '_USR_' . ($attempts + 1);
            }
            $seenPppoeUsers[$pppoeUser] = $customerCode;

            $isMikrotikSyncable = (bool) ($data['is_mikrotik_syncable'] ?? false);
            $networkSyncStats[$isMikrotikSyncable ? 'mikrotik_syncable' : 'not_mikrotik_syncable']++;
            $routerId = $this->resolveRouterId($data, $routersByScraperName, $networkSyncStats);

            $phone = !empty($data['phone']) ? $data['phone'] : '';
            $address = !empty($data['address']) ? $data['address'] : '-';
            
            $statusRaw = strtolower($data['status'] ?? 'active');
            $validStatuses = ['active', 'suspended', 'inactive', 'isolated', 'terminated', 'pending_installation'];
            if ($statusRaw === 'deleted') {
                $statusRaw = 'terminated';
            } elseif (!in_array($statusRaw, $validStatuses)) {
                $statusRaw = 'active';
            }

            $rows[] = [
                'code' => $customerCode,
                'legacy_id' => $customerCode,
                'name' => $data['name'],
                'nik' => !empty($data['nik']) ? $data['nik'] : null,
                'address' => $address,
                'phone' => $phone,
                'geo_lat' => $data['geo_lat'],
                'geo_long' => $data['geo_long'],
                'pppoe_user' => $pppoeUser,
                'package_id' => $packageId,
                'area_id' => $areaId,
                'router_id' => $routerId,
                'status' => $statusRaw,
                'join_date' => $joinDate?->toDateString(),
                'due_day' => $data['due_day'] ?? 20,
                'ktp_photo_url' => $data['ktp_photo_url'],
                'is_online' => $data['is_online'] ?? false,
                'deleted_at' => strtolower($data['status'] ?? '') === 'deleted' ? $now : null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('customers')->upsert($chunk, ['code'], [
                'legacy_id',
                'name',
                'nik',
                'address',
                'phone',
                'geo_lat',
                'geo_long',
                'pppoe_user',
                'package_id',
                'area_id',
                'router_id',
                'status',
                'join_date',
                'due_day',
                'ktp_photo_url',
                'is_online',
                'deleted_at',
                'updated_at',
            ]);
        }

        $this->lastCustomerAreaResolutionStats = $areaResolutionStats;
        $this->lastCustomerNetworkSyncStats = $networkSyncStats;

        $fallbackCount = collect($areaResolutionStats)
            ->except(['api_area'])
            ->sum();

        if ($fallbackCount > 0) {
            Log::info('Legacy customer sync used fallback area mapping for some rows.', [
                'area_resolution' => $areaResolutionStats,
            ]);
        }

        Log::info('Legacy customer sync network classification summary.', [
            'network_sync' => $networkSyncStats,
        ]);

        return count($rows);
    }

    /**
     * @return array<string, int>
     */
    public function lastCustomerAreaResolutionStats(): array
    {
        return $this->lastCustomerAreaResolutionStats;
    }

    /**
     * @return array<string, int>
     */
    public function lastCustomerNetworkSyncStats(): array
    {
        return $this->lastCustomerNetworkSyncStats;
    }

    /**
     * @return array<string, int>
     */
    private function emptyAreaResolutionStats(): array
    {
        return [
            'api_area' => 0,
            'legacy_location' => 0,
            'prefix' => 0,
            'package_keyword' => 0,
            'address_keyword' => 0,
            'unmapped' => 0,
        ];
    }

    /**
     * @return array<string, int>
     */
    private function emptyNetworkSyncStats(): array
    {
        return [
            'source_warga' => 0,
            'source_stale' => 0,
            'mikrotik_syncable' => 0,
            'not_mikrotik_syncable' => 0,
            'pppoe_from_scraper' => 0,
            'pppoe_preserved_existing' => 0,
            'pppoe_placeholder' => 0,
            'pppoe_conflict' => 0,
            'released_deleted_imp_conflicts' => 0,
            'router_mapped' => 0,
            'router_unmapped' => 0,
            'router_blank' => 0,
        ];
    }

    /**
     * @param \Illuminate\Support\Collection<string, string> $existingPppoeByCode
     * @param \Illuminate\Support\Collection<string, Customer> $existingPppoeOwners
     * @param array<string, int> $stats
     */
    private function resolvePppoeUser(
        string $customerCode,
        mixed $scrapedPppoeUser,
        $existingPppoeByCode,
        $existingPppoeOwners,
        array &$stats
    ): string {
        $scrapedPppoeUser = trim((string) $scrapedPppoeUser);

        if ($scrapedPppoeUser !== '') {
            $owner = $existingPppoeOwners->get($scrapedPppoeUser);

            if ($owner && $owner->code !== $customerCode) {
                if ($owner->trashed() && str_starts_with((string) $owner->code, 'IMP-')) {
                    DB::table('customers')
                        ->where('id', $owner->id)
                        ->update(['pppoe_user' => $this->releasedImportedPppoeValue($owner)]);
                    $existingPppoeOwners->forget($scrapedPppoeUser);
                    $stats['released_deleted_imp_conflicts']++;
                } else {
                    $stats['pppoe_conflict']++;
                    return $existingPppoeByCode->get($customerCode) ?: $customerCode . '_USR';
                }
            }

            $stats['pppoe_from_scraper']++;
            return $scrapedPppoeUser;
        }

        $existingPppoeUser = trim((string) ($existingPppoeByCode->get($customerCode) ?? ''));
        if ($existingPppoeUser !== '') {
            $stats['pppoe_preserved_existing']++;
            return $existingPppoeUser;
        }

        $stats['pppoe_placeholder']++;
        return $customerCode . '_USR';
    }

    private function releasedImportedPppoeValue(Customer $customer): string
    {
        return 'RELEASED-IMP-' . $customer->id . '-' . substr(md5((string) $customer->pppoe_user), 0, 8);
    }

    /**
     * @return array<string, Router>
     */
    private function routersByScraperName(): array
    {
        $routersByName = Router::all()->keyBy('name');
        $aliases = config('legacy_sync.router_aliases', []);
        $mapped = [];

        foreach ($aliases as $scraperName => $localRouterName) {
            $router = $routersByName->get($localRouterName);
            if ($router) {
                $mapped[$scraperName] = $router;
            }
        }

        foreach ($routersByName as $routerName => $router) {
            $mapped[$routerName] = $router;
        }

        return $mapped;
    }

    /**
     * @param array<string, mixed> $data
     * @param array<string, Router> $routersByScraperName
     * @param array<string, int> $stats
     */
    private function resolveRouterId(array $data, array $routersByScraperName, array &$stats): ?int
    {
        $routerName = trim((string) (
            data_get($data, 'router.name')
            ?? $data['router_name']
            ?? $data['nama_router']
            ?? ''
        ));

        if ($routerName === '') {
            $stats['router_blank']++;
            return null;
        }

        $router = $routersByScraperName[$routerName] ?? null;
        if (! $router) {
            $stats['router_unmapped']++;
            return null;
        }

        $stats['router_mapped']++;
        return $router->id;
    }

    /**
     * Delete areas that remain unused after the latest customer sync.
     *
     * @return array<int, string>
     */
    public function cleanupEmptyAreas(): array
    {
        $areas = Area::query()
            ->whereNotExists(function ($query) {
                $query->selectRaw('1')
                    ->from('customers')
                    ->whereColumn('customers.area_id', 'areas.id');
            })
            ->whereNotExists(function ($query) {
                $query->selectRaw('1')
                    ->from('area_user')
                    ->whereColumn('area_user.area_id', 'areas.id');
            })
            ->whereNotExists(function ($query) {
                $query->selectRaw('1')
                    ->from('wa_campaigns')
                    ->whereColumn('wa_campaigns.target_area_id', 'areas.id');
            })
            ->orderBy('name')
            ->get(['id', 'name']);

        foreach ($areas as $area) {
            $area->delete();
        }

        return $areas->pluck('name')->all();
    }

    public function syncInvoices(): int
    {
        $tmpDir = storage_path('app/legacy-sync');
        File::ensureDirectoryExists($tmpDir);

        $tmpFile = tempnam($tmpDir, 'invoices-');
        if ($tmpFile === false) {
            throw new \RuntimeException('Failed to create temporary file for invoice sync.');
        }

        try {
            $response = Http::sink($tmpFile)
                ->timeout(180)
                ->get("{$this->baseUrl}/api/v1/invoices");

            if (!$response->successful()) {
                $body = File::exists($tmpFile) ? File::get($tmpFile) : '';

                throw new \Exception("Failed to fetch invoices: " . $body);
            }

            $customerIdsByCode = Customer::withTrashed()->pluck('id', 'code');
            $rows = [];
            $count = 0;
            $now = now();

            foreach ($this->streamJsonArrayFile($tmpFile) as $data) {
                $customerId = $customerIdsByCode->get((string) $data['customer_id']);
                if (!$customerId) {
                    // If customer is missing locally, we cannot assign the invoice.
                    Log::warning("Skipping invoice sync for missing customer: {$data['customer_id']}");
                    continue;
                }

                $periodDate = Carbon::parse($data['period']);
                $dueDate = $data['due_date'] ? Carbon::parse($data['due_date']) : $periodDate->copy()->addDays(20);

                $rows[] = [
                    'customer_id' => $customerId,
                    'period' => $periodDate->toDateString(),
                    'legacy_id' => isset($data['id']) ? (string) $data['id'] : null,
                    'uuid' => $data['uuid'] ?? (string) Str::uuid(),
                    'code' => $data['code'] ?? 'INV-' . $periodDate->format('Ym') . '-' . $data['customer_id'],
                    'amount' => $data['amount'],
                    'status' => $data['status'],
                    'due_date' => $dueDate->toDateString(),
                    'generated_at' => ! empty($data['generated_at']) ? Carbon::parse($data['generated_at']) : $now,
                    'last_synced_at' => ! empty($data['last_synced_at']) ? Carbon::parse($data['last_synced_at']) : $now,
                    'payment_link' => $data['payment_link'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                $count++;

                if (count($rows) >= 1000) {
                    $this->upsertInvoiceRows($rows);
                    $rows = [];
                }
            }

            $this->upsertInvoiceRows($rows);

            return $count;
        } finally {
            File::delete($tmpFile);
        }
    }

    private function upsertInvoiceRows(array $rows): void
    {
        if ($rows === []) {
            return;
        }

        DB::table('invoices')->upsert($rows, ['customer_id', 'period'], [
            'legacy_id',
            'uuid',
            'code',
            'amount',
            'status',
            'due_date',
            'generated_at',
            'last_synced_at',
            'payment_link',
            'updated_at',
        ]);
    }

    /**
     * Stream a top-level JSON array of objects without decoding the whole file.
     */
    private function streamJsonArrayFile(string $path): Generator
    {
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            throw new \RuntimeException("Failed to open streamed JSON file: {$path}");
        }

        $buffer = '';
        $depth = 0;
        $inString = false;
        $escaped = false;

        try {
            while (! feof($handle)) {
                $chunk = fread($handle, 8192);
                if ($chunk === false) {
                    throw new \RuntimeException("Failed to read streamed JSON file: {$path}");
                }

                $length = strlen($chunk);
                for ($i = 0; $i < $length; $i++) {
                    $char = $chunk[$i];

                    if ($depth > 0) {
                        $buffer .= $char;
                    }

                    if ($inString) {
                        if ($escaped) {
                            $escaped = false;
                        } elseif ($char === '\\') {
                            $escaped = true;
                        } elseif ($char === '"') {
                            $inString = false;
                        }

                        continue;
                    }

                    if ($char === '"') {
                        $inString = true;
                        continue;
                    }

                    if ($char === '{') {
                        if ($depth === 0) {
                            $buffer = '{';
                        }

                        $depth++;
                        continue;
                    }

                    if ($char === '}') {
                        $depth--;

                        if ($depth === 0) {
                            $decoded = json_decode($buffer, true, flags: JSON_THROW_ON_ERROR);
                            if (is_array($decoded)) {
                                yield $decoded;
                            }

                            $buffer = '';
                        }
                    }
                }
            }
        } finally {
            fclose($handle);
        }
    }

    private function syncAreasFromCustomers(): int
    {
        $response = Http::timeout(60)->get("{$this->baseUrl}/api/v1/customers");
        if (! $response->successful()) {
            throw new \Exception("Failed to fetch areas and customer fallback: " . $response->body());
        }

        return collect($response->json())
            ->map(fn (array $customer) => $this->areaResolver->resolve($customer)['area'])
            ->filter()
            ->unique()
            ->sum(function (string $name) {
                Area::updateOrCreate(
                    ['name' => $name],
                    ['code' => Str::slug($name)]
                );

                return 1;
            });
    }
}
