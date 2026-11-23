<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\MeetingSlotSuggestionPolicy;

$checks = [
    'suggests the first aligned slot in an empty working day' =>
        MeetingSlotSuggestionPolicy::suggest([], '08:00', '12:00', 60, 30, 2) === [
            ['start' => '08:00', 'end' => '09:00'],
            ['start' => '08:30', 'end' => '09:30'],
        ],
    'skips overlapping room and participant busy intervals' =>
        MeetingSlotSuggestionPolicy::suggest([
            ['start' => '08:00', 'end' => '09:30'],
            ['start' => '09:00', 'end' => '10:00'],
        ], '08:00', '12:00', 60, 30, 5) === [
            ['start' => '10:00', 'end' => '11:00'],
            ['start' => '10:30', 'end' => '11:30'],
            ['start' => '11:00', 'end' => '12:00'],
        ],
    'allows a slot that starts exactly when a booking ends' =>
        MeetingSlotSuggestionPolicy::suggest([
            ['start' => '08:00', 'end' => '09:00'],
        ], '08:00', '10:00', 60, 30, 2)[0] === ['start' => '09:00', 'end' => '10:00'],
    'merges adjacent bookings before finding slots' =>
        MeetingSlotSuggestionPolicy::suggest([
            ['start' => '08:00', 'end' => '09:00'],
            ['start' => '09:00', 'end' => '10:00'],
        ], '08:00', '11:00', 60, 30, 2)[0] === ['start' => '10:00', 'end' => '11:00'],
    'supports midnight as the end of a working day' =>
        MeetingSlotSuggestionPolicy::suggest([], '23:00', '24:00', 60, 30, 1)[0] === ['start' => '23:00', 'end' => '24:00'],
    'rejects invalid working hours and duration' =>
        MeetingSlotSuggestionPolicy::suggest([], '20:00', '08:00', 60) === []
        && MeetingSlotSuggestionPolicy::suggest([], '08:00', '12:00', 10) === [],
    'ignores malformed busy intervals' =>
        MeetingSlotSuggestionPolicy::suggest([
            ['start' => 'bad', 'end' => '09:00'],
        ], '08:00', '10:00', 60, 30, 1)[0] === ['start' => '08:00', 'end' => '09:00'],
];

foreach ($checks as $label => $passed) {
    if (!$passed) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$label}" . PHP_EOL;
}

echo "All BCS smart slot finder policy smoke checks passed." . PHP_EOL;
