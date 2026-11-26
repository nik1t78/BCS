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

        return self::flagOn() && !empty(self::token());
    }

    /**
     * ВАЖНО: читаем настройки через config(), а не env().
     * После `php artisan config:cache` функция env() возвращает null для всех
     * переменных, не описанных в config/* — из-за этого MAX-уведомления
     * «молчали» даже при MAX_ENABLED=true и заданном токене.
     */
    public static function flagOn(): bool
    {
        return filter_var(
            config('services.max.enabled', env('MAX_ENABLED', false)),
            FILTER_VALIDATE_BOOLEAN
        );
    }

    public static function token(): string
    {
        return (string) config('services.max.token', env('MAX_BOT_TOKEN', ''));
    }

    public static function apiUrl(): string
    {
        $url = rtrim((string) config('services.max.api_url', env('MAX_API_URL', 'https://platform-api2.max.ru')), '/');

        // Старые шаблоны BCS использовали неофициальный maxapi.ru/v1 и
        // прежний platform-api.max.ru. Переводим именно эти legacy defaults
        // на актуальный официальный endpoint, сохраняя пользовательские URL.
        if ($url === '' || in_array($url, [
            'https://maxapi.ru/v1',
            'https://platform-api.max.ru',
            'https://platform-api.max.ru/v1',
        ], true)) {
            return 'https://platform-api2.max.ru';
        }

        return $url;
    }

    public static function botLink(): string
    {
        return (string) config('services.max.bot_link', env('MAX_BOT_LINK', 'https://max.ru/masterbot'));
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

        // Официальный Bot API: POST /messages?chat_id=... и токен
        // передаётся напрямую в Authorization (без префикса Bearer).
        $url = self::apiUrl() . '/messages?' . http_build_query(['chat_id' => $chatId]);
        $payload = ['text' => mb_substr($text, 0, 4000)];
        $headers = ['Authorization' => self::token()];

        try {
            $response = Http::timeout(10)->withHeaders($headers)->post($url, $payload);

            if ($response->successful()) {
                return true;
            }

            Log::warning('MAX: ошибка отправки уведомления', [
                'status' => $response->status(),
                'body' => substr($response->body(), 0, 300),
            ]);
            return false;
        } catch (\\Throwable $e) {
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

        $headers = ['Authorization' => self::token()];

        try {
            // MAX сначала выдаёт временный URL и token через POST /uploads.
            $uploadInit = Http::timeout(10)
                ->withHeaders($headers)
                ->post(self::apiUrl() . '/uploads?type=file');

            if (!$uploadInit->successful()) {
                Log::warning('MAX: не удалось начать загрузку файла', [
                    'status' => $uploadInit->status(),
                    'body' => substr($uploadInit->body(), 0, 300),
                ]);
                return false;
            }

            $uploadUrl = (string) $uploadInit->json('url');
            $uploadToken = (string) $uploadInit->json('token');
            if ($uploadUrl === '' || $uploadToken === '') {
                Log::warning('MAX: API загрузки не вернул url/token');
                return false;
            }

            $contents = file_get_contents($filePath);
            if ($contents === false) {
                Log::warning('MAX: не удалось прочитать файл для загрузки');
                return false;
            }

            // Multipart upload выполняется на выданный URL. Токен авторизации
            // не пересылаем на сторонний upload host.
            $uploaded = Http::timeout(60)
                ->attach('data', $contents, $fileName)
                ->post($uploadUrl);

            if (!$uploaded->successful()) {
                Log::warning('MAX: ошибка загрузки файла', [
                    'status' => $uploaded->status(),
                    'body' => substr($uploaded->body(), 0, 300),
                ]);
                return false;
            }

            // Отправляем загруженный файл как attachment к сообщению.
            $payload = [
                'text' => $caption !== '' ? mb_substr($caption, 0, 4000) : $fileName,
                'attachments' => [[
                    'type' => 'file',
                    'payload' => ['token' => $uploadToken],
                ]],
            ];
            $sent = Http::timeout(15)
                ->withHeaders($headers)
                ->post(self::apiUrl() . '/messages?' . http_build_query(['chat_id' => $chatId]), $payload);

            if ($sent->successful()) {
                return true;
            }

            Log::warning('MAX: ошибка отправки файла в чат', [
                'status' => $sent->status(),
                'body' => substr($sent->body(), 0, 300),
            ]);
            return false;
        } catch (\\Throwable $e) {
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
