import { Meeting } from "../types";

/** «Сегодня» по локальным часам устройства в виде YYYY-MM-DD.
 *  НЕ через toISOString(): UTC может сдвинуть дату на сутки назад/вперёд,
 *  из-за чего сегодняшняя встреча попадала в группу «Завтра», а вчерашняя —
 *  осталась в «Сегодня» (на странице «Мои конференции» всё отображалось не так). */
const localDayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export type SortMode = "smart" | "soonest" | "latest" | "title" | "newest";

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "smart", label: "Умная сортировка (сначала сегодняшние)" },
  { value: "soonest", label: "Сначала ближайшие" },
  { value: "latest", label: "Сначала поздние" },
  { value: "title", label: "По названию (А–Я)" },
  { value: "newest", label: "По дате создания" },
];

const toDateTime = (m: Meeting) => `${m.date}T${m.startTime || "00:00"}:00`;

/** Группа встречи для «умной» сортировки.
 *  todayKey — «сегодня» в том же поясе, что и даты встреч с бэкенда
 *  (для раздела «Мои конференции» передаётся серверная дата, см. serverTodayKeyTz).
 *  Если не передан — локальные сутки устройства. Раньше функция всегда считала
 *  «сегодня» через toISOString() (UTC), из-за чего на странице «Мои конференции»
 *  сегодняшние встречи попадали в «Завтра», а прошедшие — в «Сегодня». */
export function getMeetingGroup(m: Meeting, todayKey?: string): { key: string; label: string } {
  if (m.status === "completed" || m.status === "cancelled") {
    return { key: "past", label: "Прошедшие и отменённые" };
  }
  const shiftDay = (key: string, days: number) => {
    const d = new Date(`${key}T00:00:00`);
    d.setDate(d.getDate() + days);
    return localDayKey(d);
  };
  const today = new Date();
  const todayStr = todayKey || localDayKey(today);
  // ВАЖНО: «сегодня/завтра/неделя» считаем от todayStr (для «Мои конференции»
  // это серверная дата), а НЕ через toISOString(): в UTC «сегодня» сдвигалось
  // на сутки и сегодняшние встречи попадали в «Завтра»/«Ближайшая неделя».
  const dt = toDateTime(m);
  const nowStr = `${todayStr}T${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
  if (dt.slice(0, 10) === todayStr) return { key: "today", label: "Сегодня" };
  if (dt.slice(0, 10) === shiftDay(todayStr, 1)) return { key: "tomorrow", label: "Завтра" };
  if (dt.slice(0, 10) <= shiftDay(todayStr, 7)) return { key: "week", label: "Ближайшая неделя" };
  if (dt < nowStr) return { key: "overdue", label: "Без точной даты" };
  return { key: "later", label: "Позже" };
}

const GROUP_ORDER = ["today", "tomorrow", "week", "later", "overdue", "past"];

function compareBy(mode: SortMode, a: Meeting, b: Meeting, todayKey?: string): number {
  switch (mode) {
    case "soonest":
      return toDateTime(a).localeCompare(toDateTime(b));
    case "latest":
      return toDateTime(b).localeCompare(toDateTime(a));
    case "title":
      return a.title.localeCompare(b.title, "ru");
    case "newest":
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    case "smart":
    default: {
      const ga = GROUP_ORDER.indexOf(getMeetingGroup(a, todayKey).key);
      const gb = GROUP_ORDER.indexOf(getMeetingGroup(b, todayKey).key);
      if (ga !== gb) return ga - gb;
      // внутри группы — по времени; в прошедших — наоборот (сначала недавние)
      const da = toDateTime(a),
        db = toDateTime(b);
      return getMeetingGroup(a, todayKey).key === "past" ? db.localeCompare(da) : da.localeCompare(db);
    }
  }
}

export function sortMeetings(list: Meeting[], mode: SortMode, todayKey?: string): Meeting[] {
  return [...list].sort((a, b) => compareBy(mode, a, b, todayKey));
}
