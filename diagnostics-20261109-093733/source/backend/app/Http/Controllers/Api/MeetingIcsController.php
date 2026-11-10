<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use Illuminate\Http\Request;

/**
 * Экспорт расписания в формате iCalendar (.ics) — для добавления ВКС
 * в Outlook / Яндекс.Календарь / Google Calendar.
 */
class MeetingIcsController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Meeting::query()
            ->whereNull('deleted_at')
            ->where(function ($q) use ($user) {
                $q->where('organizer_id', $user->id)
                  ->orWhereJsonContains('participants', (string) $user->id)
                  ->orWhereJsonContains('participants', $user->id)
                  ->orWhere('is_public', true);
            });

        if ($request->filled('from')) {
            $query->where('start_time', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->where('start_time', '<=', $request->input('to'));
        }

        $meetings = $query->orderBy('start_time')->limit(500)->get();

        $lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//VKS Schedule//RU',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:ВКС Расписание',
        ];

        foreach ($meetings as $m) {
            // start_time/end_time — Carbon, собранный из DATE + TIME в таймзоне
            // приложения (Europe/Moscow). gmdate() печатал эти «московские» часы
            // как UTC-«Z», из-за чего утренняя встреча 09:00 в Outlook/Google
            // ложилась на 06:00Z и при возврате в локальную зону могла показаться
            // другим днём. Правильно — переводить абсолютный момент в UTC.
            $startUtc = $m->start_time instanceof \DateTimeInterface
                ? (clone $m->start_time)->setTimezone(new \DateTimeZone('UTC'))
                : null;
            if (!$startUtc) continue; // нет валидного начала — пропускаем событие
            $endRaw = $m->end_time ?: $m->start_time->copy()->addHour();
            $endUtc = ($endRaw instanceof \DateTimeInterface)
                ? (clone $endRaw)->setTimezone(new \DateTimeZone('UTC'))
                : null;
            if (!$endUtc) $endUtc = (clone $startUtc)->modify('+1 hour');

            $lines = array_merge($lines, [
                'BEGIN:VEVENT',
                'UID:vks-meeting-' . $m->id . '@vks.local',
                'DTSTAMP:' . now()->setTimezone(new \DateTimeZone('UTC'))->format('Ymd\THis\Z'),
                'DTSTART:' . $startUtc->format('Ymd\THis\Z'),
                'DTEND:' . $endUtc->format('Ymd\THis\Z'),
                'SUMMARY:' . $this->esc($m->title),
                'DESCRIPTION:' . $this->esc(trim(($m->description ?? '') . ' | Комната: ' . ($m->room ?: 'Онлайн'))),
                'LOCATION:' . $this->esc($m->room ?: 'Онлайн'),
                ($m->is_recurring && $m->rrule ? 'RRULE:' . $m->rrule : null),
                'STATUS:' . ($m->status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'),
                'END:VEVENT',
            ]);
        }

        $lines[] = 'END:VCALENDAR';

        // RFC 5545: CRLF + перенос длинных строк
        $ics = collect($lines)->filter(fn ($l) => $l !== null)
            ->map(fn ($l) => implode("\r\n ", str_split($l, 74)))
            ->implode("\r\n");

        return response($ics, 200, [
            'Content-Type' => 'text/calendar; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="vks-schedule.ics"',
        ]);
    }

    private function esc(string $value): string
    {
        return str_replace(['\\', "\n", ',', ';'], ['\\\\', '\\n', '\\,', '\\;'], $value);
    }
}
