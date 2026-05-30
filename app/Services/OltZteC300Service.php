<?php

namespace App\Services;

use App\Models\Olt;
use phpseclib3\Net\SSH2;
use RuntimeException;
use Symfony\Component\Process\Process;

class OltZteC300Service
{
    public function onuDetail(Olt $olt, string $onuRef): array
    {
        $onuRef = $this->normalizeOnuRef($onuRef);
        $ssh = $this->connect($olt);
        $executedCommands = [];

        try {
            $outputs = [
                'state' => $this->execFirstSuccessful($ssh, [
                    "show gpon onu state {$this->toGponOnuRef($onuRef)}",
                    "show gpon onu state {$onuRef}",
                ], $executedCommands),
                'baseinfo' => $this->execFirstSuccessful($ssh, [
                    "show gpon onu baseinfo {$this->toGponOnuRef($onuRef)}",
                    "show gpon onu baseinfo {$onuRef}",
                ], $executedCommands),
                'power' => $this->execFirstSuccessful($ssh, [
                    "show pon power onu-rx {$this->toGponOnuRef($onuRef)}",
                    "show pon power onu-rx {$this->toGponOltRef($this->extractPortFromOnuRef($onuRef) ?: '')}",
                ], $executedCommands),
                'running_config' => $this->execFirstSuccessful($ssh, [
                    "show running-config interface {$this->toGponOnuRef($onuRef)}",
                ], $executedCommands),
            ];

            $snapshot = $this->singleOnuSnapshot($onuRef, $outputs);

            return [
                'onu' => $snapshot,
                'raw' => $outputs,
                'commands' => $executedCommands,
            ];
        } finally {
            $ssh->disconnect();
        }
    }

    public function renameOnu(Olt $olt, string $onuRef, string $name): array
    {
        $onuRef = $this->normalizeOnuRef($onuRef);
        $name = trim($name);

        if ($name === '') {
            throw new RuntimeException('ONU name is required.');
        }

        return $this->runConfigOperation($olt, $onuRef, [
            'configure terminal',
            "interface {$this->toGponOnuRef($onuRef)}",
            "name {$this->escapeCliValue($name)}",
            'exit',
            'write',
        ], ['name' => $name]);
    }

    public function rebootOnu(Olt $olt, string $onuRef): array
    {
        $onuRef = $this->normalizeOnuRef($onuRef);

        return $this->runConfigOperation($olt, $onuRef, [
            'configure terminal',
            "pon-onu-mng {$this->toGponOnuRef($onuRef)}",
            'reboot',
            'yes',
            'exit',
        ]);
    }

    public function setOnuAdminState(Olt $olt, string $onuRef, bool $enabled): array
    {
        $onuRef = $this->normalizeOnuRef($onuRef);

        return $this->runConfigOperation($olt, $onuRef, [
            'configure terminal',
            "interface {$this->toGponOnuRef($onuRef)}",
            $enabled ? 'no shutdown' : 'shutdown',
            'exit',
            'write',
        ], ['enabled' => $enabled]);
    }

    public function deleteOnu(Olt $olt, string $onuRef): array
    {
        $onuRef = $this->normalizeOnuRef($onuRef);
        $portRef = $this->extractPortFromOnuRef($onuRef);
        $onuId = $this->extractOnuId($onuRef);

        if (! $portRef || ! $onuId) {
            throw new RuntimeException('Invalid ONU ref. Expected format 1/2/1:3.');
        }

        return $this->runConfigOperation($olt, $onuRef, [
            'configure terminal',
            "interface {$this->toGponOltRef($portRef)}",
            "no onu {$onuId}",
            'exit',
            'write',
        ], ['pon_port' => $portRef, 'onu_id' => $onuId]);
    }

