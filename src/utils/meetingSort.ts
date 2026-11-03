import { Meeting } from "../types";
import { guessServerTodayKey, serverNowDate } from "../api/client";
export type SortMode = "smart" | "soonest" | "latest" | "title" | "newest";
export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "smart", label: "Умная сортировка (сначала сегодняшние)" },
  { value: "soonest", label: "Сначала ближайшие" },
  { value: "latest", label: "Сначала поздние" },
  { value: "title", label: "По названию (А–Я)" },
  { value: "newest", label: "По дате создания" },
];
const toDateTime = (m: Meeting) => `${m.date}T${m.startTime || "00:00"}:00`;
/** Группа встречи для «умной» сортировки */
export function getMeetingGroup(m: Meeting): { key: string; label: string } {
  if (m.status === "completed" || m.status === "cancelled") {
    return { key: "past", label: "Прошедшие и отменённые" };
  }
  // ВАЖНО: локальные ключи дат, НЕ toISOString(): при TZ=UTC+... evening
  // toISOString().slice(0,10) возвращает «вчера» — встречи попадали не в ту
  // группу («Сегодня»/«Завтра»), дата отображалась на день раньше.
  // «Сегодня/Завтра» считаем по СЕРВЕРНЫМ часам (offset+TZ из /api/time, см.
  // src/api/client.ts): при сбитых часах/дате на компьютере пользователя встреча
  // на 30-е попадала в группу «29-го» и наоборот («неправильная дата в
  // Расписании»). guessServerTodayKey() использует offset из localStorage,
  // поэтому корректна и сразу после перезагрузки страницы, до первого /api/time.
  const serverNow = serverNowDate();
  const serverToday = guessServerTodayKey();
  // «Завтра» на сервере = сегодня(сервер) + 1 день, вычисляется от абсолютного
  // момента времени: сутки берём по поясу сервера через Intl (en-CA даёт YYYY-MM-DD).
  const tomorrowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(serverNow.getTime() + 86_400_000));
  const tp = (t: string) => tomorrowParts.find((p) => p.type === t)?.value ?? "00";
  const tomorrowServer = `${tp("year")}-${tp("month")}-${tp("day")}`;
  // нижняя граница «ближайшей недели» — тоже от серверного момента,
  // ключ даты собираем вручную из компонентов (без TZ-сдвига toISOString)
  const weekEndKey = (() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(serverNow.getTime() + 7 * 86_400_000));
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return `${g("year")}-${g("month")}-${g("day")}`;
  })();
  const dt = toDateTime(m);
  const nowStr = `${serverToday}T${String(serverNow.getHours()).padStart(2, "0")}:${String(serverNow.getMinutes()).padStart(2, "0")}`;
  if (dt.slice(0, 10) === serverToday) return { key: "today", label: "Сегодня" };
  if (dt.slice(0, 10) === tomorrowServer) return { key: "tomorrow", label: "Завтра" };
  if (dt.slice(0, 10) <= weekEndKey) return { key: "week", label: "Ближайшая неделя" };
  if (dt < nowStr) return { key: "overdue", label: "Без точной даты" };
  return { key: "later", label: "Позже" };
}
const GROUP_ORDER = ["today", "tomorrow", "week", "later", "overdue", "past"];
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
