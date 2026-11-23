<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\NotificationStreamTicket;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Персональный realtime-канал уведомлений через Server-Sent Events.
 *
 * Браузерный EventSource не умеет отправлять Authorization header.
 * Поэтому авторизованный POST сначала выдаёт одноразовый короткоживущий
 * билет, а GET-поток принимает только этот билет — не постоянный Sanctum token.
 */
class NotificationStreamController extends Controller
{
    public function issueTicket(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        try {
            $ticket = NotificationStreamTicket::issue((int) $user->id);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'Realtime временно недоступен'], 503);
        }

        return response()->json([
            'ticket' => $ticket,
            'expires_in' => NotificationStreamTicket::TTL_SECONDS,
        ], 201)->header('Cache-Control', 'no-store, private');
    }

    public function stream(Request $request): StreamedResponse
    {
        $ticket = (string) $request->query('ticket', '');
        $userId = null;

        try {
            $userId = NotificationStreamTicket::consume($ticket);
        } catch (\Throwable $e) {
            report($e);
        }

        if (!$userId) {
            return $this->unavailableResponse('invalid_or_expired_ticket');
        }

        try {
            $user = User::query()->find($userId);
        } catch (\Throwable $e) {
            report($e);

            return $this->unavailableResponse('user_lookup_failed');
        }

        if (!$user) {
            return $this->unavailableResponse('unauthenticated');
        }

        $channel = \App\Services\RealtimeNotifier::CHANNEL_PREFIX . (int) $user->id;

        // Проверяем Redis до отправки SSE-заголовков: после старта потока
        // HTTP-ошибку корректно вернуть уже нельзя.
        if (!\App\Services\RealtimeNotifier::isEnabled()) {
            return $this->unavailableResponse('redis_disabled');
        }

        try {
            Redis::connection()->ping();
        } catch (\Throwable $e) {
            report($e);

            return $this->unavailableResponse('redis_unavailable');
        }

        return new StreamedResponse(function () use ($channel, $request) {
            echo "retry: 5000\n\n";
            @ob_flush();
            flush();

            $redis = Redis::connection();
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
                    @ob_flush();
                    flush();
                } catch (\Throwable $e) {
                    // Одно некорректное сообщение не должно обрывать весь поток.
                }
            });
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-store, private',
            'X-Accel-Buffering' => 'no',
            'Connection' => 'keep-alive',
        ]);
    }

    private function unavailableResponse(string $reason): StreamedResponse
    {
        return new StreamedResponse(function () use ($reason) {
            echo "event: unavailable\n";
            echo 'data: ' . json_encode(['reason' => $reason]) . "\n\n";
            @ob_flush();
            flush();
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-store, private',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
