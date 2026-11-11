<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    protected $fillable = [
        'name',
        'capacity',
        'location',
        'department_id',
        'equipment',
        'description',
        'is_active',
        'tv_token',
        'schedule',
    ];

    protected $casts = [
        'equipment' => 'array',
        'is_active' => 'boolean',
        'department_id' => 'integer',
        'schedule' => 'array',
    ];

    /** Ключи дней недели в порядке mon..sun */
    public const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    /**
     * График зала по умолчанию: пн–пт 08:00–20:00, сб/вс выходной.
     * Используется, когда у зала не задан персональный schedule.
     */
    public static function defaultSchedule(): array
    {
        $days = [];
        foreach (self::DAY_KEYS as $d) {
            $days[$d] = in_array($d, ['sat', 'sun'], true)
                ? null
                : ['start' => '08:00', 'end' => '20:00'];
        }
        return ['days' => $days, 'closed' => []];
    }

    /** Нормализация пользовательского графика: доливает отсутствующие дни из дефолта. */
    public static function normalizeSchedule(?array $raw): array
    {
        $def = self::defaultSchedule();
        $days = [];
        foreach (self::DAY_KEYS as $d) {
            $v = $raw['days'][$d] ?? ($def['days'][$d] ?? null);
            if ($v === null || $v === false) {
                $days[$d] = null;
            } elseif (is_array($v) && isset($v['start'], $v['end'])
                && preg_match('/^\d{2}:\d{2}$/', $v['start']) && preg_match('/^\d{2}:\d{2}$/', $v['end'])) {
                $days[$d] = ['start' => $v['start'], 'end' => $v['end']];
            } else {
                $days[$d] = $def['days'][$d] ?? null;
            }
        }
        $closed = [];
        foreach ((array) ($raw['closed'] ?? []) as $c) {
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $c)) $closed[] = $c;
        }
        return ['days' => $days, 'closed' => array_values(array_unique($closed))];
    }

    /** Эффективный график зала (персональный или дефолт). */
    public function effectiveSchedule(): array
    {
        return self::normalizeSchedule($this->schedule);
    }

    /**
     * Рабочие часы зала на дату с явной передачей графика (null → дефолт).
     * Отдельный метод нужен вызывающему коду, когда атрибут schedule может
     * быть пустым массивом «не задано» (миграция залила [] у старых залов):
     * normalizeSchedule([]) вернул бы дни со start=null и дальнейший парсинг
     * даты падал с fatal error. Здесь пустое значение трактуется как дефолт.
     */
    public function hoursForDateNormalized(string $dateKey, ?array $rawSchedule = null): ?array
    {
        $sch = self::normalizeSchedule(
            (!empty($rawSchedule) && is_array($rawSchedule)) ? $rawSchedule : null
        );
        if (in_array($dateKey, $sch['closed'], true)) {
            return null;
        }
        $idx = (int) \Carbon\CarbonImmutable::parse($dateKey)->dayOfWeekIso - 1; // 0=mon..6=sun
        $key = self::DAY_KEYS[max(0, min(6, $idx))];
        $h = $sch['days'][$key] ?? null;
        // Дополнительная защита: день без корректных HH:MM считаем закрытым.
        if (!is_array($h) || !preg_match('/^\d{2}:\d{2}$/', (string) ($h['start'] ?? ''))
            || !preg_match('/^\d{2}:\d{2}$/', (string) ($h['end'] ?? ''))) {
            return null;
        }
        return $h;
    }

    /**
     * Рабочие часы зала на дату: ['start'=>'HH:MM','end'=>'HH:MM'] либо null (закрыт).
     */
    public function hoursForDate(string $dateKey): ?array
    {
        $sch = $this->effectiveSchedule();
        if (in_array($dateKey, $sch['closed'], true)) {
            return null;
        }
        $idx = (int) \Carbon\CarbonImmutable::parse($dateKey)->dayOfWeekIso - 1; // 0=mon..6=sun
        $key = self::DAY_KEYS[max(0, min(6, $idx))];
        return $sch['days'][$key] ?? null;
    }

    /**
     * Скрыть токен экрана по умолчанию: он попадает в ответ /rooms только
     * администраторам (см. RoomController::index) и нужен лишь для URL телевизора.
     */
    protected $hidden = ['tv_token'];
}
