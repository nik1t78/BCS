<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Продуктовая аналитика: журнал действий для DAU/MAU (user_activity).
        $middleware->api(append: [
            \App\Http\Middleware\TrackActivity::class,
        ]);

        // Доверяем заголовкам X-Forwarded-* от nginx (иначе Laravel не
        // распознаёт запрос как AJAX/api и включает CSRF-валидацию web-группы)
        $middleware->trustProxies(at: '*');

        // API работает по bearer-токенам Sanctum — CSRF для него не нужен.
        // Исключаем /api из проверки токенов (решает ошибку 419).
        $middleware->validateCsrfTokens(except: [
            'api/*',
            'sanctum/csrf-cookie',
        ]);
    })
    ->withSchedule(function (Illuminate\Console\Scheduling\Schedule $schedule) {
        // ВАЖНО: в Laravel 11+/12 планировщик подключается ТОЛЬКО здесь
        // (bootstrap/app.php). Метод schedule() в App\Console\Kernel игнорируется —
        // из-за этого напоминания о встречах и уведомления участникам не создавались.
        $schedule->command('meetings:send-reminders')
                 ->everyMinute()
                 ->withoutOverlapping()
                 ->runInBackground();

        $schedule->command('meetings:send-notifications')
                 ->everyFifteenMinutes()
                 ->withoutOverlapping();

        $schedule->command('notifications:cleanup')
                 ->daily()
                 ->at('03:00');

        $schedule->command('analytics:daily')
                 ->daily()
                 ->at('00:15');

        $schedule->command('db:backup --keep=14')
                 ->dailyAt('02:30')
                 ->withoutOverlapping();
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
