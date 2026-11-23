<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\MeetingReminderPolicy;

$checks = [
    'SQL TIME with seconds matches scheduler minute' => MeetingReminderPolicy::isStartingAt('10:00:00', '10:00'),
    'SQL TIME without seconds matches scheduler minute' => MeetingReminderPolicy::isStartingAt('10:00', '10:00'),
    'different minute does not match' => !MeetingReminderPolicy::isStartingAt('10:00:00', '10:01'),
    'malformed stored time does not match' => !MeetingReminderPolicy::isStartingAt('bad-time', '10:00'),
    'malformed current time does not match' => !MeetingReminderPolicy::isStartingAt('10:00:00', '10:00:00'),
];

foreach ($checks as $label => $passed) {
    if (!$passed) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$label}" . PHP_EOL;
}

echo "All BCS meeting reminder policy smoke checks passed." . PHP_EOL;
