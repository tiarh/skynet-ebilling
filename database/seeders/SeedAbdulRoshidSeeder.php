<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Customer;
use App\Models\Package;

class SeedAbdulRoshidSeeder extends Seeder
{
    public function run()
    {
        // 1. Ensure Package Exists
        $package = Package::firstOrCreate(
            ['name' => 'Paket 5M Krian'],
            [
                'code' => 'PKG-5M-KRIAN',
                'price' => 125000,
                'rate_limit' => '5Mbps',
            ]
        );

        // 2. Create Customer
        $customer = Customer::firstOrCreate(
            ['pppoe_user' => 'ABDULROSHIDRT16@SKY-KRI-31'],
            [
                'code' => 'KRN119',
                'name' => 'ABDUL ROSID',
                'address' => 'RT.16/RW.06 BADAS',
                'phone' => '0',
                'nik' => '3515115006770000',
                'package_id' => $package->id,
                'status' => 'active', // Lowercase as per new enum
                'join_date' => '2021-11-30', // "30 November 2021" converted
                'geo_lat' => -7.372358,
                'geo_long' => 112.607408,
            ]
        );

        $this->command->info('Customer ABDUL ROSID seeded successfully.');
    }
}
