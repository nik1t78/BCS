<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\NotificationStreamTicket;

function assertSseTicket(bool $expected, bool $actual, string $label): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }

    echo "[PASS] {$label}" . PHP_EOL;
}

$ticket = str_repeat('a', 64);
$key = NotificationStreamTicket::cacheKey($ticket);

assertSseTicket(true, str_starts_with($key, 'vks_sse_ticket:'), 'ticket cache key uses dedicated namespace');
assertSseTicket(true, !str_contains($key, $ticket), 'raw ticket is never used as cache key');
assertSseTicket(true, strlen(substr($key, strlen('vks_sse_ticket:'))) === 64, 'cache key stores SHA-256 digest');
assertSseTicket(true, NotificationStreamTicket::TTL_SECONDS === 60, 'ticket lifetime is limited to 60 seconds');

echo "All BCS notification stream ticket smoke checks passed." . PHP_EOL;
