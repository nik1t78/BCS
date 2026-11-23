<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Safe lifecycle rules for meeting rooms.
 */
final class RoomLifecyclePolicy
{
    public static function canDelete(bool $hasMeetings): bool
    {
        return !$hasMeetings;
    }

    public static function canBook(bool $isActive): bool
    {
        return $isActive;
    }
}
