<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Customer;
use App\Models\Area;
use Illuminate\Support\Facades\File;

class LinkCustomerAreaSeeder extends Seeder
{
    public function run()
    {
        $jsonPath = base_path('migration_data/customers_clean.json');

        if (!File::exists($jsonPath)) {
            $this->command->error("File not found: $jsonPath");
            return;
        }

        $jsonData = json_decode(File::get($jsonPath), true);

        if (!$jsonData) {
            $this->command->error("Invalid JSON data");
            return;
        }

        $this->command->info("Linking customers to areas...");

        // Pre-fetch all areas to minimize DB queries
        $areas = Area::all()->pluck('id', 'name');

        foreach ($jsonData as $item) {
            $customerCode = $item['id_pelanggan']; // Assuming 'id_pel' maps to 'code' in Customer model
            $areaName = $item['nama_lokasi'];

            if (!$customerCode || !$areaName) {
                continue;
            }

            if (isset($areas[$areaName])) {
                Customer::where('code', $customerCode)
                    ->update(['area_id' => $areas[$areaName]]);
            }
        }

        $this->command->info("Customer areas linked successfully.");
    }
}
