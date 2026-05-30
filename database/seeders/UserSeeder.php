<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create Admin User if not exists
        User::firstOrCreate(
            ['email' => 'admin@skynet.id'],
            [
                'name' => 'Admin Skynet',
                'password' => Hash::make('skynet123'),
                'email_verified_at' => now(),
                'role' => 'superadmin',
            ]
        );

        // Aisyah
        User::firstOrCreate(
            ['email' => 'aisyah@skynet.id'],
            [
                'name' => 'Aisyah',
                'password' => Hash::make('skynet123'),
                'email_verified_at' => now(),
                'role' => 'admin',
            ]
        );

        // Hawwin
        User::firstOrCreate(
            ['email' => 'hawwin@skynet.id'],
            [
                'name' => 'Hawwin',
                'password' => Hash::make('skynet123'),
                'email_verified_at' => now(),
                'role' => 'admin',
            ]
        );

        // NOC
        User::firstOrCreate(
            ['email' => 'noc@skynet.id'],
            [
                'name' => 'NOC Skynet',
                'password' => Hash::make('skynet123'),
                'email_verified_at' => now(),
                'role' => 'admin',
            ]
        );
    }
}
