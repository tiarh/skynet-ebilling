<?php

namespace App\Jobs;

use App\Models\Router;
use App\Services\RouterSyncService;
use Exception;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncRouterJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 300;

    public function __construct(public int $routerId)
    {
        $this->onQueue('router-sync');
    }

    public function handle(RouterSyncService $syncService): void
    {
        $router = Router::find($this->routerId);

        if (! $router) {
            return;
        }

        $router->update([
            'sync_status' => 'running',
            'sync_started_at' => now(),
            'sync_finished_at' => null,
            'sync_message' => 'Full sync is running.',
            'sync_lock_until' => now()->addMinutes(10),
        ]);

        try {
            $result = $syncService->fullSync($router->fresh(), 45);

            if (! ($result['success'] ?? false)) {
                throw new Exception($result['error'] ?? 'Unknown sync failure.');
            }

            $scan = $result['scan'] ?? [];
            $router->fresh()->update([
                'sync_status' => 'success',
                'sync_finished_at' => now(),
                'sync_lock_until' => null,
                'sync_message' => $this->successMessage($router, $scan),
                'last_sync_stats' => $scan,
            ]);
        } catch (Exception $e) {
            Log::error("Queued full sync failed for router {$router->name}: {$e->getMessage()}");

            $router->fresh()->update([
                'sync_status' => 'failed',
                'sync_finished_at' => now(),
                'sync_lock_until' => null,
                'sync_message' => "Sync failed: {$e->getMessage()}",
            ]);

            throw $e;
        }
    }

    private function successMessage(Router $router, array $scan): string
    {
        return sprintf(
            '%s: synced. %d mapped, %d router-only staged, %d eBilling missing.',
            $router->name,
            $scan['mapped'] ?? 0,
            $scan['staged_router_only'] ?? ($scan['unmatched_mikrotik'] ?? 0),
            $scan['not_found_ebilling'] ?? 0,
        );
    }
}
