<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Centralized safeguards for account administration.
 */
final class UserAdministrationPolicy
{
    public static function canToggleActive(
        string $actorRole,
        string $targetRole,
        int $actorId,
        int $targetId
    ): bool {
        if ($actorId === $targetId) {
            return false;
        }

        if ($actorRole === 'admin') {
            return true;
        }

        // Moderators may manage ordinary accounts only; they cannot disable
        // administrators or other moderators.
        return $actorRole === 'moderator' && $targetRole === 'user';
    }

    public static function canRemoveActiveAdmin(
        string $targetRole,
        bool $targetIsActive,
        int $activeAdminCount
    ): bool {
        return !($targetRole === 'admin' && $targetIsActive && $activeAdminCount <= 1);
    }

    public static function canDelete(bool $hasMeetingHistory): bool
    {
        return !$hasMeetingHistory;
    }
}
