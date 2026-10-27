<?php

/*
 * Стандартный config/services.php Laravel 12 (в базовом скелете отсутствует).
 *
 * ВАЖНО: после `php artisan config:cache` функция env() возвращает null для
 * переменных, не описанных ни в одном config-файле. MAX-интеграция читается
 * через config('services.max.*') — см. App\Services\MaxMessengerService.
 */

return [

    // Общий драйвер уведомлений в мессенджер: max | none
    'messenger' => env('MESSENGER', 'max'),

    'max' => [
        // Мессенджер MAX (max.ru): доставка уведомлений через Bot API.
        'enabled'  => env('MAX_ENABLED', false),
        'token'    => env('MAX_BOT_TOKEN', ''),
        'api_url'  => env('MAX_API_URL', 'https://maxapi.ru/v1'),
        'bot_link' => env('MAX_BOT_LINK', 'https://max.ru/masterbot'),
        // Чат администраторов для системных алертов (упал бот, ошибка БД и т.п.)
        'admin_chat_id' => env('ADMIN_ALERT_CHAT_ID', ''),
    ],

    // Selenium-бот генерации ссылок ВКС (контейнер vks-bot, профиль "bot").
    'vks_bot' => [
        'url'      => env('VKSBOT_URL', 'http://vks-bot:8090'),
        // true — следить за доступностью бота и алертить админа (bot:monitor)
        'expected' => env('VKSBOT_EXPECTED', false),
    ],

];
