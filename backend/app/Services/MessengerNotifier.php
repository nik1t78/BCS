<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;

/**
 * Абстракция мессенджер-уведомлений.
 *
 * Единственный поддерживаемый канал — мессенджер MAX (max.ru),
 * доставка через MaxMessengerService (Bot API).
 *
 * .env:
 *   MESSENGER=max                 # max | none
 *   MAX_ENABLED=true
 *   MAX_BOT_TOKEN=...
 *   MAX_API_URL=https://maxapi.ru/v1
 *   users.max_chat_id             # привязывается в профиле
 */
class MessengerNotifier
{
    public static function driver(): string
    {
        return strtolower((string) env('MESSENGER', 'max'));
    }

    public static function isEnabled(): bool
    {
        if (self::driver() === 'none') {
            return false;
        }

        return MaxMessengerService::isEnabled();
    }

    /** Chat id пользователя в MAX. */
    public static function chatId(User $user): ?string
    {
        return $user->max_chat_id ?: null;
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
