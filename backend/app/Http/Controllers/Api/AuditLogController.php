<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * GET /api/admin/audit-logs
     * Доступен только администраторам (роль проверяется middleware can:admin).
     */
    public function index(Request $request)
    {
        $query = AuditLog::with('user:id,name,login,role')
            ->orderBy('created_at', 'desc');

        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->date('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->date('to'));
        }

        return response()->json($query->paginate($request->get('per_page', 50)));
    }

    /**
     * Экспорт аудит-лога в CSV (без пагинации, с учётом текущих фильтров):
     * GET /api/admin/audit-logs/export?format=csv&action=...&from=...&to=...
     */
    public function export(Request $request)
    {
        $query = AuditLog::with('user:id,name,login,role')
            ->orderBy('created_at', 'desc');

        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->date('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->date('to'));
        }

        $callback = function () use ($query) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM для корректной кириллицы в Excel
            fputcsv($out, ['ID', 'Дата', 'Пользователь', 'Роль', 'Действие', 'Объект', 'IP'], ';');
            $query->chunk(500, function ($logs) use ($out) {
                foreach ($logs as $log) {
                    fputcsv($out, [
                        $log->id,
                        $log->created_at?->toDateTimeString(),
                        $log->user?->name ?? '—',
                        $log->user?->role ?? '—',
                        $log->action,
                        trim(($log->auditable_type ?? '') . ' #' . ($log->auditable_id ?? '')),
                        $log->ip_address,
                    ], ';');
                }
            });
            fclose($out);
        };

        return response()->streamDownload($callback, 'audit-log-' . now()->format('Y-m-d-H-i') . '.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
