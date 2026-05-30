<?php

namespace App\Console\Commands;

use App\Jobs\IsolateCustomerJob;
use App\Models\Invoice;
use App\Models\Setting;
use Illuminate\Console\Command;
use Spatie\Activitylog\Facades\LogBatch;
use Spatie\Activitylog\Models\Activity;

class CheckOverdueInvoices extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'billing:check-overdue {--dry-run : Run without making changes}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check for overdue invoices and isolate delinquent customers';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $isDryRun = $this->option('dry-run');
        $graceDays = (int) Setting::get('billing_grace_period_days', 7);
        
        // Cutoff date is (Today - Grace Period). e.g. If today is 15th and grace is 7, 
        // invoices due on or before the 8th are now actionable.
        $cutoffDate = now()->subDays($graceDays)->startOfDay();

        $this->info("Checking for overdue invoices due on or before: " . $cutoffDate->format('Y-m-d'));
        if ($isDryRun) {
            $this->warn("!! DRY RUN MODE - No actions will be taken !!");
        }

        // Find unpaid invoices past the cutoff date
        // Only for active customers (don't re-isolate already isolated ones)
        Invoice::where('status', 'unpaid')
            ->where('due_date', '<', $cutoffDate)
            ->whereHas('customer', function ($query) {
                $query->where('status', 'active');
            })
            ->with('customer')
            ->chunk(100, function ($invoices) use ($isDryRun, $cutoffDate) {
                foreach ($invoices as $invoice) {
                    $this->processOverdueInvoice($invoice, $isDryRun, $cutoffDate);
                }
            });

        $this->newLine();
        $this->info("Overdue check completed.");
    }

    private function processOverdueInvoice($invoice, $isDryRun, $cutoffDate)
    {
        $customer = $invoice->customer;
        $daysOverdue = $invoice->due_date->diffInDays(now());

        $this->line("Found overdue invoice: <comment>{$invoice->code}</comment> for <comment>{$customer->name}</comment>");
        $this->line(" - Due Date: {$invoice->due_date->format('Y-m-d')} ({$daysOverdue} days overdue)");

        if ($isDryRun) {
            $this->info("   [DRY RUN] Would isolate customer {$customer->name}");
            return;
        }

        $this->info("   Dispatching isolation job for {$customer->name}...");

        // Log the enforcement action
        activity()
            ->performedOn($customer)
            ->withProperties([
                'invoice_id' => $invoice->id,
                'due_date' => $invoice->due_date->format('Y-m-d'),
                'days_overdue' => $daysOverdue,
                'reason' => 'payment_overdue'
            ])
            ->log('system_isolation_triggered');

        // Dispatch the job
        IsolateCustomerJob::dispatch($customer);
    }
}
