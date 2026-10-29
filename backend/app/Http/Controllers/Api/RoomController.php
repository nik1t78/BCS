<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\Room;
use Illuminate\Http\Request;

class RoomController extends Controller
{
    /**
     * Список комнат (для справочника/селекта).
     * GET /rooms
     */
    public function index(Request $request)
    {
        // Справочник комнат доступен всем авторизованным (модалка выбора зала
        // и виджет «Свободные залы» нужны в т.ч. обычной роли «user»).
        // Для совместимости с фронтендом отдаём оба поля статуса.
        // tv_token (доступ к экрану ТВ без логина) показываем ТОЛЬКО администратору.
        $isAdmin = optional($request->user())->role === 'admin';
        $rooms = Room::orderBy('name')->get()->map(function (Room $room) use ($isAdmin) {
            $room->setAttribute('is_active', (bool) $room->is_active);
            $room->setAttribute('isActive', (bool) $room->is_active);
            if ($isAdmin) {
                if (!$room->tv_token) {
                    $room->forceFill(['tv_token' => bin2hex(random_bytes(16))])->saveQuietly();
                }
                $room->makeVisible('tv_token');
            }
            return $room;
        });

        return response()->json(['data' => $rooms]);
    }

    /**
     * Доступность комнаты на указанный день: занятые интервалы + свободные слоты.
     * GET /rooms/{room}/availability?date=YYYY-MM-DD&start_time=HH:MM&end_time=HH:MM
     */
    public function availability(Request $request, Room $room)
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
            'exclude' => 'nullable|integer', // id редактируемой встречи
        ]);

        $day = \Carbon\CarbonImmutable::parse($validated['date']);

        // Занятость комнаты: точные даты + occurrence'ы повторяющихся серий (RRULE на бэкенде)
        $bookings = Meeting::query()
            ->where(function ($w) use ($day) {
                $w->whereDate('date', $day->toDateString())
                  ->orWhere(function ($r) use ($day) {
                      $r->where('recurring', '!=', 'none')
                        ->whereNotNull('recurring')
                        ->whereDate('date', '<=', $day->toDateString())
                        ->whereDate('date', '>=', $day->copy()->subDays(\App\Services\RecurrenceService::HORIZON_DAYS)->toDateString());
                  });
            })
            ->where('room', $room->name)
            ->whereIn('status', ['scheduled', 'in-progress'])
            ->when(!empty($validated['exclude']), fn ($q) => $q->where('id', '!=', $validated['exclude']))
            ->orderBy('start_time')
            ->get(['id', 'title', 'date', 'start_time', 'end_time', 'recurring', 'repeat_until', 'rrule', 'status'])
            ->filter(fn (Meeting $m) => $m->date->toDateString() === $day->toDateString()
                || \App\Services\RecurrenceService::occursOn($m, $day));

        $busy = $bookings->map(fn ($m) => [
            'meeting_id' => $m->id,
            'title' => $m->title,
            'start' => substr((string) $m->start_time, 0, 5),
            'end' => substr((string) $m->end_time, 0, 5),
        ])->values();

        // Гибкий график зала (рабочие часы по дням недели + праздники).
        // До фикса был жёстко зашит 08:00–20:00.
        $hours = $room->hoursForDate($day->toDateString());
        $dayStart = $hours['start'] ?? '08:00';
        $dayEnd = $hours['end'] ?? '20:00';

        // Свободные слоты в рабочих часах зала на эту дату
        $free = [];
        $cursor = $dayStart;
        foreach ($busy as $b) {
            if ($b['start'] > $cursor) {
                $free[] = ['start' => $cursor, 'end' => min($b['start'], $dayEnd)];
            }
            if ($b['end'] > $cursor) {
                $cursor = $b['end'];
            }
        }
        if ($cursor < $dayEnd) {
            $free[] = ['start' => $cursor, 'end' => $dayEnd];
        }

        // Проверка конкретного интервала (для формы создания встречи)
        $available = true;
        if (!empty($validated['start_time']) && !empty($validated['end_time'])) {
            $from = $validated['start_time'];
            $to = $validated['end_time'];
            $available = !$busy->contains(fn ($b) => $from < $b['end'] && $to > $b['start']);
        }

        return response()->json([
            'room' => $room,
            'date' => $validated['date'],
            'busy' => $busy,
            'free' => $free,
            'available' => $available,
            'hours' => $hours, // null = зал закрыт на эту дату (праздник/выходной)
        ]);
    }

    /**
     * Агрегированная доступность ВСЕХ активных залов на дату за один запрос.
     * Доступно всем авторизованным (включая роль «user», у которой нет прав
     * на справочник GET /rooms) — используется виджетом «Свободные залы».
     * GET /meetings/rooms-availability?date=YYYY-MM-DD
     */
    public function allAvailability(Request $request)
    {
        $validated = $request->validate([
            'date' => 'required|date',
        ]);

        $day = \Carbon\CarbonImmutable::parse($validated['date']);

        $rooms = Room::where('is_active', true)->orderBy('name')->get(['id', 'name', 'capacity']);

        // Все встречи на день (точные + потенциальные occurrence повторяющихся серий)
        $bookings = Meeting::query()
            ->where(function ($w) use ($day) {
                $w->whereDate('date', $day->toDateString())
                  ->orWhere(function ($r) use ($day) {
                      $r->where('recurring', '!=', 'none')
                        ->whereNotNull('recurring')
                        ->whereDate('date', '<=', $day->toDateString())
                        ->whereDate('date', '>=', $day->copy()->subDays(\App\Services\RecurrenceService::HORIZON_DAYS)->toDateString());
                  });
            })
            ->whereIn('status', ['scheduled', 'in-progress'])
            ->whereNotNull('room')
            ->orderBy('start_time')
            ->get(['id', 'title', 'room', 'date', 'start_time', 'end_time', 'recurring', 'repeat_until', 'rrule', 'status'])
            ->filter(fn (Meeting $m) => $m->date->toDateString() === $day->toDateString()
                || \App\Services\RecurrenceService::occursOn($m, $day));

        $result = $rooms->map(function (Room $room) use ($bookings, $day) {
            $busy = $bookings
                ->where('room', $room->name)
                ->map(fn ($m) => [
                    'meeting_id' => $m->id,
                    'title' => $m->title,
                    'start' => substr((string) $m->start_time, 0, 5),
                    'end' => substr((string) $m->end_time, 0, 5),
                ])->values();

            // Гибкий график зала: рабочие часы по дням недели + праздники.
            $hours = $room->hoursForDate($day->toDateString());
            $dayStart = $hours['start'] ?? '08:00';
            $dayEnd = $hours['end'] ?? '20:00';

            $free = [];
            $cursor = $dayStart;
            foreach ($busy as $b) {
                if ($b['start'] > $cursor) {
                    $free[] = ['start' => $cursor, 'end' => min($b['start'], $dayEnd)];
                }
                if ($b['end'] > $cursor) {
                    $cursor = $b['end'];
                }
            }
            if ($cursor < $dayEnd) {
                $free[] = ['start' => $cursor, 'end' => $dayEnd];
            }

            return [
                'id' => $room->id,
                'name' => $room->name,
                'capacity' => $room->capacity,
                'busy' => $busy,
                'free' => $free,
                'hours' => $hours, // null — зал закрыт на эту дату
            ];
        })->values();

        return response()->json(['data' => $result, 'date' => $day->toDateString()]);
    }

    /**
     * CRUD комнат — только администратор/модератор (роут обёрнут в can:admin-or-moderator).
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:rooms,name',
            'capacity' => 'nullable|integer|min:1|max:200',
            'location' => 'nullable|string|max:255',
            // department_id — привязка комнаты к подразделению (RBAC).
            // null / строка названия отдела — публичная комната или отдел по имени.
            'department_id' => 'nullable|integer|min:1',
            'equipment' => 'nullable|array',
            'equipment.*' => 'string|max:100',
            'description' => 'nullable|string|max:1000',
            'is_active' => 'nullable|boolean',
            // Гибкий график: {"days":{"mon":{"start":"08:00","end":"20:00"},...},"closed":["2026-11-04"]}
            'schedule' => 'nullable|array',
            'schedule.days' => 'nullable|array',
            'schedule.closed' => 'nullable|array',
            'schedule.closed.*' => 'date_format:Y-m-d',
        ]);

        if (array_key_exists('schedule', $validated)) {
            $validated['schedule'] = is_null($validated['schedule']) ? null : Room::normalizeSchedule($validated['schedule']);
        }

        $room = Room::create($validated);

        return response()->json(['data' => $room], 201);
    }

    public function update(Request $request, Room $room)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255|unique:rooms,name,' . $room->id,
            'capacity' => 'nullable|integer|min:1|max:200',
            'location' => 'nullable|string|max:255',
            'department_id' => 'nullable|integer|min:1',
            'equipment' => 'nullable|array',
            'equipment.*' => 'string|max:100',
            'description' => 'nullable|string|max:1000',
            'is_active' => 'nullable|boolean',
            'schedule' => 'nullable|array',
            'schedule.days' => 'nullable|array',
            'schedule.closed' => 'nullable|array',
            'schedule.closed.*' => 'date_format:Y-m-d',
        ]);

        if (array_key_exists('schedule', $validated)) {
            $validated['schedule'] = is_null($validated['schedule']) ? null : Room::normalizeSchedule($validated['schedule']);
        }

        $room->update($validated);

        return response()->json(['data' => $room]);
    }

    public function destroy(Room $room)
    {
        $room->delete();

        return response()->json(['message' => 'Комната удалена']);
    }
}
