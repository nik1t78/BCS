<?php

namespace App\Support;

class MeetingPollPolicy
{
    public static function canManage(int $organizerId, int $userId, string $role): bool
    {
        return $organizerId === $userId || in_array($role, ['admin', 'moderator'], true);
    }

    public static function canVote(bool $meetingAccessible, bool $pollClosed, int $optionCount, int $optionIndex): bool
    {
        return $meetingAccessible
            && !$pollClosed
            && $optionIndex >= 0
            && $optionIndex < $optionCount;
    }

    public static function normalizeOptions(array $options): array
    {
        $normalized = [];
        foreach ($options as $option) {
            if (!is_string($option)) {
                continue;
            }
            $label = trim($option);
            if ($label === '') {
                continue;
            }
            $key = mb_strtolower($label);
            if (!isset($normalized[$key])) {
                $normalized[$key] = $label;
            }
        }

        return array_values($normalized);
    }
}
