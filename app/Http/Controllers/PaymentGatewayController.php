<?php

namespace App\Http\Controllers;

use App\Models\PaymentGatewayEvent;
use App\Models\Setting;
use App\Services\PaymentGatewayService;
use Illuminate\Http\Request;

class PaymentGatewayController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(PaymentGatewayEvent::query()
            ->with('invoice:id,code,uuid,status,amount')
            ->latest()
            ->paginate((int) $request->input('limit', 50)));
    }

    public function webhook(Request $request, string $provider, PaymentGatewayService $service)
    {
        $secret = Setting::get("payment_gateway_{$provider}_webhook_secret");

        if ($secret) {
            $given = $request->header('X-Webhook-Token')
                ?: $request->header('X-Callback-Token')
                ?: $request->header('X-Signature');

            abort_unless(hash_equals((string) $secret, (string) $given), 401, 'Invalid webhook token.');
        }

        $event = $service->handleWebhook($provider, $request->all());

        return response()->json([
            'ok' => true,
            'event_id' => $event->id,
            'invoice_id' => $event->invoice_id,
            'status' => $event->status,
        ]);
    }
}
