<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/**
 * Клиент Playwright-бота генерации ссылок ВКС (контейнер vks-bot, профиль "bot").
 *
 * POST {VKSBOT_URL}/create  с заголовком X-Bot-Token: BOT_TOKENS[0]
 * Ответ бота: { ok, link, room, password }; фиктивные fallback-ссылки запрещены.
 */
class VkSBotClient
{
    /**
     * Привести дату встречи к виду «ДД.ММ.ГГГГ» для бота и названия комнаты.
     * Принимает ISO-строку Laravel ("2026-10-29 00:00:00" / "2026-10-29"),
     * Carbon/DateTime-объект или уже форматированную "29.10.2026".
     * Возвращает null, если распознать не удалось (бот тогда сам подставит
     * «сегодня по Москве»).
     */
    private function normalizeDate(mixed $date): ?string
    {
        if ($date === null || $date === '') {
            return null;
        }
        if ($date instanceof \DateTimeInterface) {
            return $date->format('d.m.Y');
        }
        $s = trim((string) $date);
        // ISO из БД/фронта: 2026-10-29 или 2026-10-29 00:00:00 или с T
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $s, $m)) {
            return "{$m[3]}.{$m[2]}.{$m[1]}";
        }
        // Уже ДД.ММ.ГГГГ (или ДД/ММ/ГГГГ, ДД-ММ-ГГГГ)
        if (preg_match('/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/', $s, $m)) {
            $y = strlen($m[3]) === 4 ? $m[3] : '20' . $m[3];
            return sprintf('%02d.%02d.%s', (int) $m[1], (int) $m[2], $y);
        }
        return null;
    }

    /** @return array{ok:bool,link?:string,error?:string,detail?:string} */
    public function create(string $title, string $name, mixed $date = null): array
    {
        if (!filter_var(config('services.vks_bot.expected', false), FILTER_VALIDATE_BOOLEAN)) {
            return ['ok' => false, 'error' => 'VKS bot is disabled'];
        }

        $url = rtrim((string) config('services.vks_bot.url', 'http://vks-bot:8090'), '/') . '/create';
        // Секрет — первое значение из списка BOT_TOKENS (см. vks-bot/server.py).
        $token = trim(explode(',', (string) config('services.vks_bot.token', ''))[0] ?? '');
        if ($token === '') {
            return ['ok' => false, 'error' => 'BOT_TOKENS is not configured'];
        }

        // Дату встречи передаём боту ЯВНО и по Москве: если спросить «сегодня»
        // у сервера в UTC (или обрезать ISO-строку до первых 10 символов),
        // вечерний запрос после 21:00 MSK давал «вчера» — встреча на платформе
        // записывалась на 28 число вместо 29.
        $payload = ['title' => mb_substr($title, 0, 120), 'name' => mb_substr($name, 0, 80)];
        $normalized = $this->normalizeDate($date);
        if ($normalized !== null) {
            $payload['date'] = $normalized;
        }

        try {
            $response = Http::timeout(120)
                ->withHeaders($token !== '' ? ['X-Bot-Token' => $token] : [])
                ->post($url, $payload);
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => 'bot unreachable: ' . $e->getMessage()];
        }

        if (!$response->successful()) {
            return ['ok' => false, 'error' => 'bot http ' . $response->status(), 'detail' => mb_substr((string) $response->body(), 0, 300)];
        }

        $data = $response->json() ?? [];
        $link = !empty($data['ok']) && !empty($data['link'])
            ? (string) $data['link']
            : null;

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
