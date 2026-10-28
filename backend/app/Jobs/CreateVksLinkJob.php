<?php

namespace App\Jobs;

use App\Models\BotLog;
use App\Models\Meeting;
use App\Models\Notification;
use App\Services\AdminAlert;
use App\Services\VkSBotClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Пункт 1 плана: асинхронное создание ссылки ВКС через Selenium-бота.
 *
 * Воркер (контейнер vks-queue, php artisan queue:work) вызывает бота и
 * вписывает живую ссылку в уже сохранённую встречу. При неудаче Laravel
 * сам повторяет задачу (tries/backoff), после всех попыток — fallback на
 * локальную ссылку + алерт админу (пункт 3 плана).
 */
class CreateVksLinkJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Кол-во попыток всего (1 + 2 ретрая с backoff). */
    public $tries = 3;

    public array $backoff = [30, 60];

    public int $timeout = 180;

    public function __construct(public int $meetingId)
    {
    }

    public function handle(VkSBotClient $client): void
    {
        $meeting = Meeting::with('organizer')->find($this->meetingId);
        // Встречу могли удалить/отменить, пока задача ждала в очереди.
        if ($meeting === null || in_array($meeting->status, ['cancelled', 'completed'], true)) {
            return;
        }

        $startedAt = microtime(true);
        $result = $client->create((string) $meeting->title, (string) ($meeting->organizer?->name ?: 'Организатор'));
        $durationMs = (int) round((microtime(true) - $startedAt) * 1000);

        BotLog::create([
            'meeting_id' => $meeting->id,
            'action' => 'create',
            'trigger' => 'queue',
            'success' => !empty($result['ok']),
            'link' => $result['link'] ?? null,
            'error' => isset($result['error'])
                ? trim($result['error'] . ' ' . ($result['detail'] ?? ''))
                : null,
            'duration_ms' => $durationMs,
        ]);

        if (!empty($result['ok'])) {
            $meeting->update(['link' => $result['link']]);
            // Пункт 3: уведомить организатора о живой ссылке.
            try {
                Notification::create([
                    'user_id' => $meeting->organizer_id,
                    'meeting_id' => $meeting->id,
                    'title' => 'Ссылка ВКС готова',
                    'message' => sprintf('Встреча «%s» (%s %s–%s) получила живую ссылку: %s',
                        $meeting->title,
                        $meeting->date?->format('d.m.Y') ?? '',
                        substr((string) $meeting->start_time, 0, 5),
                        substr((string) $meeting->end_time, 0, 5),
                        $result['link'],
                    ),
                    'type' => 'vks_link_ready',
                    'read' => false,
                ]);
            } catch (\Throwable $e) {
                report($e); // уведомление не должно ломать запись ссылки
            }
            return;
        }

        // Неудача: бросаем исключение — Laravel повторит задачу (ретраи),
        // а после исчерпания попыток вызовет failed().
        throw new \RuntimeException('VKSBot: ' . ($result['error'] ?? 'unknown') . ' ' . ($result['detail'] ?? ''));
    }

    /**
     * Все попытки исчерпаны (пункт 3 плана): встреча НЕ должна оставаться
     * вовсе без ссылки — генерируем локальную (формат платформы) и репортим.
     */
    public function failed(\Throwable $exception): void
    {
        $meeting = Meeting::find($this->meetingId);
        if ($meeting === null || filled($meeting->link)) {
            return;
        }

        $code = substr(preg_replace('/[^a-z0-9]/', '', strtolower(base64_encode(random_bytes(8)))), 0, 8);
        $pwd = substr(preg_replace('/[^A-Z0-9]/', '', strtoupper(base64_encode(random_bytes(16)))), 0, 16);
        $fallback = "https://salutejazz.ru/calls/{$code}?psw={$pwd}";
        $meeting->update(['link' => $fallback]);

        BotLog::create([
            'meeting_id' => $meeting->id,
            'action' => 'create',
            'trigger' => 'queue',
            'success' => false,
            'link' => $fallback,
            'error' => 'все ретраи исчерпаны — записана локальная ссылка: ' . $exception->getMessage(),
            'duration_ms' => 0,
        ]);

        Log::warning('CreateVksLinkJob: бот не смог создать комнату, использована локальная ссылка', [
            'meeting_id' => $meeting->id,
            'error' => $exception->getMessage(),
        ]);

        try {
            AdminAlert::send(sprintf(
                "⚠️ ВКС-бот не смог создать комнату для встречи «%s» (id %d) после всех ретраев: %s. Записана локальная ссылка, организатор может создать комнату вручную.",
                $meeting->title,
                $meeting->id,
                mb_substr($exception->getMessage(), 0, 200),
            ));
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
