<?php

declare(strict_types=1);

$monitor = (string) file_get_contents(__DIR__ . '/../app/Console/Commands/MonitorSystem.php');
$compose = (string) file_get_contents(__DIR__ . '/../../docker-compose.yml');
$envExample = (string) file_get_contents(__DIR__ . '/../../.env.example');

$checks = [
    'Redis is probed through its dedicated default connection' =>
        str_contains($monitor, "app('redis')->connection('default')->ping();"),
    'Redis health check is not skipped when cache driver is file' =>
        !str_contains($monitor, "if (\$driver !== 'redis')"),
    'Docker passes the system monitoring toggle to Laravel' =>
        str_contains($compose, 'SYSTEM_MONITOR_ENABLED: "${SYSTEM_MONITOR_ENABLED:-false}"'),
    'Docker passes the internal Nginx health-check URL' =>
        str_contains($compose, 'SYSTEM_MONITOR_BASE_URL: "${SYSTEM_MONITOR_BASE_URL:-http://nginx}"'),
    'monitoring remains opt-in in the sample environment' =>
        str_contains($envExample, 'SYSTEM_MONITOR_ENABLED=false'),
];

foreach ($checks as $label => $passed) {
    if (!$passed) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$label}" . PHP_EOL;
}

echo "All BCS system monitoring smoke checks passed." . PHP_EOL;
