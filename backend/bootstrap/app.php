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

        // Гигиена токенов Sanctum: таблица personal_access_tokens растёт с
        // каждым входом (access + refresh на каждую сессию), а выборка по
        // LIKE 'refresh_token:%' без чистки деградирует — «сайт долго логает».
        // Встроенная команда sanctum:prune-expired удаляет истёкшие токены.
        $schedule->command('sanctum:prune-expired --hours=24')
                 ->daily();

        $schedule->command('db:backup --keep=14')
                 ->dailyAt('02:30')
                 ->withoutOverlapping();
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Глобальный обработчик ошибок API. Без него любая фатальная ошибка
        // внутри /api/* (например, на этапе подготовки ответа после того, как
        // валидация и запись в БД уже прошли успешно) отдаётся Laravel как
        // безликий 500 {"message":"Server Error"} — пользователь видит только
        // «не удалось сохранить конференцию» без причины, а админ гадает по
        // логам. Здесь:
        //  1) пишем в laravel.log строку [API-ERROR] POST/GET <url> => класс:
        //     сообщение @файл:строка — её можно найти одной командой;
        //  2) для api-запросов добавляем в JSON-ответ поле detail с текстом
        //     исключения — фронт показывает его вместо «Server Error», и
        //     причина видна сразу в браузере (F12 → Console).
        // Ничего не скрываем от логов: report() штатно пишет трассировку.
        $exceptions->render(function (\Throwable $e, $request) {
            if (!$request->is('api/*') && !$request->expectsJson()) {
                return null; // обычные веб-страницы — стандартный рендер Laravel
            }

            \Illuminate\Support\Facades\Log::error(
                '[API-ERROR] ' . $request->method() . ' ' . $request->fullUrl() .
                ' => ' . get_class($e) . ': ' . $e->getMessage() .
                ' @ ' . $e->getFile() . ':' . $e->getLine()
            );

            if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                return null; // 404/429/403 и т.п. отдаём штатно
            }

            $status = method_exists($e, 'getStatusCode') ? $e->getStatusCode() : 500;
            if ($status < 400 || $status > 599) {
                $status = 500;
            }

            return response()->json([
                'message' => $e->getMessage() ?: 'Server Error',
                'detail' => get_class($e) . ': ' . $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine(),
            ], $status);
        });
    })->create();
