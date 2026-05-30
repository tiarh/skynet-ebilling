<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class SupportTicket extends Model
{
    protected $fillable = [
        'code',
        'customer_id',
        'assigned_to',
        'type',
        'priority',
        'status',
        'subject',
        'description',
        'due_at',
        'resolved_at',
        'meta',
    ];

    protected $casts = [
        'due_at' => 'datetime',
        'resolved_at' => 'datetime',
        'meta' => 'array',
    ];

    protected static function booted(): void
    {
        static::creating(function (SupportTicket $ticket) {
            if (! $ticket->code) {
                $ticket->code = 'TCK-' . now()->format('Ymd') . '-' . strtoupper(Str::random(5));
            }
        });
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }
}