    public function authorizeOnu(Olt $olt, array $payload): array
    {
        $portRef = $this->normalizePonPort($payload['pon_port'] ?? '');
        $onuId = (int) ($payload['onu_id'] ?? 0);
        $serial = strtoupper(trim((string) ($payload['serial_number'] ?? '')));
        $onuType = trim((string) ($payload['onu_type'] ?? 'ZTEG-F660'));
        $name = trim((string) ($payload['name'] ?? ''));
        $lineProfile = trim((string) ($payload['line_profile'] ?? ''));
        $serviceProfile = trim((string) ($payload['service_profile'] ?? ''));

        if (! $portRef || $onuId < 1 || $onuId > 128 || $serial === '') {
            throw new RuntimeException('PON port, ONU ID, and serial number are required.');
        }

        $onuRef = "{$portRef}:{$onuId}";
        $commands = [
            'configure terminal',
            "interface {$this->toGponOltRef($portRef)}",
            "onu {$onuId} type {$this->escapeCliValue($onuType)} sn {$this->escapeCliValue($serial)}",
            'exit',
        ];

        if ($name !== '' || $lineProfile !== '' || $serviceProfile !== '') {
            $commands[] = "interface {$this->toGponOnuRef($onuRef)}";
            if ($name !== '') {
                $commands[] = "name {$this->escapeCliValue($name)}";
            }
            if ($lineProfile !== '') {
                $commands[] = "line-profile {$this->escapeCliValue($lineProfile)}";
            }
            if ($serviceProfile !== '') {
                $commands[] = "service-profile {$this->escapeCliValue($serviceProfile)}";
            }
            $commands[] = 'exit';
        }

        $commands[] = 'write';

        return $this->runConfigOperation($olt, $onuRef, $commands, [
            'pon_port' => $portRef,
            'onu_id' => $onuId,
            'serial_number' => $serial,
            'onu_type' => $onuType,
            'name' => $name,
            'line_profile' => $lineProfile,
            'service_profile' => $serviceProfile,
        ]);
    }

    public function collectSnapshot(Olt $olt): array
    {
        $pexpectSnapshot = $this->collectSnapshotViaPexpect($olt);
        if ($pexpectSnapshot !== null) {
            return $this->keepBestSnapshot($pexpectSnapshot, is_array($olt->last_gpon_snapshot) ? $olt->last_gpon_snapshot : null);
        }

        $bestCachedSnapshot = is_array($olt->last_gpon_snapshot) ? $olt->last_gpon_snapshot : null;
        $port = $olt->management_port ?: 22;
        $ssh = $this->connect($olt);
        $executedCommands = [];

        try {
            $stateOutput = $this->execAny($ssh, [
                'show gpon onu state all',
                'show gpon onu state',
            ], $executedCommands);

            $discoveryOutput = $this->execAny($ssh, [
                'show gpon onu baseinfo all',
                'show gpon onu state all',
                'show gpon onu state',
            ], $executedCommands);

            $onuRefs = $this->extractOnuRefs($stateOutput . "\n" . $discoveryOutput);
            $ports = $this->extractPorts($onuRefs);
            $baseInfoOutputs = ['all' => $discoveryOutput];
            $powerOutputs = [];
            $distanceOutputs = [];

            // Collect per-port optical power and baseinfo (same as pexpect path)
            foreach ($ports as $portRef) {
                $oltRef = $this->toGponOltRef($portRef);

                $powerOutput = $this->execFirstSuccessful($ssh, [
                    "show pon power onu-rx {$oltRef}",
                    "show pon power onu-rx {$portRef}",
                ], $executedCommands);
                if ($powerOutput !== '') {
                    $powerOutputs[$portRef] = $powerOutput;
                }

                $portBaseInfo = $this->execFirstSuccessful($ssh, [
                    "show gpon onu baseinfo {$oltRef}",
                    "show gpon onu baseinfo {$portRef}",
                ], $executedCommands);
                if ($portBaseInfo !== '') {
                    $baseInfoOutputs[$portRef] = $portBaseInfo;
                }
            }

            $runningConfigOutput = $this->execFirstSuccessful($ssh, [
                'show running-config',
            ], $executedCommands);

            $distances = $this->parseDistances($distanceOutputs);
            $rxPowers = $this->parseRxPowers($powerOutputs);
            $states = $this->parseStates($stateOutput);
            $baseInfos = $this->parseBaseInfos($baseInfoOutputs);

            $onus = [];
            foreach ($onuRefs as $onuRef) {
                $onus[] = [
                    'onu_ref' => $onuRef,
                    'pon_port' => $this->extractPortFromOnuRef($onuRef),
                    'state' => $states[$onuRef]['state'] ?? null,
                    'phase_state' => $states[$onuRef]['phase_state'] ?? null,
                    'serial_number' => $baseInfos[$onuRef]['serial_number'] ?? null,
                    'onu_name' => $baseInfos[$onuRef]['onu_name'] ?? null,
                    'rx_power_dbm' => $rxPowers[$onuRef] ?? null,
                    'distance_m' => $distances[$onuRef] ?? null,
                    'detail_raw' => null,
                ];
            }

            $snapshot = [
                'meta' => [
                    'olt' => $olt->name,
                    'host' => $olt->management_ip,
                    'port' => $port,
                    'protocol' => 'ssh',
                    'collector' => 'zte-c300-cli',
                    'collected_at' => now()->toISOString(),
                    'pon_ports_count' => count($ports),
                    'onus_count' => count($onus),
                ],
                'pon_ports' => array_map(fn (string $item) => ['name' => $item], $ports),
                'onus' => $onus,
                'raw' => [
                    'state' => $stateOutput,
                    'discovery' => $discoveryOutput,
                    'baseinfo' => $baseInfoOutputs,
                    'power' => $powerOutputs,
                    'distance' => $distanceOutputs,
                    'running_config' => $runningConfigOutput,
                ],
                'commands' => $executedCommands,
            ];

            return $this->keepBestSnapshot($snapshot, $bestCachedSnapshot);
        } finally {
            $ssh->disconnect();
        }
    }

