<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MeetingController extends Controller
{
    /**
     * Список конференций
     */
    public function index(Request $request)
    {
        $user = $request->user();
        
        $query = Meeting::query();

        // Фильтр по статусу
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Фильтр по дате
        if ($request->has('date')) {
            $query->whereDate('date', $request->date);
        }

        // Только мои конференции
        if ($request->boolean('my')) {
            $query->where(function($q) use ($user) {
                $q->where('organizer_id', $user->id)
                  ->orWhereJsonContains('participants', $user->id);
            });
        }

        // Поиск
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('room', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Приватные конференции видны только участникам
        if (!$user->isAdmin()) {
            $query->where(function($q) use ($user) {
                $q->where('is_private', false)
                  ->orWhere('organizer_id', $user->id)
                  ->orWhereJsonContains('participants', $user->id);
            });
        }

        $meetings = $query->with('organizer')
            ->orderBy('date')
            ->orderBy('start_time')
            ->paginate($request->get('per_page', 20));

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
            'date' => 'required|date|after_or_equal:today',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'room' => 'nullable|string|max:255',
            'link' => 'nullable|url',
            'priority' => 'required|in:low,medium,high',
            'reminder_minutes' => 'required|integer|min:5|max:1440',
            'recurring' => 'required|in:none,daily,weekly,monthly',
            'participants' => 'nullable|array',
            'participants.*' => 'exists:users,id',
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
        $user = $request->user();

        // Проверка доступа
        if ($meeting->is_private && 
            $meeting->organizer_id !== $user->id && 
            !in_array($user->id, $meeting->participants) &&
            !$user->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        return response()->json($meeting->load('organizer', 'participants'));
    }

    /**
     * Обновление конференции
     */
    public function update(Request $request, Meeting $meeting)
    {
        $user = $request->user();

        // Только организатор или админ может редактировать
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
            'link' => 'nullable|url',
            'status' => 'sometimes|in:scheduled,in-progress,completed,cancelled',
            'priority' => 'sometimes|in:low,medium,high',
            'reminder_minutes' => 'sometimes|integer|min:5|max:1440',
            'recurring' => 'sometimes|in:none,daily,weekly,monthly',
            'participants' => 'nullable|array',
            'participants.*' => 'exists:users,id',
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

        // Только организатор или админ может удалить
        if ($meeting->organizer_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $meeting->delete();

        return response()->json(['message' => 'Конференция удалена']);
    }
}
