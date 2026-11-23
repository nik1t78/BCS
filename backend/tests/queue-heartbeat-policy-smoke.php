<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\QueueHeartbeatPolicy;

$checks = [
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
