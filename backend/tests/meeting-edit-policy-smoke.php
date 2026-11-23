<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\MeetingEditPolicy;

function assertMeetingEditPolicy(array $expected, array $actual, string $label): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "[FAIL] {$label}: " . var_export($actual, true) . PHP_EOL);
        exit(1);
    }

    echo "[PASS] {$label}" . PHP_EOL;
}

$payload = [
    'title' => 'Updated title',
    'date' => '2026-11-24',
    'start_time' => '10:00',
    'end_time' => '10:30',
    'room' => 'Room 1',
    'link' => 'https://example.test',
    'participants' => [1, 2],
    'is_private' => true,
    'status' => 'cancelled',
    'tags' => [3],
];

assertMeetingEditPolicy(
    ['title' => 'Updated title', 'date' => '2026-11-24', 'start_time' => '10:00', 'end_time' => '10:30'],
    MeetingEditPolicy::filterFields($payload, false),
    'participant may change only title/date/time'
);
assertMeetingEditPolicy(
    $payload,
    MeetingEditPolicy::filterFields($payload, true),
    'organizer/admin/moderator retain full validated edit'
);
assertMeetingEditPolicy(
    [],
    MeetingEditPolicy::filterFields(['room' => 'Room 1', 'status' => 'cancelled'], false),
    'participant cannot change room or meeting status'
);

echo "All BCS meeting edit policy smoke checks passed." . PHP_EOL;
