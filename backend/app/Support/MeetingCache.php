<?php

namespace App\Support;

/**
 * Инвалидация кэшей, зависящих от расписания встреч.
 *
 * Кэш доступности залов (RoomController::availabilityResponse) ключуется
 * только датой (rooms:avail:v2:<date>, TTL 45 с). bump() удаляет эти ключи
 * напрямую — мгновенная инвалидация без «метки версии» в ключе (старая
 * схема делала каждый запрос после изменения встреч cache-miss и гонял
 * тяжёлую выборку; при недоступном redis это приводило и к 500).
 * Если Redis недоступен, удаление молча пропускается — устаревание по
 * TTL (≤45 с) безопасно.
 */
class MeetingCache
{
    /**
     * Вызывать после любого изменения встреч (создание/перенос/отмена/
     * удаление/восстановление/смена статуса) и после правок графика залов.
     */
/**
     * ID залов из справочника по списку названий (для bump()).
     */
    public static function roomIdsFromNames(array $names): array
    {
        $names = array_values(array_filter(array_map(static fn ($n) => is_string($n) ? trim($n) : null, $names)));
        if (!$names) {
            return [];
        }
        return \App\Models\Room::whereIn('name', $names)->pluck('id')->all();
    }

    public static function bump(?array $roomIds = null): void
    {
        // Инвалидация кэша доступности залов: удаляем сами payload-ключи,
        // а не пишем микросекундную метку версии. Раньше метка попадала в
        // cache-ключ (rooms:avail:<version>:<date>) — после каждого
        // изменения встреч первый запрос был гарантированным cache-miss и
        // выполнял тяжёлую выборку с раскрытием серий; при недоступном/
        // «битом» redis это давало и 500 на эндпоинте.
        try {
            $keys = [];
            for ($d = 0; $d <= 120; $d++) {
                $keys[] = 'rooms:avail:v2:' . \Illuminate\Support\Carbon::today()->addDays($d)->toDateString();
            }
            $store = \Illuminate\Support\Facades\Cache::store();
            if (method_exists($store, 'forgetMany')) {
                $store->forgetMany($keys);
            } else {
                foreach ($keys as $k) {
                    \Illuminate\Support\Facades\Cache::forget($k);
                }
            }
        } catch (\Throwable $e) {
            report($e); // недоступный кэш не должен ронять изменение встречи
        }

        // Метку изменений оставляем для совместимости (её читают другие места),
        // но в ключах доступности она больше не участвует.
        \App\Support\SafeCache::forever('meetings:changed', (int) round(microtime(true) * 1_000_000));

        // WebSocket (Reverb): мгновенно уведомляем экраны ТВ затронутых залов.
        // Вещание включается только при настроенном REVERB_APP_KEY; без него
        // broadcast-драйвер 'null' и вызовы — no-op. Ошибки вещания не должны
        // ронять основной запрос — обёрнуто в try/catch.
        if ($roomIds !== null && filled(config('broadcasting.connections.reverb.app_key'))) {
            foreach (array_unique(array_filter($roomIds)) as $roomId) {
                try {
                    broadcast(new \App\Events\RoomScheduleChanged((int) $roomId));
                } catch (\Throwable $e) {
                    report($e);
                }
            }
        }
    }
}
