<?php

namespace App\Console\Commands;

use App\Models\Customer;
use App\Models\Invoice;
use Carbon\Carbon;
use Illuminate\Console\Command;

use Illuminate\Support\Facades\DB;

class GenerateInvoices extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'billing:generate 
                            {--month= : The billing month (YYYY-MM), defaults to current month}
                            {--dry-run : Simulate generation without creating records}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate monthly invoices for all active customers';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $inputMonth = $this->option('month');
        $isDryRun = $this->option('dry-run');

        // Determine Billing Period (1st of the month)
        $period = $inputMonth 
            ? Carbon::createFromFormat('Y-m', $inputMonth)->startOfMonth()
            : now()->startOfMonth();
            
        $this->info("Billing Period: " . $period->format('F Y'));
        // $this->info("Due Date: " . $dueDate->format('Y-m-d')); // Removed global due date
        if ($isDryRun) {
            $this->warn("!! DRY RUN MODE - No database changes will be made !!");
        }

        // Fetch eligible customers (Active or Suspended)
        // Suspended users still get billed until offboarded/churned
        $customers = Customer::ebilling()
            ->whereIn('status', ['active', 'isolated'])
            ->whereHas('package') // Ensure they have a package
            ->with('package')
            ->chunk(100, function ($chunk) use ($period, $isDryRun) {
                foreach ($chunk as $customer) {
                    $this->processCustomer($customer, $period, $isDryRun);
                }
            });

        $this->newLine();
        $this->info("Billing generation completed.");
    }

    private function processCustomer($customer, $period, $isDryRun)
    {
        // Calculate Due Date based on Customer's preferred Due Day
        // Fallback to join_date day, or 20th if all else fails
        $day = $customer->due_day ?? ($customer->join_date ? $customer->join_date->day : 20);
        
        // Handle end of month edge cases (e.g. Due Day 30, but Feb only has 28 days)
        $daysInMonth = $period->daysInMonth;
        $day = min($day, $daysInMonth);
        
        $dueDate = $period->copy()->day($day);
        
        // Check Idempotency: Has an invoice been generated for this period?
        $exists = Invoice::where('customer_id', $customer->id)
            ->where('period', $period->format('Y-m-d'))
            ->exists();

        if ($exists) {
            // $this->line("Skipping {$customer->name} (Invoice exists)");
            return;
        }

        $amount = $customer->package->price;

        $this->line("Generating invoice for: <comment>{$customer->name}</comment> (Rp " . number_format($amount) . ") - Due: " . $dueDate->format('Y-m-d'));

        if (!$isDryRun) {
            Invoice::create([
                'customer_id' => $customer->id,
                'period' => $period->format('Y-m-d'),
                'due_date' => $dueDate->format('Y-m-d'),
                'amount' => $amount,
                'status' => 'unpaid',
                'generated_at' => now(),
            ]);
        }
    }
}
