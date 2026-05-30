<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Package;

class SmartMapPackages extends Seeder
{
    public function run()
    {
        $packages = Package::all();
        $count = 0;

        foreach ($packages as $pkg) {
            $name = strtoupper($pkg->name);
            $profile = null;

            // Heuristic Mapping Logic
            if (str_contains($name, '100M')) $profile = '100MB';
            elseif (str_contains($name, '50M')) $profile = '50MB';
            elseif (str_contains($name, '30M')) $profile = '30MB';
            elseif (str_contains($name, '25M')) $profile = '25MB';
            elseif (str_contains($name, '20M')) $profile = '20MB';
            elseif (str_contains($name, '15M')) $profile = '15MB';
            elseif (str_contains($name, '10M')) $profile = '10MB';
            elseif (str_contains($name, '5M')) $profile = '5MB';
            elseif (str_contains($name, '3M')) $profile = '3Mb'; // Specific case
            elseif (str_contains($name, '2M')) $profile = '2M';
            elseif (str_contains($name, '1M')) $profile = '1M';

            if ($profile) {
                $pkg->update(['mikrotik_profile' => $profile]);
                $this->command->info("Mapped '{$pkg->name}' -> '{$profile}'");
                $count++;
            } else {
                $this->command->warn("Skipped '{$pkg->name}' (No clear match)");
            }
        }
        
        $this->command->info("---");
        $this->command->info("Successfully mapped {$count} packages.");
    }
}
