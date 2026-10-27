<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * Алерты администратору сервера в мессенджер MAX (Bot API).
 *
 * Канал: ADMIN_ALERT_CHAT_ID (chat_id админ-чата) + стандартные настройки
 * MAX_ENABLED / MAX_BOT_TOKEN. Если что-то из этого не задано — алерты
 * молча пропускаются (ошибки при этом пишутся в laravel.log, чтобы
 * production.ERROR и другие проблемы всё равно были видны админу через логи).
 *
 * Использование:
 *   AdminAlert::send("ВКС-бот недоступен: connection refused");
 */
class AdminAlert
{
    public static function chatId(): string
    {
        // config(), а не env() — иначе после config:cache значение = null.
        return (string) config('services.max.admin_chat_id', env('ADMIN_ALERT_CHAT_ID', ''));
    }

    /** Отправить сообщение в админ-чат. Возвращает true при успехе. */
    public static function send(string $text): bool
    {
        $chatId = self::chatId();
        if ($chatId === '') {
            Log::info('AdminAlert: ADMIN_ALERT_CHAT_ID не задан — алерт пропущен: ' . $text);
            return false;
        }

        return MaxMessengerService::sendMessage($chatId, $text);
    }

    /**
     * Алерт с дедупликацией: одинаковые (по $signature) сообщения не
     * отправляются чаще одного раза в $minutes минут. Защита от спама при
     * повторяющихся ошибках (например, падающий каждые 5 минут endpoint).
     */
    public static function throttled(string $signature, string $text, int $minutes = 10): bool
    {
        $key = 'admin_alert:' . md5($signature);
        if (cache()->has($key)) {
            return false;
        }
        cache()->put($key, time(), now()->addMinutes(max(1, $minutes)));
        return self::send($text);
    }
}
