<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BotLog;
use Illuminate\Http\Request;

/**
 * Дневник работы ВКС-бота (пункт 6 плана).
 * Пишется из CreateVksLinkJob и vks:autopilot; читается отсюда — страница
 * /admin/bot-log с фильтрами «за сегодня / с ошибками».
 */
class BotLogController extends Controller
{
    /**
     * GET /api/admin/bot-log?today=1&errors=1&meeting_id=N&per_page=50&page=1
     */
    public function index(Request $request)
    {
        $query = BotLog::query()->latest()->latest('id');

        if (filter_var($request->query('today'), FILTER_VALIDATE_BOOLEAN)) {
            $query->whereDate('created_at', now()->toDateString());
        }

        if (filter_var($request->query('errors'), FILTER_VALIDATE_BOOLEAN)) {
            $query->where('success', false);
        }

        if ($request->filled('meeting_id')) {
            $query->where('meeting_id', (int) $request->query('meeting_id'));
        }

        if ($request->filled('action')) {
            $query->where('action', $request->query('action'));
        }

        $perPage = min(max((int) $request->query('per_page', 50), 10), 200);

        return $query->paginate($perPage);
    }

    /**
     * SLA-метрики (пункт 7 плана): считаются из bot_log за период (по умолчанию 7 дней).
     * GET /api/admin/bot-log/stats?days=7
     */
    public function stats(Request $request)
    {
        $days = min(max((int) $request->query('days', 7), 1), 90);
        $since = now()->subDays($days);

        $base = BotLog::query()->where('created_at', '>=', $since);

        $total = (clone $base)->count();
        $success = (clone $base)->where('success', true)->count();

        // Среднее время создания живой ссылки (только успешные create-попытки)
        $avgMs = (clone $base)
            ->where('success', true)
            ->where('action', 'create')
            ->avg('duration_ms');

        // Ручные вмешательства: пересоздания по кнопке/команде (не cron/queue)
        $manual = (clone $base)
            ->where('trigger', 'manual')
            ->count();

        // Топ причин ошибок
        $topErrors = (clone $base)
            ->where('success', false)
            ->whereNotNull('error')
            ->selectRaw('LEFT(error, 120) as reason, COUNT(*) as cnt')
            ->groupBy('reason')
            ->orderByDesc('cnt')
            ->limit(5)
            ->get();

        return [
            'period_days' => $days,
            'total_attempts' => $total,
            'successful' => $success,
            'success_rate' => $total > 0 ? round($success / $total * 100, 1) : null,
            'avg_duration_ms' => $avgMs !== null ? (int) round($avgMs) : null,
            'manual_interventions' => $manual,
            'top_errors' => $topErrors,
        ];
    }
}
