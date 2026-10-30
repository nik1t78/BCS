<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Продуктовая аналитика: лёгкий журнал действий авторизованных пользователей.
 * Пишет одну строку в user_activity на API-запрос (только значимые методы),
 * без внешних сервисов (PostHog не требуется). DAU/MAU считает
 * php artisan analytics:daily из этого журнала.
 */
class TrackActivity
{
    /**
     * Ключ кэша «существует ли таблица user_activity». Таблица создаётся
     * миграцией 2024_01_17; на стендах/старых БД её может не быть. Проверяем
     * это ОДИН раз за TTL и запоминаем результат в кэше: иначе на каждый
     * POST/PATCH/DELETE гоняется SHOW TABLES, а при отвалившейся БД middleware
     * превращается в источник таймаутов вместо штатного ответа контроллера.
     */
    private const TABLE_CACHE_KEY = 'analytics:user_activity_table_exists';
    private const TABLE_CACHE_TTL = 600; // секунд

    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        try {
            $user = $request->user();
            if (!$user || $request->path() === 'api/notifications/stream') {
                return $response; // стрим — долгоживущее соединение, не логируем
            }

            $method = $request->method();
            if ($method === 'GET') {
                return $response; // GET-шум (списки, polling unread-count и т.п.) не пишем
            }

            if (!self::tableExists()) {
                return $response;
            }

            DB::table('user_activity')->insert([
                'user_id' => $user->id,
                'action' => strtolower($method) . ':' . mb_substr(trim($request->path(), '/'), 0, 150),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // журнал не должен ломать запрос (нет таблицы/БД) — молча пропускаем.
            // В лог пишем только если ошибка не «нет таблицы» (её уже учли выше).
            logger()->debug('TrackActivity skipped: ' . $e->getMessage());
        }

        return $response;
    }

    /**
     * Есть ли таблица user_activity (результат кэшируется).
     */
    private static function tableExists(): bool
    {
        $cached = cache()->get(self::TABLE_CACHE_KEY);
        if ($cached !== null) {
            return (bool) $cached;
        }

        $exists = Schema::hasTable('user_activity');
        cache()->put(self::TABLE_CACHE_KEY, $exists ? 1 : 0, self::TABLE_CACHE_TTL);

        return $exists;
    }
}
