<?php

namespace App\Jobs;

use App\Models\BotLog;
use App\Models\Meeting;
use App\Models\Notification;
use App\Services\AdminAlert;
use App\Services\VkSBotClient;
use App\Support\MeetingCache;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/** Создаёт реальную комнату SaluteJazz в фоновой очереди. */
class CreateVksLinkJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public array $backoff = [30, 60];
    public int $timeout = 240;
    public int $uniqueFor = 900;

    public function __construct(public int $meetingId) {}

    public function uniqueId(): string
    {
        return 'create-vks-link:' . $this->meetingId;
    }

    public function handle(VkSBotClient $client): void
    {
        $meeting = Meeting::with('organizer')->find($this->meetingId);
        if ($meeting === null || in_array($meeting->status, ['cancelled', 'completed'], true)) {
            return;
        }

        // Идемпотентность: не создаём повторную комнату, если ссылка уже готова.
        if (filled($meeting->link) && $meeting->vks_link_status === 'created') {
            return;
        }

        $meeting->update(['vks_link_status' => 'creating']);
        $startedAt = microtime(true);
        $result = $client->create(
            (string) $meeting->title,
            (string) ($meeting->organizer?->name ?: 'Организатор'),
            $meeting->date
        );
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

        if (empty($result['ok']) || empty($result['link'])) {
            throw new \RuntimeException('VKSBot: ' . ($result['error'] ?? 'не удалось создать комнату') . ' ' . ($result['detail'] ?? ''));
        }

        $meeting->update([
            'link' => $result['link'],
            'vks_link_status' => 'created',
        ]);
        MeetingCache::bump(MeetingCache::roomIdsFromNames([$meeting->room]));

        try {
            Notification::create([
                'user_id' => $meeting->organizer_id,
                'meeting_id' => $meeting->id,
                'title' => 'Ссылка ВКС готова',
                'message' => sprintf(
                    'Встреча «%s» (%s %s–%s) получила ссылку: %s',
                    $meeting->title,
                    $meeting->date?->format('d.m.Y') ?? '',
                    substr((string) $meeting->start_time, 0, 5),
                    substr((string) $meeting->end_time, 0, 5),
                    $result['link']
                ),
                'type' => 'info',
                'read' => false,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    public function failed(\Throwable $exception): void
    {
        $meeting = Meeting::find($this->meetingId);
        if ($meeting === null || filled($meeting->link)) {
            return;
        }

        $meeting->update(['vks_link_status' => 'failed']);
        MeetingCache::bump(MeetingCache::roomIdsFromNames([$meeting->room]));
        BotLog::create([
            'meeting_id' => $meeting->id,
            'action' => 'create',
            'trigger' => 'queue',
            'success' => false,
            'link' => null,
            'error' => 'Реальная комната не создана после всех попыток: ' . $exception->getMessage(),
            'duration_ms' => 0,
        ]);

        Log::warning('CreateVksLinkJob: SaluteJazz room creation failed', [
            'meeting_id' => $meeting->id,
            'error' => $exception->getMessage(),
        ]);

        try {
            AdminAlert::send(sprintf(
                '⚠️ Бот не создал комнату для ВКС «%s» (id %d): %s. Реальная ссылка не создана; требуется повторная попытка или ручное создание.',
                $meeting->title,
                $meeting->id,
                mb_substr($exception->getMessage(), 0, 200)
            ));
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
