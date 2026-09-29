<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;

/**
 * Абстракция мессенджер-уведомлений.
 *
 * По умолчанию доставляет уведомления в Telegram (через MaxMessengerService,
 * который работает по протоколу Bot API — совместим и с MAX, и с Telegram).
 *
 * .env:
 *   MESSENGER=telegram            # telegram | max | none
 *   TELEGRAM_ENABLED=true
 *   TELEGRAM_BOT_TOKEN=123456:ABC...
 *   TELEGRAM_API_URL=https://api.telegram.org/bot{TOKEN}
 *   TELEGRAM_BOT_LINK=https://t.me/your_bot
 *   users.telegram_chat_id        # привязывается в профиле
 */
class MessengerNotifier
{
    public static function driver(): string
    {
        return strtolower((string) env('MESSENGER', 'telegram'));
    }

    public static function isEnabled(): bool
    {
        $driver = self::driver();

        if ($driver === 'none') {
            return false;
        }

        // Telegram использует тот же Bot-API транспорт, что и MAX
        return MaxMessengerService::isEnabled();
    }

    /** Chat id пользователя для текущего драйвера. */
    public static function chatId(User $user): ?string
    {
        $column = self::driver() === 'max' ? 'max_chat_id' : 'telegram_chat_id';

        return $user->{$column} ?: null;
    }

    public static function sendMessage(string $chatId, string $text): bool
    {
        return MaxMessengerService::sendMessage($chatId, $text);
    }

    public static function notifyMeeting(User $user, Notification $notification): bool
    {
        if (!self::isEnabled()) {
            return false;
        }

        $chatId = self::chatId($user);
        if (!$chatId) {
            return false;
        }

        $title = $notification->title ?: match ($notification->type) {
            'starting'   => '🔴 Конференция начинается',
            'reminder'   => '⏰ Напоминание о конференции',
            'warning'    => '⚠️ Изменение конференции',
            'user-added' => '👤 Вас добавили в конференцию',
            default      => '📅 Уведомление ВКС Расписание',
        };

        $text = "ВКС Расписание\n{$title}\n{$notification->message}";

        return self::sendMessage($chatId, $text);
    }

    /**
     * Создать in-app уведомление И продублировать его в мессенджер.
     */
    public static function notify(
        int $userId,
        ?int $meetingId,
        string $message,
        string $type,
        ?string $title = null
    ): Notification {
        $notification = Notification::create([
            'user_id'    => $userId,
            'meeting_id' => $meetingId,
            'title'      => $title,
            'message'    => $message,
            'type'       => $type,
            'read'       => false,
        ]);

        $user = User::find($userId);
        if ($user) {
            self::notifyMeeting($user, $notification);
        }

        return $notification;
    }
}