    protected function keepBestSnapshot(array $snapshot, ?array $cached): array
    {
        if (! $cached || empty($cached['onus']) || empty($cached['pon_ports'])) {
            return $snapshot;
        }

        $newOnus = count($snapshot['onus'] ?? []);
        $cachedOnus = count($cached['onus'] ?? []);
        $newPorts = count($snapshot['pon_ports'] ?? []);
        $cachedPorts = count($cached['pon_ports'] ?? []);

        if ($cachedOnus > $newOnus || $cachedPorts > $newPorts) {
            $cached['meta']['warning'] = 'Snapshot terbaru dari C300 lebih kecil dari cache, jadi backend mempertahankan data terbaik yang sudah tersimpan.';
            $cached['meta']['last_attempt_at'] = now()->toISOString();
            $cached['meta']['last_attempt_onus_count'] = $newOnus;
            $cached['meta']['last_attempt_pon_ports_count'] = $newPorts;

            return $cached;
        }

        return $snapshot;
    }

    protected function connect(Olt $olt): SSH2
    {
        if (! $olt->management_ip || ! $olt->username || ! $olt->password) {
            throw new RuntimeException('OLT must have management IP, username, and password.');
        }

        if (($olt->management_protocol ?: 'ssh') !== 'ssh') {
            throw new RuntimeException('ZTE C300 backend currently supports SSH only.');
        }

        $ssh = new SSH2($olt->management_ip, $olt->management_port ?: 22, 10);

        if (! $ssh->login($olt->username, $olt->password)) {
            throw new RuntimeException('Failed to log in to OLT via SSH.');
        }

        $this->prepareShell($ssh, $olt->password);

        return $ssh;
    }

