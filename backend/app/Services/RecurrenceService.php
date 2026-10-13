<?php

namespace App\Services;

use App\Models\Meeting;
use Carbon\Carbon;
use Carbon\CarbonImmutable;

/**
 * Серверный эквивалент фронтенд-парсера src/utils/recurrence.ts.
 *
 * Встречи с recurring != 'none' хранятся в БД ОДНОЙ записью; этот сервис
 * разворачивает серию в конкретные даты (occurrences) «на лету» — без
 * отдельной таблицы meeting_occurrences, что гарантирует консистентность:
 * любой перенос/отмена серии мгновенно учитывается в конфликтах и выборках.
 *
 * Поддерживается: daily / weekly / monthly и упрощённый RRULE
 * (FREQ=DAILY|WEEKLY|MONTHLY;INTERVAL=n;BYDAY=MO,..;BYSETPOS=-1;COUNT=n).
 */
class RecurrenceService
{
    /** Горизонт развёртки, дней вперёд (совпадает с MEETING_OCCURRENCES_LIMIT_DAYS на фронте) */
    public const HORIZON_DAYS = 92;

    private const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

    /**
     * Проверяет, «происходит» ли встреча в указанный день (с учётом повторов).
     */
    public static function occursOn(Meeting $meeting, CarbonImmutable $date): bool
    {
        $base = CarbonImmutable::parse($meeting->date)->startOfDay();
        $dayKey = $date->toDateString();

        if ($base->toDateString() === $dayKey) return true;

        if (!$meeting->recurring || $meeting->recurring === 'none') return false;
        if ($meeting->status === 'cancelled') return false;
        if ($meeting->repeat_until && $dayKey > Carbon::parse($meeting->repeat_until)->toDateString()) return false;
        if ($dayKey <= $base->toDateString()) return false;

        // ограничиваем горизонт развёртки
        if ($date->gt($base->addDays(self::HORIZON_DAYS))) return false;

        switch ($meeting->recurring) {
            case 'daily':
                return true;
            case 'weekly':
                return $base->dayOfWeek === $date->dayOfWeek;
            case 'monthly':
                return $base->day === $date->day;
            case 'custom':
                return self::matchesRrule((string) $meeting->rrule, $base, $date);
            default:
                return false;
        }
    }

    /**
     * Разворачивает список встреч в occurrences в диапазоне [from, to] включительно.
     * Неповторяющиеся встречи проходят как есть, если их дата в диапазоне.
     *
     * @param iterable<Meeting> $meetings
     * @return array<int, array{meeting: Meeting, date: string}>
     */
    public static function expand(iterable $meetings, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $result = [];
        $fromKey = $from->toDateString();
        $toKey = $to->toDateString();

        foreach ($meetings as $m) {
            if (!$m->recurring || $m->recurring === 'none') {
                $key = Carbon::parse($m->date)->toDateString();
                if ($key >= $fromKey && $key <= $toKey) {
                    $result[] = ['meeting' => $m, 'date' => $key];
                }
                continue;
            }
            for ($d = $from->copy(); $d->lte($to); $d = $d->addDay()) {
                if (self::occursOn($m, $d)) {
                    $result[] = ['meeting' => $m, 'date' => $d->toDateString()];
                }
            }
        }

        usort($result, function ($a, $b) {
            return [$a['date'], $a['meeting']->start_time] <=> [$b['date'], $b['meeting']->start_time];
        });

        return $result;
    }

    /**
     * Все даты повторений встречи, попадающие в диапазон [from, to].
     *
     * @return string[] YYYY-MM-DD
     */
    public static function occurrencesInRange(Meeting $meeting, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $dates = [];
        for ($d = $from->copy(); $d->lte($to); $d = $d->addDay()) {
            if (self::occursOn($meeting, $d)) {
                $dates[] = $d->toDateString();
            }
        }
        return $dates;
    }

