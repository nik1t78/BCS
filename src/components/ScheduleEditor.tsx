import { useState } from "react";
import {
  DAY_KEYS,
  DAY_LABELS,
  normalizeSchedule,
  type RoomSchedule,
} from "../utils/roomSchedule";

/**
 * Редактор гибкого графика зала: рабочие часы по дням недели + нерабочие дни
 * (праздники). Пишет объект вида { days: {...}, closed: [...] } — тот же формат,
 * что хранится в rooms.schedule на бэкенде (App\Models\Room::normalizeSchedule).
 */
export default function ScheduleEditor({
  value,
  onChange,
}: {
  /** null/undefined — график не задан (используется дефолт пн–пт 08:00–20:00) */
  value?: RoomSchedule | null;
  onChange: (sch: RoomSchedule | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const sch = normalizeSchedule(value ?? null);
  const isDefault = !value;

  const setDay = (key: string, hours: { start: string; end: string } | null) => {
    const next = normalizeSchedule({ ...sch, days: { ...sch.days, [key]: hours } });
    onChange(next);
  };

  const addClosed = (dateKey: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    const next = normalizeSchedule({ ...sch, closed: Array.from(new Set([...sch.closed, dateKey])).sort() });
    onChange(next);
  };

  const removeClosed = (dateKey: string) => {
    const next = normalizeSchedule({ ...sch, closed: sch.closed.filter((c) => c !== dateKey) });
    onChange(next);
  };

  return (
    <div className="sm:col-span-5 text-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <i className="fas fa-business-time mr-1.5 text-blue-500"></i>
        График работы {isDefault ? "(по умолчанию)" : `— ${sch.closed.length ? `${sch.closed.length} нераб. дн.` : "по дням недели"}`}
        <i className={`fas fa-chevron-${open ? "up" : "down"} ml-2 text-xs`}></i>
      </button>

      {open && (
        <div className="mt-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 space-y-3">
          {/* Часы по дням недели */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {DAY_KEYS.map((k) => {
              const h = sch.days[k];
              return (
                <label key={k} className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-300">
                  <span className="font-semibold">{DAY_LABELS[k]}</span>
                  <input
                    type="time"
                    value={h?.start ?? "08:00"}
                    disabled={!h}
                    onChange={(e) => setDay(k, { start: e.target.value, end: sch.days[k]?.end ?? "20:00" })}
                    className="px-1.5 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 disabled:opacity-40"
                  />
                  <input
                    type="time"
                    value={h?.end ?? "20:00"}
                    disabled={!h}
                    onChange={(e) => setDay(k, { start: sch.days[k]?.start ?? "08:00", end: e.target.value })}
                    className="px-1.5 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 disabled:opacity-40"
                  />
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!h}
                      onChange={(e) => setDay(k, e.target.checked ? { start: "08:00", end: "20:00" } : null)}
                    />
                    рабочий
                  </label>
                </label>
              );
            })}
          </div>

          {/* Нерабочие дни (праздники) */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Нерабочие дни (праздники):</span>
              <input
                type="date"
                className="px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600"
                onChange={(e) => {
                  if (e.target.value) {
                    addClosed(e.target.value);
                    e.target.value = "";
                  }
                }}
              />
            </div>
            {sch.closed.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {sch.closed.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => removeClosed(c)}
                    title="Убрать из нерабочих дней"
                    className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800"
                  >
                    {c} <i className="fas fa-times ml-1"></i>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center text-xs text-gray-400">
            <span>Зал доступен для бронирования только внутри рабочих часов выбранного дня.</span>
            <button
              type="button"
              onClick={() => onChange(null)} // null = сбросить на дефолт (пн–пт 08:00–20:00)
              className="text-blue-600 hover:underline"
            >
              Сбросить к стандартному
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