    protected function collectSnapshotViaPexpect(Olt $olt): ?array
    {
        $script = base_path('app/Support/zte_c300_collect.py');
        if (! is_file($script)) {
            return null;
        }

        $stateCommands = [
            'show gpon onu state',
        ];

        $outputs = $this->runPexpectCommands($olt, $stateCommands, 180);
        if ($outputs === null) {
            return null;
        }

        $stateOutput = $this->normalizeOutput((string) ($outputs['show gpon onu state'] ?? ''));
        $onuRefs = $this->extractOnuRefs($stateOutput);
        if ($onuRefs === []) {
            return null;
        }

        $ports = $this->extractPorts($onuRefs);
        $detailCommands = [];
        foreach ($ports as $portRef) {
            $detailCommands[] = 'show gpon onu baseinfo ' . $this->toGponOltRef($portRef);
            $detailCommands[] = 'show pon power onu-rx ' . $this->toGponOltRef($portRef);
        }

        $detailOutputs = $detailCommands === [] ? [] : ($this->runPexpectCommands($olt, $detailCommands, 240) ?? []);
        $baseInfoOutputs = [];
        $powerOutputs = [];

        foreach ($detailOutputs as $command => $output) {
            $normalized = $this->normalizeOutput((string) $output);
            if (str_starts_with($command, 'show gpon onu baseinfo ')) {
                $baseInfoOutputs[$command] = $normalized;
            } elseif (str_starts_with($command, 'show pon power onu-rx ')) {
                $powerOutputs[$command] = $normalized;
            }
        }

        $runningConfigCommand = 'show running-config';
        $runningConfigOutputs = $this->runPexpectCommands($olt, [$runningConfigCommand], 480) ?? [];
        $runningConfigOutput = $this->normalizeOutput((string) ($runningConfigOutputs[$runningConfigCommand] ?? ''));
        $runningConfigNames = $this->parseRunningConfigOnuNames($runningConfigOutput);

        $states = $this->parseStates($stateOutput);
        $baseInfos = $this->parseBaseInfos($baseInfoOutputs);
        $rxPowers = $this->parseRxPowers($powerOutputs);

        $onus = [];
        foreach ($onuRefs as $onuRef) {
            $onus[] = [
                'onu_ref' => $onuRef,
                'pon_port' => $this->extractPortFromOnuRef($onuRef),
                'state' => $states[$onuRef]['state'] ?? null,
                'phase_state' => $states[$onuRef]['phase_state'] ?? null,
                'serial_number' => $baseInfos[$onuRef]['serial_number'] ?? null,
                'onu_name' => $runningConfigNames[$onuRef] ?? $baseInfos[$onuRef]['onu_name'] ?? null,
                'rx_power_dbm' => $rxPowers[$onuRef] ?? null,
                'distance_m' => null,
                'detail_raw' => null,
            ];
        }

        return [
            'meta' => [
                'olt' => $olt->name,
                'host' => $olt->management_ip,
                'port' => $olt->management_port ?: 22,
                'protocol' => 'ssh',
                'collector' => 'pexpect',
                'collected_at' => now()->toISOString(),
                'pon_ports_count' => count($ports),
                'onus_count' => count($onus),
                'detail_commands_count' => count($detailCommands),
                'running_config_names_count' => count($runningConfigNames),
            ],
            'pon_ports' => array_map(fn (string $item) => ['name' => $item], $ports),
            'onus' => $onus,
            'raw' => [
                'state' => $stateOutput,
                'discovery' => implode("\n", $baseInfoOutputs),
                'baseinfo' => $baseInfoOutputs,
                'power' => $powerOutputs,
                'distance' => [],
                'running_config' => $runningConfigOutput,
            ],
            'commands' => array_merge($stateCommands, $detailCommands, [$runningConfigCommand]),
        ];
    }

    protected function runPexpectCommands(Olt $olt, array $commands, int $timeout): ?array
    {
        $script = base_path('app/Support/zte_c300_collect.py');
        $process = new Process(['python3', $script], base_path(), [
            'OLT_HOST' => (string) $olt->management_ip,
            'OLT_PORT' => (string) ($olt->management_port ?: 22),
            'OLT_USERNAME' => (string) $olt->username,
            'OLT_PASSWORD' => (string) $olt->password,
            'OLT_COMMANDS' => json_encode(array_values($commands)),
        ]);
        $process->setTimeout($timeout);
        $process->run();

        $payload = json_decode($process->getOutput(), true);
        if (! $process->isSuccessful() || ! is_array($payload) || ($payload['ok'] ?? false) !== true) {
            return null;
        }

        return is_array($payload['outputs'] ?? null) ? $payload['outputs'] : null;
    }

