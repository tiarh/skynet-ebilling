<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            UserSeeder::class,              // Create Admin & Staff
            SettingSeeder::class,           // General App Settings
            BillingSettingsSeeder::class,   // Billing Configuration
            IsolationProfileSeeder::class,  // Mikrotik Isolation Profiles
            RouterSeeder::class,            // Seed network routers
            AreaSeeder::class,              // Operational Areas
            ImportPackagesSeeder::class,    // Internet Packages
            LegacyDataSeeder::class,        // Import Production Customers & Invoices
        ]);

        if (env('SEED_TEST_BILLING_SCENARIOS', false)) {
            $this->call(TestBillingSeeder::class);
        }
    }
}
