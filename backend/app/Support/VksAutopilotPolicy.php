<?php

declare(strict_types=1);

namespace App\Support;

final class VksAutopilotPolicy
{
    public static function isFutureOrCurrent(
        string $meetingDate,
        string $startTime,
        string $today,
        string $currentTime
    ): bool {
        $meetingDate = substr(trim($meetingDate), 0, 10);
        $startTime = substr(trim($startTime), 0, 5);

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $meetingDate)
            || !preg_match('/^\d{2}:\d{2}$/', $startTime)
            || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $today)
            || !preg_match('/^\d{2}:\d{2}$/', $currentTime)) {
            return false;
        }

        return $meetingDate > $today
            || ($meetingDate === $today && $startTime >= $currentTime);
    }
}
