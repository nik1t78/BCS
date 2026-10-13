<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
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
        // Маршрут объявлен ВНЕ группы auth:sanctum (EventSource не умеет слать
        // заголовок Authorization, токен только в query ?token=ID|HASH). Поэтому
        // пользователя резолвим здесь сами — двумя способами на случай разных
        // версий Sanctum:
        //   1) если гарда всё-таки подставила юзера ($request->user());
        //   2) по query-токену напрямую через PersonalAccessToken::findToken.
        // Любой сбой (битый/просроченный токен, нет DB) — штатное событие
        // "unavailable" вместо 500: фронт живёт на поллинге unread-count.
        $user = null;
        try {
            $user = $request->user();
        } catch (\Throwable $e) {
            report($e);
        }

        if (!$user) {
            $rawToken = (string) $request->query('token', '');
            if ($rawToken === '' || substr_count($rawToken, '|') !== 1) {
                return $this->unavailableResponse('invalid_token');
            }
            [$id, $tokenPart] = explode('|', $rawToken, 2);
            try {
                $pat = PersonalAccessToken::findToken($tokenPart, $id);
                $user = $pat?->tokenable;
            } catch (\Throwable $e) {
                report($e);
                return $this->unavailableResponse('invalid_token');
            }
        }

        if (!$user) {
            \Illuminate\Support\Facades\Log::info('SSE stream: user not resolved from token', [
                'ip' => $request->ip(),
                'token_prefix' => substr((string) $request->query('token'), 0, 6),
            ]);
            return $this->unavailableResponse('unauthenticated');
        }

        $userId = (int) $user->id;
        $channel = \App\Services\RealtimeNotifier::CHANNEL_PREFIX . $userId;

        // Проверка доступности realtime-канала ДО отправки заголовков.
        // Иначе исключение внутри StreamedResponse привело бы к 500 с уже
        // отправленными заголовками (браузер получил бы «битый» поток).
        // При недоступном Redis/расширении фронт автоматически работает на
        // поллинге unread-count — это штатный запасной режим, не ошибка.
        if (!\App\Services\RealtimeNotifier::isEnabled()) {
            return $this->unavailableResponse('redis_disabled');
        }

        try {
            // Ping подключения к Redis: если сервер недоступен или нет
            // расширения (predis/phpredis), упасть в graceful-ответ вместо 500.
            \Illuminate\Support\Facades\Redis::connection()->ping();
        } catch (\Throwable $e) {
            report($e);
            return $this->unavailableResponse('redis_unavailable');
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

    /**
     * Штатный запасной режим: SSE недоступен (нет Redis/расширения).
     * Frontend получает событие "unavailable" и остаётся на поллинге.
     */
    private function unavailableResponse(string $reason): StreamedResponse
    {
        return new StreamedResponse(function () use ($reason) {
            echo "event: unavailable\n";
            echo 'data: ' . json_encode(['reason' => $reason]) . "\n\n";
            @ob_flush();
            flush();
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
