<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Setting;
use Inertia\Inertia;

class PublicInvoiceController extends Controller
{
    public function show($uuid)
    {
        $invoice = Invoice::where('uuid', $uuid)->with(['customer', 'transactions'])->firstOrFail();

        return Inertia::render('Public/Payment/Show', [
            'invoice' => $invoice,
            'company' => [
                'name' => Setting::get('company_name', 'Skynet Network'),
                'address' => Setting::get('company_address', ''),
            ],
            'manual_accounts' => Setting::get('payment_channels', []),
        ]);
    }
}
