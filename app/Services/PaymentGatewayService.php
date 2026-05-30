<?php

namespace App\Services;

use App\Jobs\ReconnectCustomerJob;
use App\Models\Invoice;
use App\Models\PaymentGatewayEvent;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentGatewayService
{
    public function handleWebhook(string $provider, array $payload): PaymentGatewayEvent
    {
        return DB::transaction(function () use ($provider, $payload) {
            $externalId = $this->firstString($payload, ['id', 'event_id', 'transaction_id', 'external_id', 'payment_id']);
            $reference = $this->firstString($payload, ['reference', 'external_id', 'merchant_ref', 'order_id', 'invoice_id']);
            $status = strtolower($this->firstString($payload, ['status', 'payment_status', 'transaction_status']) ?? 'unknown');
            $amount = $this->firstNumber($payload, ['amount', 'paid_amount', 'gross_amount', 'total_amount']);
            $invoice = $this->resolveInvoice($reference, $payload);

            $event = PaymentGatewayEvent::updateOrCreate(
                ['provider' => $provider, 'external_id' => $externalId ?: md5(json_encode($payload))],
                [
                    'reference' => $reference,
                    'invoice_id' => $invoice?->id,
                    'amount' => $amount,
                    'status' => $status,
                    'payload' => $payload,
                    'processed_at' => now(),
                ]
            );

            if ($invoice && $this->isPaidStatus($status)) {
                $this->markInvoicePaid($invoice, $amount ?: (float) $invoice->amount, $provider, $externalId ?: $reference);
            }

            return $event;
        });
    }

    protected function markInvoicePaid(Invoice $invoice, float $amount, string $provider, ?string $externalId): void
    {
        $reference = 'PG-' . strtoupper($provider) . '-' . ($externalId ?: Str::random(12));

        Transaction::firstOrCreate(
            ['reference' => $reference],
            [
                'invoice_id' => $invoice->id,
                'amount' => $amount,
                'channel' => 'manual',
                'method' => 'qris',
                'status' => 'paid',
                'paid_at' => now(),
            ]
        );

        if ($invoice->transactions()->whereIn('status', ['verified', 'paid'])->sum('amount') >= $invoice->amount) {
            $invoice->update(['status' => 'paid']);

            if ($invoice->customer?->status === 'isolated') {
                ReconnectCustomerJob::dispatch($invoice->customer);
            }
        }
    }

    protected function resolveInvoice(?string $reference, array $payload): ?Invoice
    {
        $candidate = $reference ?: $this->firstString($payload, ['invoice_uuid', 'invoice_code']);

        if (! $candidate) {
            return null;
        }

        return Invoice::where('uuid', $candidate)
            ->orWhere('code', $candidate)
            ->orWhere('payment_link', 'like', '%' . $candidate . '%')
            ->first();
    }

    protected function isPaidStatus(string $status): bool
    {
        return in_array($status, ['paid', 'settled', 'success', 'capture', 'completed'], true);
    }

    protected function firstString(array $payload, array $keys): ?string
    {
        foreach ($keys as $key) {
            if (isset($payload[$key]) && trim((string) $payload[$key]) !== '') {
                return trim((string) $payload[$key]);
            }
        }

        return null;
    }

    protected function firstNumber(array $payload, array $keys): ?float
    {
        foreach ($keys as $key) {
            if (isset($payload[$key]) && is_numeric($payload[$key])) {
                return (float) $payload[$key];
            }
        }

        return null;
    }
}
