<?php

namespace App\Services;

use Illuminate\Support\Facades\Redis;

/**
 * Realtime-доставка событий клиентам через SSE (Server-Sent Events).
 *
 * Лёгкая альтернатива WebSocket (Reverb/Soketi): не требует отдельного
 * docker-сервиса и WSS-сертификата — трафик идёт по тому же HTTPS через
 * nginx. Laravel пишет событие в Redis-pubsub канал "vks:events:{userId}",
 * а долгоживущий artisan-команды sse:stream читает его и отдаёт клиенту.
 *
 * Если Redis недоступен или QUEUE_CONNECTION != redis — publish() бросает
 * исключение, которое вызывающий код обязан перехватить: in-app уведомления
 * и поллинг при этом продолжают работать как раньше.
 */
class RealtimeNotifier
{
    public const CHANNEL_PREFIX = 'vks:events:';

    /** Доступен ли realtime-канал (redis включён в конфиге) */
    public static function isEnabled(): bool
    {
        return config('queue.default') === 'redis' && config('database.redis.client') !== null;
    }

    /**
     * Опубликовать событие в персональный канал пользователя.
     *
     * @param string $event имя события (notification / meeting_updated ...)
     * @param array  $payload данные события (JSON)
     */
    public function publish(int $userId, array $payload, string $event = 'notification'): void
    {
        Redis::publish(self::CHANNEL_PREFIX . $userId, json_encode([
            'event' => $event,
            'data' => $payload,
        ], JSON_UNESCAPED_UNICODE));
    }
}