    protected function connectForSnapshot(Olt $olt): SSH2
    {
        if (! $olt->management_ip || ! $olt->username || ! $olt->password) {
            throw new RuntimeException('OLT must have management IP, username, and password.');
        }

        if (($olt->management_protocol ?: 'ssh') !== 'ssh') {
            throw new RuntimeException('ZTE C300 backend currently supports SSH only.');
        }

        $ssh = new SSH2($olt->management_ip, $olt->management_port ?: 22, 10);
        $ssh->setTimeout(8);

        if (! $ssh->login($olt->username, $olt->password)) {
            throw new RuntimeException('Failed to log in to OLT via SSH.');
        }

        return $ssh;
    }

    protected function candidatePonPorts(): array
    {
        $ports = [];

        foreach ([2] as $slot) {
            for ($pon = 1; $pon <= 16; $pon++) {
                $ports[] = "1/{$slot}/{$pon}";
            }
        }

        return $ports;
    }

    protected function runConfigOperation(Olt $olt, string $onuRef, array $commands, array $context = []): array
    {
        $ssh = $this->connect($olt);
        $executed = [];
        $outputs = [];

        try {
            foreach ($commands as $command) {
                $executed[] = $command;
                $output = $this->runShellCommand($ssh, $command);
                $outputs[$command] = $this->normalizeOutput($output);

                if ($this->isCommandFailure($output)) {
                    throw new RuntimeException("OLT command failed: {$command}\n{$outputs[$command]}");
                }
            }

            return [
                'success' => true,
                'onu_ref' => $onuRef,
                'context' => $context,
                'commands' => $executed,
                'outputs' => $outputs,
            ];
        } finally {
            $ssh->disconnect();
        }
    }

    protected function prepareShell(SSH2 $ssh, string $password): void
    {
        $ssh->enablePTY('vt100', 180, 1000);
        $ssh->setTimeout(0.25);
        $ssh->read();

        $enableOutput = $this->runShellCommand($ssh, 'enable');
        if (preg_match('/password[: ]*$/i', $enableOutput)) {
            $this->runShellCommand($ssh, $password);
        }

        foreach ([
            'terminal page-break disable',
        ] as $command) {
            $this->runShellCommand($ssh, $command);
        }
    }

    protected function exec(SSH2 $ssh, string $command, array &$executedCommands = []): string
    {
        $executedCommands[] = $command;
        $output = $this->runShellCommand($ssh, $command);

        if ($this->isCommandFailure($output)) {
            throw new RuntimeException("OLT command failed: {$command}\n{$output}");
        }

        return $this->normalizeOutput($output);
    }

    protected function execAny(SSH2 $ssh, array $commands, array &$executedCommands = []): string
    {
        $errors = [];

        foreach ($commands as $command) {
            $executedCommands[] = $command;
            $output = $this->runShellCommand($ssh, $command);

            if (! $this->isCommandFailure($output)) {
                return $this->normalizeOutput($output);
            }

            $errors[] = "[{$command}] " . $this->normalizeOutput($output);
        }

        throw new RuntimeException(implode("\n\n", $errors));
    }

    protected function execFirstSuccessful(SSH2 $ssh, array $commands, array &$executedCommands = []): string
    {
        foreach ($commands as $command) {
            $executedCommands[] = $command;
            $output = $this->runShellCommand($ssh, $command);

            if (! $this->isCommandFailure($output)) {
                return $this->normalizeOutput($output);
            }
        }

        return '';
    }

