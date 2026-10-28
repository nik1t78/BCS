<?php

namespace App\Console\Commands;

use App\Services\AdminAlert;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * Автомониторинг uptime (пункт 9 плана): expansion готового bot:monitor.
 * Раз в минуту health-check'и ключевых сервисов: MySQL, Redis, nginx,
 * queue-worker (по «сердцебиению» в кэше). Бот vks-bot проверяется
 * отдельной командой bot:monitor (своё состояние/алерты).
 *
 * Алерт админу шлётся только при ПЕРЕХОДЕ сервиса в down (дедупликация),
 * восстановление — отдельное сообщение «снова ок».
 *
 * Запуск: php artisan system:monitor   (в расписании — каждые 5 минут)
 *
 * .env:
 *   SYSTEM_MONITOR_ENABLED=true          # включить (по умолчанию выкл., чтобы не спамить на dev)
 *   SYSTEM_MONITOR_BASE_URL=http://nginx  # адрес фронтенда/nginx внутри сети compose
 *   QUEUE_HEARTBEAT_MAX_AGE=180           # сек., после которого воркер считается мёртвым
 */
class MonitorSystem extends Command
{
    protected $signature = 'system:monitor';

    protected $description = 'Проверить доступность MySQL/Redis/nginx/queue-worker и оповестить админа при сбое';

    /** Ключ кэша-флага воркера: обновляется каждые N секунд процессом queue:work. */
    public const QUEUE_HEARTBEAT_KEY = 'queue_worker_heartbeat';

    private const STATE_PREFIX = 'sysmon_down_';

    public function handle(): int
    {
        if (!filter_var(env('SYSTEM_MONITOR_ENABLED', false), FILTER_VALIDATE_BOOLEAN)) {
            return self::SUCCESS; // молча выходим — мониторинг выключён
        }

        $checks = [
            'mysql' => fn () => $this->checkMysql(),
            'redis' => fn () => $this->checkRedis(),
            'nginx' => fn () => $this->checkNginx(),
            'queue-worker' => fn () => $this->checkQueueWorker(),
        ];

        foreach ($checks as $name => $fn) {
            [$ok, $error] = $fn();
            $this->reportState($name, $ok, $error);
        }

        return self::SUCCESS;
    }

    private function checkMysql(): array
    {
        try {
            DB::connection()->reconnect();
            DB::select('SELECT 1');
            return [true, null];
        } catch (\Throwable $e) {
            return [false, mb_substr($e->getMessage(), 0, 160)];
        }
    }

    private function checkRedis(): array
    {
        // Если кэш крутится на redis — простая команда PING проходит через facade.
        try {
            $driver = config('cache.default');
            if ($driver !== 'redis') {
                return [true, null]; // redis не используется — не считаем сбоем
            }
            app('redis')->connection()->ping();
            return [true, null];
        } catch (\Throwable $e) {
            return [false, mb_substr($e->getMessage(), 0, 160)];
        }
    }

    private function checkNginx(): array
    {
        $url = rtrim((string) env('SYSTEM_MONITOR_BASE_URL', 'http://nginx'), '/') . '/';
        try {
            $response = Http::timeout(5)->get($url);
            // nginx отдаёт index.html SPA — любой HTTP-ответ (2xx/3xx) = жив;
            // 5xx от nginx — уже авария.
            if ($response->status() >= 500) {
                return [false, 'HTTP ' . $response->status()];
            }
            return [true, null];
        } catch (\Throwable $e) {
            return [false, mb_substr($e->getMessage(), 0, 160)];
        }
    }

    private function checkQueueWorker(): array
    {
        $maxAge = max(60, (int) env('QUEUE_HEARTBEAT_MAX_AGE', 180));
        $last = cache()->get(self::QUEUE_HEARTBEAT_KEY);
        if (!is_numeric($last)) {
            return [false, "нет heartbeat (воркер не запускался или key '{$this->keyHint()}' пуст)"];
        }
        if (now()->getTimestamp() - (int) $last > $maxAge) {
            return [false, 'heartbeat устарел на ' . (now()->getTimestamp() - (int) $last) . ' c'];
        }
        return [true, null];
    }

    private function keyHint(): string
    {
        return self::QUEUE_HEARTBEAT_KEY;
    }

    /** Дедупликация алертов: пишем/чистим флаг состояния + шлём сообщение при переходах. */
    private function reportState(string $name, bool $ok, ?string $error): void
    {
        $flag = self::STATE_PREFIX . $name;
        $wasDown = cache()->has($flag);

        if ($ok) {
            if ($wasDown) {
                AdminAlert::send("✅ Сервис «{$name}» снова доступен.");
            }
            cache()->forget($flag);
            $this->info("{$name}: OK");
            return;
        }

        $this->warn("{$name}: DOWN ({$error})");

        // Алерт при переходе в down + напоминание раз в ~30 минут для длящейся аварии.
        if (!$wasDown) {
            cache()->put($flag, time(), now()->addMinutes(30));
            AdminAlert::send(
                "🛑 Сервис «{$name}» недоступен: {$error}\n"
                . "Проверьте: docker compose ps && docker compose logs --tail=50 {$name}"
            );
        } elseif ((int) cache()->get($flag, 0) < now()->subMinutes(25)->getTimestamp()) {
            cache()->put($flag, time(), now()->addMinutes(30));
            AdminAlert::send("⚠️ Сервис «{$name}» по-прежнему недоступен ({$error}).");
        }
    }
}
