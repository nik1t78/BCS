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

    /**
     * Прочитать значение как СЫРОЕ (без unserialize). Используется для ключей,
     * которые пишутся и читаются только через SafeCache (например, метка
     * «meetings:changed» — целый timestamp).
     *
     * Зачем: Laravel-хранилище сериализует значения с сохранением типа, а
     * Cache::forever() из phpredis пишет число как строку. При смешении
     * драйверов (в контейнере phpredis, в другой сборке — predis) или после
     * миграции redis Cache::get на таком ключе выдаёт строку вместо int.
     * Строковая версия попадает в кэш-ключ доступности залов и далее в
     * CarbonImmutable::parse(...) / now()->addSeconds(...) — это давало
     * 500 на /api/meetings/rooms-availability. Приведение к int здесь
     * делает чтение детерминированным независимо от драйвера.
     */
    public static function rawInt(string $key, int $default = 0): int
    {
        try {
            $value = Cache::connection()->client()
                ->get(Cache::getStore()->getPrefix() . $key);
        } catch (Throwable $e) {
            report($e);
            return $default;
        }

        if ($value === false || $value === null || $value === '') {
            return $default;
        }

        // predis может вернуть php-сериализованное значение даже на raw-get
        if (is_string($value) && preg_match('/^i:\d+;$|^s:\d+:/', $value)) {
            try {
                $value = @unserialize($value);
            } catch (Throwable) {
                return $default;
            }
        }

        return is_numeric($value) ? (int) $value : $default;
    }
}