    protected function execSnapshotAny(SSH2 $ssh, array $commands, array &$executedCommands = []): string
    {
        $errors = [];

        foreach ($commands as $command) {
            $executedCommands[] = $command;
            $output = $ssh->exec($command);

            if (is_string($output) && ! $this->isCommandFailure($output)) {
                return $this->normalizeOutput($output);
            }

            $errors[] = "[{$command}] " . $this->normalizeOutput((string) $output);
        }

        throw new RuntimeException(implode("\n\n", $errors));
    }

    protected function execSnapshotFirstSuccessful(SSH2 $ssh, array $commands, array &$executedCommands = []): string
    {
        foreach ($commands as $command) {
            $executedCommands[] = $command;
            $output = $ssh->exec($command);

            if (is_string($output) && ! $this->isCommandFailure($output)) {
                return $this->normalizeOutput($output);
            }
        }

        return '';
    }

    protected function runShellCommand(SSH2 $ssh, string $command): string
    {
        $ssh->write($command . "\n");
        $output = '';
        $sawData = false;

        for ($packet = 0; $packet < 260; $packet++) {
            $chunk = $ssh->read('', SSH2::READ_NEXT);

            if ($chunk === false) {
                if ($sawData) {
                    return $output;
                }

                throw new RuntimeException("OLT command timed out: {$command}");
            }

            $output .= $chunk;
            $sawData = true;

            if (preg_match('/(--More--|More:|Press any key to continue)/i', $chunk)) {
                $ssh->write(" \n");
                continue;
            }
        }

        return $output;
    }

    protected function isCommandFailure(string $output): bool
    {
        $normalized = strtoupper($this->normalizeOutput($output));

        foreach ([
            'INVALID INPUT',
            'UNKNOWN COMMAND',
            'INCOMPLETE COMMAND',
            'COMMAND NOT SUPPORT',
            'ERROR:',
            '% ',
        ] as $pattern) {
            if (str_contains($normalized, $pattern)) {
                return true;
            }
        }

        return false;
    }

    protected function normalizeOutput(string $output): string
    {
        $output = preg_replace('/\e\\[[\\d;]*[A-Za-z]/', '', $output) ?? $output;
        $output = preg_replace('/(?:\x08\s?)+/', '', $output) ?? $output;
        $output = preg_replace('/--More--|More:|Press any key to continue/i', '', $output) ?? $output;

        return trim(str_replace("\r", '', $output));
    }

    protected function extractOnuRefs(string $output): array
    {
        preg_match_all('/(?:gpon-onu_)?\\d+\\/\\d+\\/\\d+:\\d+/i', $output, $matches);

        return array_values(array_unique(array_map(
            fn (string $ref) => strtolower(preg_replace('/^gpon-onu_/i', '', $ref) ?? $ref),
            $matches[0] ?? []
        )));
    }

    protected function extractPorts(array $onuRefs): array
    {
        $ports = [];
        foreach ($onuRefs as $onuRef) {
            $ports[] = $this->extractPortFromOnuRef($onuRef);
        }

        return array_values(array_unique(array_filter($ports)));
    }

    protected function extractPortFromOnuRef(string $onuRef): ?string
    {
        if (! preg_match('/(?:gpon-onu_)?(\\d+)\\/(\\d+)\\/(\\d+):(\\d+)/i', $onuRef, $matches)) {
            return null;
        }

        return sprintf('%s/%s/%s', $matches[1], $matches[2], $matches[3]);
    }

    protected function extractOnuId(string $onuRef): ?int
    {
        if (! preg_match('/(?:gpon-onu_)?\d+\/\d+\/\d+:(\d+)/i', $onuRef, $matches)) {
            return null;
        }

        return (int) $matches[1];
    }

    protected function normalizeOnuRef(string $onuRef): string
    {
        $onuRef = strtolower(trim($onuRef));
        $onuRef = preg_replace('/^gpon-onu_/i', '', $onuRef) ?? $onuRef;

        if (! preg_match('/^\d+\/\d+\/\d+:\d+$/', $onuRef)) {
            throw new RuntimeException('Invalid ONU ref. Expected format 1/2/1:3.');
        }

        return $onuRef;
    }

