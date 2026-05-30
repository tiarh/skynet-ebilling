<?php

namespace App\Services;

use App\Models\Router;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use RuntimeException;

class WireGuardProvisioningService
{
    public function generateClientKeySet(): array
    {
        $privateKey = $this->runWireGuardCommand(['genkey']);
        $publicKey = $this->runWireGuardCommand(['pubkey'], $privateKey);
        $presharedKey = $this->runWireGuardCommand(['genpsk']);

        return [
            'private_key' => trim($privateKey),
            'public_key' => trim($publicKey),
            'preshared_key' => trim($presharedKey),
        ];
    }

    public function defaults(?Request $request = null): array
    {
        return [
            'vpn_interface' => 'wg-ebilling',
            'vpn_server_address' => config('services.wireguard.server_address', '10.99.0.1'),
            'vpn_server_public_key' => $this->serverPublicKey(),
            'vpn_server_endpoint' => $this->serverEndpoint($request),
            'vpn_server_port' => (int) config('services.wireguard.port', 51820),
            'vpn_allowed_ips' => config('services.wireguard.allowed_ips', '10.99.0.0/24'),
            'radius_auth_port' => 1812,
            'radius_acct_port' => 1813,
        ];
    }

    public function mikrotikScript(Router $router): string
    {
        $interface = $router->vpn_interface ?: 'wg-ebilling';
        $vpnAddress = $router->vpn_address ?: '10.99.0.2/24';
        $serverAddress = $router->vpn_server_address ?: '10.99.0.1';
        $serverEndpoint = $router->vpn_server_endpoint ?: config('services.wireguard.endpoint') ?: 'YOUR_VPS_PUBLIC_IP';
        $serverPort = $router->vpn_server_port ?: 51820;
        $allowedIps = $router->vpn_allowed_ips ?: '10.99.0.0/24';
        $authPort = $router->radius_auth_port ?: 1812;
        $acctPort = $router->radius_acct_port ?: 1813;
        $radiusSecret = $router->radius_secret ?: 'CHANGE_ME_RADIUS_SECRET';

        $lines = [
            "# {$router->name} - Skynet E-Billing VPN/RADIUS bootstrap",
            "/interface wireguard add name={$this->quote($interface)} private-key={$this->quote($router->vpn_client_private_key ?: 'PASTE_CLIENT_PRIVATE_KEY')} listen-port=13231",
            "/ip address add address={$this->quote($vpnAddress)} interface={$this->quote($interface)}",
            "/interface wireguard peers add interface={$this->quote($interface)} public-key={$this->quote($router->vpn_server_public_key ?: 'PASTE_SERVER_PUBLIC_KEY')} endpoint-address={$this->quote($serverEndpoint)} endpoint-port={$serverPort} allowed-address={$this->quote($allowedIps)} persistent-keepalive=25s" . ($router->vpn_preshared_key ? " preshared-key={$this->quote($router->vpn_preshared_key)}" : ''),
            "/radius add service=ppp address={$this->quote($serverAddress)} secret={$this->quote($radiusSecret)} authentication-port={$authPort} accounting-port={$acctPort} timeout=3s",
            "/ppp aaa set use-radius=yes accounting=yes interim-update=5m",
        ];

        return implode("\n", $lines);
    }

    public function serverPeerConfig(Router $router): string
    {
        $allowedIp = $this->peerAllowedIp($router);

        $lines = [
            "# {$router->name}",
            "[Peer]",
            "PublicKey = " . ($router->vpn_client_public_key ?: 'PASTE_MIKROTIK_PUBLIC_KEY'),
        ];

        if ($router->vpn_preshared_key) {
            $lines[] = "PresharedKey = {$router->vpn_preshared_key}";
        }

        $lines[] = "AllowedIPs = {$allowedIp}";

        return implode("\n", $lines);
    }

    public function applyPeer(Router $router): array
    {
        if (! $router->vpn_client_public_key) {
            return ['applied' => false, 'message' => 'MikroTik WireGuard public key is empty.'];
        }

        try {
            $pskFile = null;
            $command = [
                $this->wireGuardBinary(),
                'set',
                config('services.wireguard.interface', 'wg0'),
                'peer',
                $router->vpn_client_public_key,
                'allowed-ips',
                $this->peerAllowedIp($router),
            ];

            if ($router->vpn_preshared_key) {
                $pskFile = tempnam(sys_get_temp_dir(), 'wg-psk-');
                file_put_contents($pskFile, $router->vpn_preshared_key . PHP_EOL);
                $command[] = 'preshared-key';
                $command[] = $pskFile;
            }

            $this->runProcess($command);

            return ['applied' => true, 'message' => 'WireGuard peer applied to the VPS interface.'];
        } catch (\Throwable $e) {
            return ['applied' => false, 'message' => $e->getMessage()];
        } finally {
            if (isset($pskFile) && $pskFile && file_exists($pskFile)) {
                @unlink($pskFile);
            }
        }
    }

    public function peerAllowedIp(Router $router): string
    {
        $address = trim((string) $router->vpn_address);

        if ($address === '') {
            return '10.99.0.2/32';
        }

        $ip = Str::before($address, '/');

        return "{$ip}/32";
    }

    private function runWireGuardCommand(array $arguments, ?string $input = null): string
    {
        return $this->runProcess(array_merge([$this->wireGuardBinary()], $arguments), $input);
    }

    private function runProcess(array $command, ?string $input = null): string
    {
        $descriptorSpec = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $process = proc_open($command, $descriptorSpec, $pipes);

        if (! is_resource($process)) {
            throw new RuntimeException('Unable to start wg command. Install wireguard-tools on the server.');
        }

        fwrite($pipes[0], $input ?? '');
        fclose($pipes[0]);

        $output = stream_get_contents($pipes[1]);
        $error = stream_get_contents($pipes[2]);

        fclose($pipes[1]);
        fclose($pipes[2]);

        $exitCode = proc_close($process);

        if ($exitCode !== 0) {
            throw new RuntimeException(trim($error) ?: 'WireGuard key generation failed.');
        }

        return trim($output);
    }

    private function serverPublicKey(): ?string
    {
        $configured = config('services.wireguard.public_key');
        if ($configured) {
            return $configured;
        }

        $path = config('services.wireguard.public_key_path', '/etc/wireguard/server_public.key');
        if (is_readable($path)) {
            return trim((string) file_get_contents($path));
        }

        try {
            return trim($this->runWireGuardCommand(['show', config('services.wireguard.interface', 'wg0'), 'public-key']));
        } catch (\Throwable) {
            return null;
        }
    }

    private function serverEndpoint(?Request $request = null): string
    {
        $configured = config('services.wireguard.endpoint');
        if ($configured) {
            return $configured;
        }

        $host = $request?->getHost();
        if ($host && ! in_array($host, ['localhost', '127.0.0.1'], true)) {
            return $host;
        }

        $appHost = parse_url((string) config('app.url'), PHP_URL_HOST);

        return $appHost ?: 'YOUR_VPS_PUBLIC_IP';
    }

    private function wireGuardBinary(): string
    {
        foreach (['/usr/bin/wg', '/bin/wg', 'wg'] as $binary) {
            if ($binary === 'wg' || is_executable($binary)) {
                return $binary;
            }
        }

        throw new RuntimeException('WireGuard tools are not installed. Run: apt install wireguard-tools');
    }

    private function quote(mixed $value): string
    {
        $value = (string) ($value ?? '');

        return '"' . str_replace('"', '\"', $value) . '"';
    }
}
