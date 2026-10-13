<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Meeting;
use Illuminate\Http\Request;

class MeetingTrashController extends Controller
{
    /**
     * Корзина: мягко удалённые встречи.
     * Админ/модератор — все, обычный пользователь — только свои
     * (организованные или с участием).
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Meeting::onlyTrashed()->with(['organizer', 'tags']);

        if (!$user->isAdmin() && !$user->isModerator()) {
            $query->where(function ($q) use ($user) {
                $q->where('organizer_id', $user->id)
                  ->orWhereJsonContains('participants', $user->id);
            });
        }

        $query->orderBy('deleted_at', 'desc');

        return response()->json($query->paginate(min(max((int) $request->get('per_page', 50), 1), 200)));
    }

    /**
     * Восстановить встречу из корзины
     */
    public function restore(Request $request, int $id)
    {
        $user = $request->user();

        // onlyTrashed + withTrashed-поиск по id
        $meeting = Meeting::onlyTrashed()->findOrFail($id);

        if (!$user->isAdmin() && !$user->isModerator()
            && $meeting->organizer_id !== $user->id
            && !$meeting->isParticipant($user->id)) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $meeting->restore();

        AuditLog::log($request, 'meeting_restored', $meeting, ['deleted_at' => now()->toIso8601String()], ['restored' => true]);

        return response()->json($meeting->load(['organizer', 'tags']));
    }

    /**
     * Удалить навсегда (только админ/модератор или организатор)
     */
    public function destroyForever(Request $request, int $id)
    {
        $user = $request->user();

        $meeting = Meeting::onlyTrashed()->findOrFail($id);

        if (!$user->isAdmin() && !$user->isModerator() && $meeting->organizer_id !== $user->id) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        AuditLog::log($request, 'meeting_deleted_forever', null, [
            'title' => $meeting->title,
            'date' => $meeting->date,
        ]);

        $meeting->forceDelete();

        return response()->json(['message' => 'Конференция удалена безвозвратно']);
    }
}
