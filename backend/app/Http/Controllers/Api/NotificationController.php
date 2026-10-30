<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
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

        // Сортировка по id (автоинкремент) — надёжнее created_at: у уведомлений,
        // созданных в одну транзакцию/секунду, created_at одинаковый и порядок
        // «новых» плывёт, из-за чего фронт пропускал свежие уведомления.
        $notifications = $query->with(['meeting', 'user:id,name'])
            ->orderByDesc('id')
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
        // Гость (истёкший/отсутствующий токен sanctum) — не 500, а штатный 0:
        // фронт опрашивает unread-count по таймеру даже после протухания сессии.
        $user = $request->user();
        if (!$user) {
            return response()->json(['count' => 0]);
        }

        $count = Notification::where('user_id', $user->id)
            ->where('read', false)
            ->count();

        return response()->json(['count' => $count]);
    }
}
