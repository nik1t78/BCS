<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\Notification;
use Illuminate\Http\Request;

class MeetingController extends Controller
{
    /**
     * Список конференций
     */
    public function index(Request $request)
    {
        $user = $request->user();
        
        $query = Meeting::with('organizer')->accessibleBy($user);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('date')) {
            $query->whereDate('date', $request->date);
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

        $meetings = $query->orderBy('date')->orderBy('start_time')
            ->paginate($request->get('per_page', 50));

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
            'recurring' => 'required|in:none,daily,weekly,monthly',
            'participants' => 'nullable|array',
            'participants.*' => 'integer|exists:users,id',
            'participant_emails' => 'nullable|array',
            'participant_emails.*' => 'email',
            'is_private' => 'boolean',
        ]);

        $validated['organizer_id'] = $request->user()->id;
        
        $meeting = Meeting::create($validated);

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

        return response()->json($meeting->load('organizer'), 201);
    }

    /**
     * Получить конференцию
     */
    public function show(Request $request, Meeting $meeting)
    {
        if (!$meeting->hasAccess($request->user())) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        return response()->json($meeting->load('organizer'));
    }

    /**
     * Обновление конференции
     */
    public function update(Request $request, Meeting $meeting)
    {
        $user = $request->user();

        if ($meeting->organizer_id !== $user->id && !$user->isAdmin()) {
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
            'recurring' => 'sometimes|in:none,daily,weekly,monthly',
            'participants' => 'nullable|array',
            'participants.*' => 'integer|exists:users,id',
            'participant_emails' => 'nullable|array',
            'participant_emails.*' => 'email',
            'is_private' => 'boolean',
        ]);

        $meeting->update($validated);

        return response()->json($meeting->load('organizer'));
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

        $meeting->delete();

        return response()->json(['message' => 'Конференция удалена']);
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
}
