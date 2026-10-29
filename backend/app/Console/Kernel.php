<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');
        require base_path('routes/console.php');
    }

    protected function schedule(Schedule $schedule): void
    {
        // Напоминания о предстоящих конференциях каждую минуту
        $schedule->command('meetings:send-reminders')
                 ->everyMinute()
                 ->withoutOverlapping()
                 ->runInBackground();

        // Автозавершение прошедших конференций (scheduled/in-progress -> completed),
        // каждый час. Данные становятся «честными»: фронтенду больше не нужно
        // маскировать статусы фильтром по времени.
        $schedule->command('meetings:auto-complete')
                 ->hourly()
                 ->withoutOverlapping();

        // Очистка старых уведомлений (старше 30 дней)
        $schedule->command('notifications:cleanup')
                 ->daily()
                 ->at('03:00');

        // Уведомления о конференциях текущего дня — каждые 15 минут
        // (команда сама пропускает уже отправленные уведомления)
        $schedule->command('meetings:send-notifications')
                 ->everyFifteenMinutes()
                 ->withoutOverlapping();

        // Продуктовая аналитика: снимок DAU/MAU, ежедневно в 00:15
        // (по умолчанию считается текущий день; догон вчерашнего — при перезапуске)
        $schedule->command('analytics:daily')
                 ->daily()
                 ->at('00:15');

        // Очистка кэша
        $schedule->command('cache:prune-stale-tags')
                 ->hourly();

        // Ежедневный бэкап базы данных в 02:30 (хранится 14 копий)
        $schedule->command('db:backup --keep=14')
                 ->dailyAt('02:30')
                 ->withoutOverlapping();

        // Еженедельный бэкап (доп. копия вне суточного цикла, хранение 8 копий):
        // стабильность на месяцы вперёд — при порче суточных бэкапов остаётся
        // недельная линейка history.
        $schedule->command('db:backup --keep=8')
                 ->weekly()
                 ->sundayAt('04:00')
                 ->withoutOverlapping();

        // Ротация дневника ВКС-бота: строки старше 90 дней удаляются раз в
        // сутки (таблица растёт с каждой генерацией ссылки и без чистки
        // раздувает БД; полноценное партиционирование MySQL требует DDL на
        // уровне инстанса, поэтому выбрана безопасная TTL-чистка).
        $schedule->call(function () {
            \App\Models\BotLog::where('created_at', '<', now()->subDays(90))
                ->chunkById(1000, fn ($rows) => $rows->each->delete());
        })->dailyAt('03:30')->name('bot-logs-prune');

        // Ротация журнала посещаемости ТВ: строки, чей последний сигнал старше
        // 60 дней, удаляются (живые экраны продлевают last_seen поллингом).
        $schedule->call(function () {
            \App\Models\TvViewLog::where('last_seen_at', '<', now()->subDays(60))->limit(5000)->delete();
        })->dailyAt('03:40')->name('tv-view-logs-prune');

        // Мониторинг ВКС-бота: каждые 5 минут проверяем /health и алертим
        // админу в MAX при сбое/восстановлении (см. VKSBOT_EXPECTED=true).
        $schedule->command('bot:monitor')
                 ->everyFiveMinutes()
                 ->withoutOverlapping()
                 ->runInBackground();

        // Автопилот ВКС-ссылок (пункты 1–2): каждую минуту проверяет «живость»
        // комнат ближайших встреч и ставит проблемные в очередь на пересоздание
        // (CreateVksLinkJob, воркер vks-queue). Работает только при
        // VKSBOT_EXPECTED=true; окно проверки — VKSBOT_CHECK_MINUTES (по умолчанию 60 мин).
        $schedule->command('vks:autopilot')
                 ->everyMinute()
                 ->withoutOverlapping()
                 ->runInBackground();

        // NOTE: heartbeat воркера очереди пишет отдельный процесс
        // `php artisan queue:heartbeat` внутри контейнера queue
        // (см. docker-compose.yml). Планировщик ниже отмечает СВОЙ цикл —
        // файл cron_heartbeat.log, по которому «Статус системы» различает
        // scheduler и queue-worker (раньше оба читали один heartbeat, и
        // падение любого из них выглядело как отказ обоих).

        // Автомониторинг uptime (пункт 9): раз в 5 минут проверка MySQL/Redis/
        // nginx/queue-worker с дедуплицированными алертами админу.
        // Включается флагом SYSTEM_MONITOR_ENABLED=true в .env.
        $schedule->command('system:monitor')
                 ->everyFiveMinutes()
                 ->withoutOverlapping()
                 ->runInBackground();

        // Heartbeat планировщика: ОТДЕЛЬНЫЙ цикл, а не хвост schedule:run.
        // Раньше записывался в конце общего цикла — одна «залипшая» задача
        // блокировала весь цикл и «Статус системы» показывал «Планировщик:
        // ещё не запускался», хотя контейнер был жив. Но без withoutOverlapping()
        // при 60-секундном цикле (schedule:run & sleep 60) два параллельных
        // процесса писали один файл одновременно — race давал пустой/битый
        // файл, filemtime() = 0 → «Ещё не запускался». Теперь запись атомарна:
        // пишем во временный файл + rename (POSIX atomic), с проверкой результата.
        $schedule->call(function () {
            $dir = storage_path('logs');
            if (!is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }
            $target = storage_path('logs/cron_heartbeat.log');
            $tmp = @tempnam($dir, 'hb');
            if ($tmp === false || @file_put_contents($tmp, (string) time()) === false) {
                if ($tmp !== false && is_file($tmp)) @unlink($tmp);
                return;
            }
            @chmod($tmp, 0775);
            @rename($tmp, $target);
        })->everyMinute()->name('scheduler-heartbeat')->withoutOverlapping(2);

        // Подчистка журнала посещаемости ТВ: строки, невидевшиеся 30 дней,
        // больше не нужны (аналог ротации bot_logs). Раз в сутки.
        $schedule->call(function () {
            \App\Models\TvViewLog::where('last_seen_at', '<', now()->subDays(30))->delete();
        })->dailyAt('03:15')->name('tv-view-logs-prune');
    }
}
