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

class IsolateCustomerJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $backoff = [60, 180, 600]; // 1min, 3min, 10min

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
            Log::warning("Customer {$this->customer->name} has no router assigned. Skipping isolation.");
            activity()
                ->causedBy(auth()->user() ?? null)
                ->performedOn($this->customer)
                ->withProperties(['reason' => 'no_router_assigned'])
                ->log('isolation_skipped');
            return;
        }

        if (!$this->customer->pppoe_user) {
            Log::warning("Customer {$this->customer->name} has no PPPoE username. Skipping isolation.");
            activity()
                ->causedBy(auth()->user() ?? null)
                ->performedOn($this->customer)
                ->withProperties(['reason' => 'no_pppoe_user'])
                ->log('isolation_skipped');
            return;
        }

        $router = $this->customer->router;

        try {
            Log::info("Attempting to isolate: {$this->customer->name} ({$this->customer->pppoe_user}) on {$router->name}");

            // Connect to the customer's router
            $mikrotik->connect($router);

            // Isolate the user
            $success = $mikrotik->isolateUser($this->customer->pppoe_user);

            if ($success) {
                // Update customer status
                $this->customer->update([
                    'status' => 'isolated',
                    'mikrotik_profile' => $router->isolation_profile ?: 'isolirebilling',
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
                    ->log('customer_isolated');

                Log::info("Successfully isolated: {$this->customer->name}");
            } else {
                // PPPoE secret not found on router - this is a critical error
                $errorMsg = "PPPoE user '{$this->customer->pppoe_user}' not found on router '{$router->name}'";
                
                Log::error($errorMsg);
                
                activity()
                    ->causedBy(auth()->user() ?? null)
                    ->performedOn($this->customer)
                    ->withProperties([
                        'error' => $errorMsg,
                        'router' => $router->name,
                        'pppoe_user' => $this->customer->pppoe_user,
                    ])
                    ->log('isolation_failed');
                
                throw new Exception($errorMsg);
            }

        } catch (Exception $e) {
            $isConfigError = str_contains($e->getMessage(), 'Isolation profile');
            
            Log::error("Failed to isolate customer {$this->customer->name}: " . $e->getMessage());
            
            // Log the failure
            activity()
                ->causedBy(auth()->user() ?? null)
                ->performedOn($this->customer)
                ->withProperties([
                    'error' => $e->getMessage(),
                    'router' => $router->name,
                    'is_config_error' => $isConfigError
                ])
                ->log('isolation_failed');

            // Retry logic (Skip retry if it's a configuration error)
            if (!$isConfigError && $this->attempts() < $this->tries) {
                $this->release($this->backoff[$this->attempts() - 1] ?? 600);
            } else {
                $this->fail($e);
            }
        } finally {
            $mikrotik->disconnect();
        }
    }
}
