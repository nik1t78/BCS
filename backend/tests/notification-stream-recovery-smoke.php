<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\NotificationStreamPolicy;

$cases = [
    'invalid_or_expired_ticket' => true,
    'user_lookup_failed' => true,
    'redis_disabled' => true,
    'redis_unavailable' => true,
    'unauthenticated' => false,
];

foreach ($cases as $reason => $expected) {
    $actual = NotificationStreamPolicy::shouldRetryUnavailable($reason);
    if ($actual !== $expected) {
        fwrite(STDERR, "[FAIL] {$reason}: expected " . ($expected ? 'retry' : 'stop') . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$reason}" . PHP_EOL;
}

echo "All BCS notification stream recovery smoke checks passed." . PHP_EOL;
