<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OltOperationLog extends Model
{
    protected $fillable = [
        'olt_id',
        'user_id',
        'operation',
        'onu_ref',
        'status',
        'payload',
        'result',
        'error',
    ];

    protected $casts = [
        'payload' => 'array',
        'result' => 'array',
    ];

    public function olt(): BelongsTo
    {
        return $this->belongsTo(Olt::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
