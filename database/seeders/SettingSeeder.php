<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Setting;

class SettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Setting::set('company_name', 'Skynet Network', 'text', 'billing');
        Setting::set('company_address', 'Jl. Raya Randuagung No. 123', 'text', 'billing');
        
        Setting::set('payment_channels', [
            [
                'bank' => 'BCA',
                'account_number' => '1234567890',
                'account_name' => 'PT Skynet Network'
            ],
            [
                'bank' => 'Mandiri',
                'account_number' => '0987654321',
                'account_name' => 'PT Skynet Network'
            ]
        ], 'json', 'billing');

        $this->command->info('Settings seeded successfully.');
    }
}
