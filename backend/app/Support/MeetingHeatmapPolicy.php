<?php

declare(strict_types=1);

namespace App\Support;

use DateTimeImmutable;
use Throwable;

final class MeetingHeatmapPolicy
{
    /**
     * Build [weekday 0=Sun..6=Sat][hour 8..20] occupied-hour counts.
     * A meeting is counted in every hour it overlaps, not in the hour it ends.
     *
     * @param array<int, array{date:mixed,start_time:mixed,end_time:mixed}> $meetings
     * @return array{matrix:array<int,array<int,int>>,occupied_hour_slots:int,meetings_count:int}
     */
    public static function build(array $meetings): array
    {
        $matrix = array_fill(0, 7, array_fill(8, 13, 0));
        $occupied = 0;
        $validMeetings = 0;

        foreach ($meetings as $meeting) {
            try {
                $date = $meeting['date'] ?? null;
                if ($date instanceof \DateTimeInterface) {
                    $dateKey = $date->format('Y-m-d');
                } else {
                    $dateKey = substr((string) $date, 0, 10);
                }
                $day = DateTimeImmutable::createFromFormat('!Y-m-d', $dateKey);
                $start = self::timeToMinutes((string) ($meeting['start_time'] ?? ''));
                $end = self::timeToMinutes((string) ($meeting['end_time'] ?? ''));

                if (!$day || $start === null || $end === null || $start === $end) {
                    continue;
                }
                if ($end < $start) {
                    $end += 1440;
                }
                if ($end - $start > 1440) {
                    continue;
                }

                $validMeetings++;
                $firstHour = intdiv($start, 60);
                $lastHour = intdiv($end - 1, 60);
                for ($absoluteHour = $firstHour; $absoluteHour <= $lastHour; $absoluteHour++) {
                    $dayOffset = intdiv($absoluteHour, 24);
                    $hour = $absoluteHour % 24;
                    if ($hour < 8 || $hour > 20) {
                        continue;
                    }
                    $weekday = ((int) $day->format('w') + $dayOffset) % 7;
                    $matrix[$weekday][$hour]++;
                    $occupied++;
                }
            } catch (Throwable) {
                continue;
            }
        }

        return [
            'matrix' => $matrix,
            'occupied_hour_slots' => $occupied,
            'meetings_count' => $validMeetings,
        ];
    }

    private static function timeToMinutes(string $value): ?int
    {
        if (!preg_match('/^(?:([01]\d|2[0-3]):([0-5]\d)|24:00)(?::[0-5]\d)?$/', $value, $match)) {
            return null;
        }
        if (str_starts_with($value, '24:00')) {
            return 1440;
        }
        return ((int) $match[1] * 60) + (int) $match[2];
    }
}
