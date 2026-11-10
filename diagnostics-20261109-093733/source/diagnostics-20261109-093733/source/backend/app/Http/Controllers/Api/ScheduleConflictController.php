<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Services\RecurrenceService;
use Illuminate\Http\Request;

class ScheduleConflictController extends Controller
{
    /**
     * Конфликтует ли встреча с другим слотом того же пользователя.
     * Используется сервером при переносе (reschedule), чтобы не пускать
     * пересечение без явного флага force.
     *
     * Учитывает ПОВТОРЯЮЩИЕСЯ встречи: серия recurring != 'none' конфликтует
     * на целевую дату, если в этот день у неё occurrence
     * (см. App\Services\RecurrenceService — серверный эквивалент
     * фронтенд-парсера src/utils/recurrence.ts).
     */
    public static function userHasConflict(int $userId, string $date, string $startTime, string $endTime, ?int $excludeMeetingId = null): bool
    {
        $day = \Carbon\CarbonImmutable::parse($date);

        $q = Meeting::query()
            ->where(function ($w) use ($day) {
                $w->whereDate('date', $day->toDateString())
                  // повторяющиеся серии: базовая дата раньше, но occurrence может быть в этот день
                  ->orWhere(function ($r) use ($day) {
                      $r->where('recurring', '!=', 'none')
                        ->whereNotNull('recurring')
                        ->whereDate('date', '<=', $day->toDateString())
                        ->whereDate('date', '>=', $day->copy()->subDays(RecurrenceService::HORIZON_DAYS)->toDateString());
                  });
            })
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

        // Кандидаты на точную дату конфликтуют напрямую; повторяющиеся серии
        // проверяем серверным парсером RRULE (occursOn) — как это делает фронт.
        return $q->get()->contains(function (Meeting $m) use ($day, $startTime, $endTime) {
            $mStart = substr((string) $m->start_time, 0, 5);
            $mEnd = substr((string) $m->end_time, 0, 5);
            if (!($startTime < $mEnd && $endTime > $mStart)) return false;
            if ($m->date->toDateString() === $day->toDateString()) return true;
            return RecurrenceService::occursOn($m, $day);
        });
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

        $from = $validated['start_time'];
        $to = $validated['end_time'];
        $day = \Carbon\CarbonImmutable::parse($validated['date']);

        // Кандидаты: встречи на точную дату + повторяющиеся серии, у которых
        // occurrence может прийтись на этот день (окно развёртки HORIZON_DAYS).
        $candidates = Meeting::query()
            ->where(function ($w) use ($day) {
                $w->whereDate('date', $day->toDateString())
                  ->orWhere(function ($r) use ($day) {
                      $r->where('recurring', '!=', 'none')
                        ->whereNotNull('recurring')
                        ->whereDate('date', '<=', $day->toDateString())
                        ->whereDate('date', '>=', $day->copy()->subDays(RecurrenceService::HORIZON_DAYS)->toDateString());
                  });
            })
            ->whereIn('status', ['scheduled', 'in-progress'])
            ->when(!empty($validated['exclude']), fn($q) => $q->where('id', '!=', $validated['exclude']))
            ->get(['id', 'title', 'date', 'start_time', 'end_time', 'organizer_id', 'participants', 'recurring', 'repeat_until', 'rrule', 'status']);

        $conflicts = [];
        foreach ($candidates as $m) {
            $mStart = substr((string) $m->start_time, 0, 5);
            $mEnd = substr((string) $m->end_time, 0, 5);

            // Пересечение интервалов: start < otherEnd && end > otherStart
            if (!($from < $mEnd && $to > $mStart)) continue;

            // Для повторяющейся серии убеждаемся, что в этот день реально occurrence
            if ($m->date->toDateString() !== $day->toDateString() && !RecurrenceService::occursOn($m, $day)) continue;

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