    protected function normalizePonPort(string $portRef): ?string
    {
        $portRef = strtolower(trim($portRef));
        $portRef = preg_replace('/^gpon-olt_/i', '', $portRef) ?? $portRef;

        return preg_match('/^\d+\/\d+\/\d+$/', $portRef) ? $portRef : null;
    }

    protected function escapeCliValue(string $value): string
    {
        return trim(str_replace(["\r", "\n", '"'], ['', '', ''], $value));
    }

    protected function singleOnuSnapshot(string $onuRef, array $outputs): array
    {
        $state = $this->parseStates($outputs['state'] ?? '')[$onuRef] ?? [];
        $baseInfo = $this->parseBaseInfos([$outputs['baseinfo'] ?? ''])[$onuRef] ?? [];
        $configName = $this->parseRunningConfigOnuNames($outputs['running_config'] ?? '')[$onuRef] ?? null;
        $rxPowers = $this->parseRxPowers([$this->extractPortFromOnuRef($onuRef) ?: '' => $outputs['power'] ?? '']);

        return [
            'onu_ref' => $onuRef,
            'pon_port' => $this->extractPortFromOnuRef($onuRef),
            'state' => $state['state'] ?? null,
            'phase_state' => $state['phase_state'] ?? null,
            'serial_number' => $baseInfo['serial_number'] ?? null,
            'onu_name' => $configName ?? $baseInfo['onu_name'] ?? null,
            'rx_power_dbm' => $rxPowers[$onuRef] ?? null,
            'distance_m' => null,
            'detail_raw' => $outputs,
        ];
    }

    protected function parseDistances(array $distanceOutputs): array
    {
        $results = [];

        foreach ($distanceOutputs as $onuRef => $output) {
            if (preg_match('/Distance\\(m\\)\\s*.*?(\\d+)/is', $output, $matches)) {
                $results[strtolower($onuRef)] = (int) $matches[1];
            } elseif (preg_match('/\\b(\\d+)\\s*m(?:eter)?\\b/i', $output, $matches)) {
                $results[strtolower($onuRef)] = (int) $matches[1];
            }
        }

        return $results;
    }

    protected function parseRxPowers(array $powerOutputs): array
    {
        $results = [];

        foreach ($powerOutputs as $portRef => $output) {
            $lines = preg_split('/\n+/', $output) ?: [];
            foreach ($lines as $line) {
                if (! preg_match('/(?:gpon-onu_)?(\d+\/\d+\/\d+:\d+)/i', $line, $refMatch)) {
                    continue;
                }

                if (! preg_match('/\s(-?\d+(?:\.\d+)?)\s*\(?dbm\)?/i', $line, $powerMatch)) {
                    continue;
                }

                $results[strtolower($refMatch[1])] = (float) $powerMatch[1];
            }
        }

        return $results;
    }

    protected function parseStates(string $output): array
    {
        $results = [];
        $lines = preg_split('/\\n+/', $output) ?: [];

        foreach ($lines as $line) {
            if (! preg_match('/(?:gpon-onu_)?(\\d+\\/\\d+\\/\\d+:\\d+)/i', $line, $matches)) {
                continue;
            }

            $onuRef = strtolower($matches[1]);
            $phaseState = null;
            if (preg_match('/\\b(O[1-9])\\b/i', $line, $phaseMatches)) {
                $phaseState = strtoupper($phaseMatches[1]);
            }

            $state = str_contains(strtoupper($line), 'ONLINE')
                || str_contains(strtoupper($line), 'WORKING')
                || $phaseState === 'O5'
                ? 'online'
                : (str_contains(strtoupper($line), 'OFFLINE') ? 'offline' : null);

            $results[$onuRef] = [
                'state' => $state,
                'phase_state' => $phaseState ?: $this->parseColumnAfterOnuRef($line, 3),
            ];
        }

        return $results;
    }

