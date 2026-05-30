<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Package;
use App\Models\Router;
use App\Models\RouterStagedCustomer;
use App\Services\MikrotikService;
use App\Services\RouterSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class EbillingOnlyRouterSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_sync_does_not_create_customer_for_unmatched_mikrotik_secret(): void
    {
        $router = $this->router();
        $mikrotik = Mockery::mock(MikrotikService::class);
        $mikrotik->shouldReceive('connect')->once();
        $mikrotik->shouldReceive('disconnect')->once();
        $mikrotik->shouldReceive('getPPPSecrets')->once()->andReturn([
            ['name' => 'router.only', 'profile' => '10MB'],
        ]);

        $result = (new RouterSyncService($mikrotik))->syncCustomers($router);

        $this->assertSame(0, Customer::count());
        $this->assertSame(0, $result['mapped']);
        $this->assertSame(1, $result['unmatched_mikrotik']);
        $this->assertSame(1, $result['orphaned']);
        $this->assertSame(1, $result['staged_router_only']);
        $this->assertDatabaseHas('router_staged_customers', [
            'router_id' => $router->id,
            'pppoe_user' => 'router.only',
            'profile' => '10MB',
            'status' => 'unmatched',
        ]);
    }

    public function test_sync_links_existing_ebilling_customer_by_exact_pppoe_and_preserves_billing_fields(): void
    {
        $router = $this->router(['isolation_profile' => 'isolirebilling']);
        $package = Package::create([
            'name' => 'eBilling Package',
            'code' => 'PKG-EBILLING',
            'price' => 150000,
        ]);
        $customer = Customer::create([
            'code' => 'CUST-001',
            'name' => 'Abdul Roshid',
            'phone' => '081234567890',
            'address' => 'Original Address',
            'pppoe_user' => 'abdulroshid',
            'package_id' => $package->id,
            'status' => 'active',
        ]);

        $mikrotik = Mockery::mock(MikrotikService::class);
        $mikrotik->shouldReceive('connect')->once();
        $mikrotik->shouldReceive('disconnect')->once();
        $mikrotik->shouldReceive('getPPPSecrets')->once()->andReturn([
            [
                'name' => 'abdulroshid',
                'profile' => '20MB',
                'password' => 'router-secret',
                'comment' => 'router address',
            ],
        ]);

        $result = (new RouterSyncService($mikrotik))->syncCustomers($router);
        $customer->refresh();

        $this->assertSame(1, $result['mapped']);
        $this->assertSame($router->id, $customer->router_id);
        $this->assertSame('20MB', $customer->mikrotik_profile);
        $this->assertSame('CUST-001', $customer->code);
        $this->assertSame('Abdul Roshid', $customer->name);
        $this->assertSame('081234567890', $customer->phone);
        $this->assertSame('Original Address', $customer->address);
        $this->assertSame($package->id, $customer->package_id);
        $this->assertSame('active', $customer->status);
        $this->assertNotSame('router-secret', $customer->pppoe_password);
        $this->assertSame('synced', $customer->mikrotik_sync_status);
        $this->assertNotNull($customer->mikrotik_synced_at);
        $this->assertNotNull($customer->mikrotik_sync_checked_at);
    }

    public function test_sync_ignores_imported_customer_rows(): void
    {
        $router = $this->router();
        $package = $this->package('PKG-IMPORTED');
        Customer::create([
            'code' => 'IMP-ABC123',
            'name' => 'Imported Row',
            'phone' => '',
            'address' => 'Imported Address',
            'pppoe_user' => 'same-user',
            'package_id' => $package->id,
            'status' => 'active',
        ]);

        $mikrotik = Mockery::mock(MikrotikService::class);
        $mikrotik->shouldReceive('connect')->once();
        $mikrotik->shouldReceive('disconnect')->once();
        $mikrotik->shouldReceive('getPPPSecrets')->once()->andReturn([
            ['name' => 'same-user', 'profile' => '10MB'],
        ]);

        $result = (new RouterSyncService($mikrotik))->syncCustomers($router);

        $this->assertSame(0, $result['mapped']);
        $this->assertSame(1, $result['unmatched_mikrotik']);
        $importedCustomer = Customer::first();
        $this->assertNull($importedCustomer->router_id);
        $this->assertSame('unknown', $importedCustomer->mikrotik_sync_status);
        $this->assertDatabaseHas('router_staged_customers', [
            'router_id' => $router->id,
            'pppoe_user' => 'same-user',
            'status' => 'unmatched',
        ]);
    }

    public function test_existing_staged_router_secret_is_marked_matched_after_customer_is_created(): void
    {
        $router = $this->router();
        $package = $this->package('PKG-STAGED-MATCH');
        RouterStagedCustomer::create([
            'router_id' => $router->id,
            'pppoe_user' => 'later.customer',
            'profile' => '10MB',
            'status' => 'unmatched',
            'first_seen_at' => now()->subDay(),
            'last_seen_at' => now()->subDay(),
        ]);
        $customer = Customer::create([
            'code' => 'CUST-STAGED',
            'name' => 'Later Customer',
            'phone' => '080000000099',
            'address' => 'Matched Address',
            'pppoe_user' => 'later.customer',
            'package_id' => $package->id,
            'status' => 'active',
        ]);

        $mikrotik = Mockery::mock(MikrotikService::class);
        $mikrotik->shouldReceive('connect')->once();
        $mikrotik->shouldReceive('disconnect')->once();
        $mikrotik->shouldReceive('getPPPSecrets')->once()->andReturn([
            ['name' => 'later.customer', 'profile' => '20MB'],
        ]);

        $result = (new RouterSyncService($mikrotik))->syncCustomers($router);

        $this->assertSame(1, $result['mapped']);
        $this->assertSame(1, $result['staged_matched']);
        $this->assertDatabaseHas('router_staged_customers', [
            'router_id' => $router->id,
            'pppoe_user' => 'later.customer',
            'matched_customer_id' => $customer->id,
            'status' => 'matched',
        ]);
    }

    public function test_staged_router_secret_missing_from_later_scan_is_marked_gone(): void
    {
        $router = $this->router();
        RouterStagedCustomer::create([
            'router_id' => $router->id,
            'pppoe_user' => 'gone.user',
            'profile' => '10MB',
            'status' => 'unmatched',
            'first_seen_at' => now()->subDay(),
            'last_seen_at' => now()->subDay(),
        ]);

        $mikrotik = Mockery::mock(MikrotikService::class);
        $mikrotik->shouldReceive('connect')->once();
        $mikrotik->shouldReceive('disconnect')->once();
        $mikrotik->shouldReceive('getPPPSecrets')->once()->andReturn([]);

        $result = (new RouterSyncService($mikrotik))->syncCustomers($router);

        $this->assertSame(1, $result['staged_gone']);
        $this->assertDatabaseHas('router_staged_customers', [
            'router_id' => $router->id,
            'pppoe_user' => 'gone.user',
            'status' => 'gone',
        ]);
    }

    public function test_assigned_ebilling_customer_missing_from_router_is_marked_missing_without_changing_router_fields(): void
    {
        $router = $this->router();
        $package = $this->package('PKG-MISSING');
        $customer = Customer::create([
            'code' => 'CUST-002',
            'name' => 'Missing User',
            'phone' => '080000000002',
            'address' => 'Missing Address',
            'pppoe_user' => 'missing.user',
            'package_id' => $package->id,
            'router_id' => $router->id,
            'status' => 'active',
            'mikrotik_profile' => 'OLD',
        ]);

        $mikrotik = Mockery::mock(MikrotikService::class);
        $mikrotik->shouldReceive('connect')->once();
        $mikrotik->shouldReceive('disconnect')->once();
        $mikrotik->shouldReceive('getPPPSecrets')->once()->andReturn([]);

        $result = (new RouterSyncService($mikrotik))->syncCustomers($router);
        $customer->refresh();

        $this->assertSame(1, $result['not_found_ebilling']);
        $this->assertSame('OLD', $customer->mikrotik_profile);
        $this->assertSame($router->id, $customer->router_id);
        $this->assertSame('missing', $customer->mikrotik_sync_status);
        $this->assertNull($customer->mikrotik_synced_at);
        $this->assertNotNull($customer->mikrotik_sync_checked_at);
    }

    public function test_customer_without_router_or_pppoe_remains_unknown_after_router_scan(): void
    {
        $router = $this->router();
        $package = $this->package('PKG-UNKNOWN');
        $customer = Customer::create([
            'code' => 'CUST-003',
            'name' => 'Unknown User',
            'phone' => '080000000003',
            'address' => 'Unknown Address',
            'pppoe_user' => '',
            'package_id' => $package->id,
            'status' => 'active',
        ]);

        $mikrotik = Mockery::mock(MikrotikService::class);
        $mikrotik->shouldReceive('connect')->once();
        $mikrotik->shouldReceive('disconnect')->once();
        $mikrotik->shouldReceive('getPPPSecrets')->once()->andReturn([]);

        (new RouterSyncService($mikrotik))->syncCustomers($router);
        $customer->refresh();

        $this->assertSame('unknown', $customer->mikrotik_sync_status);
        $this->assertNull($customer->mikrotik_synced_at);
        $this->assertNull($customer->mikrotik_sync_checked_at);
    }

    public function test_billing_generation_excludes_imported_rows(): void
    {
        $package = Package::create([
            'name' => 'Billable Package',
            'code' => 'PKG-BILLABLE',
            'price' => 100000,
        ]);

        $realCustomer = Customer::create([
            'code' => 'CUST-BILLABLE',
            'name' => 'Real Customer',
            'phone' => '080000000003',
            'address' => 'Real Address',
            'pppoe_user' => 'real.customer',
            'package_id' => $package->id,
            'status' => 'active',
        ]);

        $importedCustomer = Customer::create([
            'code' => 'IMP-BILL',
            'name' => 'Imported Customer',
            'phone' => '',
            'address' => 'Imported Address',
            'pppoe_user' => 'imported.customer',
            'package_id' => $package->id,
            'status' => 'active',
        ]);

        $this->artisan('billing:generate', [
            '--month' => now()->format('Y-m'),
        ])->assertExitCode(0);

        $this->assertDatabaseHas('invoices', ['customer_id' => $realCustomer->id]);
        $this->assertDatabaseMissing('invoices', ['customer_id' => $importedCustomer->id]);
    }

    private function router(array $overrides = []): Router
    {
        return Router::create(array_merge([
            'name' => 'Test Router ' . uniqid(),
            'ip_address' => '10.10.10.' . rand(1, 254),
            'username' => 'admin',
            'password' => 'secret',
            'port' => 8728,
            'is_active' => true,
        ], $overrides));
    }

    private function package(string $code): Package
    {
        return Package::create([
            'name' => $code,
            'code' => $code,
            'price' => 100000,
        ]);
    }
}
