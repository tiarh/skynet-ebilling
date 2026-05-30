<?php

namespace Database\Seeders;

use App\Models\Router;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RouterSeeder extends Seeder
{
    public function run(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('routers')->delete();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        $routers = [
            ['name' => 'PPoE RANDUAGUNG', 'ip_address' => '10.181.40.2', 'port' => 8728],
            ['name' => 'Antena', 'ip_address' => '10.77.77.3', 'port' => 8728],
            ['name' => 'Metro', 'ip_address' => '10.20.40.2', 'port' => 8728],
            ['name' => 'Martopuro', 'ip_address' => '10.182.53.2', 'port' => 8728],
            ['name' => 'Srigading', 'ip_address' => '10.181.88.2', 'port' => 8728],
            ['name' => 'Lawang', 'ip_address' => '10.181.9.2', 'port' => 8728],
            ['name' => 'Bantaran', 'ip_address' => '10.182.45.2', 'port' => 8728],
            ['name' => 'Karangploso', 'ip_address' => '10.181.30.2', 'port' => 8728],
            ['name' => 'Arjosari', 'ip_address' => '10.150.5.3', 'port' => 8728],
            ['name' => 'Bumiayu', 'ip_address' => '10.150.6.5', 'port' => 8728],
            ['name' => 'Kasin', 'ip_address' => '10.150.5.4', 'port' => 8728],
            ['name' => 'Ngadipuro', 'ip_address' => '10.150.6.3', 'port' => 8728],
            ['name' => 'Sentul', 'ip_address' => '10.183.10.27', 'port' => 8728],
            ['name' => 'Tutur', 'ip_address' => '10.183.10.20', 'port' => 8728],
            ['name' => 'Krian', 'ip_address' => '10.150.6.2', 'port' => 8728],
            ['name' => 'Kendit', 'ip_address' => '10.183.10.11', 'port' => 8728],
            ['name' => 'Blitar', 'ip_address' => '10.183.10.9', 'port' => 8728],
        ];

        foreach ($routers as $router) {
            $this->command->info("Creating router: {$router['name']} ({$router['ip_address']})");
            Router::create([
                'name' => $router['name'],
                'ip_address' => $router['ip_address'],
                'username' => 'userskynet',
                'password' => 'skynet',
                'port' => $router['port'],
                'is_active' => true,
            ]);
        }
    }
}
