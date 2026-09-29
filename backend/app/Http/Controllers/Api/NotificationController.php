<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Telegram Webhook: бот получает сообщения и привязывает чат к пользователю.
     * Пользователь пишет боту /start <код-привязки> (код показывается в профиле).
     * Публичный роут — проверяется только секретный токен в URL.
     */
    public function telegramWebhook(Request $request)
    {
        $secret = (string) env('TELEGRAM_WEBHOOK_SECRET', '');
        if ($secret === '' || !hash_equals($secret, (string) $request->query('secret'))) {
            return response()->json(['ok' => false], 403);
        }

        $message = $request->input('message');
        if (!$message) {
            return response()->json(['ok' => true]);
        }

        $chatId = (string) ($message['chat']['id'] ?? '');
        $text = trim((string) ($message['text'] ?? ''));

        if ($chatId === '') {
            return response()->json(['ok' => true]);
        }

        // Команда привязки: /start CODE или /link CODE
        if (preg_match('#^/(?:start|link)\s+(\S+)#', $text, $m)) {
            $user = User::where('telegram_link_code', $m[1])->first();
            if ($user) {
                $user->update([
                    'telegram_chat_id' => $chatId,
                    'telegram_link_code' => null,
                ]);
                $this->tgReply($chatId, "✅ Аккаунт привязан! Теперь уведомления о встречах будут приходить сюда.");
            } else {
                $this->tgReply($chatId, "❌ Код привязки не найден. Получите новый в профиле ВКС Расписание и повторите /start <код>.");
            }

            return response()->json(['ok' => true]);
        }

        if ($text === '/start') {
            $this->tgReply($chatId, "Привяжите аккаунт: скопируйте код из профиля ВКС Расписание и отправьте «/start ваш_код».");
        } else {
            $this->tgReply($chatId, "Я бот ВКС Расписание. Для привязки отправьте «/start ваш_код» из профиля.");
        }

        return response()->json(['ok' => true]);
    }

    private function tgReply(string $chatId, string $text): void
    {
        try {
            \Illuminate\Support\Facades\Http::timeout(5)->post(
                rtrim((string) env('TELEGRAM_API_URL', 'https://api.telegram.org'), '/')
                    . '/bot' . env('TELEGRAM_BOT_TOKEN') . '/sendMessage',
                ['chat_id' => $chatId, 'text' => $text]
            );
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Telegram webhook reply failed: ' . $e->getMessage());
        }
    }

    /**
     * Список уведомлений пользователя.
     * Администратор с параметром all=1 видит уведомления всех пользователей ВКС.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $showAll = $request->boolean('all') && $user->role === 'admin';

        $query = $showAll ? Notification::query() : Notification::where('user_id', $user->id);

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->boolean('unread')) {
            $query->unread();
        }

        $notifications = $query->with(['meeting', 'user:id,name'])
            ->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', $showAll ? 100 : 50));

        return response()->json($notifications);
    }

    /**
     * Отметить как прочитанное
     */
    public function markAsRead(Request $request, $id)
    {
        $user = $request->user();

        // Администратор может отмечать прочитанными уведомления любого пользователя (режим «Все уведомления»)
        $query = $user->role === 'admin' ? Notification::query() : Notification::where('user_id', $user->id);

        $notification = $query->findOrFail($id);

        $notification->markAsRead();

        return response()->json($notification);
    }

    /**
     * Отметить все как прочитанные.
     * Администратор с параметром all=1 отмечает уведомления всех пользователей,
     * остальные — только свои.
     */
    public function markAllAsRead(Request $request)
    {
        $user = $request->user();
        $showAll = $request->boolean('all') && $user->role === 'admin';

        $query = $showAll ? Notification::query() : Notification::where('user_id', $user->id);

        $query->where('read', false)
            ->update(['read' => true]);

        return response()->json(['message' => 'Все уведомления отмечены как прочитанные']);
    }

    /**
     * Очистить все уведомления
     */
    public function clearAll(Request $request)
    {
        Notification::where('user_id', $request->user()->id)->delete();

        return response()->json(['message' => 'Все уведомления удалены']);
    }

    /**
     * Количество непрочитанных
     */
    public function unreadCount(Request $request)
    {
        $count = Notification::where('user_id', $request->user()->id)
            ->where('read', false)
            ->count();

        return response()->json(['count' => $count]);
    }
}
