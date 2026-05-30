<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;

class LegacyDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('🚀 Starting Legacy Data Migration via API...');

        // Call the new Sync command which uses the API instead of static files
        Artisan::call('sync:legacy', [], $this->command->getOutput());

        $this->command->info('✅ Migration completed successfully!');
    }
}

