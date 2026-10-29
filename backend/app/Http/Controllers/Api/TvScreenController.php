<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\Room;
use Illuminate\Http\Request;

/**
 * Пункт 5 плана: данные для «экрана ожидания» в зале (/tv/{room}?token=...).
 * Страница открыта без логина (токен зала в URL), поэтому контроллер:
 *  - отдаёт ТОЛЬКО нейтральные поля встреч (без описаний, e-mail, приватных);
 *  - ограничивает выдачу 30 днями вперёд.
 * JS на телевизоре опрашивает этот эндпоинт каждые ~10 секунд.
 */
class TvScreenController extends Controller
{
    public function next(Request $request, Room $room)
    {
        $token = (string) $request->query('token', '');
        if ($token === '' || !$room->tv_token || !hash_equals((string) $room->tv_token, $token)) {
            return response()->json(['message' => 'Неверный токен экрана'], 403);
        }

        // Журнал посещаемости ТВ (пишется «скользко», не чаще раза в минуту
        // на экран; ошибки журнала не должны ронять экран).
        try {
            $this->touchViewLog($request, $room, $token);
        } catch (\Throwable $e) {
            report($e);
        }

        $now = now();

        // Встречи этого зала: сегодня + occurrence'ы повторяющихся серий
        // (та же логика занятости, что в RoomController::allAvailability).
        $meetings = Meeting::query()
            ->where('room', $room->name)
            ->whereIn('status', ['scheduled', 'in-progress'])
            ->whereDate('date', '>=', $now->toDateString())
            ->whereDate('date', '<=', $now->copy()->addDays(7)->toDateString())
            ->get(['id', 'title', 'date', 'start_time', 'end_time', 'link', 'recurring', 'repeat_until', 'rrule', 'status'])
            ->map(function (Meeting $m) use ($now) {
                // Одна «битая» запись (например, пустое start_time или невалидный rrule)
                // не должна ронять весь экран ТВ с 500 — пропускаем её.
                try {
                    $day = $m->date->toDateString();
                    $startHm = substr((string) $m->start_time, 0, 5);
                    $endRaw = substr((string) $m->end_time, 0, 5);
                    if ($startHm === '' || $endRaw === '') return null;
                    $start = \Carbon\CarbonImmutable::parse($day . ' ' . $startHm);
                    $end = \Carbon\CarbonImmutable::parse($day . ' ' . $endRaw);
                    if ($end->lessThan($start)) {
                        $end = $end->addDay(); // встреча через полночь
                    }
                    // Повторяющиеся серии: приводим к ближайшему будущему occurrence.
                    // Если серия уже «происходит» сегодня, но её время вышло —
                    // ищем следующий день серии в горизонте 30 дней.
                    if ($m->recurring !== 'none' && $end->lessThan($now)) {
                        for ($d = 1; $d <= 30; $d++) {
                            $day2 = $now->copy()->addDays($d)->toDateString();
                            if (\App\Services\RecurrenceService::occursOn($m, $day2)) {
                                $start = \Carbon\CarbonImmutable::parse($day2 . ' ' . $startHm);
                                $end = \Carbon\CarbonImmutable::parse($day2 . ' ' . $endRaw);
                                break;
                            }
                        }
                    }
                    return [
                        'id' => $m->id,
                        'title' => $m->title,
                        'start' => $start->toIso8601String(),
                        'end' => $end->toIso8601String(),
                        'join_url' => '/api/m/' . $m->id, // «вечная» ссылка — всегда ведёт на актуальную комнату
                        'live' => $start->lessThanOrEqualTo($now) && $end->greaterThan($now),
                    ];
                } catch (\Throwable $e) {
                    report($e);
                    return null;
                }
            })
            ->filter()
            ->filter(fn ($row) => \Carbon\CarbonImmutable::parse($row['end'])->greaterThan($now))
            ->sortBy('start')
            ->take(10)
            ->values();

        return response()->json([
            'room' => ['id' => $room->id, 'name' => $room->name, 'capacity' => $room->capacity],
            'server_time' => $now->toIso8601String(),
            'next' => $meetings->first(),
            'upcoming' => $meetings,
        ]);
    }

    /**
     * Upsert записи журнала посещаемости. Скольжение по времени: если
     * последний апдейт был < минуты назад — только инкремент счётчика в
     * кэше (без UPDATE строки). Токен храним только как sha256-хэш.
     */
    private function touchViewLog(Request $request, Room $room, string $token): void
    {
        $screenId = mb_substr((string) $request->query('screen', ''), 0, 64) ?: null;
        $hash = hash('sha256', $token);

        // Дедупликация записи через кэш (key ≤ 60 с), чтобы поллинг раз в
        // 10 с не писал БД каждые 10 секунд.
        $gateKey = 'tvview_gate_' . $room->id . '_' . substr($hash, 0, 16) . '_' . ($screenId ?? 'x');
        if (cache()->get($gateKey)) {
            return;
        }
        cache()->put($gateKey, 1, now()->addSeconds(55));

        $match = [
            'room_id'    => $room->id,
            'token_hash' => $hash,
            'screen_id'  => $screenId,
        ];
        $row = \App\Models\TvViewLog::firstOrNew($match);
        $isNew = !$row->exists;
        $row->ip = $request->ip();
        $row->ua = mb_substr((string) $request->userAgent(), 0, 200);
        $row->last_seen_at = now();
        if ($isNew) {
            $row->first_seen_at = now();
            $row->polls = 1;
        } else {
            // Атомарный инкремент счётчика опросов вместо read-modify-write.
            $row->increment('polls');
        }
        $row->save();
    }
}
