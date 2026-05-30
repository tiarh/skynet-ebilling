<?php

namespace App\Http\Controllers;

use App\Http\Requests\OltRequest;
use App\Models\Area;
use App\Models\Customer;
use App\Models\Olt;
use App\Models\OltOperationLog;
use App\Models\Router;
use App\Services\OltHiosoService;
use App\Services\OltZteC300Service;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Symfony\Component\Process\Process;
use Throwable;

class OltController extends Controller
{
    public function index(Request $request)
    {
        $query = Olt::query()->with(['area:id,name', 'router:id,name']);

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($sub) use ($search) {
                $sub->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('management_ip', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%");
            });
        }

        $allowedSorts = ['name', 'code', 'management_ip', 'location', 'created_at'];
        $sort = in_array($request->input('sort'), $allowedSorts, true) ? $request->input('sort') : 'name';
        $direction = $request->input('direction') === 'desc' ? 'desc' : 'asc';

        $olts = $query
            ->orderBy($sort, $direction)
            ->paginate($request->input('limit', 20))
            ->withQueryString();

        return Inertia::render('Olts/Index', [
            'olts' => $olts,
            'filters' => [
                'search' => $request->search,
                'limit' => $request->input('limit', 20),
                'sort' => $sort,
                'direction' => $direction,
            ],
        ]);
    }

    public function create()
    {
        return Inertia::render('Olts/Create', [
            'areas' => Area::query()->orderBy('name')->get(['id', 'name']),
            'routers' => Router::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(OltRequest $request)
    {
        Olt::create($this->normalizedPayload($request->validated()));

        return redirect()->route('olts.index')
            ->with('success', 'OLT created successfully.');
    }

    public function show(Olt $olt)
    {
        $olt->load([
            'area:id,name',
            'router:id,name',
            'customers' => function ($query) {
                $query
                    ->select([
                        'id',
                        'code',
                        'name',
                        'pppoe_user',
                        'status',
                        'olt_id',
                        'olt_port_label',
                        'onu_serial',
                        'olt_status',
                        'onu_rx_power_dbm',
                        'onu_tx_power_dbm',
                        'fiber_distance_m',
                        'olt_last_synced_at',
                    ])
                    ->orderBy('olt_port_label')
                    ->orderBy('name');
            },
        ]);

        return Inertia::render('Olts/Show', [
            'olt' => $this->serializeOlt($olt),
        ]);
    }

    public function edit(Olt $olt)
    {
        return Inertia::render('Olts/Edit', [
            'olt' => $this->serializeOlt($olt, true),
            'areas' => Area::query()->orderBy('name')->get(['id', 'name']),
            'routers' => Router::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function update(OltRequest $request, Olt $olt)
    {
        $validated = $this->normalizedPayload($request->validated());

        if (($validated['password'] ?? null) === null || $validated['password'] === '') {
            unset($validated['password']);
        }

        $olt->update($validated);

        return redirect()->route('olts.index')
            ->with('success', 'OLT updated successfully.');
    }

    public function destroy(Olt $olt)
    {
        $olt->delete();

        return redirect()->route('olts.index')
            ->with('success', 'OLT deleted successfully.');
    }

    public function testConnection(Olt $olt)
    {
        if (! $olt->management_ip) {
            return back()->with('error', 'Set the OLT management IP first.');
        }

        $protocol = $olt->management_protocol ?: 'ssh';
        $port = $olt->management_port ?: $this->defaultPortForProtocol($protocol);

        try {
            if (in_array($protocol, ['http', 'https'], true)) {
                $url = "{$protocol}://{$olt->management_ip}:{$port}";
                $client = Http::timeout(8)
                    ->withoutRedirecting()
                    ->withOptions(['verify' => false]);

                if ($olt->username || $olt->password) {
                    $client = $client->withBasicAuth($olt->username ?: '', $olt->password ?: '');
                }

                $response = $client->get($url);

                $status = $response->status();
                if (in_array($status, [200, 301, 302, 401, 403], true)) {
                    return back()->with('success', "OLT web reachable via {$url} (HTTP {$status}).");
                }

                return back()->with('error', "OLT web responded via {$url}, but status is HTTP {$status}.");
            }

            if ($protocol === 'snmp') {
                $process = new Process([
                    'snmpwalk',
                    '-v2c',
                    '-c',
                    $olt->snmp_community ?: 'public',
                    '-On',
                    '-t',
                    '2',
                    '-r',
                    '1',
                    "{$olt->management_ip}:{$port}",
                    '.1.3.6.1.2.1.1',
                ]);
                $process->setTimeout(12);
                $process->run();

                $output = trim($process->getOutput() . "\n" . $process->getErrorOutput());
                if (! $process->isSuccessful() || preg_match('/(timeout|no response|unknown host|authentication failure)/i', $output)) {
                    return back()->with('error', "OLT SNMP failed: " . ($output ?: 'No SNMP response.'));
                }

                return back()->with('success', "OLT SNMP reachable via {$olt->management_ip}:{$port}.");
            }

            $transport = 'tcp';
            $target = sprintf('%s://%s:%d', $transport, $olt->management_ip, $port);

            $errno = 0;
            $errstr = '';
            $socket = @stream_socket_client($target, $errno, $errstr, 5);

            if (! $socket) {
                return back()->with('error', "OLT connection failed: {$errstr} ({$errno})");
            }

            fclose($socket);

            return back()->with('success', "OLT connection succeeded via {$protocol} to {$olt->management_ip}:{$port}.");
        } catch (Throwable $e) {
            return back()->with('error', "OLT connection failed: {$e->getMessage()}");
        }
    }

    public function gponSnapshot(Olt $olt)
    {
        try {
            $snapshot = $this->oltService($olt)->collectSnapshot($olt);
            $snapshot['matched_customers'] = $this->syncSnapshotToCustomers($olt, $snapshot);
            $snapshot['meta']['matched_customers_count'] = count($snapshot['matched_customers']);
            $snapshot['meta']['updated_customers_count'] = collect($snapshot['matched_customers'])
                ->where('changed', true)
                ->count();

            if (Schema::hasColumn('olts', 'last_gpon_snapshot') && Schema::hasColumn('olts', 'last_gpon_synced_at')) {
                $olt->forceFill([
                    'last_gpon_snapshot' => $snapshot,
                    'last_gpon_synced_at' => now(),
                ])->save();
            }

            return response()->json($snapshot);
        } catch (Throwable $e) {
            if (is_array($olt->last_gpon_snapshot) && ! empty($olt->last_gpon_snapshot['onus'])) {
                $snapshot = $olt->last_gpon_snapshot;
                $snapshot['meta']['warning'] = 'Collector OLT gagal mengambil data terbaru, menampilkan snapshot terakhir yang masih valid.';
                $snapshot['meta']['last_error'] = $e->getMessage();
                $snapshot['meta']['last_attempt_at'] = now()->toISOString();

                return response()->json($snapshot);
            }

            return response()->json([
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    public function onuDetail(Request $request, Olt $olt)
    {
        $validated = $request->validate([
            'onu_ref' => ['required', 'string', 'max:64'],
        ]);

        return $this->runOltOperation($olt, 'onu_detail', $validated['onu_ref'], $validated, function () use ($olt, $validated) {
            return $this->oltService($olt)->onuDetail($olt, $validated['onu_ref']);
        });
    }

    public function renameOnu(Request $request, Olt $olt)
    {
        $validated = $request->validate([
            'onu_ref' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:255'],
        ]);

        return $this->runOltOperation($olt, 'rename_onu', $validated['onu_ref'], $validated, function () use ($olt, $validated) {
            return $this->oltService($olt)->renameOnu($olt, $validated['onu_ref'], $validated['name']);
        });
    }

    public function rebootOnu(Request $request, Olt $olt)
    {
        $validated = $request->validate([
            'onu_ref' => ['required', 'string', 'max:64'],
        ]);

        return $this->runOltOperation($olt, 'reboot_onu', $validated['onu_ref'], $validated, function () use ($olt, $validated) {
            return $this->oltService($olt)->rebootOnu($olt, $validated['onu_ref']);
        });
    }

    public function setOnuAdminState(Request $request, Olt $olt)
    {
        $validated = $request->validate([
            'onu_ref' => ['required', 'string', 'max:64'],
            'enabled' => ['required', 'boolean'],
        ]);

        $operation = $validated['enabled'] ? 'enable_onu' : 'disable_onu';

        return $this->runOltOperation($olt, $operation, $validated['onu_ref'], $validated, function () use ($olt, $validated) {
            return $this->oltService($olt)->setOnuAdminState($olt, $validated['onu_ref'], (bool) $validated['enabled']);
        });
    }

    public function deleteOnu(Request $request, Olt $olt)
    {
        $validated = $request->validate([
            'onu_ref' => ['required', 'string', 'max:64'],
        ]);

        return $this->runOltOperation($olt, 'delete_onu', $validated['onu_ref'], $validated, function () use ($olt, $validated) {
            return $this->oltService($olt)->deleteOnu($olt, $validated['onu_ref']);
        });
    }

    public function authorizeOnu(Request $request, Olt $olt)
    {
        $validated = $request->validate([
            'pon_port' => ['required', 'string', 'max:64'],
            'onu_id' => ['required', 'integer', 'min:1', 'max:128'],
            'serial_number' => ['required', 'string', 'max:64'],
            'onu_type' => ['nullable', 'string', 'max:64'],
            'name' => ['nullable', 'string', 'max:255'],
            'line_profile' => ['nullable', 'string', 'max:128'],
            'service_profile' => ['nullable', 'string', 'max:128'],
        ]);

        $onuRef = "{$validated['pon_port']}:{$validated['onu_id']}";

        return $this->runOltOperation($olt, 'authorize_onu', $onuRef, $validated, function () use ($olt, $validated) {
            return $this->oltService($olt)->authorizeOnu($olt, $validated);
        });
    }

    protected function defaultPortForProtocol(string $protocol): int
    {
        return match ($protocol) {
            'telnet' => 23,
            'snmp' => 161,
            'http' => 80,
            'https' => 443,
            default => 22,
        };
    }

    protected function normalizedPayload(array $payload): array
    {
        $protocol = $payload['management_protocol'] ?? null;
        if ($protocol && empty($payload['management_port'])) {
            $payload['management_port'] = $this->defaultPortForProtocol($protocol);
        }

        $payload['vendor'] = $payload['vendor'] ?? 'zte_c300';

        return $payload;
    }

    protected function serializeOlt(Olt $olt, bool $includePasswordField = false): array
    {
        $hasCustomerGroups = $olt->relationLoaded('customers');

        return [
            'id' => $olt->id,
            'name' => $olt->name,
            'code' => $olt->code,
            'vendor' => $olt->vendor ?? 'zte_c300',
            'area_id' => $olt->area_id,
            'router_id' => $olt->router_id,
            'management_ip' => $olt->management_ip,
            'management_protocol' => $olt->management_protocol,
            'management_port' => $olt->management_port,
            'username' => $olt->username,
            'password' => $includePasswordField ? '' : null,
            'snmp_community' => $olt->snmp_community,
            'location' => $olt->location,
            'notes' => $olt->notes,
            'area' => $olt->area ? ['id' => $olt->area->id, 'name' => $olt->area->name] : null,
            'router' => $olt->router ? ['id' => $olt->router->id, 'name' => $olt->router->name] : null,
            'customer_count' => $hasCustomerGroups ? $olt->customers->count() : 0,
            'pon_port_groups' => $hasCustomerGroups ? $this->serializePonPortGroups($olt) : [],
            'last_gpon_snapshot' => $olt->last_gpon_snapshot,
            'last_gpon_synced_at' => $olt->last_gpon_synced_at?->toISOString(),
        ];
    }

    protected function serializePonPortGroups(Olt $olt): array
    {
        $customersByPon = $olt->customers
            ->groupBy(fn ($customer) => $this->normalizePonPort($customer->olt_port_label) ?: 'unassigned');

        $groups = collect($this->gponPonPorts())->map(function (array $port) use ($customersByPon) {
            return [
                'label' => $port['label'],
                'value' => $port['value'],
                'customers' => $customersByPon->get($port['label'], collect())->map(fn ($customer) => [
                    'id' => $customer->id,
                    'code' => $customer->code,
                    'name' => $customer->name,
                    'pppoe_user' => $customer->pppoe_user,
                    'status' => $customer->status,
                    'olt_port_label' => $customer->olt_port_label,
                    'onu_serial' => $customer->onu_serial,
                    'olt_status' => $customer->olt_status,
                    'onu_rx_power_dbm' => $customer->onu_rx_power_dbm,
                    'onu_tx_power_dbm' => $customer->onu_tx_power_dbm,
                    'fiber_distance_m' => $customer->fiber_distance_m,
                    'olt_last_synced_at' => $customer->olt_last_synced_at?->toISOString(),
                ])->values(),
            ];
        });

        $unassigned = $customersByPon->get('unassigned', collect());
        if ($unassigned->isNotEmpty()) {
            $groups->push([
                'label' => 'Unassigned',
                'value' => '',
                'customers' => $unassigned->map(fn ($customer) => [
                    'id' => $customer->id,
                    'code' => $customer->code,
                    'name' => $customer->name,
                    'pppoe_user' => $customer->pppoe_user,
                    'status' => $customer->status,
                    'olt_port_label' => $customer->olt_port_label,
                    'onu_serial' => $customer->onu_serial,
                    'olt_status' => $customer->olt_status,
                    'onu_rx_power_dbm' => $customer->onu_rx_power_dbm,
                    'onu_tx_power_dbm' => $customer->onu_tx_power_dbm,
                    'fiber_distance_m' => $customer->fiber_distance_m,
                    'olt_last_synced_at' => $customer->olt_last_synced_at?->toISOString(),
                ])->values(),
            ]);
        }

        return $groups->values()->all();
    }

    protected function gponPonPorts(): array
    {
        $ports = [];

        foreach ([2, 3] as $slot) {
            for ($pon = 1; $pon <= 16; $pon++) {
                $label = "1/{$slot}/{$pon}";
                $ports[] = [
                    'label' => $label,
                    'value' => "gpon-olt_{$label}",
                ];
            }
        }

        return $ports;
    }

    protected function normalizePonPort(?string $portLabel): ?string
    {
        if (! $portLabel) {
            return null;
        }

        if (preg_match('/(?:gpon-(?:olt|onu)_)?(\d+\/\d+\/\d+)(?::\d+)?/i', $portLabel, $matches)) {
            return $matches[1];
        }

        return null;
    }

    protected function syncSnapshotToCustomers(Olt $olt, array &$snapshot): array
    {
        $customers = Customer::query()
            ->where(function ($query) {
                $query->whereNotNull('pppoe_user')
                    ->orWhereNotNull('onu_serial');
            })
            ->get([
                'id',
                'name',
                'pppoe_user',
                'olt_id',
                'olt_port_label',
                'onu_serial',
                'olt_status',
                'onu_rx_power_dbm',
                'fiber_distance_m',
                'olt_last_synced_at',
            ]);

        $customersByPppoe = $customers
            ->filter(fn (Customer $customer) => $this->normalizeIdentifier($customer->pppoe_user) !== null)
            ->keyBy(fn (Customer $customer) => $this->normalizeIdentifier($customer->pppoe_user));

        $customersBySerial = $customers
            ->filter(fn (Customer $customer) => $this->normalizeSerial($customer->onu_serial) !== null)
            ->keyBy(fn (Customer $customer) => $this->normalizeSerial($customer->onu_serial));

        $customersByOnuRef = $customers
            ->filter(fn (Customer $customer) => $this->normalizeOnuRefLabel($customer->olt_port_label) !== null)
            ->keyBy(fn (Customer $customer) => $this->normalizeOnuRefLabel($customer->olt_port_label));

        $matched = [];

        foreach ($snapshot['onus'] ?? [] as &$onu) {
            $pppoeName = $this->normalizeIdentifier($onu['onu_name'] ?? null);
            $serial = $this->normalizeSerial($onu['serial_number'] ?? null);
            $onuRef = $this->normalizeOnuRefLabel($onu['onu_ref'] ?? null);
            $matchMethod = null;

            if ($pppoeName && $customersByPppoe->has($pppoeName)) {
                /** @var Customer $customer */
                $customer = $customersByPppoe->get($pppoeName);
                $matchMethod = 'pppoe';
            } elseif ($serial && $customersBySerial->has($serial)) {
                /** @var Customer $customer */
                $customer = $customersBySerial->get($serial);
                $matchMethod = 'serial';
                $onu['onu_name'] = $onu['onu_name'] ?: $customer->pppoe_user;
            } elseif ($onuRef && $customersByOnuRef->has($onuRef)) {
                /** @var Customer $customer */
                $customer = $customersByOnuRef->get($onuRef);
                $matchMethod = 'onu_ref';
                $onu['onu_name'] = $onu['onu_name'] ?: $customer->pppoe_user;
            } else {
                continue;
            }

            $onu['onu_name'] = $onu['onu_name'] ?: ($customer->pppoe_user ?: $customer->name);

            $customer->forceFill([
                'olt_id' => $olt->id,
                'olt_port_label' => $onu['onu_ref'] ?? null,
                'onu_serial' => $onu['serial_number'] ?? $customer->onu_serial,
                'olt_status' => $onu['state'] ?? $customer->olt_status,
                'onu_rx_power_dbm' => $onu['rx_power_dbm'] ?? $customer->onu_rx_power_dbm,
                'fiber_distance_m' => $onu['distance_m'] ?? $customer->fiber_distance_m,
                'olt_last_synced_at' => now(),
            ]);

            $changed = $customer->isDirty([
                'olt_id',
                'olt_port_label',
                'onu_serial',
                'olt_status',
                'onu_rx_power_dbm',
                'fiber_distance_m',
            ]);

            if ($changed) {
                $customer->save();
            }

            $matched[] = [
                'customer_id' => $customer->id,
                'customer_name' => $customer->name,
                'pppoe_user' => $customer->pppoe_user,
                'onu_ref' => $onu['onu_ref'] ?? null,
                'rx_power_dbm' => $onu['rx_power_dbm'] ?? null,
                'distance_m' => $onu['distance_m'] ?? null,
                'changed' => $changed,
                'match_method' => $matchMethod,
            ];
        }
        unset($onu);

        return $matched;
    }

    protected function normalizeIdentifier(?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        $value = trim($value);
        if ($value === '' || $value === '-') {
            return null;
        }

        return mb_strtolower($value);
    }

    protected function normalizeOnuRefLabel(?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        $value = strtolower(trim($value));
        $value = preg_replace('/^gpon-onu_/i', '', $value) ?? $value;

        return preg_match('/^\d+\/\d+\/\d+:\d+$/', $value) ? $value : null;
    }

    protected function normalizeSerial(?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        $value = strtoupper(trim($value));
        if ($value === '' || $value === '-') {
            return null;
        }

        return $value;
    }

    protected function runOltOperation(Olt $olt, string $operation, ?string $onuRef, array $payload, callable $callback)
    {
        try {
            $result = $callback();

            OltOperationLog::create([
                'olt_id' => $olt->id,
                'user_id' => auth()->id(),
                'operation' => $operation,
                'onu_ref' => $onuRef,
                'status' => 'success',
                'payload' => $this->redactSensitivePayload($payload),
                'result' => $this->redactCommandOutputs($result),
            ]);

            return response()->json($result);
        } catch (Throwable $e) {
            OltOperationLog::create([
                'olt_id' => $olt->id,
                'user_id' => auth()->id(),
                'operation' => $operation,
                'onu_ref' => $onuRef,
                'status' => 'failed',
                'payload' => $this->redactSensitivePayload($payload),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    protected function redactSensitivePayload(array $payload): array
    {
        foreach (['password', 'secret', 'community'] as $key) {
            if (array_key_exists($key, $payload)) {
                $payload[$key] = '[redacted]';
            }
        }

        return $payload;
    }

    protected function redactCommandOutputs(array $result): array
    {
        if (isset($result['outputs']) && is_array($result['outputs'])) {
            $result['outputs'] = collect($result['outputs'])
                ->map(fn ($output) => is_string($output) ? str($output)->limit(1000)->toString() : $output)
                ->all();
        }

        if (isset($result['raw']) && is_array($result['raw'])) {
            $result['raw'] = collect($result['raw'])
                ->map(fn ($output) => is_string($output) ? str($output)->limit(1000)->toString() : $output)
                ->all();
        }

        return $result;
    }

    protected function oltService(Olt $olt): OltZteC300Service|OltHiosoService
    {
        return match ($olt->vendor ?? 'zte_c300') {
            'hioso' => app(OltHiosoService::class),
            default => app(OltZteC300Service::class),
        };
    }
}
