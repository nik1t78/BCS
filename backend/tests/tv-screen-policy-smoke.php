<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Models\Meeting;
use App\Support\TvScreenPolicy;
use Carbon\CarbonImmutable;

$makeMeeting = static function (array $values): Meeting {
    return new Meeting(array_merge([
        'date' => '2026-11-20',
        'start_time' => '10:00:00',
        'end_time' => '11:00:00',
        'recurring' => 'none',
        'repeat_until' => null,
        'status' => 'scheduled',
        'is_private' => false,
    ], $values));
};

$now = CarbonImmutable::parse('2026-11-23 09:00:00');

$checks = [
    'active recurring series created earlier is visible today' => (function () use ($makeMeeting, $now) {
        $meeting = $makeMeeting(['date' => '2026-11-20', 'recurring' => 'daily', 'repeat_until' => '2026-11-30']);
        $result = TvScreenPolicy::nextOccurrence($meeting, $now, 7);
        return $result !== null && $result['date'] === '2026-11-23'
            && $result['start']->format('H:i') === '10:00';
    })(),
    'already ended occurrence today advances to the next valid occurrence' => (function () use ($makeMeeting) {
        $meeting = $makeMeeting([
            'date' => '2026-11-20',
            'start_time' => '08:00:00',
            'end_time' => '09:00:00',
            'recurring' => 'daily',
            'repeat_until' => '2026-11-30',
        ]);
        $result = TvScreenPolicy::nextOccurrence($meeting, CarbonImmutable::parse('2026-11-23 10:00:00'), 7);
        return $result !== null && $result['date'] === '2026-11-24';
    })(),
    'weekly recurrence finds the next weekday occurrence' => (function () use ($makeMeeting, $now) {
        $meeting = $makeMeeting(['date' => '2026-11-16', 'recurring' => 'weekly', 'repeat_until' => '2026-12-31']);
        $result = TvScreenPolicy::nextOccurrence($meeting, $now, 7);
        return $result !== null && $result['date'] === '2026-11-23';
    })(),
    'expired recurrence is not shown' => (function () use ($makeMeeting, $now) {
        $meeting = $makeMeeting(['date' => '2026-11-16', 'recurring' => 'daily', 'repeat_until' => '2026-11-22']);
        return TvScreenPolicy::nextOccurrence($meeting, $now, 7) === null;
    })(),
    'private meeting is never shown on public TV screen' => (function () use ($makeMeeting, $now) {
        $meeting = $makeMeeting(['date' => '2026-11-23', 'is_private' => true]);
        return TvScreenPolicy::nextOccurrence($meeting, $now, 7) === null;
    })(),
    'past non-recurring meeting is not shown' => (function () use ($makeMeeting, $now) {
        $meeting = $makeMeeting(['date' => '2026-11-23', 'start_time' => '08:00:00', 'end_time' => '08:30:00']);
        return TvScreenPolicy::nextOccurrence($meeting, $now, 7) === null;
    })(),
];

foreach ($checks as $label => $passed) {
    if (!$passed) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$label}" . PHP_EOL;
}

echo "All BCS TV screen policy smoke checks passed." . PHP_EOL;
