<?php

return [

    'name' => env('APP_NAME', 'Laravel'),

    'env' => env('APP_ENV', 'production'),

    'debug' => (bool) env('APP_DEBUG', false),

    'url' => env('APP_URL', 'http://localhost'),

    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),

    'asset_url' => env('ASSET_URL'),

    // Europe/Moscow по умолчанию: контейнеры PHP-FPM уже собраны с TZ=Europe/Moscow
    // (см. backend/Dockerfile), а фронт синхронизирует часы через GET /api/time.
    // Раньше дефолт был UTC — «время не совпадает» возникало везде, где APP_TIMEZONE
    // не был прописан в .env (now() возвращал московские wall-clock-часы, но Carbon
    // помечал их как UTC → расхождение 3 часа при проверках «прошедшего времени»).
    'timezone' => env('APP_TIMEZONE', 'Europe/Moscow'),

    'locale' => env('APP_LOCALE', 'en'),

    'fallback_locale' => env('APP_FALLBACK_LOCALE', 'en'),

    'faker_locale' => env('APP_FAKER_LOCALE', 'en_US'),

    'cipher' => 'AES-256-CBC',

    'key' => env('APP_KEY'),

    'previous_keys' => [
        ...array_filter(
            explode(',', (string) env('APP_PREVIOUS_KEYS', ''))
        ),
    ],

    'maintenance' => [
        'driver' => env('APP_MAINTENANCE_DRIVER', 'file'),
        'store' => env('APP_MAINTENANCE_STORE', 'database'),
    ],

];
