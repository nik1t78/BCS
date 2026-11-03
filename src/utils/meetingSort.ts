import { Meeting } from "../types";
import { serverNowDate, serverTodayKeyTz } from "../api/client";
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
  // ФИКС «дата отображается в прошлом»: границы «Сегодня/Завтра/Неделя»
  // считаем от ВРЕМЕНИ СЕРВЕРА (serverNowDate/serverTodayKeyTz), а не от
  // системных часов браузера. Если часы клиента отстают (или пояс другой),
  // будущая по серверу встреча ошибочно попадала в «Прошедшие». До первой
  // успешной сверки с /api/time serverNowDate() равен локальному времени,
  // поэтому поведение не хуже прежнего; окончательную проверку прошлого
  // делает сервер (422 с подсказкой echo_client_today).
  const localNow = serverNowDate();
  const localToday = serverTodayKeyTz();
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const tomorrowLocal = (() => {
    const d = serverNowDate();
    d.setDate(d.getDate() + 1);
    return dayKey(d);
  })();
  const weekEndKey = (() => {
    const d = serverNowDate();
    d.setDate(d.getDate() + 7);
    return dayKey(d);
  })();
  const dt = toDateTime(m);
  const nowStr = `${localToday}T${String(localNow.getHours()).padStart(2, "0")}:${String(localNow.getMinutes()).padStart(2, "0")}`;
  if (dt.slice(0, 10) === localToday) return { key: "today", label: "Сегодня" };
  if (dt.slice(0, 10) === tomorrowLocal) return { key: "tomorrow", label: "Завтра" };
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
