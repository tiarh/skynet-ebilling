<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\GenieAcsDevice;
use App\Models\Setting;
use Illuminate\Support\Facades\Http;

class GenieAcsService
{
    public function syncDevices(): array
    {
        $baseUrl = rtrim((string) Setting::get('genieacs_url', ''), '/');
        $username = Setting::get('genieacs_username');
        $password = Setting::get('genieacs_password');

        if ($baseUrl === '') {
            throw new \RuntimeException('GenieACS URL belum diisi di settings.');
        }

        $request = Http::timeout(20)->acceptJson();
        if ($username || $password) {
            $request = $request->withBasicAuth((string) $username, (string) $password);
        }

        $devices = $request->get($baseUrl . '/devices')->throw()->json();
        $synced = 0;

        foreach ($devices as $device) {
            $serial = $this->value($device, '_deviceId._SerialNumber')
                ?: $this->value($device, 'Device.DeviceInfo.SerialNumber');

            $customer = $serial ? Customer::where('onu_serial', $serial)->first() : null;

            GenieAcsDevice::updateOrCreate(
                ['device_id' => (string) ($device['_id'] ?? $serial)],
                [
                    'customer_id' => $customer?->id,
                    'serial_number' => $serial,
                    'oui' => $this->value($device, '_deviceId._OUI'),
                    'product_class' => $this->value($device, '_deviceId._ProductClass'),
                    'software_version' => $this->value($device, 'Device.DeviceInfo.SoftwareVersion'),
                    'ip_address' => $this->value($device, 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress'),
                    'ssid' => $this->value($device, 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID'),
                    'last_inform_at' => isset($device['_lastInform']) ? \Carbon\Carbon::parse($device['_lastInform']) : null,
                    'parameters' => $device,
                ]
            );
            $synced++;
        }

        return ['synced' => $synced];
    }

    public function reboot(GenieAcsDevice $device): array
    {
        return $this->task($device, 'reboot');
    }

    public function setParameter(GenieAcsDevice $device, string $name, mixed $value): array
    {
        return $this->task($device, 'setParameterValues', [
            'parameterValues' => [[$name, $value]],
        ]);
    }

    protected function task(GenieAcsDevice $device, string $name, array $payload = []): array
    {
        $baseUrl = rtrim((string) Setting::get('genieacs_url', ''), '/');
        if ($baseUrl === '') {
            throw new \RuntimeException('GenieACS URL belum diisi di settings.');
        }

        $response = Http::timeout(20)
            ->acceptJson()
            ->post($baseUrl . '/devices/' . rawurlencode($device->device_id) . '/tasks?connection_request', [
                'name' => $name,
            ] + $payload)
            ->throw()
            ->json();

        return ['queued' => true, 'response' => $response];
    }

    protected function value(array $device, string $path): mixed
    {
        $value = data_get($device, $path . '._value');

        return $value ?? data_get($device, $path);
    }
}
