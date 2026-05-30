<?php

namespace App\Console\Commands;

use App\Services\LegacySyncService;
use Illuminate\Console\Command;

class SyncLegacyData extends Command
{
    protected $signature = 'sync:legacy';
    protected $description = 'Sync data from the legacy eBilling scraper API';

    public function handle(LegacySyncService $syncService)
    {
        $this->info("🚀 Starting Legacy Data Sync...");
        
        try {
            $this->info("Fetching Area data...");
            $areas = $syncService->syncAreas();
            $this->info("✅ Areas Synced: {$areas}");

            $this->info("Fetching Package data...");
            $packages = $syncService->syncPackages();
            $this->info("✅ Packages Synced: {$packages}");

            $this->info("Fetching Customer data... (This may take a moment)");
            $customers = $syncService->syncCustomers();
            $this->info("✅ Customers Synced: {$customers}");
            $this->line('Area resolution: ' . $this->formatAreaResolutionStats($syncService->lastCustomerAreaResolutionStats()));
            $this->line('Network classification: ' . $this->formatAreaResolutionStats($syncService->lastCustomerNetworkSyncStats()));

            $deletedEmptyAreas = $syncService->cleanupEmptyAreas();
            if ($deletedEmptyAreas === []) {
                $this->info("✅ No empty areas deleted");
            } else {
                $this->info("✅ Empty Areas Deleted: " . count($deletedEmptyAreas));
                $this->line("Deleted: " . implode(', ', $deletedEmptyAreas));
            }

            $this->info("Fetching Invoice data... (This may take a moment)");
            $invoices = $syncService->syncInvoices();
            $this->info("✅ Invoices Synced: {$invoices}");

            $this->info("🎉 Legacy Sync Completed Successfully!");
            
        } catch (\Exception $e) {
            $this->error("❌ Sync Failed: " . $e->getMessage());
            return 1;
        }

        return 0;
    }

    /**
     * @param array<string, int> $stats
     */
    private function formatAreaResolutionStats(array $stats): string
    {
        return collect($stats)
            ->filter(fn (int $count) => $count > 0)
            ->map(fn (int $count, string $reason) => "{$reason}={$count}")
            ->implode(', ');
    }
}
