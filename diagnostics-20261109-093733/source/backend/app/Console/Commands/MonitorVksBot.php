<?php

namespace App\Console\Commands;

use App\Services\AdminAlert;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Мониторинг ВКС-бота: проверяет /health контейнера vks-bot и шлёт алерт
 * администратору в MAX при переходе бота в состояние «недоступен» (и один раз
 * при восстановлении). Не спамит каждые 5 минут — состояние хранится в кэше.
 *
 * Запуск: php artisan bot:monitor   (в расписании — каждые 5 минут)
 *
 * .env:
 *   VKSBOT_EXPECTED=true    # включить мониторинг (если используете профиль "bot")
 *   VKSBOT_URL=http://vks-bot:8090
 */
class MonitorVksBot extends Command
{
    protected $signature = 'bot:monitor';

    protected $description = 'Проверить доступность vks-bot (/health) и оповестить админа при сбое';

    /** Ключ кэша-флага «бот недоступен, алерт уже отправлен». */
    private const DOWN_FLAG = 'vks_bot_monitor_down_alerted';

    public function handle(): int
    {
        // Бот опциональный (docker-профиль "bot"): если мониторинг не включён,
        // молча выходим — отсутствие бота в этом случае не авария.
        if (!filter_var(config('services.vks_bot.expected', env('VKSBOT_EXPECTED', false)), FILTER_VALIDATE_BOOLEAN)) {
            return self::SUCCESS;
        }

        $url = rtrim((string) config('services.vks_bot.url', env('VKSBOT_URL', 'http://vks-bot:8090')), '/') . '/health';

        $ok = false;
        $error = '';
        try {
            $response = Http::timeout(5)->get($url);
            $ok = $response->successful();
            if (!$ok) {
                $error = 'HTTP ' . $response->status();
            }
        } catch (\Throwable $e) {
            $error = $e->getMessage();
        }

        $wasDown = cache()->has(self::DOWN_FLAG);

        if ($ok) {
            if ($wasDown) {
                AdminAlert::send("✅ ВКС-бот снова доступен ({$url})");
            }
            cache()->forget(self::DOWN_FLAG);
            $this->info('vks-bot OK');
            return self::SUCCESS;
        }

        $this->warn("vks-bot недоступен: {$error}");

        // Алерт только при ПЕРЕХОДЕ в down; флаг живёт 30 минут — т.е. повторное
        // предупреждение о длящейся аварии приходит максимум раз в полчаса.
        if (!$wasDown) {
            cache()->put(self::DOWN_FLAG, time(), now()->addMinutes(30));
            AdminAlert::send(
                "🛑 ВКС-бот НЕ отвечает: {$error}\nURL: {$url}\n"
                . "Проверьте: docker compose --profile bot up -d vks-bot\n"
                . "Логи: docker compose logs --tail=50 vks-bot"
            );
        } elseif ((int) cache()->get(self::DOWN_FLAG, 0) < now()->subMinutes(25)->getTimestamp()) {
            cache()->put(self::DOWN_FLAG, time(), now()->addMinutes(30));
            AdminAlert::send("⚠️ ВКС-бот по-прежнему недоступен ({$error})");
        }

        return self::FAILURE;
    }
}
