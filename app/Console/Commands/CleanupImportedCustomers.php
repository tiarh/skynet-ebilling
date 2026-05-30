<?php

namespace App\Console\Commands;

use App\Models\Customer;
use Illuminate\Console\Command;

class CleanupImportedCustomers extends Command
{
    protected $signature = 'customers:cleanup-imported {--apply : Soft-delete eligible IMP-* customers}';

    protected $description = 'Soft-delete imported MikroTik customer rows that have no invoice history';

    public function handle(): int
    {
        $apply = $this->option('apply');

        $total = Customer::importedFromMikrotik()->count();
        $eligible = Customer::importedFromMikrotik()->doesntHave('invoices')->count();
        $blocked = $total - $eligible;

        $this->info("Imported rows found: {$total}");
        $this->info("Eligible for soft delete: {$eligible}");
        $this->info("Skipped because invoice history exists: {$blocked}");

        if (!$apply) {
            $this->warn('Dry run only. Re-run with --apply to soft-delete eligible rows.');
            return self::SUCCESS;
        }

        $deleted = 0;

        Customer::importedFromMikrotik()
            ->doesntHave('invoices')
            ->orderBy('id')
            ->chunkById(200, function ($customers) use (&$deleted) {
                foreach ($customers as $customer) {
                    $customer->delete();
                    $deleted++;
                }
            });

        $this->info("Soft-deleted imported rows: {$deleted}");

        return self::SUCCESS;
    }
}
