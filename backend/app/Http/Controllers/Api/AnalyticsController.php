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
}
