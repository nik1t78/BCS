<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/**
 * Клиент Selenium-бота генерации ссылок ВКС (контейнер vks-bot, профиль "bot").
 *
 * POST {VKSBOT_URL}/create  с заголовком X-Bot-Token: BOT_TOKENS[0]
 * Ответ бота: { ok, link, room, password } либо { ok:false, fallback_link }.
 */
class VkSBotClient
{
    /** @return array{ok:bool,link?:string,error?:string,detail?:string} */
    public function create(string $title, string $name): array
    {
        $url = rtrim((string) config('services.vks_bot.url', 'http://vks-bot:8090'), '/') . '/create';
        // Секрет — первое значение из списка BOT_TOKENS (см. vks-bot/server.py).
        $token = trim(explode(',', (string) env('BOT_TOKENS', ''))[0] ?? '');

        try {
            $response = Http::timeout(120)
                ->withHeaders($token !== '' ? ['X-Bot-Token' => $token] : [])
                ->post($url, ['title' => mb_substr($title, 0, 120), 'name' => mb_substr($name, 0, 80)]);
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => 'bot unreachable: ' . $e->getMessage()];
        }

        if (!$response->successful()) {
            return ['ok' => false, 'error' => 'bot http ' . $response->status(), 'detail' => mb_substr((string) $response->body(), 0, 300)];
        }

        $data = $response->json() ?? [];
        $link = !empty($data['ok']) && !empty($data['link'])
            ? (string) $data['link']
            : (isset($data['fallback_link']) ? (string) $data['fallback_link'] : null);

        if ($link === null || !str_starts_with($link, 'https://salutejazz.ru/calls/')) {
            return ['ok' => false, 'error' => 'бот не вернул ссылку', 'detail' => mb_substr(json_encode($data, JSON_UNESCAPED_UNICODE) ?: '', 0, 300)];
        }

        return [
            'ok' => !empty($data['ok']) && !empty($data['link']),
            'link' => $link,
            'real' => !empty($data['ok']) && !empty($data['link']),
            'room' => $data['room'] ?? null,
            'password' => $data['password'] ?? null,
        ];
    }

    /**
     * Проверка «живости» ссылки ВКС (пункт 2 плана): GET на salutejazz.ru.
     * Комната ещё не создана платформой → 404/5xx или редирект на /calls/create.
     * Страница входа в несозданную комнату тоже может отдавать 200 (SPA),
     * поэтому считаем живыми только коды 2xx без редиректа на «создать».
     */
    public static function isLinkAlive(string $link): bool
    {
        try {
            $response = Http::timeout(10)->withHeaders(['User-Agent' => 'Mozilla/5.0'])->get($link);
            if (!$response->successful()) {
                return false;
            }
            // SPA всегда отдаёт 200; проверяем косвенный признак «комната есть»:
            // ответ не должен перенаправлять JS-страницей на создание.
            $body = strip_tags($response->body());
            foreach (['не найдена', 'not found', 'встреча не существует', 'создайте встречу'] as $needle) {
                if (mb_stripos($body, $needle) !== false) {
                    return false;
                }
            }
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }
}
