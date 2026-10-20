<?php

namespace App\Support;

use Throwable;
use Illuminate\Support\Facades\Cache;

/**
 * Обёртка над Cache-фасадом, которая НИКОГДА не бросает исключение.
 *
 * Причина появления: метка изменений списка встреч хранится в кэше
 * (CACHE_STORE=redis по умолчанию). Если redis недоступен (контейнер
 * redis упал/перезапускается, неверный REDIS_PASSWORD, phpredis не может
 * подключиться), обычный вызов Cache::forever()/Cache::get() внутри
 * POST /api/meetings бросал ConnectionException и Laravel отдавал 500 —
 * создание встречи падало, хотя сама запись в БД прошла успешно.
 *
 * Метка «meetings:changed» — это лишь оптимизация клиентского кэша: её
 * потеря или невозможность записи безопасны (фронт просто сделает полный
 * запрос списка). Поэтому ошибки кэша здесь глушатся.
 */
class SafeCache
{
    /**
     * Записать значение без истечения TTL; при недоступном хранилище — молча пропустить.
     */
    public static function forever(string $key, $value): void
    {
        try {
            Cache::forever($key, $value);
        } catch (Throwable $e) {
            report($e); // пишем в laravel.log, но пользователю не мешаем
        }
    }

    /**
     * Прочитать значение; при недоступном хранилище — вернуть $default.
     */
    public static function get(string $key, $default = null)
    {
        try {
            return Cache::get($key, $default);
        } catch (Throwable $e) {
            report($e);
            return $default;
        }
    }
}
