<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\RoomLifecyclePolicy;

$checks = [
    'room without meetings can be deleted' => RoomLifecyclePolicy::canDelete(false) === true,
    'room with meeting history cannot be deleted' => RoomLifecyclePolicy::canDelete(true) === false,
    'active room accepts new bookings' => RoomLifecyclePolicy::canBook(true) === true,
    'inactive room rejects new bookings' => RoomLifecyclePolicy::canBook(false) === false,
];

foreach ($checks as $label => $passed) {
    if (!$passed) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$label}" . PHP_EOL;
}

echo "All BCS room lifecycle smoke checks passed." . PHP_EOL;