    /**
     * Парсинг подмножества RRULE (RFC 5545). Возвращает null для неподдерживаемых правил.
     *
     * @return array{freq:string,interval:int,byDay:array<int,int>,bySetPos:?int,count:?int}|null
     */
    public static function parseRRule(string $rrule): ?array
    {
        if ($rrule === '') return null;
        $parts = [];
        foreach (explode(';', preg_replace('/^RRULE:/i', '', $rrule)) as $kv) {
            if (!str_contains($kv, '=')) continue;
            [$k, $v] = explode('=', strtoupper(trim($kv)), 2);
            $parts[trim($k)] = trim($v);
        }

        $freq = $parts['FREQ'] ?? '';
        if (!in_array($freq, ['DAILY', 'WEEKLY', 'MONTHLY'], true)) return null;

        $byDay = [];
        foreach (explode(',', $parts['BYDAY'] ?? '') as $code) {
            $code = preg_replace('/^[+-]?\d+/', '', strtoupper(trim($code)));
            $idx = array_search($code, self::DAY_CODES, true);
            if ($idx !== false) $byDay[] = $idx;
        }

        return [
            'freq' => $freq,
            'interval' => max(1, (int) ($parts['INTERVAL'] ?? 1) ?: 1),
            'byDay' => $byDay,
            'bySetPos' => isset($parts['BYSETPOS']) ? ((int) $parts['BYSETPOS'] ?: null) : null,
            'count' => isset($parts['COUNT']) ? ((int) $parts['COUNT'] ?: null) : null,
        ];
    }

    private static function matchesRrule(string $rrule, CarbonImmutable $base, CarbonImmutable $date): bool
    {
        $r = self::parseRRule($rrule);
        if (!$r) return false;

        $dayDiff = $base->diffInDays($date, false);
        if ($dayDiff <= 0) return false;

        // COUNT: считаем номер occurrence (сколько совпадений было до date включительно)
        if ($r['count'] !== null) {
            $occurrences = 0;
            for ($i = 1; $i <= $dayDiff && $i <= 400; $i++) {
                $cursor = $base->addDays($i);
                if ($cursor->gt($date)) break;
                if (self::matchesRruleNoCount($r, $base, $cursor)) $occurrences++;
                if ($occurrences > $r['count']) return false;
            }
        }

        return self::matchesRruleNoCount($r, $base, $date);
    }

    private static function matchesRruleNoCount(array $r, CarbonImmutable $base, CarbonImmutable $date): bool
    {
        $dayDiff = $base->diffInDays($date, false);
        if ($dayDiff <= 0) return false;

        if ($r['freq'] === 'DAILY') {
            return $dayDiff % $r['interval'] === 0
                && (empty($r['byDay']) || in_array($date->dayOfWeek, $r['byDay'], true));
        }

        if ($r['freq'] === 'WEEKLY') {
            if (intdiv($dayDiff, 7) % $r['interval'] !== 0) return false;
            $targetDays = $r['byDay'] ?: [$base->dayOfWeek];
            return in_array($date->dayOfWeek, $targetDays, true);
        }

        // MONTHLY
        $monthsDiff = ($date->year - $base->year) * 12 + ($date->month - $base->month);
        if ($monthsDiff < 0 || $monthsDiff % $r['interval'] !== 0) return false;

        $targetDays = $r['byDay'] ?: [$base->dayOfWeek];

        if ($r['bySetPos'] !== null && !empty($r['byDay'])) {
            // «N-й (или последний) указанный день месяца», напр. FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1
            $all = self::daysOfMonthMatching($date->year, $date->month, $targetDays);
            $idx = $r['bySetPos'] === -1 ? count($all) - 1 : $r['bySetPos'] - 1;
            return $idx >= 0 && ($all[$idx] ?? null) === $date->day;
        }

        if (!empty($r['byDay'])) {
            return in_array($date->dayOfWeek, $targetDays, true);
        }

        return $date->day === $base->day;
    }

    /** @param int[] $weekdays 0=Sun..6=Sat */
    private static function daysOfMonthMatching(int $year, int $month, array $weekdays): array
    {
        $result = [];
        $daysInMonth = (int) CarbonImmutable::create($year, $month, 1)->daysInMonth;
        for ($d = 1; $d <= $daysInMonth; $d++) {
            if (in_array(CarbonImmutable::create($year, $month, $d)->dayOfWeek, $weekdays, true)) {
                $result[] = $d;
            }
        }
        return $result;
    }
}
