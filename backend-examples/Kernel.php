<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Регистрация команд
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }

    /**
     * Определение расписания команд
     */
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

        // Создание повторяющихся конференций
        $schedule->command('meetings:create-recurring')
                 ->daily()
                 ->at('00:05');

        // Отправка ежедневного дайджеста
        $schedule->command('meetings:send-daily-digest')
                 ->daily()
                 ->at('08:00')
                 ->when(function () {
                     return config('app.env') === 'production';
                 });

        // Резервное копирование БД (еженедельно)
        $schedule->command('backup:run')
                 ->weekly()
                 ->sundays()
                 ->at('02:00');

        // Очистка кэша
        $schedule->command('cache:prune-stale-tags')
                 ->hourly();
    }
}
