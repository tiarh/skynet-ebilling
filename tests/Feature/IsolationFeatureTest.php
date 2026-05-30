<?php

namespace Tests\Feature;

use App\Jobs\IsolateCustomerJob;
use App\Jobs\ReconnectCustomerJob;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Package;
use App\Models\Router;
use App\Models\User;
use App\Services\MikrotikService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Mockery;
use Tests\TestCase;

class IsolationFeatureTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_isolate_route_runs_realtime_mikrotik_action_without_dispatching_job(): void
    {
        Bus::fake();
        $customer = $this->customer(['router_id' => $this->router()->id]);
        $admin = User::factory()->create(['role' => 'admin']);
        $mikrotik = Mockery::mock(MikrotikService::class);
        $mikrotik->shouldReceive('isolateCustomerNow')
            ->once()
            ->with(Mockery::on(fn ($value) => $value->is($customer)), 10)
            ->andReturnUsing(function (Customer $customer) {
                $customer->update([
                    'status' => 'isolated',
                    'mikrotik_profile' => $customer->router->isolation_profile ?: 'isolirebilling',
                    'mikrotik_sync_status' => 'synced',
                    'mikrotik_synced_at' => now(),
                    'mikrotik_sync_checked_at' => now(),
                ]);
            });
        $this->app->instance(MikrotikService::class, $mikrotik);

        $this->actingAs($admin)
            ->post(route('customers.isolate', $customer))
            ->assertRedirect()
            ->assertSessionHas('success');

        Bus::assertNotDispatched(IsolateCustomerJob::class);
        $customer->refresh();
        $this->assertSame('isolated', $customer->status);
        $this->assertSame('synced', $customer->mikrotik_sync_status);
        $this->assertNotNull($customer->mikrotik_synced_at);
        $this->assertNotNull($customer->mikrotik_sync_checked_at);
    }

    public function test_admin_reconnect_route_runs_realtime_mikrotik_action_without_dispatching_job(): void
    {
        Bus::fake();
        $customer = $this->customer([
            'router_id' => $this->router()->id,
            'status' => 'isolated',
        ]);
        $admin = User::factory()->create(['role' => 'admin']);
        $mikrotik = Mockery::mock(MikrotikService::class);
        $mikrotik->shouldReceive('reconnectCustomerNow')
            ->once()
            ->with(Mockery::on(fn ($value) => $value->is($customer)), 10)
            ->andReturnUsing(function (Customer $customer) {
                $customer->update([
                    'status' => 'active',
                    'mikrotik_profile' => $customer->previous_profile
                        ?: $customer->package?->mikrotik_profile
                        ?: $customer->mikrotik_profile
                        ?: 'default',
                    'mikrotik_sync_status' => 'synced',
                    'mikrotik_synced_at' => now(),
                    'mikrotik_sync_checked_at' => now(),
                ]);
            });
        $this->app->instance(MikrotikService::class, $mikrotik);

        $this->actingAs($admin)
            ->post(route('customers.reconnect', $customer))
            ->assertRedirect()
            ->assertSessionHas('success');

        Bus::assertNotDispatched(ReconnectCustomerJob::class);
        $customer->refresh();
        $this->assertSame('active', $customer->status);
        $this->assertSame('synced', $customer->mikrotik_sync_status);
        $this->assertNotNull($customer->mikrotik_synced_at);
        $this->assertNotNull($customer->mikrotik_sync_checked_at);
    }

    public function test_failed_realtime_manual_isolate_keeps_customer_active_and_returns_error(): void
    {
        Bus::fake();
        $customer = $this->customer(['router_id' => $this->router()->id]);
        $admin = User::factory()->create(['role' => 'admin']);
        $mikrotik = Mockery::mock(MikrotikService::class);
        $mikrotik->shouldReceive('isolateCustomerNow')
            ->once()
            ->andThrow(new \RuntimeException('router timeout'));
        $this->app->instance(MikrotikService::class, $mikrotik);

        $this->actingAs($admin)
            ->post(route('customers.isolate', $customer))
            ->assertRedirect()
            ->assertSessionHas('error');

        Bus::assertNotDispatched(IsolateCustomerJob::class);
        $this->assertSame('active', $customer->refresh()->status);
    }

    public function test_manual_isolate_without_router_keeps_status_and_returns_error(): void
    {
        Bus::fake();
        $customer = $this->customer(['router_id' => null]);
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)
            ->post(route('customers.isolate', $customer))
            ->assertRedirect()
            ->assertSessionHas('error');

        Bus::assertNotDispatched(IsolateCustomerJob::class);
        $this->assertSame('active', $customer->refresh()->status);
    }

    public function test_manual_reconnect_without_router_keeps_status_and_returns_error(): void
    {
        Bus::fake();
        $customer = $this->customer([
            'router_id' => null,
            'status' => 'isolated',
        ]);
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)
            ->post(route('customers.reconnect', $customer))
            ->assertRedirect()
            ->assertSessionHas('error');

        Bus::assertNotDispatched(ReconnectCustomerJob::class);
        $this->assertSame('isolated', $customer->refresh()->status);
    }

    public function test_overdue_command_dispatches_isolation_for_active_overdue_customer_only(): void
    {
        Bus::fake();
        $router = $this->router();
        $active = $this->customer(['router_id' => $router->id, 'status' => 'active']);
        $isolated = $this->customer([
            'code' => 'CUST-ISO',
            'pppoe_user' => 'already.iso',
            'router_id' => $router->id,
            'status' => 'isolated',
        ]);

        $this->invoice($active, ['due_date' => now()->subDays(10), 'status' => 'unpaid']);
        $this->invoice($isolated, ['due_date' => now()->subDays(10), 'status' => 'unpaid']);

        $this->artisan('billing:check-overdue')->assertExitCode(0);

        Bus::assertDispatched(IsolateCustomerJob::class, 1);
        Bus::assertDispatched(IsolateCustomerJob::class, fn ($job) => $job->customer->is($active));
    }

    public function test_manual_payment_dispatches_reconnect_for_isolated_paid_customer(): void
    {
        Bus::fake();
        $customer = $this->customer([
            'router_id' => $this->router()->id,
            'status' => 'isolated',
        ]);
        $invoice = $this->invoice($customer, ['amount' => 100000, 'status' => 'unpaid']);
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)->post(route('payments.store', $invoice), [
            'amount' => 100000,
            'method' => 'cash',
            'paid_at' => now()->toDateString(),
        ])->assertRedirect();

        Bus::assertDispatched(ReconnectCustomerJob::class, fn ($job) => $job->customer->is($customer));
        $this->assertSame('paid', $invoice->refresh()->status);
    }

    public function test_isolation_job_saves_previous_profile_and_uses_router_isolation_profile(): void
    {
        $router = $this->router(['isolation_profile' => 'ISOLIR-CUSTOM']);
        $customer = $this->customer(['router_id' => $router->id, 'pppoe_user' => 'user.iso']);

        $mikrotik = Mockery::mock(MikrotikService::class);
        $mikrotik->shouldReceive('connect')->once()->with(Mockery::on(fn ($value) => $value->is($router)))->andReturnSelf();
        $mikrotik->shouldReceive('isolateUser')->once()->with('user.iso')->andReturnUsing(function () use ($customer) {
            $customer->update(['previous_profile' => '20MB']);
            return true;
        });
        $mikrotik->shouldReceive('disconnect')->once();

        (new IsolateCustomerJob($customer))->handle($mikrotik);

        $this->assertSame('isolated', $customer->refresh()->status);
        $this->assertSame('20MB', $customer->previous_profile);
        $this->assertSame('synced', $customer->mikrotik_sync_status);
        $this->assertNotNull($customer->mikrotik_synced_at);
        $this->assertNotNull($customer->mikrotik_sync_checked_at);
    }

    public function test_reconnect_job_restores_profile_and_clears_previous_profile(): void
    {
        $router = $this->router();
        $customer = $this->customer([
            'router_id' => $router->id,
            'status' => 'isolated',
            'previous_profile' => '20MB',
            'mikrotik_profile' => '10MB',
        ]);

        $mikrotik = Mockery::mock(MikrotikService::class);
        $mikrotik->shouldReceive('connect')->once()->with(Mockery::on(fn ($value) => $value->is($router)))->andReturnSelf();
        $mikrotik->shouldReceive('reconnectUser')->once()->with($customer->pppoe_user, 'PACKAGE_PROFILE')->andReturnUsing(function () use ($customer) {
            $customer->update(['previous_profile' => null]);
            return true;
        });
        $mikrotik->shouldReceive('disconnect')->once();

        (new ReconnectCustomerJob($customer))->handle($mikrotik);

        $this->assertSame('active', $customer->refresh()->status);
        $this->assertNull($customer->previous_profile);
        $this->assertSame('20MB', $customer->mikrotik_profile);
        $this->assertSame('synced', $customer->mikrotik_sync_status);
        $this->assertNotNull($customer->mikrotik_synced_at);
        $this->assertNotNull($customer->mikrotik_sync_checked_at);
    }

    public function test_mikrotik_service_uses_router_profile_and_restores_saved_profile(): void
    {
        $router = $this->router(['isolation_profile' => 'ISOLIR-CUSTOM']);
        $customer = $this->customer(['router_id' => $router->id, 'pppoe_user' => 'service.user']);
        $service = new FakeIsolationMikrotikService([
            ['name' => 'default'],
            ['name' => 'isolir-custom'],
        ], [
            '.id' => '*1',
            'name' => 'service.user',
            'profile' => '20MB',
        ]);
        $service->connect($router);

        $this->assertTrue($service->isolateUser('service.user'));
        $this->assertSame('isolir-custom', $service->lastSetProfile);
        $this->assertSame('20MB', $customer->refresh()->previous_profile);

        $service->secret['profile'] = 'isolir-custom';
        $this->assertTrue($service->reconnectUser('service.user', 'default'));
        $this->assertSame('20MB', $service->lastSetProfile);
        $this->assertNull($customer->refresh()->previous_profile);
    }

    public function test_live_isolation_command_preflight_does_not_dispatch_jobs_without_yes(): void
    {
        Bus::fake();
        $router = $this->router();
        $customer = $this->customer(['router_id' => $router->id]);

        $mikrotik = Mockery::mock(MikrotikService::class);
        $mikrotik->shouldReceive('connect')->once()->andReturnSelf();
        $mikrotik->shouldReceive('getPPPSecret')->once()->with($customer->pppoe_user)->andReturn([
            '.id' => '*1',
            'name' => $customer->pppoe_user,
            'profile' => '20MB',
        ]);
        $mikrotik->shouldReceive('disconnect')->once();
        $this->app->instance(MikrotikService::class, $mikrotik);

        $this->artisan('network:test-isolation', ['customer_id' => $customer->id])
            ->expectsOutputToContain('Preflight only')
            ->assertExitCode(0);

        Bus::assertNothingDispatched();
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

    private function customer(array $overrides = []): Customer
    {
        $package = Package::first() ?: Package::create([
            'code' => 'PKG-BASIC',
            'name' => 'Basic',
            'price' => 100000,
            'mikrotik_profile' => 'PACKAGE_PROFILE',
        ]);

        return Customer::create(array_merge([
            'code' => 'CUST-' . strtoupper(substr(uniqid(), -6)),
            'name' => 'Isolation Customer',
            'phone' => '081234567890',
            'address' => 'Isolation Address',
            'pppoe_user' => 'user.' . substr(uniqid(), -6),
            'package_id' => $package->id,
            'status' => 'active',
        ], $overrides));
    }

    private function invoice(Customer $customer, array $overrides = []): Invoice
    {
        return Invoice::create(array_merge([
            'customer_id' => $customer->id,
            'period' => now()->startOfMonth()->toDateString(),
            'amount' => 100000,
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => 'unpaid',
            'generated_at' => now(),
        ], $overrides));
    }
}

class FakeIsolationMikrotikService extends MikrotikService
{
    public ?string $lastSetProfile = null;

    public function __construct(private array $profiles, public array $secret)
    {
    }

    public function connect(Router $router, array $options = []): self
    {
        $this->router = $router;

        return $this;
    }

    protected function ensureConnected(): void
    {
    }

    public function getProfiles(): array
    {
        return $this->profiles;
    }

    protected function findPPPSecret(string $username): ?array
    {
        return $this->secret['name'] === $username ? $this->secret : null;
    }

    protected function setPPPSecretProfile(array $secret, string $profile): void
    {
        $this->lastSetProfile = $profile;
        $this->secret['profile'] = $profile;
    }

    public function kickUser(string $username): void
    {
    }
}
