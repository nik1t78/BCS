<?php

namespace App\Http\Controllers\Api;

use App\Console\Commands\MonitorSystem;
use App\Http\Controllers\Controller;
use App\Models\BotLog;
use App\Models\TvViewLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Страница «Статус системы» (админка → вкладка «Статус»).
 * GET /api/admin/system-status  (только admin)
 *
 * Даёт админу живую картину без доступа к docker compose ps:
 *  - uptime PHP-процесса, время сервера и пояс;
 *  - MySQL — пинг + размер базы; Redis/кэш — драйвер и пинг;
 *  - queue-worker по heartbeat (см. MonitorSystem), глубина очередей
 *    (jobs / failed_jobs);
 *  - ВКС-бот: последние 10 записей дневника + успешность за сутки;
 *  - экраны ТВ: список залов с активными за 15 минут экранами.
 */
class SystemStatusController extends Controller
{
    public function show(Request $request)
    {
        $out = [
            'server_time' => now()->toIso8601String(),
            'timezone'    => config('app.timezone'),
            'php' => [
                'version' => PHP_VERSION,
                'uptime_s' => $this->phpUptimeSeconds(),
            ],
            'services' => [],
        ];

        // MySQL
        try {
            DB::select('SELECT 1');
            $dbSize = DB::selectOne(
                'SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS mb
                   FROM information_schema.tables WHERE table_schema = DATABASE()'
            );
            $out['services']['mysql'] = ['ok' => true, 'size_mb' => $dbSize->mb ?? null];
        } catch (\Throwable $e) {
            $out['services']['mysql'] = ['ok' => false, 'error' => mb_substr($e->getMessage(), 0, 160)];
        }

        // Кэш/Redis
        $cacheDriver = config('cache.default');
        try {
            if ($cacheDriver === 'redis') {
                app('redis')->connection()->ping();
            }
            $out['services']['cache'] = ['ok' => true, 'driver' => $cacheDriver];
        } catch (\Throwable $e) {
            $out['services']['cache'] = ['ok' => false, 'driver' => $cacheDriver, 'error' => mb_substr($e->getMessage(), 0, 160)];
        }

        // Очереди: heartbeat воркера + глубина
        $hb = cache()->get(MonitorSystem::QUEUE_HEARTBEAT_KEY);
        $hbAge = is_numeric($hb) ? now()->getTimestamp() - (int) $hb : null;
        $out['services']['queue_worker'] = [
            'ok' => $hbAge !== null && $hbAge <= max(60, (int) env('QUEUE_HEARTBEAT_MAX_AGE', 180)),
            'heartbeat_age_s' => $hbAge,
        ];
        try {
            $out['services']['queue'] = [
                'ok' => true,
                'pending' => DB::table('jobs')->count(),
                'failed_24h' => DB::table('failed_jobs')->where('failed_at', '>=', now()->subDay())->count(),
            ];
        } catch (\Throwable $e) {
            $out['services']['queue'] = ['ok' => false, 'error' => mb_substr($e->getMessage(), 0, 160)];
        }

        // Планировщик (контейнер scheduler): признак — свежий heartbeat < 2 мин
        $out['services']['scheduler'] = ['ok' => $hbAge !== null && $hbAge <= 120];

        // ВКС-бот: сутки + последние события
        $since = now()->subDay();
        $total = BotLog::where('created_at', '>=', $since)->count();
        $okCnt = BotLog::where('created_at', '>=', $since)->where('success', true)->count();
        $out['vks_bot'] = [
            'expected' => filter_var(env('VKSBOT_EXPECTED', false), FILTER_VALIDATE_BOOLEAN),
            'auto' => filter_var(env('VKSBOT_AUTO', true), FILTER_VALIDATE_BOOLEAN),
            'events_24h' => $total,
            'success_rate_24h' => $total > 0 ? round($okCnt / $total * 100, 1) : null,
            'recent' => BotLog::latest()->latest('id')->take(10)
                ->get(['id', 'action', 'trigger', 'success', 'error', 'meeting_id', 'created_at']),
        ];

        // Экраны ТВ, живые за 15 минут
        $out['tv_screens'] = TvViewLog::with('room:id,name')
            ->where('last_seen_at', '>=', now()->subMinutes(15))
            ->orderByDesc('last_seen_at')
            ->get(['id', 'room_id', 'screen_id', 'ip', 'first_seen_at', 'last_seen_at', 'polls'])
            ->map(fn ($r) => [
                'room' => $r->room?->name ?? ('зал #' . $r->room_id),
                'screen_id' => $r->screen_id,
                'ip' => $r->ip,
                'since' => optional($r->first_seen_at)->toIso8601String(),
                'last_seen' => optional($r->last_seen_at)->toIso8601String(),
                'polls' => $r->polls,
            ]);

        return response()->json($out);
    }

    /**
     * Журнал посещаемости экранов ТВ: GET /api/admin/tv-views?days=7&page=1
     * История сессий (зал, ip, когда подключился/последний сигнал, длительность).
     */
    public function tvViews(Request $request)
    {
        $days = min(max((int) $request->query('days', 7), 1), 90);
        $perPage = min(max((int) $request->query('per_page', 50), 10), 200);

        $rows = TvViewLog::with('room:id,name')
            ->where('last_seen_at', '>=', now()->subDays($days))
            ->orderByDesc('last_seen_at')
            ->paginate($perPage);

        $rows->getCollection()->transform(function (TvViewLog $r) {
            $mins = ($r->first_seen_at && $r->last_seen_at)
                ? max(1, (int) round($r->last_seen_at->diffInMinutes($r->first_seen_at)))
                : null;
            return [
                'id' => $r->id,
                'room' => $r->room?->name ?? ('зал #' . $r->room_id),
                'screen_id' => $r->screen_id,
                'ip' => $r->ip,
                'ua' => $r->ua,
                'first_seen' => optional($r->first_seen_at)->toIso8601String(),
                'last_seen' => optional($r->last_seen_at)->toIso8601String(),
                'online' => $r->last_seen_at && $r->last_seen_at->gte(now()->subMinutes(2)),
                'duration_min' => $mins,
                'polls' => $r->polls,
            ];
        });

        return $rows;
    }

    /** Uptime контейнера (сек) из /proc/uptime — process uptime как прокси. */
    private function phpUptimeSeconds(): ?int
    {
        try {
            $up = @file_get_contents('/proc/uptime');
            if ($up !== false) {
                return (int) trim(explode(' ', $up)[0]);
            }
        } catch (\Throwable) {
            // best-effort
        }
        return null;
    }
}
