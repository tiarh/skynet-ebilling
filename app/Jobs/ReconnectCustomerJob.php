<?php

namespace App\Jobs;

use App\Models\Customer;
use App\Services\MikrotikService;
use App\Services\RadiusUserService;
use Exception;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ReconnectCustomerJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $backoff = [60, 180, 600];

    /**
     * Create a new job instance.
     */
    public function __construct(public Customer $customer)
    {
        $this->onQueue('network-enforcement');
    }

    /**
     * Execute the job.
     */
    public function handle(MikrotikService $mikrotik, RadiusUserService $radius): void
    {
        $this->customer->refresh();

        // Check if customer has a router assigned
        if (!$this->customer->router_id || !$this->customer->router) {
            Log::warning("Customer {$this->customer->name} has no router assigned. Skipping reconnection.");
            return;
        }

        if (!$this->customer->pppoe_user) {
            Log::warning("Customer {$this->customer->name} has no PPPoE username. Skipping reconnection.");
            return;
        }

        $router = $this->customer->router;

        try {
            Log::info("Attempting to reconnect: {$this->customer->name} ({$this->customer->pppoe_user}) on {$router->name}");

            // Connect to the customer's router
            $mikrotik->connect($router);

            $fallbackProfile = $this->customer->package?->mikrotik_profile
                ?: $this->customer->mikrotik_profile
                ?: 'default';
            $restoredProfile = $this->customer->previous_profile
                ?: $this->customer->package?->mikrotik_profile
                ?: $this->customer->mikrotik_profile
                ?: $fallbackProfile;

            // Reconnect the user and restore the best known non-isolation profile.
            $success = $mikrotik->reconnectUser($this->customer->pppoe_user, $fallbackProfile);

            if ($success) {
                // Update customer status back to active
                $this->customer->update([
                    'status' => 'active',
                    'mikrotik_profile' => $restoredProfile,
                    'mikrotik_sync_status' => 'synced',
                    'mikrotik_synced_at' => now(),
                    'mikrotik_sync_checked_at' => now(),
                ]);
                $radius->syncCustomer($this->customer->fresh());

                // Log the action
                activity()
                    ->causedBy(auth()->user() ?? null)
                    ->performedOn($this->customer)
                    ->withProperties([
                        'router' => $router->name,
                        'pppoe_user' => $this->customer->pppoe_user,
                    ])
                    ->log('customer_reconnected');

                Log::info("Successfully reconnected: {$this->customer->name}");
            } else {
                Log::warning("Failed to reconnect {$this->customer->name}: User not found on router");
            }

        } catch (Exception $e) {
            Log::error("Failed to reconnect customer {$this->customer->name}: " . $e->getMessage());
            
            // Log the failure
            activity()
                ->causedBy(auth()->user() ?? null)
                ->performedOn($this->customer)
                ->withProperties([
                    'error' => $e->getMessage(),
                    'router' => $router->name,
                ])
                ->log('reconnection_failed');

            // Retry logic
            if ($this->attempts() < $this->tries) {
                $this->release($this->backoff[$this->attempts() - 1] ?? 600);
            } else {
                $this->fail($e);
            }
        } finally {
            $mikrotik->disconnect();
        }
    }
}
