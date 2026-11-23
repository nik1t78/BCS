<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Console\Command as ConsoleCommand;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;

class FailedJobController extends Controller
{
    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->isAdmin(), 403, 'Доступ запрещён');
    }

    /**
     * Список неудачных задач. Payload не отдаём: он может содержать
     * сериализованные данные встреч, пользователей или секреты интеграций.
     */
    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        try {
            $jobs = DB::table('failed_jobs')
                ->select(['id', 'uuid', 'connection', 'queue', 'exception', 'failed_at'])
                ->orderByDesc('failed_at')
                ->paginate($validated['per_page'] ?? 25);
        } catch (QueryException $e) {
            return response()->json([
                'message' => 'Хранилище ошибок очереди недоступно. Проверьте таблицу failed_jobs.',
            ], 503);
        }

        $jobs->getCollection()->transform(function ($job) {
            return [
                'id' => $job->id,
                'uuid' => $job->uuid,
                'connection' => $job->connection,
                'queue' => $job->queue,
                'failed_at' => $job->failed_at,
                'exception_summary' => \App\Support\FailedJobPolicy::summarizeException((string) $job->exception),
            ];
        });

        return response()->json($jobs);
    }

    /**
     * Повторить одну задачу штатным Laravel failed-job provider.
     */
    public function retry(Request $request, int $id)
    {
        $this->authorizeAdmin($request);

        try {
            $failedJob = DB::table('failed_jobs')->where('id', $id)->first();
        } catch (QueryException $e) {
            return response()->json(['message' => 'Хранилище ошибок очереди недоступно.'], 503);
        }

        if (!$failedJob) {
            return response()->json(['message' => 'Неудачная задача не найдена.'], 404);
        }

        try {
            $exitCode = Artisan::call('queue:retry', ['id' => $failedJob->uuid]);
            if ($exitCode !== 0) {
                return response()->json([
                    'message' => 'Laravel не смог вернуть задачу в очередь. Проверьте подключение очереди и логи.',
                ], 503);
            }
        } catch (\Throwable $e) {
            report($e);
            return response()->json([
                'message' => 'Не удалось повторно поставить задачу в очередь. Проверьте состояние queue worker.',
            ], 503);
        }

        AuditLog::log($request, 'failed_job_retried', null, [
            'failed_job_id' => $failedJob->id,
            'queue' => $failedJob->queue,
        ]);

        return response()->json(['message' => 'Задача возвращена в очередь на повторное выполнение.']);
    }

    /**
     * Удалить только запись об ошибке. Исходный payload не исполняется.
     */
    public function destroy(Request $request, int $id)
    {
        $this->authorizeAdmin($request);

        try {
            $failedJob = DB::table('failed_jobs')->where('id', $id)->first();
            if (!$failedJob) {
                return response()->json(['message' => 'Неудачная задача не найдена.'], 404);
            }

            DB::table('failed_jobs')->where('id', $id)->delete();
        } catch (QueryException $e) {
            return response()->json(['message' => 'Не удалось удалить запись ошибки очереди.'], 503);
        }

        AuditLog::log($request, 'failed_job_deleted', null, [
            'failed_job_id' => $failedJob->id,
            'queue' => $failedJob->queue,
        ]);

        return response()->json(['message' => 'Запись об ошибке удалена.']);
    }

}
