<?php

namespace App\Console\Commands;

use App\Models\Router;
use App\Services\MikrotikService;
use Illuminate\Console\Command;

class MonitorRouters extends Command
{
    protected $signature = 'routers:monitor {router?}';
    protected $description = 'Check health and update online status for active routers';

    public function handle()
    {
        $routerId = $this->argument('router');
        $query = Router::where('is_active', true);

        if ($routerId) {
            $query->where('id', $routerId);
        }

        $routers = $query->get();

        if ($routers->isEmpty()) {
            $this->warn('No active routers found to monitor.');
            return;
        }

        $this->info("Monitoring " . $routers->count() . " router(s)...");

        foreach ($routers as $router) {
            $this->info("Checking {$router->name} ({$router->ip_address})...");

            try {
                $mikrotik = (new MikrotikService())->connect($router);
                $stats = $mikrotik->getHealthStats();

                if (!$stats) {
                    throw new \Exception("Could not retrieve health stats");
                }

                $router->update([
                    'cpu_load' => $stats['cpu_load'],
                    'uptime' => $stats['uptime'],
                    'free_memory' => $stats['free_memory'],
                    'total_memory' => $stats['total_memory'],
                    'last_health_check_at' => now(),
                    'connection_status' => 'online'
                ]);

                $this->info("ONLINE: CPU {$stats['cpu_load']}%, Active: " . $stats['online_count']);
                
                // Disconnect to clean up
            } catch (\Exception $e) {
                $this->error("OFFLINE: " . $e->getMessage());
                
                $router->update([
                    'connection_status' => 'offline',
                    'last_health_check_at' => now(),
                ]);
            }
        }

        $this->info('Monitoring completed.');
    }
}
