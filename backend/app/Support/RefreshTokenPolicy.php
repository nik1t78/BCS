<?php

namespace App\Support;

use Carbon\CarbonImmutable;

final class RefreshTokenPolicy
{
    /**
     * Старые refresh-токены без expires_at получают срок от created_at,
     * чтобы переход на новую политику не оставлял их бессрочными.
     */
    public static function isExpired(
        ?string $expiresAt,
        ?string $createdAt,
        int $ttlDays,
        ?CarbonImmutable $now = null
    ): bool {
        $now ??= CarbonImmutable::now();

        if ($expiresAt !== null && $expiresAt !== '') {
            return CarbonImmutable::parse($expiresAt)->lessThanOrEqualTo($now);
        }

        if ($createdAt === null || $createdAt === '') {
            return true;
        }

        return CarbonImmutable::parse($createdAt)
            ->addDays(max(1, $ttlDays))
            ->lessThanOrEqualTo($now);
    }
}
