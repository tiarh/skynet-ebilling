<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CustomerUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'package_id' => ['required', 'integer', 'exists:packages,id'],
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'router_id' => ['nullable', 'integer', 'exists:routers,id'],
            'olt_id' => ['nullable', 'integer', 'exists:olts,id'],
            'olt_port_label' => ['nullable', 'string', 'max:255'],
            'onu_serial' => ['nullable', 'string', 'max:255'],
            'olt_status' => ['nullable', 'string', 'max:50'],
            'onu_rx_power_dbm' => ['nullable', 'numeric', 'between:-100,100'],
            'onu_tx_power_dbm' => ['nullable', 'numeric', 'between:-100,100'],
            'fiber_distance_m' => ['nullable', 'integer', 'min:0'],
            'address' => ['required', 'string'],
            'phone' => ['nullable', 'string', 'max:20'],
            'nik' => ['nullable', 'string', 'max:20'],
            'status' => ['required', Rule::in(['pending_installation', 'active', 'isolated', 'terminated'])],
            'geo_lat' => ['nullable', 'numeric', 'between:-90,90'],
            'geo_long' => ['nullable', 'numeric', 'between:-180,180'],
            'ktp_photo' => ['nullable', 'image', 'mimes:jpeg,png,jpg', 'max:2048'],
        ];
    }
}
