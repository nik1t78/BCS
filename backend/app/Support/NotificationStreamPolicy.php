<?php

namespace App\\Support;

/**
 * Решает, нужно ли повторять SSE-подключение после служебного события.
 * Временные сбои Redis/cache и истёкший одноразовый билет не должны
 * навсегда отключать realtime до перезагрузки страницы.
 */
final class NotificationStreamPolicy
{
    public static function shouldRetryUnavailable(string $reason): bool
    {
        return $reason !== 'unauthenticated';
    }
}