    protected function parseBaseInfos(array $baseInfoOutputs, array $detailOutputs = []): array
    {
        $results = [];

        foreach ($baseInfoOutputs as $output) {
            $lines = preg_split('/\\n+/', $output) ?: [];
            foreach ($lines as $line) {
                if (! preg_match('/(?:gpon-onu_)?(\\d+\\/\\d+\\/\\d+:\\d+)/i', $line, $matches)) {
                    continue;
                }

                $onuRef = strtolower($matches[1]);
                preg_match('/\bSN\s*:\s*([A-Z0-9]+)/i', $line, $serialMatches);

                $results[$onuRef] = [
                    'serial_number' => $serialMatches[1] ?? null,
                    'onu_name' => null,
                ];
            }
        }

        foreach ($detailOutputs as $onuRef => $output) {
            if (! $output) {
                continue;
            }

            $key = strtolower($onuRef);
            $results[$key] = [
                'serial_number' => $results[$key]['serial_number'] ?? $this->parseSerial($output),
                'onu_name' => $results[$key]['onu_name'] ?? $this->parseOnuName($output),
            ];
        }

        return $results;
    }

    protected function parseRunningConfigOnuNames(string $output): array
    {
        $results = [];
        $currentOnuRef = null;
        $lines = preg_split('/\\n+/', $output) ?: [];

        foreach ($lines as $line) {
            if (preg_match('/^\\s*interface\\s+gpon-onu_(\\d+\\/\\d+\\/\\d+:\\d+)/i', $line, $matches)) {
                $currentOnuRef = strtolower($matches[1]);
                continue;
            }

            if ($currentOnuRef && preg_match('/^\\s*name\\s+(.+)\\s*$/i', $line, $matches)) {
                $results[$currentOnuRef] = trim($matches[1]);
                continue;
            }

            if (trim($line) === '!' || preg_match('/^\\s*end\\s*$/i', $line)) {
                $currentOnuRef = null;
            }
        }

        return $results;
    }

    protected function toGponOnuRef(string $onuRef): string
    {
        return str_starts_with(strtolower($onuRef), 'gpon-onu_') ? $onuRef : "gpon-onu_{$onuRef}";
    }

    protected function toGponOltRef(string $portRef): string
    {
        return str_starts_with(strtolower($portRef), 'gpon-olt_') ? $portRef : "gpon-olt_{$portRef}";
    }

    protected function parseColumnAfterOnuRef(string $line, int $index): ?string
    {
        $columns = preg_split('/\\s+/', trim($line)) ?: [];

        return $columns[$index] ?? null;
    }

    protected function parseSerial(string $output): ?string
    {
        if (preg_match('/(?:Serial(?: Number)?|SN)\\s*[:=]\\s*([A-Z0-9]+)/i', $output, $matches)) {
            return $matches[1];
        }

        if (preg_match('/ZTEG[A-Z0-9]+|[A-Z0-9]{8,}/', $output, $matches)) {
            return $matches[0];
        }

        return null;
    }

    protected function parseOnuName(string $output): ?string
    {
        foreach ([
            '/(?:ONU\\s*)?Name\\s*[:=]\\s*([^\\r\\n]+)/i',
            '/Description\\s*[:=]\\s*([^\\r\\n]+)/i',
        ] as $pattern) {
            if (preg_match($pattern, $output, $matches)) {
                return trim($matches[1]);
            }
        }

        $lines = preg_split('/\\n+/', $output) ?: [];
        foreach ($lines as $line) {
            if (! preg_match('/(?:gpon-onu_)?\\d+\\/\\d+\\/\\d+:\\d+/i', $line)) {
                continue;
            }

            $columns = preg_split('/\\s+/', trim($line)) ?: [];
            $tail = array_values(array_filter(array_slice($columns, 1), function ($column) {
                return ! preg_match('/^(enable|disable|online|offline|working|o\\d|\\d\\(gpon\\)|ZTEG[A-Z0-9]+|[A-Z0-9]{8,})$/i', $column);
            }));

            if ($tail !== []) {
                return end($tail) ?: null;
            }
        }

        return null;
    }
}
