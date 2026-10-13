<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Отправка уведомлений в мессенджер MAX (max.ru) через Bot API.
 *
 * В .env: MAX_ENABLED=true, MAX_BOT_TOKEN=..., MAX_API_URL=https://maxapi.ru/v1
 * Пользователь должен привязать chat_id в профиле (users.max_chat_id).
 */
class MaxMessengerService
{
    public static function isEnabled(): bool
    {
        // MESSENGER=none отключает доставку полностью
        if (MessengerNotifier::driver() === 'none') {
            return false;
        }

        return filter_var(env('MAX_ENABLED', false), FILTER_VALIDATE_BOOLEAN)
            && !empty(env('MAX_BOT_TOKEN'));
    }

    /**
     * Отправить сообщение в чат мессенджера MAX (Bot API).
     * Возвращает true при успехе.
     * Ошибки логируются и не ломают основной поток (in-app уведомление остаётся).
     */
    public static function sendMessage(string $chatId, string $text): bool
    {
        if (!self::isEnabled()) {
            return false;
        }

        $url = rtrim((string) env('MAX_API_URL', 'https://maxapi.ru/v1'), '/') . '/sendmessage';
        $payload = ['chat_id' => $chatId, 'text' => $text];
        $headers = ['Authorization' => 'Bearer ' . env('MAX_BOT_TOKEN')];

        try {
            $response = Http::timeout(5)->withHeaders($headers)->post($url, $payload);

            if ($response->successful()) {
                return true;
            }

            Log::warning('MAX: ошибка отправки уведомления', [
                'status' => $response->status(),
                'body' => substr($response->body(), 0, 300),
            ]);
            return false;
        } catch (\Throwable $e) {
            Log::warning('MAX: исключение при отправке: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Отправить файл (например, PDF-протокол встречи) в чат MAX через upload_file.
     * $filePath — локальный путь к файлу на диске.
     */
    public static function sendFile(string $chatId, string $filePath, string $fileName, string $caption = ''): bool
    {
        if (!self::isEnabled() || !is_readable($filePath)) {
            return false;
        }

        $url = rtrim((string) env('MAX_API_URL', 'https://maxapi.ru/v1'), '/') . '/upload_file';
        $headers = ['Authorization' => 'Bearer ' . env('MAX_BOT_TOKEN')];

        try {
            $response = Http::timeout(20)
                ->attach('file', file_get_contents($filePath), $fileName)
                ->withHeaders($headers)
                ->post($url, array_filter([
                    'chat_id' => $chatId,
                    'caption' => $caption ?: null,
                ]));

            if ($response->successful()) {
                return true;
            }

            Log::warning('MAX: ошибка отправки файла', [
                'status' => $response->status(),
                'body' => substr($response->body(), 0, 300),
            ]);
            return false;
        } catch (\Throwable $e) {
            Log::warning('MAX: исключение при отправке файла: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Уведомить пользователя о встрече в MAX (если привязан chat_id и интеграция включена).
     * Возвращает true при успехе; ошибки не ломают основной поток (in-app уведомление остаётся).
     */
    public static function notifyMeeting(User $user, Notification $notification): bool
    {
        if (!self::isEnabled() || !$user->max_chat_id) {
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

        return self::sendMessage($user->max_chat_id, $text);
    }

    /**
     * Хук: вызывается после создания in-app уведомления (Notification::created).
     * Продублировать уведомление в MAX можно, раскомментарив блок ниже — это
     * гарантирует ровно одну отправку на событие без правки всех контроллеров.
     */
    public static function bootNotificationHook(): void
    {
        \App\Models\Notification::created(function (Notification $notification) {
            // if (self::isEnabled()) {
            //     $user = $notification->user()->first();
            //     if ($user) {
            //         self::notifyMeeting($user, $notification);
            //     }
            // }
        });
    }

    /**
     * Отправить in-app уведомление пользователю И продублировать его в MAX
     * (если пользователь привязал chat_id в профиле и MAX_ENABLED=true).
     */
    public static function notifyWithMax(
        int $userId,
        ?int $meetingId,
        string $message,
        string $type,
        ?string $title = null
    ): \App\Models\Notification {
        $notification = \App\Models\Notification::create([
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
