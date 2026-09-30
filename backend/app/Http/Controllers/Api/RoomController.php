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
    public function index()
    {
        $rooms = Room::orderBy('name')->get();

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

        // Свободные слоты в рабочих часах 08:00–20:00
        $free = [];
        $cursor = '08:00';
        foreach ($busy as $b) {
            if ($b['start'] > $cursor) {
                $free[] = ['start' => $cursor, 'end' => $b['start']];
            }
            if ($b['end'] > $cursor) {
                $cursor = $b['end'];
            }
        }
        if ($cursor < '20:00') {
            $free[] = ['start' => $cursor, 'end' => '20:00'];
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
        ]);
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
            'equipment' => 'nullable|array',
            'equipment.*' => 'string|max:100',
            'description' => 'nullable|string|max:1000',
            'is_active' => 'nullable|boolean',
        ]);

        $room = Room::create($validated);

        return response()->json(['data' => $room], 201);
    }

    public function update(Request $request, Room $room)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255|unique:rooms,name,' . $room->id,
            'capacity' => 'nullable|integer|min:1|max:200',
            'location' => 'nullable|string|max:255',
            'equipment' => 'nullable|array',
            'equipment.*' => 'string|max:100',
            'description' => 'nullable|string|max:1000',
            'is_active' => 'nullable|boolean',
        ]);

        $room->update($validated);

        return response()->json(['data' => $room]);
    }

    public function destroy(Room $room)
    {
        $room->delete();

        return response()->json(['message' => 'Комната удалена']);
    }
}
