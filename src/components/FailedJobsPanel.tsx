import { useCallback, useEffect, useState } from "react";
import { failedJobsAPI } from "../api/client";

interface FailedJob {
  id: number;
  uuid: string;
  connection: string;
  queue: string;
  failed_at: string;
  exception_summary: string;
}

export default function FailedJobsPanel() {
  const [jobs, setJobs] = useState<FailedJob[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    try {
      const response = await failedJobsAPI.list(nextPage, 25);
      setJobs(Array.isArray(response?.data) ? response.data : []);
      setPage(Number(response?.current_page ?? nextPage));
      setLastPage(Math.max(1, Number(response?.last_page ?? 1)));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить список ошибок очереди");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const retry = async (job: FailedJob) => {
    if (!confirm(`Вернуть задачу #${job.id} в очередь на повторное выполнение?`)) return;
    setBusyId(job.id);
    try {
      await failedJobsAPI.retry(job.id);
      await load(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось повторить задачу");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (job: FailedJob) => {
    if (!confirm(`Удалить запись об ошибке задачи #${job.id}? Повторного запуска не будет.`)) return;
    setBusyId(job.id);
    try {
      await failedJobsAPI.remove(job.id);
      await load(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить запись ошибки");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">
            <i className="fas fa-triangle-exclamation text-amber-500 mr-2"></i>Ошибки очереди
          </h3>
          <p className="text-xs text-gray-500 mt-1">Задачи, завершившиеся ошибкой. Payload и секретные данные не показываются.</p>
        </div>
        <button
          onClick={() => void load(page)}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50"
        >
          <i className={`fas fa-sync-alt mr-1 ${loading ? "fa-spin" : ""}`}></i>Обновить
        </button>
      </div>

      {error && <p className="px-4 pt-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="p-4 text-sm text-gray-500">Загрузка…</p>
      ) : jobs.length === 0 ? (
        <p className="p-4 text-sm text-gray-500">Неудачных задач нет.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {jobs.map((job) => (
              <article key={job.id} className="p-4 flex flex-col xl:flex-row xl:items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-gray-800 dark:text-gray-100">#{job.id}</span>
                    <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {job.queue || "default"}
                    </span>
                    <span className="text-gray-400">{job.connection}</span>
                    <span className="text-gray-400">
                      {job.failed_at ? new Date(job.failed_at).toLocaleString("ru-RU") : "—"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-200 break-words">{job.exception_summary || "Причина не указана"}</p>
                  <p className="text-[11px] text-gray-400 font-mono break-all">{job.uuid}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => void retry(job)}
                    disabled={busyId !== null}
                    className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {busyId === job.id ? "…" : "Повторить"}
                  </button>
                  <button
                    onClick={() => void remove(job)}
                    disabled={busyId !== null}
                    className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30 disabled:opacity-50"
                  >
                    Удалить
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
            <span>Страница {page} из {lastPage}</span>
            <div className="flex gap-2">
              <button
                onClick={() => void load(page - 1)}
                disabled={page <= 1 || loading}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40"
              >
                Назад
              </button>
              <button
                onClick={() => void load(page + 1)}
                disabled={page >= lastPage || loading}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40"
              >
                Далее
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
