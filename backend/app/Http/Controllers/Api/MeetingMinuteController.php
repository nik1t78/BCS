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
            $meeting->tasks()
                ->with(['assignee', 'assignees', 'comments.user'])
                ->orderByRaw("case when status = 'done' then 1 else 0 end")
                ->orderBy('deadline')
                ->get()
        );
    }

    /**
     * Создать задачу. Поддерживает множественных ответственных:
     * assignee_ids: [1,2] (или одиночный assignee_id для обратной совместимости).
     */
    public function tasksStore(Request $request, Meeting $meeting)
    {
        if ($denied = $this->ensureAccess($request, $meeting, true)) return $denied;

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'assignee_id' => 'nullable|integer|exists:users,id',
            'assignee_ids' => 'nullable|array',
            'assignee_ids.*' => 'integer|exists:users,id',
            'deadline' => 'nullable|date',
        ]);

        $ids = collect($validated['assignee_ids'] ?? [])
            ->merge(array_filter([$validated['assignee_id'] ?? null]))
            ->unique()->values()->all();

        $task = $meeting->tasks()->create([
            'title' => $validated['title'],
            'deadline' => $validated['deadline'] ?? null,
            'assignee_id' => $ids[0] ?? null,
            'assignee_ids' => $ids ?: null,
            'status' => 'pending',
        ]);
        $task->assignees()->sync($ids);

        // Уведомляем каждого ответственного
        foreach ($ids as $assigneeId) {
            if ($assigneeId === $request->user()->id) continue;
            Notification::create([
                'user_id' => $assigneeId,
                'meeting_id' => $meeting->id,
                'message' => "📌 Вам поставлена задача по встрече \"{$meeting->title}\": {$task->title}",
                'type' => 'info',
                'read' => false,
            ]);
        }

        return response()->json($task->load(['assignee', 'assignees']), 201);
    }

    /**
     * Обновить задачу (статус/ответственные/дедлайн)
     */
    public function tasksUpdate(Request $request, Meeting $meeting, MeetingTask $task)
    {
        if ($denied = $this->ensureAccess($request, $meeting, true)) return $denied;

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'assignee_id' => 'nullable|integer|exists:users,id',
            'assignee_ids' => 'nullable|array',
            'assignee_ids.*' => 'integer|exists:users,id',
            'deadline' => 'nullable|date',
            'status' => 'sometimes|in:pending,in_progress,done',
        ]);

        $payload = collect($validated)->except(['assignee_id', 'assignee_ids'])->filter(fn($v) => !is_null($v) || array_key_exists($v, $validated))->all();

        if (array_key_exists('assignee_ids', $validated) || array_key_exists('assignee_id', $validated)) {
            $ids = collect($validated['assignee_ids'] ?? [])
                ->merge(array_filter([$validated['assignee_id'] ?? null]))
                ->unique()->values()->all();
            $payload['assignee_id'] = $ids[0] ?? null;
            $payload['assignee_ids'] = $ids ?: null;
            $task->assignees()->sync($ids);

            // Уведомления новым ответственным
            $oldIds = array_column($task->assignees()->getRelated()->whereIn('id', $task->assignees()->pluck('user_id')->all())->get()->keyBy('id')->all(), 'id');
            $newOnes = array_diff($ids, $oldIds ?: []);
            foreach ($newOnes as $uid) {
                if ($uid === $request->user()->id) continue;
                Notification::create([
                    'user_id' => $uid,
                    'meeting_id' => $meeting->id,
                    'message' => "📌 Вы назначены ответственным по задаче \"{$task->title}\" (встреча \"{$meeting->title}\")",
                    'type' => 'info',
                    'read' => false,
                ]);
            }
        }

        $task->update($payload);

        return response()->json($task->load(['assignee', 'assignees', 'comments.user']));
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

    // ==================== КОММЕНТАРИИ К ЗАДАЧАМ ====================

    /**
     * Добавить комментарий к задаче
     */
    public function taskCommentStore(Request $request, Meeting $meeting, MeetingTask $task)
    {
        if ($denied = $this->ensureAccess($request, $meeting, true)) return $denied;

        $validated = $request->validate([
            'body' => 'required|string|max:5000',
        ]);

        $comment = \App\Models\TaskComment::create([
            'meeting_task_id' => $task->id,
            'user_id' => $request->user()->id,
            'body' => $validated['body'],
        ]);

        // Уведомление ответственным (кроме автора комментария)
        foreach ($task->assignees()->pluck('user_id') as $uid) {
            if ($uid === $request->user()->id) continue;
            Notification::create([
                'user_id' => $uid,
                'meeting_id' => $meeting->id,
                'message' => "💬 Новый комментарий к задаче \"{$task->title}\": " . mb_substr($validated['body'], 0, 80),
                'type' => 'info',
                'read' => false,
            ]);
        }

        return response()->json($comment->load('user'), 201);
    }

    /**
     * Удалить комментарий (автор, организатор или админ)
     */
    public function taskCommentDestroy(Request $request, Meeting $meeting, MeetingTask $task, \App\Models\TaskComment $comment)
    {
        if ($denied = $this->ensureAccess($request, $meeting, true)) return $denied;

        $user = $request->user();
        if ($comment->user_id !== $user->id && $meeting->organizer_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Удалить комментарий может только его автор или организатор'], 403);
        }

        $comment->delete();

        return response()->json(['message' => 'Комментарий удалён']);
    }
}
