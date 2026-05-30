<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Package;

class ImportPackagesSeeder extends Seeder
{
    public function run()
    {
        $packages = [
            ['name' => 'Paket 10M +', 'price' => 150000, 'bandwidth_label' => '10MB'],
            ['name' => 'Paket 10M Promo', 'price' => 115000, 'bandwidth_label' => '10Mbps'],
            ['name' => 'Paket Free', 'price' => 0, 'bandwidth_label' => 'Free'],
            ['name' => 'Paket up to 5M', 'price' => 100000, 'bandwidth_label' => '5Mbps'],
            ['name' => 'Paket 5M Global', 'price' => 125000, 'bandwidth_label' => '5Mbps'],
            ['name' => 'Paket Up To 5MB', 'price' => 111000, 'bandwidth_label' => '5M'],
            ['name' => 'Paket UpTo 10Mbps Bumiayu', 'price' => 110000, 'bandwidth_label' => '10MB'],
            ['name' => 'Paket 5M Krian', 'price' => 125000, 'bandwidth_label' => '5Mbps'],
            ['name' => 'Paket up to 15M KENDIT', 'price' => 175000, 'bandwidth_label' => '15Mbps'],
            ['name' => 'Paket 15M', 'price' => 200000, 'bandwidth_label' => '15MB'],
            ['name' => 'Paket 5M Pakis', 'price' => 110000, 'bandwidth_label' => '5Mbps'],
            ['name' => 'Paket 5MB Malang', 'price' => 135000, 'bandwidth_label' => '5MB'],
            ['name' => 'Paket Up To 5MB Titik', 'price' => 55000, 'bandwidth_label' => '5MB'],
            ['name' => 'Paket up to 10M Comboran', 'price' => 80000, 'bandwidth_label' => '10Mbps'],
            ['name' => 'Paket 10M-', 'price' => 165000, 'bandwidth_label' => '10MB'],
            ['name' => 'Paket up to 5M BLITAR', 'price' => 130000, 'bandwidth_label' => '5Mbps'],
            ['name' => 'Paket up to 5Mb WAJAK', 'price' => 100000, 'bandwidth_label' => '5MB'],
            ['name' => 'Paket up to 25Mb Promo', 'price' => 125000, 'bandwidth_label' => '25Mbps'],
            ['name' => 'Paket up to 15M', 'price' => 250000, 'bandwidth_label' => '15MB'],
            ['name' => 'Paket Up To 20MB', 'price' => 175000, 'bandwidth_label' => '20Mbps'],
            ['name' => 'Paket 10MB Karangploso 1', 'price' => 130000, 'bandwidth_label' => '10MB'],
            ['name' => 'Paket up to 10M Krian', 'price' => 200000, 'bandwidth_label' => '10M'],
            ['name' => 'Paket up to 5M KENDIT', 'price' => 100000, 'bandwidth_label' => '5Mbps'],
            ['name' => 'Paket Up To 4 Mbps', 'price' => 100000, 'bandwidth_label' => '4M'],
            ['name' => 'Paket 10Mb Karangploso 2', 'price' => 135000, 'bandwidth_label' => '10Mbps'],
            ['name' => 'Paket 5MB Promo', 'price' => 75000, 'bandwidth_label' => '5Mb'],
            ['name' => 'Paket UpTo 10Mbps Protong', 'price' => 135000, 'bandwidth_label' => '10MB'],
            ['name' => 'Paket Up to 10M', 'price' => 115000, 'bandwidth_label' => '10Mb'],
            ['name' => 'Paket up to 50Mb Promo', 'price' => 150000, 'bandwidth_label' => '50Mbps'],
            ['name' => 'Paket 25MB', 'price' => 330000, 'bandwidth_label' => '25M'],
            ['name' => 'Paket up to 5M MARTOPURO', 'price' => 120000, 'bandwidth_label' => '5Mbps'],
            ['name' => 'Paket UpTo 10Mbps', 'price' => 100000, 'bandwidth_label' => '10MB'],
            ['name' => 'Paket 10MB Purwosari', 'price' => 120000, 'bandwidth_label' => '10MB'],
            ['name' => 'Paket up to 10M Malang', 'price' => 138750, 'bandwidth_label' => '10Mbps'],
            ['name' => 'Paket Up To 10MB', 'price' => 175000, 'bandwidth_label' => '10MB'],
            ['name' => 'Paket 20M Promo', 'price' => 150000, 'bandwidth_label' => '20Mbps'],
            ['name' => 'Paket 5MB Pasuruan', 'price' => 150000, 'bandwidth_label' => '5M'],
            ['name' => 'Paket up to 10M Martopuro', 'price' => 155000, 'bandwidth_label' => '10Mbps'],
            ['name' => 'Paket 20MBps', 'price' => 350000, 'bandwidth_label' => '20MBps'],
            ['name' => 'Paket 10MB Suko', 'price' => 125000, 'bandwidth_label' => '10Mb'],
            ['name' => 'Paket 5Mb TITIK', 'price' => 50000, 'bandwidth_label' => '5M'],
            ['name' => 'SUBNET 200Mb', 'price' => 13320000, 'bandwidth_label' => '200Mbps'],
            ['name' => 'Paket up to 10M', 'price' => 145000, 'bandwidth_label' => '10Mbps'],
            ['name' => 'Paket 10M Up to', 'price' => 160000, 'bandwidth_label' => '10Mbps'],
            ['name' => 'Paket 20M New', 'price' => 250000, 'bandwidth_label' => '20Mbps'],
            ['name' => 'Paket up to 25M', 'price' => 125000, 'bandwidth_label' => '25Mbps'],
            ['name' => 'Paket 10M Promo Pakis', 'price' => 140000, 'bandwidth_label' => '10Mbps'],
            ['name' => 'Paket 5MB-', 'price' => 90000, 'bandwidth_label' => '5M-'],
            ['name' => 'Paket Up To 15MB', 'price' => 175000, 'bandwidth_label' => '15Mb'],
            ['name' => 'Paket 10Mb Promo', 'price' => 135000, 'bandwidth_label' => '10MB'],
            ['name' => 'Paket UpTo 10Mbps Gajahrejo', 'price' => 140000, 'bandwidth_label' => '10MB'],
            ['name' => 'Bandwidth METRO 1G', 'price' => 20000000, 'bandwidth_label' => '1G'],
            ['name' => 'Paket 10M Pakis', 'price' => 150000, 'bandwidth_label' => '10Mbps'],
            ['name' => 'Paket up to 10M BLITAR', 'price' => 155000, 'bandwidth_label' => '10Mbps'],
            ['name' => 'Paket UpTo 5Mbps', 'price' => 130000, 'bandwidth_label' => '5MB'],
            ['name' => 'Paket Upto 10MB Titik', 'price' => 50000, 'bandwidth_label' => '10MB'],
            ['name' => 'Paket up to 10M Purwodadi', 'price' => 140000, 'bandwidth_label' => '10Mbps'],
            ['name' => 'Paket 5M--', 'price' => 80000, 'bandwidth_label' => '5M--'],
            ['name' => 'SUBNET 50Mb', 'price' => 2773750, 'bandwidth_label' => '100Mbps'],
            ['name' => 'SUBNET 30MB', 'price' => 1500000, 'bandwidth_label' => '30Mbps'],
            ['name' => 'Paket 3M Pakis', 'price' => 100000, 'bandwidth_label' => '3Mbps'],
            ['name' => 'Paket UpTo 20Mbps', 'price' => 200000, 'bandwidth_label' => '20Mbps'],
            ['name' => 'Paket 10M New', 'price' => 179000, 'bandwidth_label' => '10Mbps'],
            ['name' => 'Paket 10MBps', 'price' => 100000, 'bandwidth_label' => '10MBps'],
            ['name' => 'Paket 5M TITIK', 'price' => 85000, 'bandwidth_label' => '5Mbps'],
            ['name' => 'Paket 15M Srigading B', 'price' => 173000, 'bandwidth_label' => '15Mbps'],
            ['name' => 'SUBNET 20M', 'price' => 1000000, 'bandwidth_label' => '20Mbps'],
            ['name' => 'Paket UpTo 20Mbps Gajahrejo', 'price' => 140000, 'bandwidth_label' => '20MB'],
            ['name' => 'Paket 20M Pakis', 'price' => 170000, 'bandwidth_label' => '20Mbps'],
        ];

        foreach ($packages as $pkg) {
            Package::firstOrCreate(
                ['name' => $pkg['name']],
                [
                    'code' => 'PKG-' . strtoupper(substr(md5($pkg['name']), 0, 8)),
                    'price' => $pkg['price'], 
                    'rate_limit' => $pkg['bandwidth_label'],
                ]
            );
        }
    }
}
