<?php

namespace App\Console\Commands;

use App\Jobs\CreateVksLinkJob;
use App\Models\BotLog;
use App\Models\Meeting;
use App\Services\VkSBotClient;
use Illuminate\Console\Command;

/**
 * Пункты 1–2 плана: «автопилот» ВКС-ссылок. Запускается планировщиком
 * каждую минуту (см. Kernel) и делает две вещи:
 *
 *  1) Живость: для встреч, стартующих в ближайшие VKSBOT_CHECK_MINUTES
 *     минут, проверяет GET-запросом, что комната по ссылке реально
 *     существует на salutejazz.ru. Мёртвая ссылка -> встреча помечается
 *     ссылкой-null и ставится в очередь на пересоздание (бот создаст
 *     новую комнату, воркер впишет актуальную ссылку).
 *
 *  2) Недостающие ссылки: у будущих встреч (в окне проверки или при
 *     включённом VKSBOT_AUTO) без живой ссылки — диспатч CreateVksLinkJob.
 *
 * Повторные проверки одной встречи дедуплицируются кэшем, чтобы не долбить
 * платформу каждые 60 секунд.
 *
 * .env:
 *   VKSBOT_AUTO=true            # создавать ссылки очередью автоматически
 *   VKSBOT_CHECK_MINUTES=60     # окно проверки живости (минут до начала)
 */
class VksAutopilot extends Command
{
    protected $signature = 'vks:autopilot';

    protected $description = 'Проверить живость ВКС-ссылок ближайших встреч и поставить проблемные в очередь на пересоздание';

    public function handle(): int
    {
        if (!filter_var(config('services.vks_bot.expected', env('VKSBOT_EXPECTED', false)), FILTER_VALIDATE_BOOLEAN)) {
            // Бот не развёрнут (профиль bot выключен) — автопилот не нужен.
            return self::SUCCESS;
        }

        $window = max(5, (int) env('VKSBOT_CHECK_MINUTES', 60));
        $autoQueue = filter_var(env('VKSBOT_AUTO', false), FILTER_VALIDATE_BOOLEAN);
        $now = now();
        $horizon = $now->copy()->addMinutes($window);

        // Ссылки, которые уже проверяли в этом окне — не повторяем (кэш 10 мин).
        $checked = 0;
        $queued = 0;

        $meetings = Meeting::query()
            ->where('status', 'scheduled')
            ->whereDate('date', '=', $now->toDateString())
            ->whereNotNull('link')
            ->get()
            ->filter(function (Meeting $m) use ($now, $horizon) {
                $start = \Carbon\CarbonImmutable::parse($m->date->toDateString() . ' ' . substr((string) $m->start_time, 0, 5));
                return $start->greaterThan($now->copy()->subMinutes(5)) && $start->lessThan($horizon);
            });

        foreach ($meetings as $meeting) {
            $cacheKey = 'vks_alive_' . $meeting->id . '_' . md5((string) $meeting->link);
            if (cache()->has($cacheKey)) {
                continue;
            }
            cache()->put($cacheKey, 1, now()->addMinutes(10));
            $checked++;

            $t0 = microtime(true);
            $alive = VkSBotClient::isLinkAlive((string) $meeting->link);
            BotLog::create([
                'meeting_id' => $meeting->id,
                'action' => 'check',
                'trigger' => 'cron',
                'success' => $alive,
                'link' => $meeting->link,
                'error' => $alive ? null : 'ссылка не отвечает/комнаты нет',
                'duration_ms' => (int) round((microtime(true) - $t0) * 1000),
            ]);

            if (!$alive) {
                // Комната мертва/не создана: снимаем ссылку и ставим задачу
                // боту на создание новой (воркер впишет актуальную).
                $meeting->update(['link' => null]);
                CreateVksLinkJob::dispatch($meeting->id);
                $queued++;
            }
        }

        // Встречи вовсе без ссылки в ближайшем окне (или все будущие при
        // VKSBOT_AUTO) — тоже отдаём боту.
        $noLinkQuery = Meeting::query()
            ->where('status', 'scheduled')
            ->where(function ($q) use ($now, $horizon, $autoQueue) {
                $q->whereNull('link')->orWhere('link', '');
                if (!$autoQueue) {
                    // без автосоздания чиним только то, что вот-вот начнётся
                    $q->whereDate('date', '=', $now->toDateString());
                }
            });
        if (!$autoQueue) {
            $noLinkQuery->where(function ($q) use ($horizon) {
                $q->whereTime('start_time', '>=', $now->format('H:i:s'))
                  ->whereTime('start_time', '<=', $horizon->format('H:i:s'));
            });
        }

        foreach ($noLinkQuery->cursor()->unique() as $meeting) {
            // Не ставить в очередь повторно задачу, которая ещё не выполнена.
            $lockKey = 'vks_queued_' . $meeting->id;
            if (cache()->has($lockKey)) {
                continue;
            }
            cache()->put($lockKey, 1, now()->addMinutes(15));
            CreateVksLinkJob::dispatch($meeting->id);
            $queued++;
        }

        $this->info("vks:autopilot — проверено {$checked}, поставлено в очередь {$queued}");
        return self::SUCCESS;
    }
}
