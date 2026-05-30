<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => fn () => $request->user() ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'role' => $request->user()->role,
                    'scope' => $request->user()->isSuperAdmin()
                        ? 'superadmin'
                        : ($request->user()->hasAreaScope() ? 'scoped_admin' : 'global_admin'),
                    'area_ids' => $request->user()->hasAreaScope()
                        ? $request->user()->accessibleAreaIds()->all()
                        : [],
                ] : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'settings' => [
                'payment_channels' => fn () => $request->user()?->isGlobalAdmin()
                    ? \App\Models\Setting::get('payment_channels', [])
                    : [],
            ],
        ];
    }
}
