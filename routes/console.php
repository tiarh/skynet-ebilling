<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Scheduled Commands
Schedule::command('billing:generate')
    ->monthlyOn(1, '00:00')
    ->description('Generate monthly invoices for active customers');

Schedule::command('billing:check-overdue')
    ->dailyAt('08:00')
    ->description('Check overdue invoices and isolate delinquent customers');




Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
