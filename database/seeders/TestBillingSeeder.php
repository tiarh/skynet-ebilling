<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Customer;
use App\Models\Package;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class TestBillingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Truncate relevant tables to start fresh
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        Customer::truncate();
        DB::table('invoices')->truncate();
        DB::table('invoice_broadcasts')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // Ensure Package exists
        $package = Package::firstOrCreate(
            ['name' => 'Paket Test 10Mbps'],
            [
                'code' => 'PKG-TEST-10M',
                'price' => 150000,
                'rate_limit' => '10M/10M',
            ]
        );

        $testPhone = '6289688597253'; // User's phone

        // 1. Customer H-5 (Due in 5 days)
        // If today is Feb 2nd, Due date should be Feb 7th.
        // So Join Date should be 7th of any month.
        $dateH5 = now()->addDays(5); 

        Customer::create([
            'name' => 'Test User H-5',
            'code' => 'TEST-001',
            'phone' => $testPhone,
            'address' => 'Test Address 1',
            'package_id' => $package->id,
            'pppoe_user' => 'test_h5',
            'pppoe_password' => '123456',
            'status' => 'active',
            'join_date' => now()->subMonth()->setDay($dateH5->day), // Recently joined, cycle aligned
        ]);

        // 2. Customer H-Day (Due Today)
        // If today is Feb 2nd, Due date is Feb 2nd.
        // So Join Date should be 2nd.
        $dateHDay = now();

        Customer::create([
            'name' => 'Test User H-Day',
            'code' => 'TEST-002',
            'phone' => $testPhone,
            'address' => 'Test Address 2',
            'package_id' => $package->id,
            'pppoe_user' => 'test_hday',
            'pppoe_password' => '123456',
            'status' => 'active',
            'join_date' => now()->subMonth()->setDay($dateHDay->day),
        ]);

        // 3. Customer H+3 Block (Overdue by 3 days)
        // If today is Feb 2nd, Due date was Jan 30th (or Jan 31st depending on exact calculation, lets say 3 days ago).
        // Due Date = Feb 2nd - 3 days = Jan 30th.
        // So Join Date should be 30th.
        $dateOverdue = now()->subDays(3);

        Customer::create([
            'name' => 'Test User Overdue',
            'code' => 'TEST-003',
            'phone' => $testPhone,
            'address' => 'Test Address 3',
            'package_id' => $package->id,
            'pppoe_user' => 'test_overdue',
            'pppoe_password' => '123456',
            'status' => 'active', // Will be switched to isolated by system
            'join_date' => now()->subMonths(2)->setDay($dateOverdue->day),
        ]);

        $this->command->info("Test data created with phone: {$testPhone}");
        $this->command->info("H-5 Due: " . $dateH5->format('Y-m-d'));
        $this->command->info("H-Day Due: " . $dateHDay->format('Y-m-d'));
        $this->command->info("Overdue Due: " . $dateOverdue->format('Y-m-d'));
    }
}
