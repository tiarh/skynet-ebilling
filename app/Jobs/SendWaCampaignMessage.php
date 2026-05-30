<?php

namespace App\Jobs;

use App\Models\WaCampaignRecipient;
use App\Services\WhatspieService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

class SendWaCampaignMessage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public WaCampaignRecipient $recipient)
    {
    }

    public function handle(WhatspieService $whatspie): void
    {
        $campaign = $this->recipient->campaign;

        if ($this->recipient->status !== 'pending' && $this->recipient->status !== 'failed') {
            return;
        }

        $customer = $this->recipient->customer;
        $message = $campaign->message_template;
        
        if ($customer) {
            $message = str_replace('{name}', $customer->name, $message);
            $billingAmount = $customer->package ? $customer->package->price : 0;
            $message = str_replace('{billing_amount}', 'Rp ' . number_format($billingAmount, 0, ',', '.'), $message);
        }

        $response = $whatspie->sendMessage($this->recipient->phone_number, $message);

        // Lock campaign to prevent race conditions during updates
        // To be safe we'll use DB transactions for count
        \DB::transaction(function() use ($campaign, $response, $message) {
            // refresh campaign
            $campaign->refresh();

            if ($response) {
                $this->recipient->update([
                    'status' => 'sent',
                    'sent_at' => now(),
                    'error_message' => null,
                ]);
                $campaign->increment('sent_count');
            } else {
                $this->recipient->update([
                    'status' => 'failed',
                    'error_message' => 'Failed to send message or Whatspie API error.',
                ]);
                $campaign->increment('failed_count');
            }
            
            $totalProcessed = $campaign->sent_count + $campaign->failed_count;
            if ($totalProcessed >= $campaign->total_recipients && $campaign->status !== 'completed') {
                $campaign->update(['status' => 'completed']);
            }
        });
    }
}
