<?php

return [
    'name' => env('APP_NAME', 'ВКС Расписание'),
    'env' => env('APP_ENV', 'production'),
    'debug' => (bool) env('APP_DEBUG', false),
    'url' => env('APP_URL', 'http://localhost'),
    'timezone' => 'Europe/Moscow',
    'locale' => 'ru',
    'fallback_locale' => 'en',
    'faker_locale' => 'ru_RU',
    'cipher' => 'AES-256-CBC',
    'key' => env('APP_KEY'),
    'maintenance' => ['driver' => 'file'],
    'providers' => Illuminate\Support\Facades\Facade::defaultProviders()->toArray(),
    'aliases' => Illuminate\Support\Facades\Facade::defaultAliases()->toArray(),
];
