<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;

/**
 * Web Push (browser push notifications) — подписки браузера на уведомления.
 * Пользователь разрешает push в браузере, подписка сохраняется; при создании
 * уведомлений приложение может доставлять их через сервисный worker.
 */
class PushSubscriptionController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'endpoint' => 'required|string',
            'keys' => 'required|array',
            'keys.p256dh' => 'required|string',
            'keys.auth' => 'required|string',
        ]);

        $sub = $request->user()->pushSubscriptions()->updateOrCreate(
            ['endpoint' => $validated['endpoint']],
            [
                'public_key' => $validated['keys']['p256dh'],
                'auth_token' => $validated['keys']['auth'],
            ]
        );

        return response()->json(['message' => 'Подписка сохранена', 'id' => $sub->id]);
    }

    public function destroy(Request $request, $id)
    {
        $request->user()->pushSubscriptions()->where('id', $id)->delete();
        return response()->json(['message' => 'Подписка удалена']);
    }

    public function index(Request $request)
    {
        return response()->json($request->user()->pushSubscriptions);
    }

    /**
     * Тестовая доставка: формирует webpush-поле для фронтенда (сервисный worker
     * показывает уведомление). Реальная отправка через VAPID возможна при
     * подключении библиотек web-push (см. DOCS.md, раздел «Дорожная карта»).
     */
    public function testPush(Request $request)
    {
        Notification::create([
            'user_id' => $request->user()->id,
            'type' => 'info',
            'title' => 'Проверка Push',
            'message' => 'Если вы видите это уведомление — канал работает.',
        ]);

        return response()->json([
            'message' => 'Тестовое уведомление создано и доставлено через SSE',
            'subscriptions' => $request->user()->pushSubscriptions()->count(),
        ]);
    }
}
