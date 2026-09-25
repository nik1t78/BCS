<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
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
     * Отметить все как прочитанные
     */
    public function markAllAsRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)
            ->where('read', false)
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
