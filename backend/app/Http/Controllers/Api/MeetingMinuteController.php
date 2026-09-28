<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\MeetingMinute;
use App\Models\MeetingTask;
use App\Models\Notification;
use Illuminate\Http\Request;

/**
 * Протокол встречи (minutes) и задачи/action items внутри встречи.
 * Доступ к операциям — как у самой встречи: читать может любой, кто видит
 * встречу; изменять — организатор, участники (для записей протокола) и админ.
 */
class MeetingMinuteController extends Controller
{
    /**
     * Чтение — по доступу к встрече (hasAccess). Запись — только организатор,
     * участник или админ (для приватных встреч это совпадает, для публичных
     * протокол и задачи ведут участники).
     */
    private function ensureAccess(Request $request, Meeting $meeting, bool $writable = false): ?\Illuminate\Http\JsonResponse
    {
        $user = $request->user();

        if ($writable) {
            if (!($meeting->isOrganizer($user->id) || $meeting->isParticipant($user->id) || $user->isAdmin())) {
                return response()->json(['message' => 'Доступ запрещён'], 403);
            }
            return null;
        }

        if (!$meeting->hasAccess($user)) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        return null;
    }

    // ==================== ПРОТОКОЛ (MINUTES) ====================

    /**
     * Список записей протокола встречи
     */
    public function minutesIndex(Request $request, Meeting $meeting)
    {
        if ($denied = $this->ensureAccess($request, $meeting)) return $denied;

        return response()->json(
            $meeting->minutes()->with('author')->latest()->get()
        );
    }

    /**
     * Добавить запись протокола
     */
    public function minutesStore(Request $request, Meeting $meeting)
    {
        if ($denied = $this->ensureAccess($request, $meeting, true)) return $denied;

        $validated = $request->validate([
            'discussion' => 'nullable|string|max:10000',
            'decisions' => 'nullable|string|max:10000',
            'responsible' => 'nullable|string|max:500',
        ]);

        if (collect($validated)->filter(fn ($v) => is_string($v) && trim($v) !== '')->isEmpty()) {
            return response()->json(['message' => 'Запись протокола пуста'], 422);
        }

        $minute = $meeting->minutes()->create($validated + ['user_id' => $request->user()->id]);

        return response()->json($minute->load('author'), 201);
    }

    /**
     * Обновить запись протокола (только автор или организатор/админ)
     */
    public function minutesUpdate(Request $request, Meeting $meeting, MeetingMinute $minute)
    {
        if ($denied = $this->ensureAccess($request, $meeting, true)) return $denied;

        $user = $request->user();
        if ($minute->user_id !== $user->id && $meeting->organizer_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Редактировать запись может только её автор или организатор'], 403);
        }

        $validated = $request->validate([
            'discussion' => 'nullable|string|max:10000',
            'decisions' => 'nullable|string|max:10000',
            'responsible' => 'nullable|string|max:500',
        ]);

        $minute->update($validated);

        return response()->json($minute->load('author'));
    }

    /**
     * Удалить запись протокола (автор, организатор или админ)
     */
    public function minutesDestroy(Request $request, Meeting $meeting, MeetingMinute $minute)
    {
        if ($denied = $this->ensureAccess($request, $meeting, true)) return $denied;

        $user = $request->user();
        if ($minute->user_id !== $user->id && $meeting->organizer_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Удалить запись может только её автор или организатор'], 403);
        }

        $minute->delete();

        return response()->json(['message' => 'Запись удалена']);
    }

    // ==================== ЗАДАЧИ (ACTION ITEMS) ====================

    /**
     * Список задач встречи
     */
    public function tasksIndex(Request $request, Meeting $meeting)
    {
        if ($denied = $this->ensureAccess($request, $meeting)) return $denied;

        return response()->json(
            $meeting->tasks()->with('assignee')->orderByRaw("case when status = 'done' then 1 else 0 end")->orderBy('deadline')->get()
        );
    }

    /**
     * Создать задачу
     */
    public function tasksStore(Request $request, Meeting $meeting)
    {
        if ($denied = $this->ensureAccess($request, $meeting, true)) return $denied;

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'assignee_id' => 'nullable|integer|exists:users,id',
            'deadline' => 'nullable|date',
        ]);

        $task = $meeting->tasks()->create($validated + ['status' => 'pending']);

        // Уведомляем ответственного
        if ($task->assignee_id && $task->assignee_id !== $request->user()->id) {
            Notification::create([
                'user_id' => $task->assignee_id,
                'meeting_id' => $meeting->id,
                'message' => "📌 Вам поставлена задача по встрече \"{$meeting->title}\": {$task->title}",
                'type' => 'info',
                'read' => false,
            ]);
        }

        return response()->json($task->load('assignee'), 201);
    }

    /**
     * Обновить задачу (статус/ответственный/дедлайн)
     */
    public function tasksUpdate(Request $request, Meeting $meeting, MeetingTask $task)
    {
        if ($denied = $this->ensureAccess($request, $meeting, true)) return $denied;

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'assignee_id' => 'nullable|integer|exists:users,id',
            'deadline' => 'nullable|date',
            'status' => 'sometimes|in:pending,in_progress,done',
        ]);

        $task->update($validated);

        return response()->json($task->load('assignee'));
    }

    /**
     * Удалить задачу
     */
    public function tasksDestroy(Request $request, Meeting $meeting, MeetingTask $task)
    {
        if ($denied = $this->ensureAccess($request, $meeting, true)) return $denied;

        $task->delete();

        return response()->json(['message' => 'Задача удалена']);
    }
}
