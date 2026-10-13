<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Массовая загрузка участников встречи списком / CSV.
 * Формат тела: { "participants": "Иванов А.С.; petrova\n12,34" } — строки
 * разделяются ; \n ,. По каждому токену ищем пользователя по id, логину
 * (регистронезависимо) или точному совпадению ФИО. Найденные добавляются
 * к списку участников, ненайденные возвращаются в ответе.
 */
class MeetingBulkParticipantsController extends Controller
{
    public function store(Request $request, Meeting $meeting)
    {
        abort_unless($this->canManage($request, $meeting), 403, 'Только организатор, модератор или админ может добавлять участников');

        $data = $request->validate([
            'participants' => 'required|string|max:20000',
            'notify' => 'boolean',
        ]);

        $tokens = preg_split('/[;\n,]+/u', $data['participants'], -1, PREG_SPLIT_NO_EMPTY);
        $tokens = array_map(fn ($t) => trim($t), $tokens);
        $tokens = array_values(array_filter($tokens));

        $current = array_map('intval', $meeting->participants ?? []);
        $added = [];
        $notFound = [];

        foreach ($tokens as $token) {
            $user = null;
            if (ctype_digit($token)) {
                $user = User::find((int) $token);
            }
            if (!$user) {
                $user = User::whereRaw('LOWER(login) = LOWER(?)', [$token])->first();
            }
            if (!$user) {
                $user = User::where('name', $token)->first();
            }

            if (!$user) {
                $notFound[] = $token;
                continue;
            }
            if (!in_array($user->id, $current, true)) {
                $current[] = $user->id;
                $added[] = ['id' => $user->id, 'name' => $user->name];
            }
        }

        $meeting->update(['participants' => array_values(array_unique($current))]);

        if (!empty($added) && ($data['notify'] ?? true)) {
            foreach ($added as $a) {
                Notification::create([
                    'user_id' => $a['id'],
                    'type' => 'meeting',
                    'title' => 'Вас добавили во встречу',
                    'message' => "«{$meeting->title}» — {$meeting->start_time->format('d.m.Y H:i')}" . ($meeting->room ? ", комната: {$meeting->room}" : ''),
                ]);
            }
        }

        return response()->json([
            'message' => 'Участники обновлены',
            'added' => $added,
            'not_found' => $notFound,
            'participants' => $meeting->fresh()->participants,
        ]);
    }

    private function canManage(Request $request, Meeting $meeting): bool
    {
        $u = $request->user();
        if ($u->isAdmin() || $u->isModerator()) {
            return true;
        }
        return (int) $meeting->organizer_id === (int) $u->id;
    }
}
