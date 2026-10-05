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

    // ==================== ЭКСПОРТ ПРОТОКОЛА ====================

    /**
     * Собрать данные протокола встречи (записи + задачи) для экспорта.
     *
     * @return array{meeting: Meeting, minutes: \Illuminate\Support\Collection, tasks: \Illuminate\Support\Collection}
     */
    private function collectExportData(Meeting $meeting): array
    {
        $minutes = $meeting->minutes()->with('author')->orderBy('created_at')->get();
        $tasks = $meeting->tasks()->orderBy('deadline')->get();

        return ['meeting' => $meeting, 'minutes' => $minutes, 'tasks' => $tasks];
    }

    /**
     * Рендер HTML-протокола (кириллица — UTF-8, шрифт DejaVu Sans на сервере).
     */
    private function renderMinutesHtml(array $data): string
    {
        $m = $data['meeting'];
        $esc = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');

        $rows = '';
        foreach ($data['minutes'] as $i => $min) {
            $rows .= '<tr>'
                . '<td>' . ($i + 1) . '</td>'
                . '<td>' . $esc($min->discussion) . '</td>'
                . '<td>' . $esc($min->decisions) . '</td>'
                . '<td>' . $esc($min->responsible) . '</td>'
                . '<td>' . $esc(optional($min->author)->name ?? '—') . '</td>'
                . '</tr>';
        }

        $taskRows = '';
        foreach ($data['tasks'] as $t) {
            $assignee = $t->assignee ? ($t->assignee->name ?? '') : '';
            $taskRows .= '<tr>'
                . '<td>' . $esc($t->title) . '</td>'
                . '<td>' . $esc($assignee ?: '—') . '</td>'
                . '<td>' . $esc($t->deadline ?? '—') . '</td>'
                . '<td>' . $esc($t->status) . '</td>'
                . '</tr>';
        }

        $minuteCount = count($data['minutes']);
        $taskCount = count($data['tasks']);
        $generated = now()->format('d.m.Y H:i');
        $date = $esc($m->date);
        $time = $esc($m->start_time) . '–' . $esc($m->end_time);
        $title = $esc($m->title);
        $room = $esc($m->room ?: '—');
        $organizer = $esc(optional($m->organizer)->name ?? '—');
        $participants = $esc($m->participants ? implode(', ', (array) $m->participants) : '—');
        $description = $esc($m->description ?: '');

        return <<<HTML
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><title>Протокол {$title}</title>
<style>
body { font-family: "DejaVu Sans", sans-serif; font-size: 12px; color: #111; margin: 32px; }
h1 { font-size: 18px; margin-bottom: 4px; } h2 { font-size: 14px; margin-top: 24px; }
.meta td { padding: 2px 8px 2px 0; vertical-align: top; }
table.data { border-collapse: collapse; width: 100%; margin-top: 8px; }
table.data th, table.data td { border: 1px solid #999; padding: 6px 8px; text-align: left; vertical-align: top; }
table.data th { background: #eee; }
.footer { margin-top: 28px; font-size: 10px; color: #555; }
.empty { color: #777; font-style: italic; }
</style></head>
<body>
<h1>Протокол встречи: {$title}</h1>
<table class="meta">
<tr><td><b>Дата:</b></td><td>{$date}</td><td><b>Время:</b></td><td>{$time}</td></tr>
<tr><td><b>Комната:</b></td><td>{$room}</td><td><b>Организатор:</b></td><td>{$organizer}</td></tr>
<tr><td><b>Участники:</b></td><td colspan="3">{$participants}</td></tr>
</table>
<p><b>Описание:</b> {$description}</p>
<h2>Записи протокола ({$minuteCount})</h2>
<table class="data"><thead><tr><th>#</th><th>Обсуждение</th><th>Решение</th><th>Ответственный</th><th>Автор</th></tr></thead>
<tbody>{$rows}</tbody></table>
<h2>Задачи ({$taskCount})</h2>
<table class="data"><thead><tr><th>Задача</th><th>Исполнитель</th><th>Срок</th><th>Статус</th></tr></thead>
<tbody>{$taskRows}</tbody></table>
<div class="footer">Сформировано автоматически в ВКС-системе, {$generated}</div>
</body></html>
HTML;
    }

    /**
     * GET /api/meetings/{meeting}/minutes/export-pdf?inline=1
     * Экспорт протокола в PDF. Если установлен barryvdh/laravel-dompdf — отдаём
     * настоящий PDF; иначе — готовый к печати HTML (печать → «Сохранить как PDF»).
     */
    public function exportPdf(Request $request, Meeting $meeting)
    {
        if ($denied = $this->ensureAccess($request, $meeting)) {
            return $denied;
        }

        $data = $this->collectExportData($meeting);
        $html = $this->renderMinutesHtml($data);
        $filename = 'protokol-' . $meeting->id . '-' . now()->format('Ymd-His') . '.pdf';

        if (class_exists(\Barryvdh\DomPDF\Facade\Pdf::class)) {
            $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)->setPaper('a4');
            $disposition = $request->boolean('inline') ? 'inline' : 'attachment';

            return response($pdf->output(), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => $disposition . '; filename="' . $filename . '"',
            ]);
        }

        // DOMPDF не установлен — отдаём печатопригодный HTML.
        return response($html, 200, ['Content-Type' => 'text/html; charset=UTF-8']);
    }

    /**
     * POST /api/meetings/{meeting}/minutes/send-max
     * Отправить протокол PDF-файлом в MAX: организатору и всем участникам,
     * у которых привязан max_chat_id. Только организатор или админ.
     */
    public function sendMax(Request $request, Meeting $meeting)
    {
        $user = $request->user();
        if (!($meeting->isOrganizer($user->id) || $user->isAdmin())) {
            return response()->json(['message' => 'Отправлять протокол может только организатор или админ'], 403);
        }

        if (!\App\Services\MaxMessengerService::isEnabled()) {
            return response()->json(['message' => 'MAX не настроен (MESSENGER/MAX_BOT_TOKEN в .env)'], 400);
        }

        $data = $this->collectExportData($meeting);
        $html = $this->renderMinutesHtml($data);

        // Сохраняем PDF во временный файл
        $dir = storage_path('app/tmp');
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $pdfPath = $dir . '/protokol-' . $meeting->id . '.pdf';

        if (class_exists(\Barryvdh\DomPDF\Facade\Pdf::class)) {
            file_put_contents($pdfPath, \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)->setPaper('a4')->output());
        } else {
            // Без dompdf отправляем текстовую выжимку сообщением
            $text = "Протокол встречи: {$meeting->title}\nДата: {$meeting->date} {$meeting->start_time}\n";
            foreach ($data['minutes'] as $i => $min) {
                $text .= ($i + 1) . '. ' . $min->discussion . ' → ' . $min->decisions . "\n";
            }
            $sent = 0;
            foreach ($this->recipientsWithChat($meeting) as $u) {
                if (\App\Services\MaxMessengerService::sendMessage($u->max_chat_id, $text)) {
                    $sent++;
                }
            }

            return response()->json(['message' => "Отправлено текстом (PDF-рендерер не установлен)", 'sent' => $sent]);
        }

        $sent = 0;
        $skipped = 0;
        foreach ($this->recipientsWithChat($meeting) as $u) {
            $ok = \App\Services\MaxMessengerService::sendFile(
                $u->max_chat_id,
                $pdfPath,
                basename($pdfPath),
                'Протокол встречи: ' . $meeting->title . ' (' . $meeting->date . ')'
            );
            $ok ? $sent++ : $skipped++;
        }
        @unlink($pdfPath);

        return response()->json([
            'message' => "PDF отправлен в MAX: {$sent}",
            'sent' => $sent,
            'skipped_no_chat_or_error' => $skipped,
        ]);
    }

    /**
     * Получатели: организатор + участники с привязанным max_chat_id (без дублей).
     */
    private function recipientsWithChat(Meeting $meeting)
    {
        $ids = array_unique(array_merge(
            [$meeting->organizer_id],
            (array) ($meeting->participants ?? [])
        ));

        return \App\Models\User::whereIn('id', $ids)
            ->whereNotNull('max_chat_id')
            ->where('max_chat_id', '!=', '')
            ->get();
    }
}
