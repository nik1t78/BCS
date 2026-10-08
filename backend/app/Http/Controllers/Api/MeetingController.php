<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Meeting;
use App\Models\Notification;
use App\Models\Room;
use Illuminate\Http\Request;

class MeetingController extends Controller
{
    /**
     * Список конференций
     */
    public function index(Request $request)
    {
        $user = $request->user();
        
        $query = Meeting::with(['organizer', 'tags'])->accessibleBy($user);
        // Дата для пост-фильтрации occurrence'ов повторяющихся серий (см. RecurrenceService)
        $filterOccurrenceDay = null;

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('date')) {
            // date=YYYY-MM-DD: точная дата + occurrence'ы повторяющихся серий в этот день
            $day = \Carbon\CarbonImmutable::parse($request->date);
            $query->where(function ($w) use ($day) {
                $w->whereDate('date', $day->toDateString())
                  ->orWhere(function ($r) use ($day) {
                      $r->where('recurring', '!=', 'none')
                        ->whereNotNull('recurring')
                        ->whereDate('date', '<=', $day->toDateString())
                        ->whereDate('date', '>=', $day->copy()->subDays(\App\Services\RecurrenceService::HORIZON_DAYS)->toDateString());
                  });
            });
            $filterOccurrenceDay = $day;
        }

