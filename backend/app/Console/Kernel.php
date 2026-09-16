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
        // Отправка напоминаний о конференциях каждую минуту
        $schedule->command('meetings:send-reminders')
                 ->everyMinute()
                 ->withoutOverlapping()
                 ->runInBackground();

        // Очистка старых уведомлений (старше 30 дней)
        $schedule->command('notifications:cleanup')
                 ->daily()
                 ->at('03:00');

        // Очистка кэша
        $schedule->command('cache:prune-stale-tags')
                 ->hourly();
    }
}
