<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\MeetingPoll;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Support\MeetingPollPolicy;

class MeetingPollController extends Controller
{
    private function canManage(Request $request, Meeting $meeting): bool
    {
        $user = $request->user();

        return MeetingPollPolicy::canManage((int) $meeting->organizer_id, (int) $user->id, (string) $user->role);
    }

    private function ensureMeetingAccess(Request $request, Meeting $meeting): ?\Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        $isModerator = in_array($user->role, ['admin', 'moderator'], true);
        if (!$meeting->hasAccess($user) && !$isModerator) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        return null;
    }

    private function serializePoll(MeetingPoll $poll, int $userId): array
    {
        $counts = $poll->votes()
            ->select('option_index', DB::raw('COUNT(*) as total'))
            ->groupBy('option_index')
            ->pluck('total', 'option_index');

        $myVote = $poll->votes()->where('user_id', $userId)->value('option_index');
        $options = array_values(array_map(
            fn ($label, $index) => [
                'label' => $label,
                'votes' => (int) ($counts[$index] ?? 0),
            ],
            $poll->options ?? [],
            array_keys($poll->options ?? [])
        ));

        return [
            'id' => $poll->id,
            'meeting_id' => $poll->meeting_id,
            'question' => $poll->question,
            'options' => $options,
            'total_votes' => array_sum(array_column($options, 'votes')),
            'my_vote' => $myVote === null ? null : (int) $myVote,
            'is_closed' => $poll->isClosed(),
            'closed_at' => $poll->closed_at?->toIso8601String(),
            'created_at' => $poll->created_at?->toIso8601String(),
        ];
    }

    public function index(Request $request, Meeting $meeting)
    {
        if ($denied = $this->ensureMeetingAccess($request, $meeting)) {
            return $denied;
        }

        $polls = $meeting->polls()->latest()->get()
            ->map(fn (MeetingPoll $poll) => $this->serializePoll($poll, (int) $request->user()->id));

        return response()->json(['data' => $polls]);
    }

    public function store(Request $request, Meeting $meeting)
    {
        if (!$this->canManage($request, $meeting)) {
            return response()->json(['message' => 'Создавать голосования может организатор, администратор или модератор'], 403);
        }

        if (in_array($meeting->status, ['completed', 'cancelled'], true)) {
            return response()->json(['message' => 'Нельзя создавать голосование для завершённой или отменённой встречи'], 422);
        }

        $validated = $request->validate([
            'question' => 'required|string|max:255',
            'options' => 'required|array|min:2|max:10',
            'options.*' => 'required|string|max:120',
        ]);

        $options = collect(MeetingPollPolicy::normalizeOptions($validated['options']));

        if ($options->count() < 2) {
            return response()->json(['message' => 'Укажите не менее двух разных вариантов ответа'], 422);
        }

        $poll = $meeting->polls()->create([
            'created_by' => $request->user()->id,
            'question' => trim($validated['question']),
            'options' => $options->all(),
        ]);

        return response()->json(['data' => $this->serializePoll($poll, (int) $request->user()->id)], 201);
    }

    public function vote(Request $request, Meeting $meeting, MeetingPoll $poll)
    {
        if ((int) $poll->meeting_id !== (int) $meeting->id) {
            return response()->json(['message' => 'Голосование не найдено'], 404);
        }
        if ($denied = $this->ensureMeetingAccess($request, $meeting)) {
            return $denied;
        }
        if ($poll->isClosed()) {
            return response()->json(['message' => 'Голосование уже закрыто'], 422);
        }

        $validated = $request->validate([
            'option_index' => 'required|integer|min:0|max:9',
        ]);

        if (!MeetingPollPolicy::canVote(true, $poll->isClosed(), count($poll->options ?? []), (int) $validated['option_index'])) {
            return response()->json(['message' => 'Выбранный вариант не существует'], 422);
        }

        $now = now();
        DB::table('meeting_poll_votes')->upsert([[
            'poll_id' => $poll->id,
            'user_id' => $request->user()->id,
            'option_index' => $validated['option_index'],
            'created_at' => $now,
            'updated_at' => $now,
        ]], ['poll_id', 'user_id'], ['option_index', 'updated_at']);

        return response()->json(['data' => $this->serializePoll($poll, (int) $request->user()->id)]);
    }

    public function close(Request $request, Meeting $meeting, MeetingPoll $poll)
    {
        if ((int) $poll->meeting_id !== (int) $meeting->id) {
            return response()->json(['message' => 'Голосование не найдено'], 404);
        }
        if (!$this->canManage($request, $meeting)) {
            return response()->json(['message' => 'Закрыть голосование может только организатор, администратор или модератор'], 403);
        }

        $poll->update(['closed_at' => $poll->closed_at ?? now()]);

        return response()->json(['data' => $this->serializePoll($poll, (int) $request->user()->id)]);
    }
}
