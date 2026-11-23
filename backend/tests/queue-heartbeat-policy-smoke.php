<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\QueueHeartbeatPolicy;

$kernelSource = (string) file_get_contents(__DIR__ . '/../app/Console/Kernel.php');
$heartbeatSource = (string) file_get_contents(__DIR__ . '/../app/Console/Commands/QueueHeartbeat.php');

$checks = [
    'scheduler does not synthesize queue worker heartbeat' => !str_contains($kernelSource, 'queue-heartbeat-fallback')
        && !str_contains($kernelSource, 'MonitorSystem::QUEUE_HEARTBEAT_KEY'),
    'TV screen visit log has only one retention schedule' => substr_count($kernelSource, "name('tv-view-logs-prune')") === 1,
    'queue heartbeat implementation checks for a real worker' => str_contains($heartbeatSource, '$workerAlive = $this->hasQueueWorkerProcess();')
        && str_contains($heartbeatSource, 'if ($workerAlive)'),

    'php artisan queue worker is detected' => QueueHeartbeatPolicy::isQueueWorkerCommandLine(implode(chr(0), ['php', 'artisan', 'queue:work', 'database'])),
    'absolute php binary is detected' => QueueHeartbeatPolicy::isQueueWorkerCommandLine(implode(chr(0), ['/usr/bin/php', 'artisan', 'queue:work', '--queue=default'])),
    'heartbeat sidecar is not mistaken for a worker' => !QueueHeartbeatPolicy::isQueueWorkerCommandLine(implode(chr(0), ['php', 'artisan', 'queue:heartbeat'])),
    'shell command containing worker text is not mistaken for a worker' => !QueueHeartbeatPolicy::isQueueWorkerCommandLine(implode(chr(0), ['sh', '-c', 'php artisan queue:work'])),
    'php-fpm is not mistaken for a worker' => !QueueHeartbeatPolicy::isQueueWorkerCommandLine(implode(chr(0), ['php-fpm', 'artisan', 'queue:work'])),
];

foreach ($checks as $label => $passed) {
    if (!$passed) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$label}" . PHP_EOL;
}

echo "All BCS queue heartbeat policy smoke checks passed." . PHP_EOL;
