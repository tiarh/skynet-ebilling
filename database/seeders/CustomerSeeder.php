<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use App\Models\Customer;
use App\Models\Package;
use Carbon\Carbon;

class CustomerSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $jsonPath = base_path('final_customer_data.json');

        if (!File::exists($jsonPath)) {
            $this->command->error("File not found: {$jsonPath}");
            return;
        }

        $json = File::get($jsonPath);
        $customers = json_decode($json, true);

        if (!$customers) {
            $this->command->error("Failed to decode JSON");
            return;
        }

        $this->command->info("Found " . count($customers) . " customers to process...");

        // Pre-fetch packages to minimize queries
        $packages = Package::all()->keyBy('name');
        
        // Fallback package if mismatch
        $defaultPackage = Package::firstOrCreate(
            ['name' => 'Paket Unknown'],
            [
                'code' => 'PKG-UNKNOWN',
                'price' => 100000,
                'rate_limit' => 'Unknown',
            ]
        );

        $count = 0;
        foreach ($customers as $data) {
            $pppoeUser = $data['pppoe_username'] ?? null;
            
            // Skip invalid data
            if (!$pppoeUser) {
                continue;
            }

            // Find or Create Package
            $packageName = $data['package'] ?? 'Unknown';
            
            if (!$packages->has($packageName)) {
                $createdPackage = Package::firstOrCreate(
                    ['name' => $packageName],
                    [
                        'price' => $data['price'] ?? 0,
                        'code' => 'PKG-' . strtoupper(substr(md5($packageName), 0, 8)),
                        'rate_limit' => $data['bandwidth'] ?? 'Unknown',
                    ]
                );
                $packages->put($packageName, $createdPackage);
            }
            
            $package = $packages->get($packageName);

            // Map Status
            $status = strtolower($data['status'] ?? 'active');
            if (!in_array($status, ['active', 'suspended', 'isolated', 'offboarding'])) {
                $status = 'active';
            }

            // Parse Date
            try {
                $joinDate = isset($data['join_date']) 
                    ? Carbon::parse($data['join_date']) 
                    : now();
            } catch (\Exception $e) {
                $joinDate = now();
            }

            // Check if code already exists
            $code = $data['code'] ?? null;
            if ($code && Customer::where('code', $code)->where('pppoe_user', '!=', $pppoeUser)->exists()) {
                // Code exists for different customer, make it unique
                $code = $code . '-' . substr(md5($pppoeUser), 0, 4);
            }

            Customer::updateOrCreate(
                ['pppoe_user' => $pppoeUser], // Unique Key
                [
                    'code' => $code,
                    'name' => $data['name'] ?? 'Unknown',
                    'address' => $data['address'] ?? '-',
                    'phone' => $data['phone'] ?? null,
                    'nik' => $data['nik'] ?? null,
                    'package_id' => $package->id,
                    'status' => $status,
                    'join_date' => $joinDate,
                    'geo_lat' => (is_numeric($data['latitude']) && abs($data['latitude']) <= 90) ? $data['latitude'] : null,
                    'geo_long' => (is_numeric($data['longitude']) && abs($data['longitude']) <= 180) ? $data['longitude'] : null,
                    // Default password for imports if not specified
                    'pppoe_password' => $data['pppoe_password'] ?? '123456', 
                ]
            );

            $count++;
            if ($count % 100 === 0) {
                $this->command->info("Processed {$count} customers...");
            }
        }

        $this->command->info("Done! Processed {$count} records.");
    }
}
