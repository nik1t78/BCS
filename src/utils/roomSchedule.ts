// Гибкий график залов: рабочие часы по дням недели + нерабочие дни (праздники).
// Формат совпадает с серверным rooms.schedule (см. App\Models\Room::normalizeSchedule):
//   { days: { mon:{start,end}|null, ... sun }, closed: ["YYYY-MM-DD", ...] }
// null-график у зала = дефолт: пн–пт 08:00–20:00, сб/вс выходной.

export interface DayHours { start: string; end: string } // "HH:MM"
export interface RoomSchedule {
  days: Record<string, DayHours | null>;
  closed: string[]; // ISO-даты (праздники / сантехника и т.п.)
}

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const DAY_LABELS: Record<string, string> = {
  mon: "Пн", tue: "Вт", wed: "Ср", thu: "Чт", fri: "Пт", sat: "Сб", sun: "Вс",
};

/** Ключ даты YYYY-MM-DD → ключ дня недели mon..sun (ISO: 1=пн) */
export function dayKeyOfDate(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`); // полдень — чтобы TZ не сдвигал дату
  const iso = d.getDay() === 0 ? 7 : d.getDay(); // 0(вс)→7
  return DAY_KEYS[iso - 1];
}

export function defaultSchedule(): RoomSchedule {
  const days: Record<string, DayHours | null> = {};
  for (const k of DAY_KEYS) days[k] = k === "sat" || k === "sun" ? null : { start: "08:00", end: "20:00" };
  return { days, closed: [] };
}

/** Нормализация: доливает отсутствующие дни/поля из дефолта, чистит closed. */
export function normalizeSchedule(raw?: Partial<RoomSchedule> | null): RoomSchedule {
  const def = defaultSchedule();
  const days: Record<string, DayHours | null> = {};
  for (const k of DAY_KEYS) {
    const v = raw?.days?.[k];
    if (v === null) days[k] = null;
    else if (v && /^\d{2}:\d{2}$/.test(v.start) && /^\d{2}:\d{2}$/.test(v.end)) days[k] = { start: v.start, end: v.end };
    else days[k] = def.days[k];
  }
  const closed = (raw?.closed ?? []).filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c));
  return { days, closed: Array.from(new Set(closed)).sort() };
}

/** Рабочие часы зала на дату; null — зал закрыт (выходной день или праздник). */
export function hoursForDate(schedule: RoomSchedule | null | undefined, dateKey: string): DayHours | null {
  const sch = normalizeSchedule(schedule ?? null);
  if (sch.closed.includes(dateKey)) return null;
  return sch.days[dayKeyOfDate(dateKey)] ?? null;
}

/** Дефолтный диапазон шкалы дня для виджетов, если сервер не прислал hours. */
export const FALLBACK_DAY_HOURS: DayHours = { start: "00:00", end: "20:00" };
