<?php

namespace App\Console\Commands;

use App\Models\Customer;
use App\Models\Invoice;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class CleanupDelinquentCustomers extends Command
{
    protected $signature = 'customers:cleanup-delinquent
                            {--apply : Soft-delete eligible customers}
                            {--min-unpaid=3 : Minimum unpaid invoice periods required}';

    protected $description = 'Soft-delete eBilling customers with three or more unpaid invoice periods';

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');
        $minimumUnpaid = max(1, (int) $this->option('min-unpaid'));
        $candidateIds = $this->candidateIds($minimumUnpaid);

        $this->info("Minimum unpaid periods: {$minimumUnpaid}");
        $this->info('Eligible customers: ' . count($candidateIds));

        if ($candidateIds === []) {
            return self::SUCCESS;
        }

        $previewRows = $this->previewRows($candidateIds);
        $this->table(
            ['Code', 'Name', 'Status', 'Router', 'MikroTik', 'Unpaid Periods', 'Oldest Due'],
            $previewRows->map(fn (Customer $customer) => [
                $customer->code,
                $customer->name,
                $customer->status,
                $customer->router?->name ?? '',
                $customer->mikrotik_sync_status ?? 'unknown',
                $customer->invoices->pluck('period')->unique(fn ($period) => $period?->toDateString())->count(),
                $customer->invoices->min('due_date')?->toDateString() ?? '',
            ])->all()
        );

        if (!$apply) {
            $this->warn('Dry run only. Re-run with --apply to soft-delete eligible customers.');
            return self::SUCCESS;
        }

        $deleted = 0;

        Customer::ebilling()
            ->whereKey($candidateIds)
            ->with(['router:id,name', 'invoices' => function ($query) {
                $query->where('status', 'unpaid')->orderBy('period');
            }])
            ->orderBy('id')
            ->chunkById(100, function ($customers) use (&$deleted, $minimumUnpaid) {
                DB::transaction(function () use ($customers, &$deleted, $minimumUnpaid) {
                    foreach ($customers as $customer) {
                        $unpaidInvoices = $customer->invoices;

                        activity()
                            ->performedOn($customer)
                            ->withProperties([
                                'reason' => 'three_unpaid_periods',
                                'minimum_unpaid_periods' => $minimumUnpaid,
                                'unpaid_invoice_ids' => $unpaidInvoices->pluck('id')->values()->all(),
                                'unpaid_periods' => $unpaidInvoices
                                    ->pluck('period')
                                    ->map(fn ($period) => $period?->toDateString())
                                    ->filter()
                                    ->values()
                                    ->all(),
                                'router' => $customer->router?->name,
                                'pppoe_user' => $customer->pppoe_user,
                                'mikrotik_sync_status' => $customer->mikrotik_sync_status,
                            ])
                            ->log('customer_soft_deleted_for_delinquency');

                        $customer->delete();
                        $deleted++;
                    }
                });
            });

        $this->info("Soft-deleted customers: {$deleted}");

        return self::SUCCESS;
    }

    /**
     * @return array<int>
     */
    private function candidateIds(int $minimumUnpaid): array
    {
        return Customer::ebilling()
            ->where('customers.status', '!=', 'terminated')
            ->whereHas('invoices', fn (Builder $query) => $query->where('status', 'unpaid'))
            ->select('customers.id')
            ->join('invoices', 'invoices.customer_id', '=', 'customers.id')
            ->where('invoices.status', 'unpaid')
            ->groupBy('customers.id')
            ->havingRaw('COUNT(DISTINCT invoices.period) >= ?', [$minimumUnpaid])
            ->pluck('customers.id')
            ->all();
    }

    /**
     * @param array<int> $candidateIds
     */
    private function previewRows(array $candidateIds)
    {
        return Customer::ebilling()
            ->whereKey($candidateIds)
            ->with([
                'router:id,name',
                'invoices' => fn ($query) => $query->where('status', 'unpaid')->orderBy('due_date'),
            ])
            ->orderBy('code')
            ->limit(50)
            ->get();
    }
}
