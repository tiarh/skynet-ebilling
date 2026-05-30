<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GenieAcsDevice extends Model
{
    protected $fillable = [
        'device_id',
        'customer_id',
        'serial_number',
        'oui',
        'product_class',
        'software_version',
        'ip_address',
        'ssid',
        'last_inform_at',
        'parameters',
    ];

    protected $casts = [
        'last_inform_at' => 'datetime',
        'parameters' => 'array',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
