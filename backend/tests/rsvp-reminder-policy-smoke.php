<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\\Support\\RsvpReminderPolicy;

$checks = [
    'default offsets are parsed and sorted' => RsvpReminderPolicy::parseOffsets('60,1440,60') === [1440, 60],
    'invalid and out-of-range offsets are ignored' => RsvpReminderPolicy::parseOffsets('0,-5,10081,nope,30') === [30],
    'empty offsets disable reminders' => RsvpReminderPolicy::parseOffsets('') === [],
    'reminder fires at exact offset' => RsvpReminderPolicy::isDue(3600, 60),
    'reminder tolerates scheduler delay inside grace window' => RsvpReminderPolicy::isDue(3660, 60),
    'reminder does not fire too early' => !RsvpReminderPolicy::isDue(3720, 60),
    'reminder does not fire after meeting starts' => !RsvpReminderPolicy::isDue(-1, 60),
    'no response needs reminder' => RsvpReminderPolicy::needsResponse(null),
    'maybe response needs reminder' => RsvpReminderPolicy::needsResponse('maybe'),
    'yes response does not need reminder' => !RsvpReminderPolicy::needsResponse('yes'),
    'no response does not need reminder' => !RsvpReminderPolicy::needsResponse('no'),
];

foreach ($checks as $label => $passed) {
    if (!$passed) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$label}" . PHP_EOL;
}

echo "All BCS RSVP reminder policy smoke checks passed." . PHP_EOL;
