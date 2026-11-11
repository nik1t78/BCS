<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\Room;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class RoomController extends Controller
{
    public function index(Request $request)
    {
        $isAdmin = optional($request->user())->role === 'admin';
        
        $rooms = Room::orderBy('name')->get()->map(function (Room $room) use ($isAdmin) {
            if ($isAdmin) {
                if (!$room->tv_token) {
                    $newToken = bin2hex(random_bytes(16));
                    
                    DB::table('rooms')
                        ->where('id', $room->id)
                        ->update(['tv_token' => $newToken]);
                    
                    $room->tv_token = $newToken;
                }
                $room->makeVisible('tv_token');
            }
            return $room;
        });

        return response()->json(['data' => $rooms]);
    }

    public function availability(Request $request, Room $room)
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
            'exclude' => 'nullable|integer',
        ]);

        $day = \Carbon\CarbonImmutable::parse($validated['date']);

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

        $raw = $room->schedule;
        $hours = $room->hoursForDateNormalized(
            $day->toDateString(),
            is_array($raw) && !empty($raw) ? $raw : null
        );
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
            'hours' => $hours,
        ]);
    }

    public function allAvailability(Request $request)
    {
        $validated = $request->validate(['date' => 'required|date']);
        $day = \Carbon\CarbonImmutable::parse($validated['date']);
        return $this->availabilityResponse($day);
    }

    private function availabilityResponse(\Carbon\CarbonImmutable $day): \Illuminate\Http\JsonResponse
    {
        $key = 'rooms:avail:v2:' . $day->toDateString();

        try {
            $payload = Cache::remember($key, 45, fn () => [
                'data' => $this->buildAllAvailability($day),
                'date' => $day->toDateString(),
            ]);
        } catch (\Throwable $e) {
            report($e);
            $payload = null;
        }

        if (!is_array($payload) || !isset($payload['data'])) {
            try { Cache::forget($key); } catch (\Throwable) {}

            try {
                $payload = ['data' => $this->buildAllAvailability($day), 'date' => $day->toDateString()];
            } catch (\Throwable $e) {
                report($e);
                $fallbackRooms = Room::where('is_active', true)->orderBy('name')->get(['id', 'name', 'capacity'])
                    ->map(fn ($r) => ['id' => $r->id, 'name' => $r->name, 'capacity' => $r->capacity, 'busy' => [], 'free' => [], 'hours' => null])->all();
                $payload = ['data' => $fallbackRooms, 'date' => $day->toDateString(), 'degraded' => true];
            }
        }

        return response()->json($payload);
    }

    private function buildAllAvailability(\Carbon\CarbonImmutable $day)
    {
        $rooms = Room::where('is_active', true)->orderBy('name')->get(['id', 'name', 'capacity']);

        $bookings = Meeting::query()
            ->where(function ($w) use ($day) {
                $w->whereDate('date', $day->toDateString())
                  ->orWhere(function ($r) use ($day) {
                      $r->where('recurring', '!=', 'none')->whereNotNull('recurring')
                        ->whereDate('date', '<=', $day->toDateString())
                        ->whereDate('date', '>=', $day->copy()->subDays(\App\Services\RecurrenceService::HORIZON_DAYS)->toDateString());
                  });
            })
            ->whereIn('status', ['scheduled', 'in-progress'])->whereNotNull('room')
            ->orderBy('start_time')
            ->get(['id', 'title', 'room', 'date', 'start_time', 'end_time', 'recurring', 'repeat_until', 'rrule', 'status'])
            ->filter(fn (Meeting $m) => $m->date->toDateString() === $day->toDateString() || \App\Services\RecurrenceService::occursOn($m, $day));

        return $rooms->map(function (Room $room) use ($bookings, $day) {
            $raw = $room->schedule;
            $hours = $room->hoursForDateNormalized($day->toDateString(), is_array($raw) && !empty($raw) ? $raw : null);
            $dayStart = $hours['start'] ?? '08:00';
            $dayEnd = $hours['end'] ?? '20:00';

            $busy = $bookings->where('room', $room->name)->map(fn ($m) => [
                'meeting_id' => $m->id, 'title' => $m->title,
                'start' => substr((string) $m->start_time, 0, 5), 'end' => substr((string) $m->end_time, 0, 5),
            ])->values();

            $free = []; $cursor = $dayStart;
            foreach ($busy as $b) {
                if ($b['start'] > $cursor) $free[] = ['start' => $cursor, 'end' => min($b['start'], $dayEnd)];
                if ($b['end'] > $cursor) $cursor = $b['end'];
            }
            if ($cursor < $dayEnd) $free[] = ['start' => $cursor, 'end' => $dayEnd];

            return ['id' => $room->id, 'name' => $room->name, 'capacity' => $room->capacity, 'busy' => $busy, 'free' => $free, 'hours' => $hours];
        })->values();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:rooms,name',
            'capacity' => 'nullable|integer|min:1|max:200',
            'location' => 'nullable|string|max:255',
            'department_id' => 'nullable|integer|min:1',
            'equipment' => 'nullable|array', 'equipment.*' => 'string|max:100',
            'description' => 'nullable|string|max:1000',
            'is_active' => 'nullable|boolean',
            'schedule' => 'nullable|array', 'schedule.days' => 'nullable|array',
            'schedule.closed' => 'nullable|array', 'schedule.closed.*' => 'date_format:Y-m-d',
        ]);

        if (array_key_exists('schedule', $validated)) {
            $validated['schedule'] = is_null($validated['schedule']) ? null : Room::normalizeSchedule($validated['schedule']);
        }

        $room = Room::create($validated);
        \App\Support\MeetingCache::bump();

        return response()->json(['data' => $room], 201);
    }

    public function update(Request $request, Room $room)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255|unique:rooms,name,' . $room->id,
            'capacity' => 'nullable|integer|min:1|max:200',
            'location' => 'nullable|string|max:255',
            'department_id' => 'nullable|integer|min:1',
            'equipment' => 'nullable|array', 'equipment.*' => 'string|max:100',
            'description' => 'nullable|string|max:1000',
            'is_active' => 'nullable|boolean',
            'schedule' => 'nullable|array', 'schedule.days' => 'nullable|array',
            'schedule.closed' => 'nullable|array', 'schedule.closed.*' => 'date_format:Y-m-d',
        ]);

        if (array_key_exists('schedule', $validated)) {
            $validated['schedule'] = is_null($validated['schedule']) ? null : Room::normalizeSchedule($validated['schedule']);
        }

        $oldName = $room->name;
        DB::transaction(function () use ($room, $validated, $oldName) {
            $room->update($validated);
            if (isset($validated['name']) && $validated['name'] !== $oldName) {
                Meeting::where('room', $oldName)->update(['room' => $validated['name']]);
            }
        });

        \App\Support\MeetingCache::bump();

        return response()->json(['data' => $room]);
    }

    public function destroy(Room $room)
    {
        $room->delete();
        \App\Support\MeetingCache::bump();
        return response()->json(['message' => 'Комната удалена']);
    }
}