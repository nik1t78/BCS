<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Meeting;
use App\Services\RecurrenceService;
use Carbon\CarbonImmutable;

final class TvScreenPolicy
{
    /**
     * Return the nearest not-yet-ended occurrence in the requested horizon.
     *
     * @return array{date:string,start:CarbonImmutable,end:CarbonImmutable}|null
     */
    public static function nextOccurrence(Meeting $meeting, CarbonImmutable $now, int $days = 7): ?array
    {
        if ($meeting->is_private || !in_array($meeting->status, ['scheduled', 'in-progress'], true)) {
            return null;
        }

        $startTime = substr((string) $meeting->start_time, 0, 5);
        $endTime = substr((string) $meeting->end_time, 0, 5);
        if ($startTime === '' || $endTime === '') {
            return null;
        }

        $baseDate = $meeting->date->toDateString();
        for ($offset = 0; $offset <= max(0, min(30, $days)); $offset++) {
            $candidate = $now->startOfDay()->addDays($offset);
            $date = $candidate->toDateString();

            if ($meeting->recurring && $meeting->recurring !== 'none') {
                if (!RecurrenceService::occursOn($meeting, $candidate)) {
                    continue;
                }
            } elseif ($date !== $baseDate) {
                continue;
            }

            $start = CarbonImmutable::parse($date . ' ' . $startTime);
            $end = CarbonImmutable::parse($date . ' ' . $endTime);
            if ($end->lessThan($start)) {
                $end = $end->addDay();
            }

            if ($end->greaterThan($now)) {
                return ['date' => $date, 'start' => $start, 'end' => $end];
            }
        }

        return null;
    }
}
