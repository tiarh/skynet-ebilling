<?php

namespace App\Support;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\User;
use App\Models\WaCampaign;
use Illuminate\Database\Eloquent\Builder;

class AreaScope
{
    public static function applyToCustomers(Builder $query, ?User $user): Builder
    {
        if (! $user || ! $user->hasAreaScope()) {
            return $query;
        }

        $areaIds = $user->accessibleAreaIds()->all();

        return empty($areaIds)
            ? $query->whereRaw('1 = 0')
            : $query->whereIn('area_id', $areaIds);
    }

    public static function applyToInvoices(Builder $query, ?User $user): Builder
    {
        if (! $user || ! $user->hasAreaScope()) {
            return $query;
        }

        $areaIds = $user->accessibleAreaIds()->all();

        return empty($areaIds)
            ? $query->whereRaw('1 = 0')
            : $query->whereHas('customer', fn (Builder $customer) => $customer
                ->withTrashed()
                ->whereIn('area_id', $areaIds));
    }

    public static function applyToTransactions(Builder $query, ?User $user): Builder
    {
        if (! $user || ! $user->hasAreaScope()) {
            return $query;
        }

        $areaIds = $user->accessibleAreaIds()->all();

        return empty($areaIds)
            ? $query->whereRaw('1 = 0')
            : $query->whereHas('invoice.customer', fn (Builder $customer) => $customer
                ->withTrashed()
                ->whereIn('area_id', $areaIds));
    }

    public static function applyToCampaigns(Builder $query, ?User $user): Builder
    {
        if (! $user || ! $user->hasAreaScope()) {
            return $query;
        }

        $areaIds = $user->accessibleAreaIds()->all();

        return empty($areaIds)
            ? $query->whereRaw('1 = 0')
            : $query->whereIn('target_area_id', $areaIds);
    }

    public static function authorizeCustomer(Customer $customer, ?User $user): void
    {
        if (! $user || ! $user->hasAreaScope()) {
            return;
        }

        abort_unless(
            $customer->area_id && $user->accessibleAreaIds()->contains($customer->area_id),
            403
        );
    }

    public static function authorizeInvoice(Invoice $invoice, ?User $user): void
    {
        if (! $user || ! $user->hasAreaScope()) {
            return;
        }

        $invoice->loadMissing(['customer' => fn ($query) => $query->withTrashed()]);

        abort_unless(
            $invoice->customer?->area_id && $user->accessibleAreaIds()->contains($invoice->customer->area_id),
            403
        );
    }

    public static function authorizeCampaign(WaCampaign $campaign, ?User $user): void
    {
        if (! $user || ! $user->hasAreaScope()) {
            return;
        }

        abort_unless(
            $campaign->target_area_id && $user->accessibleAreaIds()->contains($campaign->target_area_id),
            403
        );
    }

    public static function authorizeAreaId(?int $areaId, ?User $user): void
    {
        if (! $user || ! $user->hasAreaScope()) {
            return;
        }

        abort_unless($areaId && $user->accessibleAreaIds()->contains($areaId), 403);
    }

    public static function applyToAreas(Builder $query, ?User $user): Builder
    {
        if (! $user || ! $user->hasAreaScope()) {
            return $query;
        }

        return $query->whereIn('id', $user->accessibleAreaIds()->all());
    }
}
