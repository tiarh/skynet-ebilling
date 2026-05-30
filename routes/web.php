<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\PackageController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\OltController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\UserManagementController;
use App\Http\Controllers\GenieAcsController;
use App\Http\Controllers\HotspotVoucherController;
use App\Http\Controllers\PaymentGatewayController;
use App\Http\Controllers\ResellerCommissionController;
use App\Http\Controllers\SupportTicketController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes - Skynet E-Billing
|--------------------------------------------------------------------------
|
| Routes organized by feature:
| - Dashboard (Accounting widgets)
| - Customer Management
| - Invoice Management
| - Payment Entry
| - Package Management
|
*/

// Redirect root to login
Route::get('/', function () {
    return redirect()->route('login');
});

// =====================================================
// Public Payment Routes
// =====================================================
Route::get('/pay/{uuid}', [\App\Http\Controllers\PublicInvoiceController::class, 'show'])->name('public.invoice.show');
Route::post('/webhooks/payment-gateway/{provider}', [PaymentGatewayController::class, 'webhook'])
    ->name('webhooks.payment-gateway');

// Authenticated Routes
Route::middleware(['auth', 'verified'])->group(function () {
    
    // =====================================================
    // Dashboard - Enhanced with Accounting Widgets
    // =====================================================
    Route::get('/dashboard', [DashboardController::class, 'index'])
        ->name('dashboard');
    
    // =====================================================
    // Profile Management
    // =====================================================
    Route::get('/profile', [ProfileController::class, 'edit'])
        ->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])
        ->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])
        ->name('profile.destroy');

    Route::middleware('superadmin')->group(function () {
        Route::resource('users', UserManagementController::class)->except(['show']);
    });
    
    // =====================================================
    // Customer Management
    // =====================================================
    Route::get('/customers', [CustomerController::class, 'index'])->name('customers.index');
    Route::get('/customers/export', [CustomerController::class, 'export'])->name('customers.export');
    Route::middleware('admin')->group(function () {
        Route::get('/customers/create', [CustomerController::class, 'create'])->name('customers.create');
        Route::post('/customers', [CustomerController::class, 'store'])->name('customers.store');
        Route::get('/customers/{customer}/edit', [CustomerController::class, 'edit'])->name('customers.edit');
        Route::match(['put', 'patch'], '/customers/{customer}', [CustomerController::class, 'update'])->name('customers.update');
        Route::delete('/customers/{customer}', [CustomerController::class, 'destroy'])->name('customers.destroy');
        Route::post('/customers/{customer}/isolate', [CustomerController::class, 'isolate'])->name('customers.isolate');
        Route::post('/customers/{customer}/reconnect', [CustomerController::class, 'reconnect'])->name('customers.reconnect');
    });
    Route::get('/customers/{customer}', [CustomerController::class, 'show'])->name('customers.show');
    
    // =====================================================
    // Package Management
    // =====================================================
    Route::middleware('global-admin')->group(function () {
        Route::resource('packages', PackageController::class);
        Route::resource('areas', \App\Http\Controllers\AreaController::class);
        Route::resource('olts', OltController::class);
        Route::post('/olts/{olt}/test', [OltController::class, 'testConnection'])
            ->name('olts.test')->middleware('throttle:olt-operations');
        Route::get('/api/olts/{olt}/gpon-snapshot', [OltController::class, 'gponSnapshot'])
            ->name('api.olts.gpon-snapshot')->middleware('throttle:olt-operations');
        Route::post('/api/olts/{olt}/onu/detail', [OltController::class, 'onuDetail'])
            ->name('api.olts.onu.detail')->middleware('throttle:olt-operations');
        Route::post('/api/olts/{olt}/onu/rename', [OltController::class, 'renameOnu'])
            ->name('api.olts.onu.rename')->middleware('throttle:olt-operations');
        Route::post('/api/olts/{olt}/onu/reboot', [OltController::class, 'rebootOnu'])
            ->name('api.olts.onu.reboot')->middleware('throttle:olt-operations');
        Route::post('/api/olts/{olt}/onu/admin-state', [OltController::class, 'setOnuAdminState'])
            ->name('api.olts.onu.admin-state')->middleware('throttle:olt-operations');
        Route::delete('/api/olts/{olt}/onu', [OltController::class, 'deleteOnu'])
            ->name('api.olts.onu.delete')->middleware('throttle:olt-operations');
        Route::post('/api/olts/{olt}/onu/authorize', [OltController::class, 'authorizeOnu'])
            ->name('api.olts.onu.authorize')->middleware('throttle:olt-operations');
        Route::post('/routers/{router}/test', [\App\Http\Controllers\RouterController::class, 'testConnection'])
            ->name('routers.test')->middleware('throttle:mikrotik-operations');
        Route::post('/routers/{router}/scan', [\App\Http\Controllers\RouterController::class, 'scanRouter'])
            ->name('routers.scan')->middleware('throttle:mikrotik-operations');
        Route::post('/routers/{router}/sync', [\App\Http\Controllers\RouterController::class, 'sync'])
            ->name('routers.sync')->middleware('throttle:mikrotik-operations');
        Route::post('/routers/{router}/vpn', [\App\Http\Controllers\RouterController::class, 'updateVpn'])
            ->name('routers.vpn.update');
        Route::post('/routers/{router}/radius-sync', [\App\Http\Controllers\RouterController::class, 'syncRadius'])
            ->name('routers.radius.sync');
        Route::post('/routers/{router}/isolation-profile', [\App\Http\Controllers\RouterController::class, 'storeIsolationProfile'])
            ->name('routers.isolation-profile.store');
        Route::delete('/routers/{router}/isolation-profile', [\App\Http\Controllers\RouterController::class, 'destroyIsolationProfile'])
            ->name('routers.isolation-profile.destroy');
        Route::post('/routers/sync-all', [\App\Http\Controllers\RouterController::class, 'syncAll'])
            ->name('routers.sync-all');
        Route::get('/api/routers/{router}/customers', [\App\Http\Controllers\RouterController::class, 'customers'])
            ->name('api.routers.customers');
        Route::get('/api/routers/{router}/profiles', [\App\Http\Controllers\RouterController::class, 'getProfiles'])
            ->name('api.routers.profiles');
        Route::get('/api/routers/{router}/live-stats', [\App\Http\Controllers\RouterController::class, 'liveStats'])
            ->name('api.routers.live-stats');
        Route::resource('routers', \App\Http\Controllers\RouterController::class);
        Route::post('/routers/{router}/sync-online', [\App\Http\Controllers\RouterController::class, 'syncOnlineStatus'])
            ->name('routers.sync-online');
    });
    
    // =====================================================
    // Invoice Management
    // =====================================================
    Route::get('/invoices', [InvoiceController::class, 'index'])
        ->name('invoices.index');
    Route::get('/invoices/export', [InvoiceController::class, 'export'])
        ->name('invoices.export');
    Route::middleware('admin')->group(function () {
        Route::get('/invoices/create', [InvoiceController::class, 'create'])
            ->name('invoices.create');
        Route::post('/invoices', [InvoiceController::class, 'store'])
            ->name('invoices.store');
        Route::post('/invoices/{invoice}/void', [InvoiceController::class, 'void'])
            ->name('invoices.void');
        Route::delete('/invoices/{invoice}', [InvoiceController::class, 'destroy'])
            ->name('invoices.destroy');
    });
    Route::get('/invoices/{invoice}', [InvoiceController::class, 'show'])
        ->name('invoices.show');
    Route::get('/invoices/{invoice}/download', [InvoiceController::class, 'download'])
        ->name('invoices.download');
    Route::get('/customers/{customer}/invoices', [InvoiceController::class, 'customerInvoices'])
        ->name('customers.invoices');
    
    // =====================================================
    // Payment Entry
    // =====================================================
    Route::middleware('admin')->group(function () {
        Route::get('/invoices/{invoice}/pay', [PaymentController::class, 'create'])
            ->name('invoices.pay');
        Route::post('/invoices/{invoice}/payments', [PaymentController::class, 'store'])
            ->name('payments.store');
        Route::post('/payments/bulk-import', [PaymentController::class, 'bulkImport'])
            ->name('payments.bulk-import');
    });

    
    // =====================================================
    // Analytics & Reports
    // =====================================================
    Route::get('/analytics', [AnalyticsController::class, 'index'])->name('analytics.index');
    Route::get('/api/analytics/revenue-trend', [AnalyticsController::class, 'revenueTrend'])->name('api.analytics.revenue-trend');
    Route::get('/api/analytics/mrr', [AnalyticsController::class, 'mrr'])->name('api.analytics.mrr');
    Route::get('/api/analytics/collection-rate', [AnalyticsController::class, 'collectionRate'])->name('api.analytics.collection-rate');
    Route::get('/api/analytics/revenue-by-area', [AnalyticsController::class, 'revenueByArea'])->name('api.analytics.revenue-by-area');
    Route::get('/api/analytics/package-performance', [AnalyticsController::class, 'packagePerformance'])->name('api.analytics.package-performance');
    Route::get('/api/analytics/payment-methods', [AnalyticsController::class, 'paymentMethods'])->name('api.analytics.payment-methods');
    Route::get('/api/analytics/outstanding-aging', [AnalyticsController::class, 'outstandingAging'])->name('api.analytics.outstanding-aging');
    Route::get('/api/analytics/customer-growth', [AnalyticsController::class, 'customerGrowth'])->name('api.analytics.customer-growth');

    // =====================================================
    // Radius Suite Cockpit
    // =====================================================
    Route::middleware('admin')->group(function () {
        Route::get('/api/hotspot-vouchers', [HotspotVoucherController::class, 'index'])
            ->name('api.hotspot-vouchers.index');
        Route::post('/api/hotspot-vouchers', [HotspotVoucherController::class, 'store'])
            ->name('api.hotspot-vouchers.store');
        Route::post('/api/hotspot-vouchers/{voucher}/sync', [HotspotVoucherController::class, 'sync'])
            ->name('api.hotspot-vouchers.sync');
        Route::post('/api/hotspot-vouchers/{voucher}/disable', [HotspotVoucherController::class, 'disable'])
            ->name('api.hotspot-vouchers.disable');

        Route::get('/api/payment-gateway/events', [PaymentGatewayController::class, 'index'])
            ->name('api.payment-gateway.events');

        Route::get('/api/support-tickets', [SupportTicketController::class, 'index'])
            ->name('api.support-tickets.index');
        Route::post('/api/support-tickets', [SupportTicketController::class, 'store'])
            ->name('api.support-tickets.store');
        Route::patch('/api/support-tickets/{ticket}', [SupportTicketController::class, 'update'])
            ->name('api.support-tickets.update');

        Route::get('/api/reseller-commissions', [ResellerCommissionController::class, 'index'])
            ->name('api.reseller-commissions.index');
        Route::post('/api/reseller-commissions', [ResellerCommissionController::class, 'store'])
            ->name('api.reseller-commissions.store');
        Route::post('/api/reseller-commissions/{commission}/paid', [ResellerCommissionController::class, 'markPaid'])
            ->name('api.reseller-commissions.paid');

        Route::get('/api/genieacs/devices', [GenieAcsController::class, 'index'])
            ->name('api.genieacs.devices');
        Route::post('/api/genieacs/sync', [GenieAcsController::class, 'sync'])
            ->name('api.genieacs.sync');
        Route::post('/api/genieacs/devices/{device}/reboot', [GenieAcsController::class, 'reboot'])
            ->name('api.genieacs.reboot');
        Route::post('/api/genieacs/devices/{device}/parameter', [GenieAcsController::class, 'setParameter'])
            ->name('api.genieacs.parameter');
    });

    Route::get('/hotspot-voucher', fn () => Inertia\Inertia::render('Modules/RadiusSuite', [
        'module' => 'hotspot',
        'title' => 'Hotspot Voucher',
        'description' => 'Pusat voucher hotspot berbasis RADIUS untuk generate batch voucher, masa aktif, kuota, profile MikroTik, dan sinkron semua NAS.',
        'routers' => \App\Models\Router::query()->select('id', 'name')->orderBy('name')->get(),
        'packages' => \App\Models\Package::query()->select('id', 'name', 'price', 'mikrotik_profile', 'rate_limit')->orderBy('name')->get(),
    ]))->name('modules.hotspot');

    Route::get('/payment-gateway', fn () => Inertia\Inertia::render('Modules/RadiusSuite', [
        'module' => 'payment_gateway',
        'title' => 'Payment Gateway',
        'description' => 'Konfirmasi pembayaran otomatis untuk QRIS/VA/e-wallet, webhook, rekonsiliasi invoice, dan reconnect pelanggan setelah lunas.',
        'webhookUrl' => url('/webhooks/payment-gateway/manual'),
    ]))->name('modules.payment-gateway');

    Route::get('/ticketing', fn () => Inertia\Inertia::render('Modules/RadiusSuite', [
        'module' => 'ticketing',
        'title' => 'Ticketing',
        'description' => 'Tiket pasang baru dan gangguan dengan assignment teknisi, SLA, catatan pekerjaan, foto bukti, dan notifikasi WhatsApp.',
        'customers' => \App\Models\Customer::query()->ebilling()->select('id', 'code', 'name')->orderBy('name')->limit(500)->get(),
        'users' => \App\Models\User::query()->select('id', 'name')->orderBy('name')->get(),
    ]))->name('modules.ticketing');

    Route::get('/portal-pelanggan', fn () => Inertia\Inertia::render('Modules/RadiusSuite', [
        'module' => 'portal',
        'title' => 'Portal Pelanggan',
        'description' => 'Area pelanggan untuk cek status internet, tagihan, riwayat pembayaran, buka tiket, serta request ganti SSID/password.',
    ]))->name('modules.portal');

    Route::get('/kemitraan', fn () => Inertia\Inertia::render('Modules/RadiusSuite', [
        'module' => 'reseller',
        'title' => 'Kemitraan',
        'description' => 'Dashboard mitra/reseller untuk melihat pelanggan binaan, tagihan, komisi, settlement, dan performa area.',
        'users' => \App\Models\User::query()->select('id', 'name')->orderBy('name')->get(),
    ]))->name('modules.reseller');

    Route::get('/genieacs', fn () => Inertia\Inertia::render('Modules/RadiusSuite', [
        'module' => 'genieacs',
        'title' => 'GenieACS TR069',
        'description' => 'Integrasi ACS untuk manajemen CPE/ONU: inventory device, parameter WiFi, reboot, preset, dan provisioning.',
    ]))->name('modules.genieacs');

    Route::get('/support-center', fn () => Inertia\Inertia::render('Modules/RadiusSuite', [
        'module' => 'support',
        'title' => 'Support Center',
        'description' => 'Pusat bantuan operasional untuk status server, panduan koneksi MikroTik/OLT, dan checklist integrasi lapangan.',
    ]))->name('modules.support');

    // =====================================================
    // Broadcast & Campaigns
    // =====================================================
    Route::get('/broadcasts', [\App\Http\Controllers\WaCampaignController::class, 'index'])->name('broadcasts.index');
    Route::middleware('admin')->group(function () {
        Route::get('/broadcasts/create', [\App\Http\Controllers\WaCampaignController::class, 'create'])->name('broadcasts.create');
        Route::post('/broadcasts', [\App\Http\Controllers\WaCampaignController::class, 'store'])->name('broadcasts.store');
        Route::post('/broadcasts/{campaign}/retry', [\App\Http\Controllers\WaCampaignController::class, 'retryFailed'])->name('broadcasts.retry');
    });
    Route::get('/broadcasts/{campaign}', [\App\Http\Controllers\WaCampaignController::class, 'show'])->name('broadcasts.show');

    // =====================================================
    // Settings System
    // =====================================================
    Route::middleware('global-admin')->group(function () {
        Route::get('/settings', [SettingController::class, 'index'])->name('settings.index');
        Route::post('/settings', [SettingController::class, 'update'])->name('settings.update');
    });
});

// Auth Routes (Login, Register, etc.)
require __DIR__.'/auth.php';
