<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\User;
use App\Models\UserSetting;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MeetingIcsController extends Controller
{
    public function index(Request $request)
    {
        return $this->calendarResponse($request->user(), $request, true);
    }

    public function rotateFeed(Request $request)
    {
        $token = Str::random(64);
        $settings = $request->user()->getSettings();
        $settings->calendar_token_hash = hash('sha256', $token);
        $settings->save();

        return response()->json([
            'url' => url('/api/calendar-feed/' . $token . '.ics'),
        ]);
    }

    public function feedStatus(Request $request)
    {
        return response()->json([
            'active' => (bool) $request->user()->settings?->calendar_token_hash,
        ]);
    }

    public function revokeFeed(Request $request)
    {
        $settings = $request->user()->settings;
        if ($settings) {
            $settings->calendar_token_hash = null;
            $settings->save();
        }

        return response()->json(['message' => 'Ссылка календаря отключена']);
    }

    public function feed(Request $request, string $token)
    {
        $settings = UserSetting::where('calendar_token_hash', hash('sha256', $token))->first();
        if (!$settings || !$settings->user || !$settings->user->is_active) {
            return response()->json(['message' => 'Календарь не найден или ссылка отозвана'], 404);
        }

        return $this->calendarResponse($settings->user, null, false);
    }

    private function calendarResponse(User $user, ?Request $request = null, bool $download = true)
    {
        // Используем общий scope приложения, чтобы правила доступа к приватным
        // встречам совпадали с основным API (включая полный доступ администратора).
        $query = Meeting::query()->accessibleBy($user);

        if ($request && $request->filled('from')) {
            $query->where('date', '>=', $request->input('from'));
        }
        if ($request && $request->filled('to')) {
            $query->where('date', '<=', $request->input('to'));
        }

        $meetings = $query->orderBy('date')->orderBy('start_time')->limit(500)->get();
        $timezone = config('app.timezone', 'Europe/Moscow');

        $lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//VKS Schedule//RU',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:ВКС Расписание',
        ];

        foreach ($meetings as $m) {
            // В БД DATE и TIME — отдельные поля. Собираем локальный момент
            // в таймзоне приложения и только затем переводим его в UTC.
            $date = $m->getRawOriginal('date');
            if (!$date || !$m->start_time) {
                continue;
            }

            try {
                $startUtc = Carbon::parse($date . ' ' . $m->start_time, $timezone)->utc();
                $endTime = $m->end_time ?: Carbon::parse($m->start_time)->addHour()->format('H:i:s');
                $endUtc = Carbon::parse($date . ' ' . $endTime, $timezone)->utc();
            } catch (\Throwable $e) {
                // Некорректная старая запись не должна ломать экспорт всего календаря.
                continue;
            }

            $lines = array_merge($lines, [
                'BEGIN:VEVENT',
                'UID:vks-meeting-' . $m->id . '@vks.local',
                'DTSTAMP:' . now()->setTimezone('UTC')->format('Ymd\THis\Z'),
                'DTSTART:' . $startUtc->format('Ymd\THis\Z'),
                'DTEND:' . $endUtc->format('Ymd\THis\Z'),
                'SUMMARY:' . $this->esc($m->title),
                'DESCRIPTION:' . $this->esc(trim(($m->description ?? '') . ' | Комната: ' . ($m->room ?: 'Онлайн'))),
                'LOCATION:' . $this->esc($m->room ?: 'Онлайн'),
                ($rrule = $this->buildRRule($m)) ? 'RRULE:' . $rrule : null,
                'STATUS:' . ($m->status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'),
                'END:VEVENT',
            ]);
        }

        $lines[] = 'END:VCALENDAR';
        $ics = collect($lines)->filter(fn ($line) => $line !== null)
            ->map(fn ($line) => $this->foldLine($line))
            ->implode("\r\n");

        return response($ics, 200, [
            'Content-Type' => 'text/calendar; charset=UTF-8',
            'Content-Disposition' => ($download ? 'attachment' : 'inline') . '; filename="vks-schedule.ics"',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
        ]);
    }


    /**
     * Переводит правила повторения приложения в подмножество RFC 5545.
     * Для стандартных daily/weekly/monthly встреч RRULE строится автоматически:
     * иначе внешние календари показывали бы только первое событие серии.
     */
    private function buildRRule(Meeting $meeting): ?string
    {
        $rule = trim((string) $meeting->rrule);
        if ($rule !== '') {
            $rule = preg_replace('/^RRULE:/i', '', $rule);
        } else {
            $frequency = match ($meeting->recurring) {
                'daily' => 'DAILY',
                'weekly' => 'WEEKLY',
                'monthly' => 'MONTHLY',
                default => null,
            };

            if (!$frequency) {
                return null;
            }

            $rule = 'FREQ=' . $frequency;
        }

        if ($meeting->repeat_until && !preg_match('/(?:^|;)UNTIL=/i', $rule)) {
            $until = Carbon::parse(
                $meeting->repeat_until->format('Y-m-d') . ' 23:59:59',
                config('app.timezone', 'Europe/Moscow')
            )->utc()->format('Ymd\\THis\\Z');
            $rule .= ';UNTIL=' . $until;
        }

        return $rule;
    }

    /**
     * RFC 5545: строки не длиннее 75 октетов. Переносим по Unicode-символам,
     * чтобы не разрезать русские буквы посередине UTF-8 последовательности.
     */
    private function foldLine(string $line): string
    {
        $characters = preg_split('//u', $line, -1, PREG_SPLIT_NO_EMPTY);
        if ($characters === false) {
            return $line;
        }

        $result = [];
        $current = '';
        foreach ($characters as $character) {
            if ($current !== '' && strlen($current) + strlen($character) > 75) {
                $result[] = $current;
                $current = ' ' . $character;
            } else {
                $current .= $character;
            }
        }

        $result[] = $current;
        return implode("\r\n", $result);
    }

    private function esc(string $value): string
    {
        return str_replace(['\\', "\n", ',', ';'], ['\\\\', '\\n', '\\,', '\\;'], $value);
    }
}
