<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\Room;
use App\Models\User;
use App\Services\RecurrenceService;
use App\Support\MeetingSlotSuggestionPolicy;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

class MeetingSlotSuggestionController extends Controller
{
    /**
     * Find common time slots for the requested participants and active rooms.
     * Only availability is returned; meeting titles and participant details are never exposed.
     */
    public function index(Request $request)
    {
        $validated = $request->validate([
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to' => ['required', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'duration' => ['required', 'integer', 'min:15', 'max:480'],
            'participant_ids' => ['required', 'array', 'min:1', 'max:100'],
            'participant_ids.*' => ['required', 'integer', 'distinct', 'exists:users,id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'exclude_meeting_id' => ['nullable', 'integer', 'exists:meetings,id'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:40'],
        ]);

        $from = CarbonImmutable::createFromFormat('Y-m-d', $validated['date_from'])->startOfDay();
        $to = CarbonImmutable::createFromFormat('Y-m-d', $validated['date_to'])->startOfDay();
        if ($from->diffInDays($to) > 14) {
            return response()->json(['message' => 'Период подбора не может превышать 15 календарных дней.'], 422);
        }

        $participantIds = array_values(array_unique(array_map('intval', $validated['participant_ids'])));
        $participantIds[] = (int) $request->user()->id;
        $participantIds = array_values(array_unique($participantIds));

        $activeIds = User::query()->active()->whereIn('id', $participantIds)->pluck('id')->map(fn ($id) => (int) $id)->all();
        if (count($activeIds) !== count($participantIds)) {
            return response()->json(['message' => 'В списке есть неактивные участники.'], 422);
        }

        $roomsQuery = Room::query()->where('is_active', true)->orderBy('name');
        if (!empty($validated['room_id'])) {
            $roomsQuery->whereKey($validated['room_id']);
        }
        $rooms = $roomsQuery->get();
        if ($rooms->isEmpty()) {
            return response()->json(['data' => [], 'message' => 'Нет активных залов для подбора.']);
        }

        $roomNames = $rooms->pluck('name')->all();
        $queryFrom = $from->subDays(RecurrenceService::HORIZON_DAYS)->toDateString();
        $queryTo = $to->toDateString();

        $meetingsQuery = Meeting::query()
            ->whereIn('status', ['scheduled', 'in-progress'])
            ->whereDate('date', '>=', $queryFrom)
            ->whereDate('date', '<=', $queryTo)
            ->where(function ($query) use ($participantIds, $roomNames) {
                $query->whereIn('organizer_id', $participantIds)
                    ->orWhereIn('room', $roomNames);
                foreach ($participantIds as $id) {
                    $query->orWhereJsonContains('participants', $id)
                        ->orWhereJsonContains('participants', (string) $id);
                }
            })
            ->when(!empty($validated['exclude_meeting_id']), fn ($query) => $query->where('id', '!=', $validated['exclude_meeting_id']));

        $meetings = $meetingsQuery
            ->get(['id', 'date', 'start_time', 'end_time', 'organizer_id', 'participants', 'room', 'recurring', 'repeat_until', 'rrule', 'status']);

        $limit = (int) ($validated['limit'] ?? 20);
        $suggestions = [];

        for ($day = $from; $day->lessThanOrEqualTo($to) && count($suggestions) < $limit; $day = $day->addDay()) {
            $dateKey = $day->toDateString();
            $dayMeetings = $meetings->filter(function (Meeting $meeting) use ($dateKey) {
                try {
                    if ($meeting->date->toDateString() === $dateKey) return true;
                    return $meeting->recurring && $meeting->recurring !== 'none'
                        && RecurrenceService::occursOn($meeting, $dateKey);
                } catch (\Throwable $e) {
                    report($e);
                    return false;
                }
            });

            foreach ($rooms as $room) {
                if (count($suggestions) >= $limit) break;
                $hours = $room->hoursForDateNormalized(
                    $dateKey,
                    is_array($room->schedule) && !empty($room->schedule) ? $room->schedule : null
                );
                if (!$hours || ($hours['end'] ?? '') <= ($hours['start'] ?? '')) continue;

                $busy = [];
                foreach ($dayMeetings as $meeting) {
                    $start = substr((string) $meeting->start_time, 0, 5);
                    $end = substr((string) $meeting->end_time, 0, 5);
                    if ($start === '' || $end === '' || $end <= $start) continue;

                    $meetingParticipants = array_map('intval', is_array($meeting->participants) ? $meeting->participants : []);
                    $blocksParticipant = in_array((int) $meeting->organizer_id, $participantIds, true)
                        || count(array_intersect($participantIds, $meetingParticipants)) > 0;
                    $blocksRoom = $meeting->room === $room->name;
                    if ($blocksParticipant || $blocksRoom) {
                        $busy[] = ['start' => $start, 'end' => $end];
                    }
                }

                $slots = MeetingSlotSuggestionPolicy::suggest(
                    $busy,
                    $hours['start'],
                    $hours['end'],
                    (int) $validated['duration'],
                    30,
                    min(5, $limit - count($suggestions))
                );

                foreach ($slots as $slot) {
                    $suggestions[] = [
                        'room_id' => $room->id,
                        'room' => $room->name,
                        'date' => $dateKey,
                        'start' => $slot['start'],
                        'end' => $slot['end'],
                        'duration' => (int) $validated['duration'],
                    ];
                    if (count($suggestions) >= $limit) break;
                }
            }
        }

        return response()->json([
            'data' => $suggestions,
            'meta' => [
                'date_from' => $from->toDateString(),
                'date_to' => $to->toDateString(),
                'duration' => (int) $validated['duration'],
                'participants_count' => count($participantIds),
                'count' => count($suggestions),
            ],
        ]);
    }
}
