<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Transaction extends Model
{
    use LogsActivity;

    protected $fillable = [
        'legacy_id',
        'legacy_customer_code',
        'legacy_period',
        'invoice_id',
        'reference',
        'channel',
        'admin_id',
        'amount',
        'status',
        'method',
        'proof_url',
        'paid_at',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty();
    }

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'legacy_period' => 'date',
    ];

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
