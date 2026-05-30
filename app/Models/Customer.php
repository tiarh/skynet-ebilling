<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;
use Illuminate\Database\Eloquent\SoftDeletes;


class Customer extends Model
{
    use LogsActivity, SoftDeletes;

    // ...

    protected static function booted()
    {
        static::creating(function ($customer) {
            if (empty($customer->join_date)) {
                $customer->join_date = now();
            }
            
            if (empty($customer->due_day)) {
                $customer->due_day = $customer->join_date ? $customer->join_date->day : now()->day;
            }
        });

        static::updating(function ($customer) {
            // Auto-void all unpaid invoices when customer is terminated
            if ($customer->isDirty('status') && $customer->status === 'terminated') {
                $customer->invoices()->where('status', 'unpaid')->update(['status' => 'void']);
            }
        });
    }

    protected $fillable = [
        'code',
        'legacy_id',
        'name',
        'address',
        'phone',
        'nik',
        'geo_lat',
        'geo_long',
        'pppoe_user',
        'pppoe_password',
        'package_id',
        'area_id',
        'router_id',
        'olt_id',
        'olt_port_label',
        'onu_serial',
        'olt_status',
        'onu_rx_power_dbm',
        'onu_tx_power_dbm',
        'fiber_distance_m',
        'olt_last_synced_at',
        'mikrotik_profile',
        'previous_profile',
        'mikrotik_sync_status',
        'mikrotik_synced_at',
        'mikrotik_sync_checked_at',
        'status',
        'join_date',
        'due_day',
        'ktp_photo_url',
        'is_online',
    ];

    public function router(): BelongsTo
    {
        return $this->belongsTo(Router::class);
    }

    public function olt(): BelongsTo
    {
        return $this->belongsTo(Olt::class);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty();
    }

    protected $casts = [
        'geo_lat' => 'decimal:8',
        'geo_long' => 'decimal:8',
        'join_date' => 'date',
        'is_online' => 'boolean',
        'onu_rx_power_dbm' => 'decimal:2',
        'onu_tx_power_dbm' => 'decimal:2',
        'fiber_distance_m' => 'integer',
        'olt_last_synced_at' => 'datetime',
        'mikrotik_synced_at' => 'datetime',
        'mikrotik_sync_checked_at' => 'datetime',
    ];

    public function scopeEbilling(Builder $query): Builder
    {
        $codeColumn = $query->getModel()->qualifyColumn('code');

        return $query->where(function (Builder $query) use ($codeColumn) {
            $query->whereNull($codeColumn)
                ->orWhere($codeColumn, 'not like', 'IMP-%');
        });
    }

    public function scopeImportedFromMikrotik(Builder $query): Builder
    {
        return $query->where($query->getModel()->qualifyColumn('code'), 'like', 'IMP-%');
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(Package::class);
    }

    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    /**
     * Get the current unpaid invoice for this customer
     */
    public function currentUnpaidInvoice()
    {
        return $this->invoices()->where('status', 'unpaid')->latest('period')->first();
    }

    /**
     * Get KTP photo URL (smart accessor)
     */
    public function getKtpPhotoUrlAttribute($value): ?string
    {
        if (!$value) {
            return null;
        }

        $value = $this->normalizeKtpPhotoValue($value);

        // Filter out incomplete legacy URLs (e.g., just the directory path ending in /)
        if (str_ends_with($value, '/')) {
            return null;
        }

        if (filter_var($value, FILTER_VALIDATE_URL)) {
            return $value;
        }

        return asset('storage/' . $value);
    }

    private function normalizeKtpPhotoValue(string $value): string
    {
        $value = trim($value);
        $lastHttpsPosition = strripos($value, 'https://');
        $lastHttpPosition = strripos($value, 'http://');
        $lastUrlPosition = max($lastHttpsPosition === false ? -1 : $lastHttpsPosition, $lastHttpPosition === false ? -1 : $lastHttpPosition);

        if ($lastUrlPosition > 0) {
            return substr($value, $lastUrlPosition);
        }

        return $value;
    }

    /**
     * Check if customer has a KTP photo
     */
    public function hasKtpPhoto(): bool
    {
        return !empty($this->ktp_photo_url);
    }
}
