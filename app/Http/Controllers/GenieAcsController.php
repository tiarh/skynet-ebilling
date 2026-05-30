<?php

namespace App\Http\Controllers;

use App\Models\GenieAcsDevice;
use App\Services\GenieAcsService;
use Illuminate\Http\Request;

class GenieAcsController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(GenieAcsDevice::query()
            ->with('customer:id,code,name,onu_serial')
            ->when($request->search, fn ($query, $search) => $query
                ->where('device_id', 'like', "%{$search}%")
                ->orWhere('serial_number', 'like', "%{$search}%"))
            ->latest('last_inform_at')
            ->paginate((int) $request->input('limit', 50)));
    }

    public function sync(GenieAcsService $service)
    {
        return response()->json($service->syncDevices());
    }

    public function reboot(GenieAcsDevice $device, GenieAcsService $service)
    {
        return response()->json($service->reboot($device));
    }

    public function setParameter(Request $request, GenieAcsDevice $device, GenieAcsService $service)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'value' => ['nullable'],
        ]);

        return response()->json($service->setParameter($device, $validated['name'], $validated['value'] ?? null));
    }
}
