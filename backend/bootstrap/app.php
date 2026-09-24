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
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
