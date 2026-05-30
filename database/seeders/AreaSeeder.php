<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class AreaSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $jsonPath = base_path('migration_data/customers_final.json');

        if (!file_exists($jsonPath)) {
            $this->command->error("File not found: $jsonPath");
            return;
        }

        $jsonData = json_decode(file_get_contents($jsonPath), true);
        
        if (!$jsonData) {
            $this->command->error("Invalid JSON data");
            return;
        }

        $areas = collect($jsonData)->map(function ($row) {
            $areaFromData = $row['nama_lokasi'] ?? null;
            $inferredArea = $this->inferAreaFromPackage($row['paket'] ?? $row['package'] ?? '');
            
            return $areaFromData ?: $inferredArea;
        });

        $areas = $areas->filter()->unique()->values();

        $this->command->info("Found " . $areas->count() . " unique areas.");

        foreach ($areas as $areaName) {
            \App\Models\Area::firstOrCreate(
                ['name' => $areaName],
                ['code' => \Illuminate\Support\Str::slug($areaName)]
            );
        }
    }

    private function inferAreaFromPackage(string $packageName): string
    {
        $name = strtoupper($packageName);
        
        if (str_contains($name, 'KRIAN')) return 'SKYNET-KRIAN';
        if (str_contains($name, 'WAJAK')) return 'SKYNET-WAJAK';
        if (str_contains($name, 'BUMIAYU')) return 'SKYNET-BUMIAYU';
        if (str_contains($name, 'KENDIT')) return 'SKYNET-KENDIT';
        if (str_contains($name, 'PASURUAN')) return 'SKYNET-PASURUAN';
        if (str_contains($name, 'MALANG')) return 'SKYNET-MALANG';
        if (str_contains($name, 'BLITAR')) return 'SKYNET-BLITAR';
        if (str_contains($name, 'MARTOPURO')) return 'SKYNET-MARTOPURO';
        if (str_contains($name, 'COMBORAN')) return 'SKYNET-COMBORAN';
        if (str_contains($name, 'PUROWOSARI')) return 'SKYNET-PURWOSARI';
        
        return 'SKYNET-GENERAL';
    }
}
