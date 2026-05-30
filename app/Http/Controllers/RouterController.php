<?php

namespace App\Http\Controllers;

use App\Http\Requests\RouterStoreRequest;
use App\Http\Requests\RouterUpdateRequest;
use App\Http\Requests\RouterVpnUpdateRequest;
use App\Jobs\SyncRouterJob;
use App\Models\RouterProfile;
use App\Services\MikrotikService;
use App\Services\RadiusUserService;
use App\Services\WireGuardProvisioningService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

use App\Models\Router;
use Inertia\Inertia;

class RouterController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Router::query()->withCount('customers');

        // Search
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%");
            });
        }

        // Filter by status
        if ($request->filled('status')) {
            $isActive = $request->input('status') === 'active';
            $query->where('is_active', $isActive);
        }

        // Sorting
        $sortField = $request->input('sort', 'name');
        $sortDirection = $request->input('direction', 'asc');
        $query->orderBy($sortField, $sortDirection);

        // Paginate
        $limit = $request->input('limit', 25);
        $routers = $query->paginate($limit)->withQueryString();

        return Inertia::render('Routers/Index', [
            'routers' => $routers,
            'filters' => $request->only(['search', 'status', 'sort', 'direction', 'limit']),
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return Inertia::render('Routers/Create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(RouterStoreRequest $request)
    {
        $validated = $request->validated();

        Router::create($validated);

        return redirect()->route('routers.index')
            ->with('success', 'Router added successfully.');
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, Router $router)
    {
        $router->load(['profiles']);
        $router->loadCount([
            'customers',
            'stagedCustomers as staged_unmatched_customers_count' => fn ($query) => $query->where('status', 'unmatched'),
        ]);
        // Customers will be loaded lazily via API
        
        return Inertia::render('Routers/Show', [
            'router' => $router,
            'vpn' => [
                'mikrotik_script' => app(WireGuardProvisioningService::class)->mikrotikScript($router),
                'server_peer_config' => app(WireGuardProvisioningService::class)->serverPeerConfig($router),
                'radius_tables_ready' => app(RadiusUserService::class)->tablesReady(),
                'defaults' => app(WireGuardProvisioningService::class)->defaults($request),
            ],
        ]);
    }

    /**
     * Get paginated customers for this router (API)
     */
    public function customers(Request $request, Router $router)
    {
        $query = $router->customers()->ebilling()->with('package');

        // Search functionality
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('pppoe_user', 'like', "%{$search}%");
            });
        }

        // Filter by status
        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }

        $customers = $query->latest()->paginate(20);

        return response()->json($customers);
    }

    /**
     * Get list of PPP profiles from this router (API)
     */
    public function getProfiles(Router $router)
    {
        // Read from database (synced via routers:sync-profiles command)
        $profiles = \App\Models\RouterProfile::where('router_id', $router->id)
            ->get()
            ->map(function ($profile) {
                return [
                    'name' => $profile->name,
                    'rate_limit' => $profile->rate_limit,
                    'bandwidth' => $profile->bandwidth,
                    'local_address' => $profile->local_address,
                    'remote_address' => $profile->remote_address,
                ];
            });

        return response()->json($profiles);
    }

    /**
     * Get live router stats for the router detail page.
     */
    public function liveStats(Router $router)
    {
        $cacheKey = "router:{$router->id}:live-stats";

        try {
            $payload = \Cache::remember($cacheKey, now()->addSeconds(60), function () use ($router) {
                $mikrotik = new \App\Services\MikrotikService();
                $mikrotik->connect($router, ['timeout' => 5, 'attempts' => 1]);

                try {
                    $resourceQuery = new \RouterOS\Query('/system/resource/print');
                    $resource = $mikrotik->getClient()->query($resourceQuery)->read();
                    $activeConnections = $mikrotik->getActiveConnections();

                    return [
                        'data' => [
                            'active_connections' => $activeConnections,
                            'total_online' => count($activeConnections),
                            'system_info' => $resource[0] ?? [],
                        ],
                        'last_updated' => now()->toISOString(),
                    ];
                } finally {
                    $mikrotik->disconnect();
                }
            });

            return response()->json($payload + ['cached' => true]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Router $router)
    {
        return Inertia::render('Routers/Edit', [
            'router' => $router,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(RouterUpdateRequest $request, Router $router)
    {
        $validated = $request->validated();

        // Only update password if provided
        if (empty($validated['password'])) {
            unset($validated['password']);
        }

        $router->update($validated);

        return redirect()->route('routers.index')
            ->with('success', 'Router updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Router $router)
    {
        // Prevent deletion if router has customers
        if ($router->customers()->ebilling()->count() > 0) {
            return back()->with('error', 'Cannot delete router with assigned customers.');
        }

        $router->delete();

        return redirect()->route('routers.index')
            ->with('success', 'Router deleted successfully.');
    }

    /**
     * Test connection to router
     */
    public function testConnection(Router $router)
    {
        $syncService = app(\App\Services\RouterSyncService::class);
        $result = $syncService->syncHealthStatus($router);

        if ($result['success']) {
            return back()->with('success', $result['message']);
        } else {
            return back()->with('error', $result['message']);
        }
    }

    public function syncOnlineStatus(Router $router)
    {
        return $this->testConnection($router);
    }

    public function updateVpn(
        RouterVpnUpdateRequest $request,
        Router $router,
        WireGuardProvisioningService $wireGuard,
        RadiusUserService $radius
    ) {
        $validated = $request->validated();
        $generateKeys = (bool) ($validated['generate_client_keys'] ?? false);
        unset($validated['generate_client_keys']);

        $validated = array_merge(
            $wireGuard->defaults($request),
            array_filter($validated, fn ($value) => $value !== null && $value !== '')
        );

        $validated['vpn_enabled'] = (bool) ($validated['vpn_enabled'] ?? true);
        $validated['radius_enabled'] = (bool) ($validated['radius_enabled'] ?? true);
        $validated['radius_secret'] = $validated['radius_secret'] ?? $router->radius_secret ?? Str::password(32, symbols: false);

        if ($generateKeys || ! $router->vpn_client_private_key || ! $router->vpn_client_public_key || ! $router->vpn_preshared_key) {
            $keys = $wireGuard->generateClientKeySet();
            $validated['vpn_client_private_key'] = $keys['private_key'];
            $validated['vpn_client_public_key'] = $keys['public_key'];
            $validated['vpn_preshared_key'] = $keys['preshared_key'];
        }

        $router->update($validated);
        $router = $router->fresh();
        $radius->upsertNas($router);
        $radiusResult = $router->radius_enabled && $radius->tablesReady()
            ? $radius->syncRouter($router)
            : null;
        $wireGuardResult = $wireGuard->applyPeer($router);

        $message = "{$router->name}: VPN and RADIUS settings saved.";
        if ($radiusResult) {
            $message .= " RADIUS users synced: {$radiusResult['synced']}/{$radiusResult['total']}.";
        }
        if (! $wireGuardResult['applied']) {
            $message .= " WireGuard peer config is ready to copy.";
        }

        return back()->with('success', $message);
    }

    public function syncRadius(Router $router, RadiusUserService $radius)
    {
        if (! $radius->tablesReady()) {
            return back()->with('error', 'FreeRADIUS tables are not ready. Run migrations or import the FreeRADIUS SQL schema first.');
        }

        if (! $router->radius_enabled) {
            return back()->with('error', 'Enable RADIUS on this router before syncing customers.');
        }

        $radius->upsertNas($router);
        $result = $radius->syncRouter($router);

        return back()->with('success', "RADIUS sync finished: {$result['synced']}/{$result['total']} users synced.");
    }

    public function storeIsolationProfile(Request $request, Router $router, MikrotikService $mikrotik)
    {
        $validated = $request->validate([
            'isolation_profile' => ['required', 'string', 'max:255'],
            'isolation_rate_limit' => ['nullable', 'string', 'max:255'],
            'isolation_local_address' => ['nullable', 'string', 'max:255'],
            'isolation_remote_address' => ['nullable', 'string', 'max:255'],
        ]);

        $profileName = trim($validated['isolation_profile']);

        try {
            $mikrotik->connect($router, ['timeout' => 30, 'attempts' => 1]);
            $result = $mikrotik->ensureIsolationProfile(
                $profileName,
                $validated['isolation_rate_limit'] ?? null,
                $validated['isolation_local_address'] ?? null,
                $validated['isolation_remote_address'] ?? null,
            );
        } catch (\Exception $e) {
            return back()->with('error', "Failed to save isolation profile: {$e->getMessage()}");
        } finally {
            $mikrotik->disconnect();
        }

        $router->update([
            'isolation_profile' => $profileName,
            'connection_status' => 'online',
        ]);

        RouterProfile::updateOrCreate(
            [
                'router_id' => $router->id,
                'name' => $result['name'],
            ],
            [
                'rate_limit' => $result['rate_limit'] ?? ($validated['isolation_rate_limit'] ?? null),
                'bandwidth' => $result['rate_limit'] ?? ($validated['isolation_rate_limit'] ?? null),
                'local_address' => $result['local_address'] ?? null,
                'remote_address' => $result['remote_address'] ?? null,
                'only_one' => $result['only_one'] ?? 'yes',
            ]
        );

        $mode = $result['created'] ? 'created' : 'updated';

        return back()->with('success', "Isolation profile {$profileName} {$mode} on {$router->name}.");
    }

    public function destroyIsolationProfile(Router $router, MikrotikService $mikrotik)
    {
        $profileName = trim((string) ($router->isolation_profile ?: ''));

        if ($profileName === '') {
            return back()->with('error', 'This router does not have a saved isolation profile.');
        }

        try {
            $mikrotik->connect($router, ['timeout' => 30, 'attempts' => 1]);
            $result = $mikrotik->deleteIsolationProfile($profileName);
        } catch (\Exception $e) {
            return back()->with('error', "Failed to delete isolation profile: {$e->getMessage()}");
        } finally {
            $mikrotik->disconnect();
        }

        RouterProfile::where('router_id', $router->id)
            ->where('name', $profileName)
            ->delete();

        $router->update([
            'isolation_profile' => null,
            'connection_status' => 'online',
        ]);

        if (! $result['deleted']) {
            return back()->with('success', "Isolation profile {$profileName} was already missing on {$router->name}. Saved profile reference has been cleared.");
        }

        return back()->with('success', "Isolation profile {$profileName} deleted from {$router->name}.");
    }

    /**
     * Scan this router for customers
     */
    public function scanRouter(Router $router)
    {
        if (!$router->is_active) {
            return back()->with('error', "Cannot scan inactive router. Please enable it first or 'Test Connection'.");
        }

        try {
            \Log::info("Initiating synchronous scan for router: {$router->name} (ID: {$router->id})");
            
            $syncService = app(\App\Services\RouterSyncService::class);
            $stats = $syncService->syncCustomers($router);
            
            $message = "Scan completed. Mapped: {$stats['mapped']}, Router-only staged: {$stats['staged_router_only']}, eBilling missing: {$stats['not_found_ebilling']}";
            
            return back()->with('success', $message);
        } catch (\Exception $e) {
            \Log::error("Scan failed for {$router->name}: {$e->getMessage()}");
            return back()->with('error', "Failed to scan: {$e->getMessage()}");
        }
    }

    /**
     * Unified Sync (Test + Scan)
     */
    public function sync(Router $router)
    {
        $router->refresh();
        $isLocked = in_array($router->sync_status, ['queued', 'running'], true)
            && $router->sync_lock_until
            && $router->sync_lock_until->isFuture();

        if ($isLocked) {
            return back()->with('success', "{$router->name}: Sync is already {$router->sync_status}.");
        }

        $router->update([
            'sync_status' => 'queued',
            'sync_started_at' => null,
            'sync_finished_at' => null,
            'sync_lock_until' => now()->addMinutes(10),
            'sync_message' => 'Full sync is queued.',
        ]);

        SyncRouterJob::dispatch($router->id);

        return back()->with('success', "{$router->name}: Full sync queued.");
    }

    /**
     * Sync All Active Routers
     */
    public function syncAll()
    {
        $routers = Router::where('is_active', true)->get();
        $results = [
            'total' => $routers->count(),
            'synced' => 0,
            'failed' => 0,
            'errors' => []
        ];

        foreach ($routers as $router) {
            $isLocked = in_array($router->sync_status, ['queued', 'running'], true)
                && $router->sync_lock_until
                && $router->sync_lock_until->isFuture();

            if ($isLocked) {
                $results['failed']++;
                $results['errors'][] = "{$router->name}: already {$router->sync_status}";
                continue;
            }

            $router->update([
                'sync_status' => 'queued',
                'sync_started_at' => null,
                'sync_finished_at' => null,
                'sync_lock_until' => now()->addMinutes(10),
                'sync_message' => 'Full sync is queued.',
            ]);

            SyncRouterJob::dispatch($router->id);
            $results['synced']++;
        }

        $message = "Queued {$results['synced']}/{$results['total']} routers";
        if ($results['failed'] > 0) {
            $message .= ". {$results['failed']} failed.";
        }

        return back()->with('success', $message);
    }
}
