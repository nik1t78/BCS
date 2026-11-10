import { Meeting } from "../types";
import { serverNowStr, serverTodayKey, serverTomorrowKey, serverPlusDaysKey } from "../api/serverTime";

export type SortMode = "smart" | "soonest" | "latest" | "title" | "newest";
export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "smart", label: "Умная сортировка (сначала сегодняшние)" },
  { value: "soonest", label: "Сначала ближайшие" },
  { value: "latest", label: "Сначала поздние" },
  { value: "title", label: "По названию (А–Я)" },
  { value: "newest", label: "По дате создания" },
];

/** Встреча как строка "YYYY-MM-DDTHH:mm:ss" — в том же формате сервер хранит
 *  date/startTime, поэтому сравнения идут обычным лексикографическим < / ===. */
const toDateTime = (m: Meeting) => `${m.date}T${m.startTime || "00:00"}:00`;

/** Группа встречи для «умной» сортировки. Вся логика — три строки:
 *  «сейчас», «сегодня», «завтра» берутся с СЕРВЕРА (см. src/api/serverTime.ts),
 *  поэтому расхождение часов/пояса браузера не может уронить свежую встречу в
 *  «Прошедшие» или показать вчерашнюю дату как сегодняшнюю. */
export function getMeetingGroup(m: Meeting): { key: string; label: string } {
  if (m.status === "completed" || m.status === "cancelled") {
    return { key: "past", label: "Прошедшие и отменённые" };
  }
  const nowStr = serverNowStr(); // "2026-11-03T13:45" по часам сервера
  // Встреча уже закончилась (или дата прошла) — всегда «Прошедшие», даже если
  // планировщик ещё не проставил статус completed.
  const endStr = `${m.date}T${m.endTime || m.startTime || "23:59"}`;
  if (endStr < nowStr) return { key: "past", label: "Прошедшие и отменённые" };
  const day = m.date;
  if (day === serverTodayKey()) return { key: "today", label: "Сегодня" };
  if (day === serverTomorrowKey()) return { key: "tomorrow", label: "Завтра" };
  if (day <= serverPlusDaysKey(7)) return { key: "week", label: "Ближайшая неделя" };
  return { key: "later", label: "Позже" };
}

const GROUP_ORDER = ["today", "tomorrow", "week", "later", "past"];

function compareBy(mode: SortMode, a: Meeting, b: Meeting): number {
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
      const ga = GROUP_ORDER.indexOf(getMeetingGroup(a).key);
      const gb = GROUP_ORDER.indexOf(getMeetingGroup(b).key);
      if (ga !== gb) return ga - gb;
      // внутри группы — по времени; в прошедших — наоборот (сначала недавние)
      const da = toDateTime(a),
        db = toDateTime(b);
      return getMeetingGroup(a).key === "past" ? db.localeCompare(da) : da.localeCompare(db);
    }
  }
}

export function sortMeetings(list: Meeting[], mode: SortMode): Meeting[] {
  return [...list].sort((a, b) => compareBy(mode, a, b));
}
