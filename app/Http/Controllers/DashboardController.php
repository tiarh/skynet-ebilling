<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Transaction;
use App\Support\AreaScope;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    /**
     * Display the enhanced dashboard with accounting widgets
     */
    public function index()
    {
        $user = request()->user();
        $currentPeriod = now()->startOfMonth()->format('Y-m-d');

        // Projected Revenue (Sum of all active customer packages)
        $projectedCustomers = Customer::ebilling()->where('status', 'active')->with('package');
        AreaScope::applyToCustomers($projectedCustomers, $user);
        $projectedRevenue = $projectedCustomers->get()->sum(function($customer) {
            return $customer->package->price ?? 0;
        });

        // Actual Revenue (Sum of transactions this month)
        $actualRevenueQuery = Transaction::whereMonth('paid_at', now()->month)
            ->whereYear('paid_at', now()->year);
        AreaScope::applyToTransactions($actualRevenueQuery, $user);
        $actualRevenue = $actualRevenueQuery->sum('amount');

        // Outstanding (Projected - Actual)
        $outstanding = $projectedRevenue - $actualRevenue;

        // Overdue Invoices Count (Active Overdue)
        // Invoices that are unpaid AND past due date + grace period
        $gracePeriod = (int) \App\Models\Setting::get('billing_grace_period_days', 7);
        $overdueCutoff = now()->subDays($gracePeriod);

        $overdueQuery = Invoice::where('status', 'unpaid')
            ->where('due_date', '<', $overdueCutoff);
        AreaScope::applyToInvoices($overdueQuery, $user);
        $overdueCount = $overdueQuery->count();

        // Active Customer Count
        $activeCustomersQuery = Customer::ebilling()->where('status', 'active');
        AreaScope::applyToCustomers($activeCustomersQuery, $user);
        $activeCustomers = $activeCustomersQuery->count();

        // Billing Health Stats
        $paidInvoicesQuery = Invoice::where('period', $currentPeriod)->where('status', 'paid');
        AreaScope::applyToInvoices($paidInvoicesQuery, $user);
        $paidInvoicesCount = $paidInvoicesQuery->count();

        $unpaidInvoicesQuery = Invoice::where('period', $currentPeriod)->where('status', 'unpaid');
        AreaScope::applyToInvoices($unpaidInvoicesQuery, $user);
        $unpaidInvoicesCount = $unpaidInvoicesQuery->count();
        $totalBillable = $paidInvoicesCount + $unpaidInvoicesCount;
        $collectionRate = $totalBillable > 0 ? round(($paidInvoicesCount / $totalBillable) * 100, 1) : 0;

        // Customers who should have an invoice but don't
        $customersWithInvoiceQuery = Invoice::where('period', $currentPeriod);
        AreaScope::applyToInvoices($customersWithInvoiceQuery, $user);
        $customersWithInvoice = $customersWithInvoiceQuery->pluck('customer_id');

        $customersWithoutInvoiceQuery = Customer::ebilling()
            ->whereIn('status', ['active', 'isolated'])
            ->whereHas('package')
            ->whereNotIn('id', $customersWithInvoice);
        AreaScope::applyToCustomers($customersWithoutInvoiceQuery, $user);
        $customersWithoutInvoice = $customersWithoutInvoiceQuery->count();

        // Recent Payments
        $recentPaymentsQuery = Transaction::with(['invoice.customer', 'admin'])
            ->orderBy('paid_at', 'desc')
            ->limit(10);
        AreaScope::applyToTransactions($recentPaymentsQuery, $user);
        $recentPayments = $recentPaymentsQuery->get();

        return Inertia::render('Dashboard', [
            'stats' => [
                'projected_revenue' => $projectedRevenue,
                'actual_revenue' => $actualRevenue,
                'outstanding' => $outstanding,
                'overdue_count' => $overdueCount,
                'active_customers' => $activeCustomers,
                'paid_invoices' => $paidInvoicesCount,
                'unpaid_invoices' => $unpaidInvoicesCount,
                'collection_rate' => $collectionRate,
                'customers_without_invoice' => $customersWithoutInvoice,
            ],
            'recent_payments' => $recentPayments,
        ]);
    }
}
