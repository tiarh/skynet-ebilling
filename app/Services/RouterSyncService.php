<?php

namespace App\Services;

use App\Models\Router;
use App\Models\Customer;
use App\Models\RouterStagedCustomer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class RouterSyncService
{
    protected MikrotikService $mikrotik;

    public function __construct(MikrotikService $mikrotik)
    {
        $this->mikrotik = $mikrotik;
    }

    /**
     * Sync Router Health (Status, CPU, Active Users)
     */
    public function syncHealthStatus(Router $router, int $timeout = 8): array
    {
        try {
            $this->mikrotik->connect($router, ['timeout' => $timeout, 'attempts' => 1]);
            
            // 1. Fetch System Resources (Fast)
            $resourceQuery = new \RouterOS\Query('/system/resource/print');
            $resource = $this->mikrotik->getClient()->query($resourceQuery)->read();
            $system = $resource[0] ?? [];

            // 2. Fetch Active Connections (Heavy - do only once)
            $activeConnections = $this->mikrotik->getActiveConnections();
            $onlineCount = count($activeConnections);

            // 3. Sync Customer Status
            $this->mikrotik->syncCustomerOnlineStatus($activeConnections);

            // 4. Update Router Stats in DB
            $router->update([
                'connection_status' => 'online',
                'current_online_count' => $onlineCount,
                'cpu_load' => isset($system['cpu-load']) ? (int)$system['cpu-load'] : null,
                'uptime' => $system['uptime'] ?? null,
                'version' => $system['version'] ?? null,
                'board_name' => $system['board-name'] ?? null,
                'last_health_check_at' => now(),
            ]);

            $this->mikrotik->disconnect();

            return [
                'success' => true,
                'online_count' => $onlineCount,
                'message' => "Connected! Synced {$onlineCount} active users."
            ];

        } catch (\Exception $e) {
             // Update health check timestamp and connection status on failure
             $router->update([
                'connection_status' => 'offline',
                'last_health_check_at' => now(),
           ]);

           return [
               'success' => false,
               'error' => $e->getMessage(),
               'message' => "Connection error: {$e->getMessage()}"
           ];
        }
    }

    /**
     * Scan and Map Customers
     */
    public function syncCustomers(Router $router, bool $dryRun = false, int $timeout = 45): array
    {
        $stats = $this->initialScanStats();

        try {
            $this->mikrotik->connect($router, ['timeout' => $timeout, 'attempts' => 1]);

            $this->syncProfilesToDatabase($router);
            
            $secrets = $this->mikrotik->getPPPSecrets();
            $stats = $this->syncSecretsToEbillingCustomers($router, $secrets, $stats, $dryRun);
            
            // Update scan results
            if (!$dryRun) {
                $router->update([
                    'connection_status' => 'online',
                    'last_scanned_at' => now(),
                    'last_scan_customers_count' => $stats['mapped'],
                ]);
            }

            $this->mikrotik->disconnect();

        } catch (\Exception $e) {
            if (!$dryRun) {
                $router->update(['connection_status' => 'offline']);
            }
            throw $e; // Re-throw to let caller handle critical failure
        }

        return $stats;
    }

    /**
     * Full Sync: Health + Customers + Status (One Connection)
     */

    public function fullSync(Router $router, int $timeout = 45): array
    {
        $connected = false;

        try {
            $this->mikrotik->connect($router, ['timeout' => $timeout, 'attempts' => 1]);
            $connected = true;

            $result = [
                'health' => [],
                'scan' => [],
                'success' => true
            ];

            // 0. Smart Auto-Configuration (Detection)
            if (empty($router->isolation_profile)) {
                $this->detectAndSetIsolationProfile($router);
            }

            // 0.5. Sync Profiles to Database (for package creation UI)
            $this->syncProfilesToDatabase($router);

            // 1. Health Stats & Online Status
            $resourceQuery = new \RouterOS\Query('/system/resource/print');
            $resource = $this->mikrotik->getClient()->query($resourceQuery)->read();
            $system = $resource[0] ?? [];

            $activeConnections = $this->mikrotik->getActiveConnections();
            $onlineCount = count($activeConnections);
            $this->mikrotik->syncCustomerOnlineStatus($activeConnections);

            // 2. eBilling-first customer scan: link existing customers only.
            $scanStats = $this->initialScanStats();
            $secrets = $this->mikrotik->getPPPSecrets();
            $scanStats = $this->syncSecretsToEbillingCustomers($router, $secrets, $scanStats, false, $activeConnections);
            $result['scan'] = $scanStats;

            // 3. Update Router Stats
            $router->update([
                'connection_status' => 'online',
                'current_online_count' => $onlineCount,
                'cpu_load' => isset($system['cpu-load']) ? (int)$system['cpu-load'] : null,
                'uptime' => $system['uptime'] ?? null,
                'version' => $system['version'] ?? null,
                'board_name' => $system['board-name'] ?? null,
                'last_health_check_at' => now(),
                'last_scanned_at' => now(), // Also update scan timestamp
                'last_scan_customers_count' => $scanStats['mapped'],
            ]);

            return $result;

        } catch (\Exception $e) {
            $router->update(['connection_status' => 'offline']);
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        } finally {
            if ($connected) {
                $this->mikrotik->disconnect();
            }
        }
    }

    /**
     * Auto-detect and configure isolation profile if missing
     */
    protected function detectAndSetIsolationProfile(Router $router): void
    {
        try {
            $profiles = $this->mikrotik->getProfiles();
            $commonNames = ['isolirebilling', 'isolir', 'isolated', 'nonpayment', 'block', 'suspend', 'expired'];
            
            foreach ($profiles as $profile) {
                $profileName = $profile['name'] ?? '';
                if (in_array(strtolower($profileName), $commonNames)) {
                    $router->update(['isolation_profile' => $profileName]);
                    Log::info("Auto-configured isolation profile for {$router->name}: {$profileName}");
                    break;
                }
            }
        } catch (\Exception $e) {
            Log::warning("Failed to auto-detect isolation profile for {$router->name}: " . $e->getMessage());
        }
    }

    /**
     * Sync router profiles to database for UI usage
     */
    protected function syncProfilesToDatabase(Router $router): void
    {
        try {
            $profiles = $this->mikrotik->getProfiles();
            
            foreach ($profiles as $profile) {
                $name = $profile['name'] ?? '';
                
                // Skip system/isolation profiles
                if (in_array(strtolower($name), ['default', 'default-encryption'])) {
                    continue;
                }
                if (stripos($name, 'isolir') !== false || stripos($name, 'speedtest') !== false) {
                    continue;
                }

                $rateLimit = $profile['rate-limit'] ?? null;
                $bandwidth = $this->extractBandwidth($rateLimit);

                \App\Models\RouterProfile::updateOrCreate(
                    [
                        'router_id' => $router->id,
                        'name' => $name,
                    ],
                    [
                        'rate_limit' => $rateLimit,
                        'bandwidth' => $bandwidth,
                        'local_address' => $profile['local-address'] ?? null,
                        'remote_address' => $profile['remote-address'] ?? null,
                        'only_one' => $profile['only-one'] ?? null,
                    ]
                );
            }

            Log::info("Synced profiles to database for {$router->name}");
        } catch (\Exception $e) {
            Log::warning("Failed to sync profiles for {$router->name}: " . $e->getMessage());
        }
    }

    /**
     * Extract bandwidth from Mikrotik rate limit string
     */
    protected function extractBandwidth(?string $rateLimit): ?string
    {
        if (!$rateLimit) return null;
        
        // Parse: "2560k/15M 5120k/20M ..." → Extract "20M"
        $parts = explode(' ', $rateLimit);
        if (count($parts) >= 2) {
            $maxSpeed = $parts[1]; // e.g., "5120k/20M"
            $segments = explode('/', $maxSpeed);
            if (count($segments) >= 2) {
                return $segments[1]; // "20M"
            }
        }
        
        return null;
    }

    protected function initialScanStats(): array
    {
        return [
            'total_secrets' => 0,
            'mapped' => 0,
            'not_found_ebilling' => 0,
            'unmatched_mikrotik' => 0,
            'orphaned' => 0,
            'staged_router_only' => 0,
            'staged_matched' => 0,
            'staged_gone' => 0,
            'synced_package' => 0,
            'synced_status' => 0,
            'errors' => [],
        ];
    }

    protected function syncSecretsToEbillingCustomers(
        Router $router,
        array $secrets,
        array $stats,
        bool $dryRun = false,
        array $activeConnections = []
    ): array {
        $stats['total_secrets'] = count($secrets);
        $secretUsernames = $this->secretUsernames($secrets);
        $activeUsernames = array_flip($this->secretUsernames($activeConnections));
        $customersByPppoe = $this->ebillingCustomersByPppoe();
        $syncRows = [];

        foreach ($secrets as $secret) {
            $pppoeUsername = $secret['name'] ?? null;
            if (!$pppoeUsername) {
                continue;
            }

            $customer = $customersByPppoe[$pppoeUsername] ?? null;

            if (!$customer) {
                $stats['unmatched_mikrotik']++;
                if (!$dryRun) {
                    $this->stageRouterOnlySecret($router, $secret);
                    $stats['staged_router_only']++;
                }
                continue;
            }

            if (!$dryRun) {
                $isOnline = array_key_exists($pppoeUsername, $activeUsernames) ? true : null;
                $syncRows[] = $this->customerSyncRow($router, $customer, $secret, $stats, $isOnline);
                if ($this->markStagedSecretMatched($router, $pppoeUsername, $customer)) {
                    $stats['staged_matched']++;
                }
            }
            $stats['mapped']++;
        }

        if (!$dryRun && !empty($syncRows)) {
            $this->updateCustomerSyncRows($syncRows);
        }

        if (!$dryRun) {
            $stats['staged_gone'] = $this->markStagedSecretsGone($router, $secretUsernames);
        }

        $stats['not_found_ebilling'] = $this->markAssignedEbillingCustomersMissingFromRouter($router, $secretUsernames, $dryRun);
        $stats['orphaned'] = $stats['unmatched_mikrotik'];

        Log::info("Completed full customer sync for {$router->name}", [
            'total_secrets' => $stats['total_secrets'],
            'mapped' => $stats['mapped'],
            'unmatched_mikrotik' => $stats['unmatched_mikrotik'],
            'not_found_ebilling' => $stats['not_found_ebilling'],
            'staged_router_only' => $stats['staged_router_only'],
            'staged_gone' => $stats['staged_gone'],
            'synced_status' => $stats['synced_status'],
        ]);

        return $stats;
    }

    protected function stageRouterOnlySecret(Router $router, array $secret): void
    {
        $username = (string) ($secret['name'] ?? '');
        if ($username === '') {
            return;
        }

        $now = now();

        $staged = RouterStagedCustomer::firstOrNew([
            'router_id' => $router->id,
            'pppoe_user' => $username,
        ]);

        if (!$staged->exists) {
            $staged->first_seen_at = $now;
        }

        $payload = $secret;
        unset($payload['password']);

        $staged->fill([
            'matched_customer_id' => null,
            'profile' => $secret['profile'] ?? null,
            'comment' => $secret['comment'] ?? null,
            'disabled' => filter_var($secret['disabled'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'status' => 'unmatched',
            'raw_payload' => $payload,
            'last_seen_at' => $now,
        ])->save();
    }

    protected function markStagedSecretMatched(Router $router, string $username, Customer $customer): bool
    {
        return RouterStagedCustomer::where('router_id', $router->id)
            ->where('pppoe_user', $username)
            ->where('status', '!=', 'matched')
            ->update([
                'matched_customer_id' => $customer->id,
                'status' => 'matched',
                'last_seen_at' => now(),
            ]) > 0;
    }

    protected function markStagedSecretsGone(Router $router, array $secretUsernames): int
    {
        $query = RouterStagedCustomer::where('router_id', $router->id)
            ->where('status', 'unmatched');

        if (!empty($secretUsernames)) {
            $query->whereNotIn('pppoe_user', $secretUsernames);
        }

        return $query->update(['status' => 'gone']);
    }

    protected function secretUsernames(array $secrets): array
    {
        return collect($secrets)
            ->pluck('name')
            ->filter(fn ($username) => is_string($username) && $username !== '')
            ->unique()
            ->values()
            ->all();
    }

    protected function ebillingCustomersByPppoe(): array
    {
        return Customer::ebilling()
            ->whereNotNull('pppoe_user')
            ->where('pppoe_user', '!=', '')
            ->get()
            ->keyBy('pppoe_user')
            ->all();
    }

    protected function markAssignedEbillingCustomersMissingFromRouter(Router $router, array $secretUsernames, bool $dryRun = false): int
    {
        $query = Customer::ebilling()
            ->where('router_id', $router->id)
            ->whereNotNull('pppoe_user')
            ->where('pppoe_user', '!=', '');

        if (!empty($secretUsernames)) {
            $query->whereNotIn('pppoe_user', $secretUsernames);
        }

        $count = (clone $query)->count();

        if (! $dryRun && $count > 0) {
            $query->update([
                'mikrotik_sync_status' => 'missing',
                'mikrotik_synced_at' => null,
                'mikrotik_sync_checked_at' => now(),
            ]);
        }

        return $count;
    }

    protected function customerSyncRow(Router $router, Customer $customer, array $secret, array &$stats, ?bool $isOnline = null): array
    {
        $profileName = $secret['profile'] ?? null;
        $now = now();
        $row = [
            'id' => $customer->id,
            'router_id' => $router->id,
            'mikrotik_profile' => $profileName,
            'mikrotik_sync_status' => 'synced',
            'mikrotik_synced_at' => $now,
            'mikrotik_sync_checked_at' => $now,
            'is_online' => $isOnline ?? $customer->is_online,
            'status' => $customer->status,
            'updated_at' => $now,
        ];

        // Auto-Sync Status (Isolation Logic)
        if ($router->isolation_profile) {
            if ($profileName === $router->isolation_profile) {
                if ($customer->status !== 'isolated') {
                    $row['status'] = 'isolated';
                    $stats['synced_status']++;
                }
            } else {
                if ($customer->status === 'isolated') {
                    $row['status'] = 'active';
                    $stats['synced_status']++;
                }
            }
        }

        return $row;
    }

    protected function updateCustomerSyncRows(array $rows): void
    {
        DB::transaction(function () use ($rows) {
            foreach ($rows as $row) {
                $id = $row['id'];
                unset($row['id']);

                Customer::whereKey($id)->update($row);
            }
        });
    }
}
