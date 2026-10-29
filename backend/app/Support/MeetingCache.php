<?php

namespace App\Support;

/**
 * Инвалидация кэшей, зависящих от расписания встреч.
 *
 * Кэш доступности залов (RoomController::availabilityResponse) ключуется
 * меткой «meetings:changed» + датой, TTL всего 45 с. Поэтому для мгновенной
 * инвалидации достаточно поднять саму метку — старые ключи перестают
 * читаться и будут пересобраны при следующем запросе. Метка живёт в Redis;
 * если Redis недоступен, SafeCache молча пропускает запись, а кэш-ключ
 * устареет по TTL (≤45 с) — деградация безопасна.
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
        \App\Support\SafeCache::forever('meetings:changed', now()->timestamp);

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
