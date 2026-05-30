<?php

namespace App\Http\Controllers;

use App\Http\Requests\SettingsUpdateRequest;
use App\Models\Setting;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Redirect;

class SettingController extends Controller
{
    /**
     * Display the settings page.
     */
    public function index()
    {
        $settings = Setting::all()->groupBy('group');
        
        return Inertia::render('Settings/Index', [
            'settings' => $settings,
            'grouped_settings' => [
                'billing' => [
                    'company_name' => Setting::get('company_name', 'Skynet Network'),
                    'company_address' => Setting::get('company_address', ''),
                ]
            ]
        ]);
    }

    /**
     * Update settings.
     */
    public function update(SettingsUpdateRequest $request)
    {
        $validated = $request->validated();

        foreach ($validated['settings'] as $item) {
            Setting::set(
                $item['key'],
                $item['value'],
                $item['type'],
                $item['group']
            );
        }

        return back()->with('success', 'Settings updated successfully.');
    }
}
