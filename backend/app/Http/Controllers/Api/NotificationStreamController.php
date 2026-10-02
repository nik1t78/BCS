<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RealtimeNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

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
        $channel = RealtimeNotifier::CHANNEL_PREFIX . $userId;

        return new StreamedResponse(function () use ($channel, $request) {
            // Бесконечный цикл отдаём целиком под защитой try/catch: любое
            // исключение внутри стрима (обрыв клиента, отвал Redis на
            // subscribe/publish-соединении) Laravel превращал в ошибку
            // "Streamed response threw an exception during flushing" и
            // браузер видел 500 на /api/notifications/stream. Здесь мы
            // тихо завершаем поток — фронт при этом продолжает жить за
            // счёт поллинга unread-count (запасной механизм).
            try {
                // Первый кадр сразу: EventSource считает соединение
                // установленным только после получения данных.
                echo "retry: 5000\n\n";
                $this->flushFrame();

                if ($this->subscribeWithHeartbeat($channel, $request)) {
                    return; // штатный выход: клиент закрыл соединение
                }
                // сюда попадаем только если Redis недоступен — держим
                // соединение живым редкими comment-кадрами (см. выше)
                while (!$request->closed()) {
                    echo ": poll-mode\n\n";
                    $this->flushFrame();
                    sleep(15);
                }
            } catch (Throwable $e) {
                // обрыв потока (закрытая вкладка / убитый worker) — молча
                // останавливаем вывод; заголовки уже отправлены, ответ
                // остаётся корректным text/event-stream
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'X-Accel-Buffering' => 'no', // nginx: не буферизовать даже без правки конфига
            'Connection' => 'keep-alive',
        ]);
    }

    /**
     * Подписка на Redis-pubsub с heartbeat'ами.
     *
     * Возвращает true, если подписка отработала штатно (клиент отключился),
     * и false, если канал realtime недоступен (нет Redis / extension) —
     * вызывающий тогда переходит в режим холостого keep-alive.
     */
    private function subscribeWithHeartbeat(string $channel, Request $request): bool
    {
        try {
            $redis = Redis::connection();

            // Проверка доступности ДО subscribe(): если Redis выключен,
            // редис-библиотека бросит исключение уже здесь, а не посреди
            // бесконечного цикла.
            $redis->ping();

            // Фоновый heartbeat раз в 15 секунд: без кадров SSE nginx
            // (proxy/fastcgi_read_timeout) и промежуточные прокси рвут
            // "молчащее" соединение, а EventSource бесконечно переподключается.
            register_shutdown_function(static function () use ($redis) {
                try {
                    $redis->close();
                } catch (Throwable $e) {
                    // ignore
                }
            });
            pcntl_async_signals(true);
            pcntl_signal(SIGALRM, function () use ($request) {
                if ($request->closed()) {
                    throw new \RuntimeException('client closed');
                }
                echo ": heartbeat\n\n";
                $this->flushFrame();
                pcntl_alarm(15);
            });
            pcntl_alarm(15);

            $redis->subscribe([$channel], function ($message) use ($request) {
                if ($request->closed()) {
                    throw new \RuntimeException('client closed');
                }
                try {
                    $decoded = json_decode($message, true);
                    $event = is_array($decoded) ? ($decoded['event'] ?? 'notification') : 'notification';
                    $data = is_array($decoded) ? ($decoded['data'] ?? $decoded) : $message;
                    echo 'event: ' . $event . "\n";
                    echo 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
                    $this->flushFrame();
                } catch (Throwable $e) {
                    // одно битое сообщение не должно ронять весь стрим
                }
            });

            pcntl_alarm(0);

            return true;
        } catch (\Illuminate\Redis\Connections\ConnectionException | \RedisException $e) {
            // Redis реально недоступен — переходим в poll-mode
            return false;
        }
        // ВАЖНО: любой другой Throwable (например "client closed" из
        // heartbeat-колбэка) сюда НЕ попадает — он пробрасывается наверх,
        // где перехватывается общим try/catch стрима и поток завершается.
    }

    /** Сброс буферов PHP наружу (nginx-буферизация отключена в конфиге). */
    private function flushFrame(): void
    {
        if (ob_get_level() > 0) {
            @ob_flush();
        }
        flush();
    }
}
