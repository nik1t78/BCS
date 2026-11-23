<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

/**
 * Короткоживущий билет для EventSource. Постоянный Sanctum-токен
 * никогда не помещается в URL и не попадает в access-логи nginx.
 */
final class NotificationStreamTicket
{
    public const TTL_SECONDS = 60;

    public static function issue(int $userId): string
    {
        $ticket = bin2hex(random_bytes(32));

        Cache::put(
            self::cacheKey($ticket),
            $userId,
            now()->addSeconds(self::TTL_SECONDS)
        );

        return $ticket;
    }

    /**
     * Билет имеет ограниченный срок действия и удаляется при получении.
     */
    public static function consume(string $ticket): ?int
    {
        if (!preg_match('/^[a-f0-9]{64}$/D', $ticket)) {
            return null;
        }

        $userId = Cache::pull(self::cacheKey($ticket));

        return is_numeric($userId) && (int) $userId > 0
            ? (int) $userId
            : null;
    }

    /**
     * В хранилище лежит только SHA-256 билета, не сам секрет.
     */
    public static function cacheKey(string $ticket): string
    {
        return 'vks_sse_ticket:' . hash('sha256', $ticket);
    }
}
