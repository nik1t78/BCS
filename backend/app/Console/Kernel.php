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
    }
}
