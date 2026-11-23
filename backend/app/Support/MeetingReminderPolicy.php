<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Normalizes SQL TIME values before comparing them with minute-level scheduler time.
 */
final class MeetingReminderPolicy
{
    public static function isStartingAt(string $storedTime, string $currentTime): bool
    {
        if (!preg_match('/^\d{2}:\d{2}(?::\d{2})?$/', $storedTime)
            || !preg_match('/^\d{2}:\d{2}$/', $currentTime)) {
            return false;
        }

        return substr($storedTime, 0, 5) === $currentTime;
    }
}
