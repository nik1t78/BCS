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

        // Незалогиненный запрос к /api/* должен получать честный 401 в JSON,
        // а не редирект на несуществующий маршрут «login» (в SPA-приложении
        // routes/web.php такой точки входа нет). Без этой правки curl без
        // токена падал с 500 "Route [login] not defined" вместо ожидаемого
        // 401 Unauthorized.
        $middleware->redirectGuestsTo(fn ($request) =>
            $request->is('api/*') || $request->expectsJson()
                ? null
                : route('login')
        );

        // Тот же случай на уровне обработчика исключений: shouldReturnJson()
        // для AuthenticationException срабатывает только при Accept:
        // application/json или ajax-заголовках. Запрос вида
        // GET /api/... c "Accept: */*" (curl по умолчанию) уходил в ветку
        // redirect()->guest(route('login')) и падал с тем же 500. Для всех
        // api/* принудительно отдаём JSON 401.
        $exceptions->shouldRenderJsonWhen(
            fn ($request) => $request->is('api/*') || $request->expectsJson()
        );

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

        // Фикс «Свободные залы показывают прошедшие брони»: встречи, у которых
        // закончилось время, оставались в статусе scheduled/in-progress до
        // ручного запуска meetings:auto-complete — их слоты продолжали красить
        // сетку занятости и зал выглядел занятым/пустым некорректно. Теперь
        // автозавершение гоняется каждую минуту (команда идемпотентна).
        $schedule->command('meetings:auto-complete')
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

        // Мониторинг ВКС-бота (профиль "bot"): каждые 5 минут проверяем /health,
        // при сбое/восстановлении — алерт админу в MAX (ADMIN_ALERT_CHAT_ID).
        // Без VKSBOT_EXPECTED=true команда молча пропускает проверку.
        $schedule->command('bot:monitor')
                 ->everyFiveMinutes()
                 ->withoutOverlapping()
                 ->runInBackground();
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

            // Алерт админу в MAX при 5xx на API (только когда настроен чат —
            // см. ADMIN_ALERT_CHAT_ID). Дедуп по signature: одна и та же ошибка
            // не будет спамить чаще, чем раз в 10 минут. Статус берём из
            // исключения (HttpException и т.п.), иначе считаем 500.
            try {
                $errStatus = method_exists($e, 'getStatusCode') ? (int) $e->getStatusCode() : 500;
                if ($errStatus >= 500 && !($e instanceof \Illuminate\Validation\ValidationException)) {
                    \App\Services\AdminAlert::throttled(
                        'api5xx:' . get_class($e) . ':' . $e->getMessage(),
                        "🔥 Ошибка API: {$request->method()} {$request->path()}\n"
                            . get_class($e) . ': ' . $e->getMessage() .
                            ' @ ' . basename($e->getFile()) . ':' . $e->getLine()
                    );
                }
            } catch (\Throwable) {
                // алерты не должны ломать обработку запроса
            }

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
