<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use Illuminate\Http\Request;

class ScheduleConflictController extends Controller
{
    /**
     * Конфликтует ли встреча с другим слотом того же пользователя.
     * Используется сервером при переносе (reschedule), чтобы не пускать
     * пересечение без явного флага force.
     */
    public static function userHasConflict(int $userId, string $date, string $startTime, string $endTime, ?int $excludeMeetingId = null): bool
    {
        $q = Meeting::query()
            ->whereDate('date', $date)
            ->where('status', '!=', 'cancelled')
            ->where(function ($w) use ($userId) {
                $w->where('organizer_id', $userId)
                  ->orWhereJsonContains('participants', $userId);
            })
            ->where(function ($w) use ($startTime, $endTime) {
                $w->where(function ($x) use ($startTime, $endTime) {
                    $x->where('start_time', '<', $endTime)->where('end_time', '>', $startTime);
                });
            });

        if ($excludeMeetingId) {
            $q->where('id', '!=', $excludeMeetingId);
        }

        return $q->exists();
    }

    /**
     * Проверка конфликтов расписания: пересекающиеся по времени встречи
     * у указанных пользователей (участники + организатор) в указанный день.
     *
     * GET /meetings/check-conflicts?date=&start_time=&end_time=&users=1,2&exclude=meetingId
     */
    public function check(Request $request)
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i',
            'users' => 'required|string',
            'exclude' => 'nullable|integer',
        ]);

        $userIds = collect(explode(',', $validated['users']))
            ->map(fn($id) => (int) trim($id))
            ->filter()
            ->unique()
            ->values();

        if ($userIds->isEmpty()) {
            return response()->json(['conflicts' => []]);
        }

        $candidates = Meeting::query()
            ->whereDate('date', $validated['date'])
            ->whereIn('status', ['scheduled', 'in-progress'])
            ->when(!empty($validated['exclude']), fn($q) => $q->where('id', '!=', $validated['exclude']))
            ->get(['id', 'title', 'date', 'start_time', 'end_time', 'organizer_id', 'participants']);

        $from = $validated['start_time'];
        $to = $validated['end_time'];

        $conflicts = [];
        foreach ($candidates as $m) {
            $mStart = substr((string) $m->start_time, 0, 5);
            $mEnd = substr((string) $m->end_time, 0, 5);

            // Пересечение интервалов: start < otherEnd && end > otherStart
            if (!($from < $mEnd && $to > $mStart)) continue;

            $mUsers = array_unique(array_merge([$m->organizer_id], $m->participants ?? []));
            $clash = $userIds->filter(fn($uid) => in_array($uid, $mUsers))->values();

            if ($clash->isNotEmpty()) {
                $conflicts[] = [
                    'meeting_id' => $m->id,
                    'title' => $m->title,
                    'start_time' => $mStart,
                    'end_time' => $mEnd,
                    'overlapping_user_ids' => $clash->all(),
                ];
            }
        }

        return response()->json(['conflicts' => $conflicts]);
    }
}
