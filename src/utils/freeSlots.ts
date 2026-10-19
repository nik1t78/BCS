// Расчёт свободных интервалов переговорных комнат «до конца рабочего дня».
// Используется виджетом «Свободные залы» на главной: по каждому залу
// строится timeline занятости, вырезаются уже прошедшие отрезки (для
// сегодняшнего дня) и возвращаются ближайшие свободные окна.

// Рабочий день 08:00–20:00 — совпадает с серверной логикой
// /rooms/{id}/availability и /meetings/rooms-availability, чтобы подпись
// диапазона в виджете «Свободные залы» не расходилась со свободными слотами.
// Полная шкала дня 00:00–24:00 (по ТЗ). Серверный агрегированный эндпоинт
// /meetings/rooms-availability исторически считает «рабочий день» 08:00–20:00,
// но занятость (busy) приходит абсолютная — клиент пересчитывает свободные
// слоты сам через computeFreeSlots, поэтому расширение шкалы безопасно.
export const WORK_DAY_START_MIN = 0; // 00:00
// Поздним вечером создавать ВКС нельзя — верхняя граница 20:00.
export const WORK_DAY_END_MIN = 20 * 60; // 20:00
/** Максимальное время начала встречи (включительно) */
export const LATE_CREATE_LIMIT_HM = "20:00";
/** Проверка: строка HH:mm позже 20:00 → создание запрещено */
export function isLateTime(hm: string): boolean {
  return hmToMin(hm || "00:00") > hmToMin(LATE_CREATE_LIMIT_HM);
}
export const MIN_SLOT_MIN = 30; // окна короче 30 минут не показываем

/** "HH:MM" → минуты с полуночи */
export function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** минуты → "HH:MM" */
export function minToHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Длительность в минутах → человекочитаемо: "1 ч", "30 мин", "1 ч 30 мин" */
export function humanDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

export interface FreeSlot {
  startMin: number;
  endMin: number;
  /** Длительность в минутах */
  lengthMin: number;
  /** true — окно начинается в прошлом (сегодня до «сейчас»). Бронировать нельзя! */
  isPast?: boolean;
}

/**
 * Из списка занятых интервалов (строки ISO или HH:MM) получить свободные окна
 * в пределах рабочего дня. Для todayFrom — обрезаем всё, что уже прошло.
 */
export function computeFreeSlots(
  busy: { start: string; end: string }[],
  opts: { isToday: boolean; nowMin: number }
): FreeSlot[] {
  // Нормализуем занятые интервалы к минутам дня
  const toMin = (s: string): number => {
    if (/^\d{1,2}:\d{2}$/.test(s)) return hmToMin(s);
    const d = new Date(s);
    return d.getHours() * 60 + d.getMinutes();
  };
  const ranges = busy
    .map((b) => ({ s: toMin(b.start), e: toMin(b.end) }))
    .filter((r) => r.e > r.s)
    .sort((a, b) => a.s - b.s);

  // Шкала строится от начала рабочего дня — прошедшие окна тоже видны,
  // но помечены isPast и забронировать их нельзя (как в Outlook).
  let from = WORK_DAY_START_MIN;
  const to = WORK_DAY_END_MIN;
  const pastLimit = opts.isToday ? opts.nowMin : WORK_DAY_START_MIN;
  if (to <= from) return [];

  const slots: FreeSlot[] = [];
  let cursor = from;
  for (const r of ranges) {
    if (r.e <= cursor) continue;
    if (r.s >= to) break;
    if (r.s > cursor) {
      slots.push({ startMin: cursor, endMin: Math.min(r.s, to), lengthMin: 0 } as FreeSlot);
    }
    cursor = Math.max(cursor, r.e);
    if (cursor >= to) break;
  }
  if (cursor < to) slots.push({ startMin: cursor, endMin: to, lengthMin: 0 } as FreeSlot);

  return slots
    .map((s) => ({
      ...s,
      lengthMin: s.endMin - s.startMin,
      isPast: s.startMin < pastLimit,
    }))
    .filter((s) => s.lengthMin >= MIN_SLOT_MIN);
}
