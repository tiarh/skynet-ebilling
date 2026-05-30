<?php

namespace App\Services;

use App\Models\Router;
use App\Models\Customer;
use RouterOS\Client;
use RouterOS\Config;
use RouterOS\Query;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class MikrotikService
{
    protected ?Client $client = null;
    protected ?Router $router = null;

    /**
     * Connect to a MikroTik router
     * 
     * @param Router $router
     * @param array $options Optional override for connection settings (timeout, attempts)
     */
    public function connect(Router $router, array $options = []): self
    {
        $this->router = $router;

        try {
            $timeout = $options['timeout'] ?? 10;
            // Force PHP socket timeout to respect our setting (fix for hanging connections)
            ini_set('default_socket_timeout', $timeout);

            $config = new Config([
                'host' => $router->ip_address,
                'user' => $router->username,
                'pass' => $router->password, // Auto-decrypted by Laravel's encrypted cast
                'port' => $router->port,
                'timeout' => $timeout, // Connection timeout
                'socket_timeout' => $timeout, // Read/write timeout (THIS WAS THE MISSING PIECE!)
                'attempts' => $options['attempts'] ?? 3,
            ]);

            $this->client = new Client($config);

            Log::info("Successfully connected to router: {$router->name}");
        } catch (\Exception $e) {
            Log::error("Failed to connect to router {$router->name}: {$e->getMessage()}");
            throw $e;
        }

        return $this;
    }

    public function isolateCustomerNow(Customer $customer, int $timeout = 10): void
    {
        if (!$customer->router || !$customer->pppoe_user) {
            throw new \InvalidArgumentException('Customer must have a router and PPPoE username.');
        }

        try {
            $this->connect($customer->router, ['timeout' => $timeout, 'attempts' => 1]);

            if (!$this->isolateUser($customer->pppoe_user)) {
                throw new \RuntimeException("PPPoE user '{$customer->pppoe_user}' not found on router '{$customer->router->name}'");
            }

            $customer->update([
                'status' => 'isolated',
                'mikrotik_profile' => $this->isolationProfileName(),
                'mikrotik_sync_status' => 'synced',
                'mikrotik_synced_at' => now(),
                'mikrotik_sync_checked_at' => now(),
            ]);

            activity()
                ->causedBy(auth()->user() ?? null)
                ->performedOn($customer)
                ->withProperties([
                    'router' => $customer->router->name,
                    'pppoe_user' => $customer->pppoe_user,
                    'mode' => 'realtime',
                ])
                ->log('customer_isolated');
        } finally {
            $this->disconnect();
        }
    }

    public function reconnectCustomerNow(Customer $customer, int $timeout = 10): void
    {
        if (!$customer->router || !$customer->pppoe_user) {
            throw new \InvalidArgumentException('Customer must have a router and PPPoE username.');
        }

        try {
            $this->connect($customer->router, ['timeout' => $timeout, 'attempts' => 1]);

            $fallbackProfile = $customer->package?->mikrotik_profile
                ?: $customer->mikrotik_profile
                ?: 'default';
            $restoredProfile = $this->reconnectProfileName($customer, $fallbackProfile);

            if (!$this->reconnectUser($customer->pppoe_user, $fallbackProfile)) {
                throw new \RuntimeException("PPPoE user '{$customer->pppoe_user}' not found on router '{$customer->router->name}'");
            }

            $customer->update([
                'status' => 'active',
                'mikrotik_profile' => $restoredProfile,
                'mikrotik_sync_status' => 'synced',
                'mikrotik_synced_at' => now(),
                'mikrotik_sync_checked_at' => now(),
            ]);

            activity()
                ->causedBy(auth()->user() ?? null)
                ->performedOn($customer)
                ->withProperties([
                    'router' => $customer->router->name,
                    'pppoe_user' => $customer->pppoe_user,
                    'mode' => 'realtime',
                ])
                ->log('customer_reconnected');
        } finally {
            $this->disconnect();
        }
    }

    /**
     * Get all PPPoE secrets from router
     */
    public function getPPPSecrets(): array
    {
        $this->ensureConnected();

        try {
            $query = (new Query('/ppp/secret/print'))
                ->equal('.proplist', 'name,profile,comment,disabled,service,remote-address');
            $response = $this->client->query($query)->read();

            Log::info("Retrieved " . count($response) . " PPP secrets from {$this->router->name}");

            return $response;
        } catch (\Exception $e) {
            Log::error("Failed to get PPP secrets from {$this->router->name}: {$e->getMessage()}");
            throw $e;
        }
    }
    
    /**
     * Get a specific PPPoE secret by username
     */
    public function getPPPSecret(string $username): ?array
    {
        $this->ensureConnected();

        try {
            return $this->findPPPSecret($username);
        } catch (\Exception $e) {
            Log::error("Failed to get PPP secret for {$username}: {$e->getMessage()}");
            throw $e;
        }
    }

    /**
     * Get all PPP profiles from router
     */
    public function getProfiles(): array
    {
        $this->ensureConnected();

        try {
            $query = (new Query('/ppp/profile/print'))
                ->equal('.proplist', 'name,rate-limit,local-address,remote-address,only-one');
            $response = $this->client->query($query)->read();

            Log::info("Retrieved " . count($response) . " PPP profiles from {$this->router->name}");

            return $response;
        } catch (\Exception $e) {
            Log::error("Failed to get PPP profiles from {$this->router->name}: {$e->getMessage()}");
            throw $e;
        }
    }

    /**
     * Create or update the PPP profile used for customer isolation.
     */
    public function ensureIsolationProfile(string $name, ?string $rateLimit = null, ?string $localAddress = null, ?string $remoteAddress = null): array
    {
        $this->ensureConnected();

        $name = trim($name);
        if ($name === '') {
            throw new \InvalidArgumentException('Isolation profile name is required.');
        }

        $originalLocalAddress = $this->normalizeOptionalValue($localAddress);
        $localAddress = $this->normalizeOptionalValue($localAddress);
        $remoteAddress = $this->normalizeOptionalValue($remoteAddress);
        $profileLocalAddress = $localAddress ? Str::before($localAddress, '/') : null;

        if ($localAddress && $remoteAddress && $this->shouldCreateAddressPool($localAddress, $remoteAddress)) {
            $range = $this->deriveAddressPoolRange($localAddress);

            if (! $range) {
                throw new \InvalidArgumentException('Unable to derive an IP pool range from the local address.');
            }

            $this->ensureAddressPool($remoteAddress, $range);
        }

        $query = (new Query('/ppp/profile/print'))
            ->where('name', $name);
        $profiles = $this->client->query($query)->read();
        $profile = $profiles[0] ?? null;

        $payload = [
            'name' => $name,
            'rate-limit' => $rateLimit,
            'local-address' => $profileLocalAddress,
            'remote-address' => $remoteAddress,
        ];

        $payload = array_filter(
            $payload,
            fn ($value) => $value !== null && trim((string) $value) !== ''
        );

        if ($profile && isset($profile['.id'])) {
            $setQuery = (new Query('/ppp/profile/set'))
                ->equal('.id', $profile['.id']);

            foreach ($payload as $key => $value) {
                $setQuery->equal($key, (string) $value);
            }

            $response = $this->client->query($setQuery)->read();
            Log::info("Updated isolation profile {$name} on {$this->router->name}", [
                'payload' => $payload,
                'response' => $response,
            ]);
            return $this->verifiedIsolationProfileResult($name, false, $originalLocalAddress, $remoteAddress);
        }

        $addQuery = new Query('/ppp/profile/add');

        foreach ($payload as $key => $value) {
            $addQuery->equal($key, (string) $value);
        }

        $response = $this->client->query($addQuery)->read();
        Log::info("Created isolation profile {$name} on {$this->router->name}", [
            'payload' => $payload,
            'response' => $response,
        ]);
        return $this->verifiedIsolationProfileResult($name, true, $originalLocalAddress, $remoteAddress);
    }

    public function deleteIsolationProfile(string $name): array
    {
        $this->ensureConnected();

        $name = trim($name);
        if ($name === '') {
            throw new \InvalidArgumentException('Isolation profile name is required.');
        }

        $query = (new Query('/ppp/profile/print'))
            ->where('name', $name);
        $profiles = $this->client->query($query)->read();
        $profile = $profiles[0] ?? null;

        if (! $profile || ! isset($profile['.id'])) {
            return ['deleted' => false, 'name' => $name];
        }

        $removeQuery = (new Query('/ppp/profile/remove'))
            ->equal('.id', $profile['.id']);
        $this->client->query($removeQuery)->read();

        Log::info("Deleted isolation profile {$name} on {$this->router->name}");

        return ['deleted' => true, 'name' => $name];
    }

    /**
     * Get active PPPoE connections
     */
    public function getActiveConnections(): array
    {
        $this->ensureConnected();

        try {
            $query = (new Query('/ppp/active/print'))
                ->equal('.proplist', 'name,address,uptime,encoding,caller-id,service');
            $response = $this->client->query($query)->read();

            Log::info("Retrieved " . count($response) . " active PPP connections from {$this->router->name}");

            return $response;
        } catch (\Exception $e) {
            Log::error("Failed to get active connections from {$this->router->name}: {$e->getMessage()}");
            throw $e;
        }
    }

    /**
     * Isolate a user (block internet access)
     * Method: Change PPPoE profile to 'isolirebilling' (case-insensitive)
     */
    public function isolateUser(string $username): bool
    {
        $this->ensureConnected();
        $isolationProfile = $this->isolationProfileName();

        try {
            // Get all available profiles to find case-insensitive match
            $matchedProfile = $this->matchProfileName($isolationProfile);
            
            if (!$matchedProfile) {
                throw new \Exception("Isolation profile '{$isolationProfile}' not found on router {$this->router->name}");
            }

            // Find the PPP secret
            $secret = $this->findPPPSecret($username);

            if (!$secret) {
                Log::warning("PPP secret not found for user: {$username} on {$this->router->name}");
                return false;
            }

            $currentProfile = $secret['profile'] ?? 'default';

            // Save previous profile if not already isolated
            if (strcasecmp($currentProfile, $isolationProfile) !== 0) {
                $customer = Customer::ebilling()->where('pppoe_user', $username)->first();
                if ($customer) {
                    $customer->update(['previous_profile' => $currentProfile]);
                }
            }

            // Change profile to isolation profile (using the exact case from router)
            $this->setPPPSecretProfile($secret, $matchedProfile);

            // Kick active session if any
            $this->kickUser($username);

            Log::info("Successfully isolated user: {$username} on {$this->router->name} (Profile: {$matchedProfile})");

            return true;
        } catch (\Exception $e) {
            Log::error("Failed to isolate user {$username} on {$this->router->name}: {$e->getMessage()}");
            throw $e;
        }
    }

    /**
     * Reconnect a user (restore internet access)
     * Method: Change PPPoE profile back to saved previous profile
     */
    public function reconnectUser(string $username, string $profile = 'default'): bool
    {
        $this->ensureConnected();

        try {
            // Find the PPP secret
            $secret = $this->findPPPSecret($username);

            if (!$secret) {
                Log::warning("PPP secret not found for user: {$username} on {$this->router->name}");
                return false;
            }

            $customer = Customer::ebilling()->with('package')->where('pppoe_user', $username)->first();
            $targetProfile = $customer
                ? $this->reconnectProfileName($customer, $profile)
                : $profile;

            if ($customer && !empty($customer->previous_profile)) {
                Log::info("Restoring {$username} to previous profile: {$targetProfile}");
            }

            // Restore profile
            $this->setPPPSecretProfile($secret, $targetProfile);

            if ($customer && !empty($customer->previous_profile)) {
                $customer->update(['previous_profile' => null]);
            }

            // Kick active session to force new profile
            $this->kickUser($username);

            Log::info("Successfully reconnected user: {$username} on {$this->router->name} to {$targetProfile}");

            return true;
        } catch (\Exception $e) {
            Log::error("Failed to reconnect user {$username} on {$this->router->name}: {$e->getMessage()}");
            throw $e;
        }
    }

    /**
     * Kick an active PPPoE session
     */
    public function kickUser(string $username): void
    {
        try {
            $query = (new Query('/ppp/active/print'))
                ->where('name', $username);
            
            $active = $this->client->query($query)->read();

            if (!empty($active)) {
                $session = $active[0];
                
                $query = (new Query('/ppp/active/remove'))
                    ->equal('.id', $session['.id']);

                $this->client->query($query)->read();

                Log::info("Kicked active session for user: {$username} on {$this->router->name}");
            }
        } catch (\Exception $e) {
            Log::warning("Could not kick user {$username}: {$e->getMessage()}");
        }
    }

    protected function ensureConnected(): void
    {
        if (!$this->client) {
            throw new \Exception('Not connected to router. Call connect() first.');
        }
    }

    protected function isolationProfileName(): string
    {
        $configuredProfile = trim((string) ($this->router?->isolation_profile ?? ''));

        return $configuredProfile !== '' ? $configuredProfile : 'isolirebilling';
    }

    protected function reconnectProfileName(Customer $customer, string $fallbackProfile = 'default'): string
    {
        return $customer->previous_profile
            ?: $customer->package?->mikrotik_profile
            ?: $customer->mikrotik_profile
            ?: $fallbackProfile;
    }

    protected function matchProfileName(string $profileName): ?string
    {
        foreach ($this->getProfiles() as $profile) {
            if (isset($profile['name']) && strcasecmp($profile['name'], $profileName) === 0) {
                return $profile['name'];
            }
        }

        return null;
    }

    protected function findPPPSecret(string $username): ?array
    {
        $query = (new Query('/ppp/secret/print'))
            ->where('name', $username);

        $secrets = $this->client->query($query)->read();

        return $secrets[0] ?? null;
    }

    protected function setPPPSecretProfile(array $secret, string $profile): void
    {
        $query = (new Query('/ppp/secret/set'))
            ->equal('.id', $secret['.id'])
            ->equal('profile', $profile);

        $this->client->query($query)->read();
    }

    protected function normalizeOptionalValue(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    protected function shouldCreateAddressPool(string $localAddress, string $remoteAddress): bool
    {
        if (! filter_var(Str::before($localAddress, '/'), FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            return false;
        }

        if (filter_var($remoteAddress, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            return false;
        }

        return ! str_contains($remoteAddress, '-')
            && ! str_contains($remoteAddress, ',')
            && ! str_contains($remoteAddress, '/');
    }

    protected function deriveAddressPoolRange(string $localAddress): ?string
    {
        [$ip, $prefix] = array_pad(explode('/', $localAddress, 2), 2, null);
        $prefix = $prefix !== null ? (int) $prefix : 24;

        if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) || $prefix < 1 || $prefix > 30) {
            return null;
        }

        $ipLong = ip2long($ip);
        if ($ipLong === false) {
            return null;
        }

        $mask = (-1 << (32 - $prefix)) & 0xFFFFFFFF;
        $network = $ipLong & $mask;
        $broadcast = $network | (~$mask & 0xFFFFFFFF);
        $firstHost = $network + 1;
        $lastHost = $broadcast - 1;

        if ($firstHost > $lastHost) {
            return null;
        }

        $ranges = [];
        if ($ipLong > $firstHost) {
            $ranges[] = long2ip($firstHost) . '-' . long2ip($ipLong - 1);
        }
        if ($ipLong < $lastHost) {
            $ranges[] = long2ip($ipLong + 1) . '-' . long2ip($lastHost);
        }

        return empty($ranges) ? null : implode(',', $ranges);
    }

    protected function ensureAddressPool(string $poolName, string $range): void
    {
        $existingQuery = (new Query('/ip/pool/print'))
            ->where('name', $poolName);
        $pools = $this->client->query($existingQuery)->read();

        if (! empty($pools)) {
            return;
        }

        $addQuery = (new Query('/ip/pool/add'))
            ->equal('name', $poolName)
            ->equal('ranges', $range);

        $response = $this->client->query($addQuery)->read();
        Log::info("Created address pool {$poolName} ({$range}) on {$this->router->name}", [
            'response' => $response,
        ]);
    }

    protected function verifiedIsolationProfileResult(string $name, bool $created, ?string $requestedLocalAddress = null, ?string $requestedRemoteAddress = null): array
    {
        $profile = $this->findProfileByName($name);

        if (! $profile) {
            Log::warning("Isolation profile readback failed on {$this->router->name}", [
                'profile' => $name,
                'available_profiles' => array_map(
                    fn (array $item) => $item['name'] ?? null,
                    $this->getProfiles()
                ),
            ]);
            throw new \RuntimeException("MikroTik did not return the isolation profile '{$name}' after save.");
        }

        if ($requestedRemoteAddress && $this->shouldVerifyAddressPool($requestedRemoteAddress)) {
            $pool = $this->findAddressPoolByName($requestedRemoteAddress);

            if (! $pool) {
                throw new \RuntimeException("MikroTik did not return the address pool '{$requestedRemoteAddress}' after save.");
            }
        }

        return [
            'created' => $created,
            'name' => $profile['name'] ?? $name,
            'rate_limit' => $profile['rate-limit'] ?? null,
            'local_address' => $profile['local-address'] ?? ($requestedLocalAddress ? Str::before($requestedLocalAddress, '/') : null),
            'remote_address' => $profile['remote-address'] ?? $requestedRemoteAddress,
            'only_one' => $profile['only-one'] ?? 'yes',
        ];
    }

    protected function shouldVerifyAddressPool(string $remoteAddress): bool
    {
        return ! filter_var($remoteAddress, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)
            && ! str_contains($remoteAddress, '-')
            && ! str_contains($remoteAddress, ',')
            && ! str_contains($remoteAddress, '/');
    }

    protected function findProfileByName(string $name): ?array
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $query = (new Query('/ppp/profile/print'))
                ->where('name', $name);
            $profiles = $this->client->query($query)->read();

            foreach ($profiles as $profile) {
                if (isset($profile['name']) && strcasecmp((string) $profile['name'], $name) === 0) {
                    return $profile;
                }
            }

            foreach ($this->getProfiles() as $profile) {
                if (isset($profile['name']) && strcasecmp((string) $profile['name'], $name) === 0) {
                    return $profile;
                }
            }

            usleep(200000);
        }

        return null;
    }

    protected function findAddressPoolByName(string $name): ?array
    {
        $query = (new Query('/ip/pool/print'))
            ->where('name', $name);
        $pools = $this->client->query($query)->read();

        return $pools[0] ?? null;
    }

    /**
     * Test connection to router
     */
    public function testConnection(): array
    {
        if (!$this->client) {
            throw new \Exception('Not connected to router. Call connect() first.');
        }

        try {
            $query = new Query('/system/resource/print');
            $response = $this->client->query($query)->read();

            return [
                'success' => true,
                'router' => $this->router->name,
                'data' => $response[0] ?? []
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'router' => $this->router->name,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Get router health statistics (CPU, Uptime, Online Count)
     */
    public function getHealthStats(): array
    {
        if (!$this->client) {
            throw new \Exception('Not connected to router. Call connect() first.');
        }

        try {
            // Get System Resources
            $resourceQuery = new Query('/system/resource/print');
            $resource = $this->client->query($resourceQuery)->read();
            $system = $resource[0] ?? [];

            // Get Online Count
            $activeQuery = new Query('/ppp/active/print');
            $active = $this->client->query($activeQuery)->read();
            $onlineCount = count($active);

            // Get Total PPPoE Secrets Count - REMOVED to prevent DoS (Update via network:monitor is too frequent)
            // This is now handled by network:scan hourly
            $totalPppoeCount = null;

            return [
                'cpu_load' => isset($system['cpu-load']) ? (int)$system['cpu-load'] : null,
                'uptime' => $system['uptime'] ?? null,
                'version' => $system['version'] ?? null,
                'board_name' => $system['board-name'] ?? null,
                'free_memory' => isset($system['free-memory']) ? (int)$system['free-memory'] : null,
                'total_memory' => isset($system['total-memory']) ? (int)$system['total-memory'] : null,
                'online_count' => $onlineCount,
                'total_pppoe_count' => $totalPppoeCount,
            ];
        } catch (\Exception $e) {
            Log::error("Failed to get health stats for {$this->router->name}: {$e->getMessage()}");
            throw $e;
        }
    }

    /**
     * Sync Customer 'is_online' status based on active connections
     */
    public function syncCustomerOnlineStatus(array $activeConnections): void
    {
        if (!$this->router) {
            return;
        }

        $activeUsernames = array_column($activeConnections, 'name');

        if (!empty($activeUsernames)) {
            // 1. Set is_online = true for active users
            \App\Models\Customer::where('router_id', $this->router->id)
                ->ebilling()
                ->whereIn('pppoe_user', $activeUsernames)
                ->update(['is_online' => true]);

            // 2. Set is_online = false for inactive users
            \App\Models\Customer::where('router_id', $this->router->id)
                ->ebilling()
                ->whereNotIn('pppoe_user', $activeUsernames)
                ->update(['is_online' => false]);
        } else {
            // No active users -> Set all on this router to offline
            \App\Models\Customer::where('router_id', $this->router->id)
                ->ebilling()
                ->update(['is_online' => false]);
        }
        
        Log::info("Synced online status for Router: {$this->router->name} (" . count($activeUsernames) . " active)");
    }

    /**
     * Get the RouterOS client instance
     */
    public function getClient(): ?Client
    {
        return $this->client;
    }

    /**
     * Disconnect from router
     */
    public function disconnect(): void
    {
        if ($this->client) {
            $this->client = null;
            Log::info("Disconnected from router: {$this->router->name}");
        }
    }
}
