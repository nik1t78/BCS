<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * Тепловая карта загрузки: количество встреч по (день недели x час)
     * за последние N недель. Использует date('w') отфильтрованные PHP-вычисления
     * на уровне приложения — подходит для умеренных объёмов данных.
     */
    public function heatmap(Request $request)
    {
        $weeks = min(max((int) $request->query('weeks', 8), 1), 26);
        $since = now()->subWeeks($weeks)->startOfDay();

        $meetings = Meeting::query()
            ->where('date', '>=', $since->toDateString())
            ->where('status', '!=', 'cancelled')
            ->get(['date', 'start_time', 'end_time']);

        // matrix[dayOfWeek 0..6][hour 8..20] = count
        $matrix = array_fill(0, 7, array_fill(8, 13, 0));
        $total = 0;

        foreach ($meetings as $m) {
            try {
                $d = new \DateTime($m->date);
            } catch (\Exception $e) {
                continue;
            }
            $dow = (int) $d->format('w'); // 0=вс..6=сб
            $startHour = (int) substr((string) $m->start_time, 0, 2);
            $endHour = (int) substr((string) ($m->end_time ?: $m->start_time), 0, 2);
            if ($endHour <= $startHour) {
                $endHour = $startHour + 1;
            }
            for ($h = max($startHour, 8); $h < min($endHour + 1, 21); $h++) {
                $matrix[$dow][$h]++;
                $total++;
            }
        }

        return response()->json([
            'weeks' => $weeks,
            'hours' => range(8, 20),
            // дни в порядке Пн..Вс
            'days' => [1, 2, 3, 4, 5, 6, 0],
            'matrix' => $matrix,
            'total_meetings' => $total,
        ]);
    }

    /**
     * GET /api/admin/load — сводный дашборд нагрузки системы.
     * Встречи по дням, активные пользователи за 7 дней, топ загруженных
     * комнат и почасовая загрузка за последние N недель (по умолчанию 4).
     * Лёгкие SQL-агрегации вместо полной выборки — не грузит память.
     */
    public function load(Request $request)
    {
        $weeks = min(max((int) $request->query('weeks', 4), 1), 26);
        $since = now()->subWeeks($weeks)->toDateString();

        // Встречи по дням (заполненность календаря)
        $byDay = Meeting::query()
            ->selectRaw('date, COUNT(*) as cnt')
            ->where('date', '>=', $since)
            ->where('date', '<=', now()->addWeeks(4)->toDateString())
            ->where('status', '!=', 'cancelled')
            ->groupBy('date')
            ->orderBy('date')
            ->pluck('cnt', 'date');

        // Почасовая загрузка за период
        $byHour = Meeting::query()
            ->selectRaw('SUBSTRING(start_time,1,2) as hr, COUNT(*) as cnt')
            ->where('date', '>=', $since)
            ->where('status', '!=', 'cancelled')
            ->groupBy('hr')
            ->pluck('cnt', 'hr');

        // Топ комнат по числу встреч
        $topRooms = Meeting::query()
            ->selectRaw('room, COUNT(*) as cnt')
            ->where('date', '>=', $since)
            ->whereNotNull('room')
            ->where('room', '!=', '')
            ->where('status', '!=', 'cancelled')
            ->groupBy('room')
            ->orderByDesc('cnt')
            ->limit(5)
            ->pluck('cnt', 'room');

        // Активность пользователей: сколько входов в аудит-логе за 7 дней
        $logins7d = DB::table('audit_logs')
            ->where('action', 'login')
            ->where('created_at', '>=', now()->subDays(7))
            ->distinct('user_id')
            ->count('user_id');

        return response()->json([
            'weeks' => $weeks,
            'since' => $since,
            'meetings_by_day' => $byDay,          // { "2026-10-05": 3, ... }
            'meetings_by_hour' => $byHour,        // { "10": 12, ... }
            'top_rooms' => $topRooms,             // { "Переговорная 1": 8, ... }
            'active_users_7d' => $logins7d,
            'totals' => [
                'upcoming' => Meeting::where('date', '>=', now()->toDateString())
                    ->where('status', 'scheduled')->count(),
                'past_period' => Meeting::where('date', '>=', $since)
                    ->where('date', '<', now()->toDateString())->count(),
                'users_total' => \App\Models\User::where('is_active', true)->count(),
            ],
        ]);
    }
}
