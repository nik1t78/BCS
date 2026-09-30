<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Продуктовая аналитика: лёгкий журнал действий авторизованных пользователей.
 * Пишет одну строку в user_activity на API-запрос (только значимые методы),
 * без внешних сервисов (PostHog не требуется). DAU/MAU считает
 * php artisan analytics:daily из этого журнала.
 */
class TrackActivity
{
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

            DB::table('user_activity')->insert([
                'user_id' => $user->id,
                'action' => strtolower($method) . ':' . trim($request->path(), '/'),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // журнал не должен ломать запрос (нет таблицы/БД) — молча пропускаем
        }

        return $response;
    }
}
