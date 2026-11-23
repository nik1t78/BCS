<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\MeetingHeatmapPolicy;

$matrix = static fn (array $rows) => MeetingHeatmapPolicy::build($rows);

$checks = [
    'one-hour meeting does not count the hour in which it ends' => (function () use ($matrix) {
        $result = $matrix([['date' => '2026-11-23', 'start_time' => '10:00:00', 'end_time' => '11:00:00']]);
        return $result['matrix'][1][10] === 1
            && $result['matrix'][1][11] === 0
            && $result['occupied_hour_slots'] === 1
            && $result['meetings_count'] === 1;
    })(),
    'meeting crossing an hour boundary counts both occupied hours' => (function () use ($matrix) {
        $result = $matrix([['date' => '2026-11-23', 'start_time' => '10:30', 'end_time' => '11:30']]);
        return $result['matrix'][1][10] === 1 && $result['matrix'][1][11] === 1
            && $result['occupied_hour_slots'] === 2;
    })(),
    'meeting ending exactly on the hour does not occupy the next hour' => (function () use ($matrix) {
        $result = $matrix([['date' => '2026-11-23', 'start_time' => '10:00', 'end_time' => '10:30']]);
        return $result['matrix'][1][10] === 1 && $result['matrix'][1][11] === 0;
    })(),
    'overnight meeting is split across weekdays' => (function () use ($matrix) {
        $result = $matrix([['date' => '2026-11-23', 'start_time' => '19:30', 'end_time' => '08:30']]);
        return $result['matrix'][1][19] === 1
            && $result['matrix'][1][20] === 1
            && $result['matrix'][2][8] === 1;
    })(),
    'invalid and zero-length meetings are ignored' => (function () use ($matrix) {
        $result = $matrix([
            ['date' => '2026-11-23', 'start_time' => 'bad', 'end_time' => '11:00'],
            ['date' => '2026-11-23', 'start_time' => '10:00', 'end_time' => '10:00'],
        ]);
        return $result['meetings_count'] === 0 && $result['occupied_hour_slots'] === 0;
    })(),
];

foreach ($checks as $label => $passed) {
    if (!$passed) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$label}" . PHP_EOL;
}

echo "All BCS meeting heatmap policy smoke checks passed." . PHP_EOL;
