<?php

declare(strict_types=1);

namespace App\Support;

final class MeetingEditPolicy
{
    private const PARTICIPANT_FIELDS = [
        'title',
        'date',
        'start_time',
        'end_time',
    ];

    /**
     * Organizers/admins/moderators retain the full validated update.
     * Participants may only change the meeting title and time slot.
     */
    public static function filterFields(array $attributes, bool $canManage): array
    {
        if ($canManage) {
            return $attributes;
        }

        return array_intersect_key($attributes, array_flip(self::PARTICIPANT_FIELDS));
    }
}