        if ($request->boolean('my')) {
            $query->myMeetings($user->id);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('room', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Дополнительные фильтры фильтрационного API
        if ($request->filled('priority')) {
            $query->whereIn('priority', (array) $request->priority);
        }

        if ($request->filled('organizer_id')) {
            $query->where('organizer_id', $request->integer('organizer_id'));
        }

        if ($request->filled('participant_id')) {
            $pid = $request->integer('participant_id');
            $query->where(function($q) use ($pid) {
                $q->whereJsonContains('participants', $pid)->orWhere('organizer_id', $pid);
            });
        }

        if ($request->filled('tag_id')) {
            $query->whereHas('tags', fn($t) => $t->where('tags.id', $request->integer('tag_id')));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('date', '>=', $request->date('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('date', '<=', $request->date('date_to'));
        }

        if ($request->boolean('upcoming')) {
            $query->upcoming();
        }

        // Сортировка: allowed fields + направление
        $sortMap = [
            'date' => 'date', 'start' => 'start_time', 'title' => 'title',
            'priority' => 'priority', 'created' => 'created_at', 'status' => 'status',
        ];
        $sortKey = $sortMap[$request->get('sort', 'date')] ?? 'date';
        $direction = $request->get('direction', 'asc') === 'desc' ? 'desc' : 'asc';
        $query->orderBy($sortKey, $direction);
        if ($sortKey !== 'start_time') {
            $query->orderBy('start_time', $direction);
        }

        $perPage = min(max((int) $request->get('per_page', 50), 1), 200);

        if ($filterOccurrenceDay !== null) {
            // Фильтр по дню: из кандидатов (точная дата + серии с окном развёртки)
            // оставляем только те, у кого в этот день реально есть occurrence.
            // Пагинация намеренно отключена — список за один день ограничен.
            $items = $query->limit(500)->get()->filter(
                fn (\App\Models\Meeting $m) => $m->date->toDateString() === $filterOccurrenceDay->toDateString()
                    || \App\Services\RecurrenceService::occursOn($m, $filterOccurrenceDay)
            )->values();

            return response()->json(
                new \Illuminate\Pagination\LengthAwarePaginator(
                    $items->forPage((int) $request->get('page', 1), $perPage),
                    $items->count(),
                    $perPage,
                    (int) $request->get('page', 1)
                )
            );
        }

        $meetings = $query->paginate($perPage);

        return response()->json($meetings);
    }

    /**
     * Создание конференции
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'room' => 'nullable|string|max:255',
            'link' => 'nullable|url|max:500',
            'priority' => 'required|in:low,medium,high',
            'reminder_minutes' => 'required|integer|min:5|max:1440',
            'recurring' => 'required|in:none,daily,weekly,monthly,custom',
            'rrule' => 'nullable|string|max:255',
            'participants' => 'nullable|array',
            'participants.*' => 'integer|exists:users,id',
            'participant_emails' => 'nullable|array',
            'participant_emails.*' => 'email',
            'is_private' => 'boolean',
            'repeat_until' => 'nullable|date',
            'tags' => 'nullable|array',
            'tags.*' => 'integer|exists:tags,id',
        ]);

        $this->validateRoomAccess($request, $validated["room"] ?? null);

        $validated['organizer_id'] = $request->user()->id;
        
        $tags = $validated['tags'] ?? null;
        unset($validated['tags']);

        if (in_array($validated['recurring'] ?? 'none', ['none'], true)) {
            $validated['repeat_until'] = null;
        }

        $meeting = Meeting::create($validated);

        if ($tags !== null) {
            $meeting->tags()->sync($tags);
        }

        // Создаём уведомления для участников
        foreach ($validated['participants'] ?? [] as $participantId) {
            if ($participantId !== $request->user()->id) {
                Notification::create([
                    'user_id' => $participantId,
                    'meeting_id' => $meeting->id,
                    'message' => "👤 Вас добавили в конференцию \"{$meeting->title}\"",
                    'type' => 'user-added',
                    'read' => false,
                ]);
            }
        }

        AuditLog::log($request, 'meeting_created', $meeting, [], [
            'title' => $meeting->title,
            'date' => $meeting->date,
            'start_time' => $meeting->start_time,
        ]);

        return response()->json($meeting->load(['organizer', 'tags']), 201);
    }

    /**
     * Получить конференцию
     */
    public function show(Request $request, Meeting $meeting)
    {
        if (!$meeting->hasAccess($request->user())) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        return response()->json($meeting->load(['organizer', 'tags']));
    }

    /**
     * Обновление конференции
     */
    public function update(Request $request, Meeting $meeting)
    {
        $user = $request->user();

        // Право редактировать: организатор, админ, модератор или участник встречи
        // (по запросу участников они могут править название/время и смотреть описание).
        $isParticipant = in_array($user->id, array_map('intval', $meeting->participants ?? []), true);
        if ($meeting->organizer_id !== $user->id && !$user->isAdmin() && !$user->isModerator() && !$isParticipant) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'date' => 'sometimes|date',
            'start_time' => 'sometimes|date_format:H:i',
            'end_time' => 'sometimes|date_format:H:i|after:start_time',
            'room' => 'nullable|string|max:255',
            'link' => 'nullable|url|max:500',
            'status' => 'sometimes|in:scheduled,in-progress,completed,cancelled',
            'priority' => 'sometimes|in:low,medium,high',
            'reminder_minutes' => 'sometimes|integer|min:5|max:1440',
            'recurring' => 'sometimes|in:none,daily,weekly,monthly,custom',
            'rrule' => 'nullable|string|max:255',
            'participants' => 'nullable|array',
            'participants.*' => 'integer|exists:users,id',
            'participant_emails' => 'nullable|array',
            'participant_emails.*' => 'email',
            'is_private' => 'boolean',
            'repeat_until' => 'nullable|date',
            'tags' => 'nullable|array',
            'tags.*' => 'integer|exists:tags,id',
        ]);

        if (array_key_exists('room', $validated)) {
            $this->validateRoomAccess($request, $validated['room']);
        }

        $tags = $validated['tags'] ?? null;
        unset($validated['tags']);

        if (array_key_exists('recurring', $validated) && $validated['recurring'] === 'none') {
            $validated['repeat_until'] = null;
        }

        $fields = array_keys($validated);
        $oldValues = collect($meeting->only($fields))->toArray();
        $meeting->update($validated);

        if ($tags !== null) {
            $meeting->tags()->sync($tags);
        }

        AuditLog::log($request, 'meeting_updated', $meeting, $oldValues, $meeting->only($fields));

        return response()->json($meeting->load(['organizer', 'tags']));
    }

    /**
     * Удаление конференции
     */
    public function destroy(Request $request, Meeting $meeting)
    {
        $user = $request->user();

        if ($meeting->organizer_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        AuditLog::log($request, 'meeting_deleted', $meeting, [
            'title' => $meeting->title,
            'date' => $meeting->date,
        ]);

        // Мягкое удаление: встреча попадает в корзину (MeetingTrashController),
        // откуда её можно восстановить. Уведомляем участников.
        $targets = array_unique(array_merge([$meeting->organizer_id], $meeting->participants ?? []));
        foreach ($targets as $userId) {
            if ($userId === $user->id) continue;
            Notification::create([
                'user_id' => $userId,
                'meeting_id' => $meeting->id,
                'message' => "🗑 Конференция \"{$meeting->title}\" ({$meeting->date->format('d.m.Y')} {$meeting->start_time}) удалена организатором. Её можно восстановить из корзины.",
                'type' => 'warning',
                'read' => false,
            ]);
        }

        $meeting->delete();

        return response()->json(['message' => 'Конференция перемещена в корзину']);
    }

    /**
     * Отмена конференции с уведомлением всех участников
     */
    public function cancel(Request $request, Meeting $meeting)
    {
        $user = $request->user();

        if ($meeting->organizer_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        if ($meeting->status === 'cancelled') {
            return response()->json(['message' => 'Конференция уже отменена'], 422);
        }

        $validated = $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        $oldStatus = $meeting->status;
        $meeting->update(['status' => 'cancelled']);

        $suffix = !empty($validated['reason']) ? " Причина: {$validated['reason']}" : '';
        $targets = array_unique(array_merge([$meeting->organizer_id], $meeting->participants ?? []));
        foreach ($targets as $userId) {
            if ($userId === $user->id) continue; // инициатору уведомление не нужно
            Notification::create([
                'user_id' => $userId,
                'meeting_id' => $meeting->id,
                'message' => "❌ Конференция \"{$meeting->title}\" ({$meeting->date->format('d.m.Y')} {$meeting->start_time}) отменена.{$suffix}",
                'type' => 'warning',
                'read' => false,
            ]);
        }

        AuditLog::log($request, 'meeting_cancelled', $meeting, ['status' => $oldStatus], ['status' => 'cancelled', 'reason' => $validated['reason'] ?? null]);

        return response()->json($meeting->load(['organizer', 'tags']));
    }

    /**
     * Перенос конференции на другую дату/время (drag&drop в Schedule).
     * Уведомляет участников об изменении расписания.
     */
    public function reschedule(Request $request, Meeting $meeting)
    {
        $user = $request->user();

        // Перенос доступен организатору, админу, модератору и участникам встречи.
        $isParticipant = in_array($user->id, array_map('intval', $meeting->participants ?? []), true);
        if ($meeting->organizer_id !== $user->id && !$user->isAdmin() && !$user->isModerator() && !$isParticipant) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $validated = $request->validate([
            'date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'sometimes|date_format:H:i',
            'notify' => 'sometimes|boolean',
            'force' => 'sometimes|boolean',
        ]);

        $newEnd = substr($validated['end_time'] ?? $meeting->end_time, 0, 5);
        $newDate = \Illuminate\Support\Carbon::parse($validated['date'])->toDateString();

        // Серверная валидация конфликтов: у организатора/участников не должно
        // быть пересечений на новом слоте (если перенос не подтверждён force=true).
        if (!$request->boolean('force')) {
            $people = array_unique(array_merge(
                [$meeting->organizer_id],
                array_map('intval', $meeting->participants ?? []),
            ));
            foreach ($people as $uid) {
                if (ScheduleConflictController::userHasConflict($uid, $newDate, $validated['start_time'], $newEnd, $meeting->id)) {
                    return response()->json([
                        'message' => 'На новом времени у участника уже есть встреча. Повторите запрос с force=true, если перенос всё равно нужен.',
                        'conflict_user_id' => $uid,
                    ], 409);
                }
            }
        }

        $oldDate = $meeting->date->toDateString();
        $oldStart = substr((string) $meeting->start_time, 0, 5);

        $meeting->update([
            'date' => $validated['date'],
            'start_time' => $validated['start_time'],
            'end_time' => $validated['end_time'] ?? $meeting->end_time,
        ]);

        if ($request->boolean('notify', true)) {
            $suffix = ($oldDate !== $meeting->date->toDateString())
                ? " было: {$oldDate} {$oldStart}"
                : " время было: {$oldStart}";
            $targets = array_unique(array_merge([$meeting->organizer_id], $meeting->participants ?? []));
            foreach ($targets as $userId) {
                if ($userId === $user->id) continue;
                Notification::create([
                    'user_id' => $userId,
                    'meeting_id' => $meeting->id,
                    'message' => "📅 Конференция \"{$meeting->title}\" перенесена на {$meeting->date->format('d.m.Y')} {$validated['start_time']},{$suffix}",
                    'type' => 'info',
                    'read' => false,
                ]);
            }
        }

        AuditLog::log($request, 'meeting_rescheduled', $meeting,
            ['date' => $oldDate, 'start_time' => $oldStart],
            ['date' => $meeting->date->toDateString(), 'start_time' => $validated['start_time']]);

        return response()->json($meeting->load(['organizer', 'tags']));
    }

    /**
     * Статистика конференций
     */
    public function getStats(Request $request)
    {
        $user = $request->user();
        $query = Meeting::accessibleBy($user);

        return response()->json([
            'total' => (clone $query)->count(),
            'scheduled' => (clone $query)->where('status', 'scheduled')->count(),
            'in_progress' => (clone $query)->where('status', 'in-progress')->count(),
            'completed' => (clone $query)->where('status', 'completed')->count(),
            'cancelled' => (clone $query)->where('status', 'cancelled')->count(),
            'this_week' => (clone $query)->whereBetween('date', [
                now()->startOfWeek(),
                now()->endOfWeek()
            ])->count(),
            'high_priority' => (clone $query)->where('priority', 'high')->count(),
        ]);
    }

    /**
     * RBAC комнат по подразделениям: комнату, привязанную к отделу
     * (rooms.department_id), могут бронировать только сотрудники этого отдела,
     * admin/moderator. Комнаты без department_id — публичные (любые).
     */
    private function validateRoomAccess(Request $request, ?string $roomName): void
    {
        if ($roomName === null || trim($roomName) === '') {
            return;
        }
        $user = $request->user();
        if ($user->isAdmin() || $user->isModerator()) {
            return;
        }
        $room = Room::where('name', $roomName)->first();
        // Свободный текст в поле room (не из справочника) разрешаем как раньше
        if (!$room || !$room->department_id) {
            return;
        }
        // Сопоставление: department_id комнаты может храниться как числовой id
        // или совпадать с названием отдела пользователя. Таблицы departments в
        // схеме нет — сверяем напрямую значения (число↔число, строка↔строка).
        $userDept = trim((string) ($user->department ?? ''));
        $roomDept = trim((string) $room->department_id);
        $matches = $userDept !== ''
            && ($userDept === $roomDept || (is_numeric($userDept) && (int) $userDept === (int) $roomDept));
        if (!$matches) {
            abort(403, 'Эта комната закреплена за другим подразделением');
        }
    }
}
