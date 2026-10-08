<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Server-Sent Events: персональный realtime-канал уведомлений пользователя.
 *
 * GET /api/notifications/stream  (EventSource в браузере)
 *
 * События приходят из Redis-pubsub канала vks:events:{userId}, куда пишет
 * App\Services\RealtimeNotifier (вызывается из модели Notification при
 * создании уведомления). Отдельного websocket-сервиса не требуется: поток
 * идёт по тому же HTTPS через nginx (proxy_buffering off).
 *
 * Поллинг unread-count остаётся запасным механизмом: если SSE недоступен
 * (нет Redis, прокси буферизует ответ), фронт продолжает работать как раньше.
 */
class NotificationStreamController extends Controller
{
    public function stream(Request $request): StreamedResponse
    {
        $userId = (int) $request->user()->id;
        $channel = \App\Services\RealtimeNotifier::CHANNEL_PREFIX . $userId;

        // Проверка доступности realtime-канала ДО отправки заголовков.
        // Иначе исключение внутри StreamedResponse привело бы к 500 с уже
        // отправленными заголовками (браузер получил бы «битый» поток).
        // При недоступном Redis/расширении фронт автоматически работает на
        // поллинге unread-count — это штатный запасной режим, не ошибка.
        if (!\App\Services\RealtimeNotifier::isEnabled()) {
            return new StreamedResponse(function () {
                echo "event: unavailable\n";
                echo "data: {\"reason\":\"redis_disabled\"}\n\n";
                @ob_flush();
                flush();
            }, 200, [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache',
                'X-Accel-Buffering' => 'no',
            ]);
        }

        try {
            // Ping подключения к Redis: если сервер недоступен или нет
            // расширения (predis/phpredis), упасть в graceful-ответ вместо 500.
            \Illuminate\Support\Facades\Redis::connection()->ping();
        } catch (\Throwable $e) {
            report($e);
            return new StreamedResponse(function () {
                echo "event: unavailable\n";
                echo "data: {\"reason\":\"redis_unavailable\"}\n\n";
                @ob_flush();
                flush();
            }, 200, [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache',
                'X-Accel-Buffering' => 'no',
            ]);
        }

        return new StreamedResponse(function () use ($channel, $request) {
            // Заголовки отдаём до входа в бесконечный цикл
            echo "retry: 5000\n\n";
            @ob_flush();
            flush();

            $redis = \Illuminate\Support\Facades\Redis::connection();
            $redis->subscribe([$channel], function ($message) use ($request) {
                // Обрыв клиента (закрыта вкладка) — прерываем стрим
                if ($request->closed()) {
                    throw new \RuntimeException('client closed');
                }
                try {
                    $decoded = json_decode($message, true);
                    $event = is_array($decoded) ? ($decoded['event'] ?? 'notification') : 'notification';
                    $data = is_array($decoded) ? ($decoded['data'] ?? $decoded) : $message;
                    echo 'event: ' . $event . "\n";
                    echo 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
                    @ob_flush();
                    flush();
                } catch (\Throwable $e) {
                    // одно битое сообщение не должно ронять весь стрим
                }
            });
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no', // nginx: не буферизовать даже без правки конфига
            'Connection' => 'keep-alive',
        ]);
    }
}
