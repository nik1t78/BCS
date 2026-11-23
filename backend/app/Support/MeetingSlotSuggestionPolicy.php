<?php

declare(strict_types=1);

namespace App\Support;

final class MeetingSlotSuggestionPolicy
{
    /**
     * Return start/end pairs for slots that fit inside working hours and do not
     * overlap any busy interval. All times are HH:MM; 24:00 is allowed as end.
     *
     * @param array<int, array{start:string,end:string}> $busy
     * @return array<int, array{start:string,end:string}>
     */
    public static function suggest(
        array $busy,
        string $dayStart,
        string $dayEnd,
        int $durationMinutes,
        int $stepMinutes = 30,
        int $limit = 10
    ): array {
        $from = self::toMinutes($dayStart);
        $to = self::toMinutes($dayEnd);

        if ($from === null || $to === null || $to <= $from
            || $durationMinutes < 15 || $durationMinutes > 480
            || $stepMinutes < 5 || $stepMinutes > 120 || $limit < 1) {
            return [];
        }

        $ranges = [];
        foreach ($busy as $item) {
            $start = self::toMinutes((string) ($item['start'] ?? ''));
            $end = self::toMinutes((string) ($item['end'] ?? ''));
            if ($start === null || $end === null || $end <= $start) {
                continue;
            }
            if ($end > $from && $start < $to) {
                $ranges[] = ['start' => max($from, $start), 'end' => min($to, $end)];
            }
        }

        usort($ranges, fn (array $a, array $b) => $a['start'] <=> $b['start']);
        $merged = [];
        foreach ($ranges as $range) {
            $last = count($merged) - 1;
            if ($last >= 0 && $range['start'] <= $merged[$last]['end']) {
                $merged[$last]['end'] = max($merged[$last]['end'], $range['end']);
            } else {
                $merged[] = $range;
            }
        }

        $slots = [];
        $candidate = (int) (ceil($from / $stepMinutes) * $stepMinutes);
        while ($candidate + $durationMinutes <= $to && count($slots) < $limit) {
            $end = $candidate + $durationMinutes;
            $conflict = false;
            foreach ($merged as $range) {
                if ($candidate < $range['end'] && $end > $range['start']) {
                    $conflict = true;
                    break;
                }
                if ($range['start'] >= $end) {
                    break;
                }
            }

            if (!$conflict) {
                $slots[] = [
                    'start' => self::fromMinutes($candidate),
                    'end' => self::fromMinutes($end),
                ];
            }
            $candidate += $stepMinutes;
        }

        return $slots;
    }

    private static function toMinutes(string $value): ?int
    {
        if (!preg_match('/^(?:([01]?[0-9]|2[0-3]):([0-5][0-9])|24:00)$/', $value, $match)) {
            return null;
        }
        if ($value === '24:00') return 1440;
        return ((int) $match[1] * 60) + (int) $match[2];
    }

    private static function fromMinutes(int $value): string
    {
        return sprintf('%02d:%02d', intdiv($value, 60), $value % 60);
    }
}
