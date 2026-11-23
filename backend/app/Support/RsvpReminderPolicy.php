<?php

declare(strict_types=1);

namespace App\\Support;

/**
 * Правила напоминаний участникам, не подтвердившим присутствие.
 */
final class RsvpReminderPolicy
{
    /**
     * @return int[] Уникальные значения в минутах, от большего к меньшему.
     */
    public static function parseOffsets(string $value): array
    {
        $offsets = [];
        foreach (explode(',', $value) as $part) {
            $minutes = filter_var(trim($part), FILTER_VALIDATE_INT);
            if ($minutes !== false && $minutes >= 1 && $minutes <= 10080) {
                $offsets[] = $minutes;
            }
        }

        $offsets = array_values(array_unique($offsets));
        rsort($offsets, SORT_NUMERIC);

        return $offsets;
    }

    /**
     * Планировщик работает раз в минуту; двухминутное окно страхует
     * от небольшого запаздывания запуска, а БД-дедупликация не даст дублей.
     */
    public static function isDue(int $secondsUntilStart, int $offsetMinutes, int $graceMinutes = 2): bool
    {
        if ($offsetMinutes < 1 || $graceMinutes < 1 || $secondsUntilStart < 0) {
            return false;
        }

        return $secondsUntilStart >= $offsetMinutes * 60
            && $secondsUntilStart < ($offsetMinutes + $graceMinutes) * 60;
    }

    /**
     * Напоминаем только тем, кто не ответил или выбрал «Под вопросом».
     * «Приду» и «Не приду» — уже определённые ответы.
     */
    public static function needsResponse(?string $response): bool
    {
        return !in_array($response, ['yes', 'no'], true);
    }
}
