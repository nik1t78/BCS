<?php

declare(strict_types=1);

namespace App\\Support;

final class NotificationAccess
{
    /**
     * Cross-user notification access is deliberately opt-in and admin-only.
     */
    public static function canManageAll(string $role, bool $allRequested): bool
    {
        return $role === 'admin' && $allRequested;
    }
}
