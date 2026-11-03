import { Meeting } from "../types";
import { getServerTimezone, serverNowDate, serverNowHmTz, serverTodayKeyTz } from "../api/client";

/** Абсолютный «серверный сейчас» в виде "YYYY-MM-DDTHH:MM" ПО ЯВНОСТИ — для
 *  честного сравнения с `${date}T${time}` встреч (both are wall-clock strings). */
export function serverNowDateTimeStr(): string {
  return `${serverTodayKeyTz()}T${serverNowHmTz()}`;
}
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
  // Расписании»).
  const serverNow = serverNowDate();
  // «Сегодня» на сервере — через Intl В ПОЯСЕ СЕРВЕРА (serverTodayKeyTz), а не
  // guessServerTodayKey(): последний берёт локальную дату браузера + offset из
  // последней синхронизации. При поясе браузера ≠ пояс сервера (например, браузер
  // в UTC, сервер Europe/Moscow после 21:00 MSK) это давало расхождение на сутки:
  // сегодняшняя встреча определялась как «прошлая» и падала в группу
  // «Прошедшие и отменённые» («фронт выдал 02.11 как прошедшее, хотя сегодня 03.11»).
  const serverToday = serverTodayKeyTz();
  // «Завтра» на сервере = сегодня(сервер) + 1 день, вычисляется от абсолютного
  // момента времени: сутки берём по поясу сервера через Intl (en-CA даёт YYYY-MM-DD).
  const tzName = getServerTimezone();
  const tomorrowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tzName,
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
      timeZone: tzName,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(serverNow.getTime() + 7 * 86_400_000));
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return `${g("year")}-${g("month")}-${g("day")}`;
  })();
  const dt = toDateTime(m);
  // Абсолютный серверный «сейчас» (дата+время по поясу сервера). Раньше здесь
  // был баг: строка now собиралась как `${serverToday}T${serverNow.getHours()}`
  // — дата бралась ПО ЯВНОСТИ СЕРВЕРА, а часы через getHours() — В ПОЯСЕ
  // БРАУЗЕРА. При TZ=UTC и сервере Europe/Moscow получалось, например,
  // «2026-11-03T09:00» вместо реальных «12:00»: встречи позже этого момента
  // ошибочно уходили в «Без точной даты», а дата на карточке выглядела так,
  // будто она уже прошла. Берём serverNowHmTz() (Intl по поясу сервера).
  const nowStr = `${serverToday}T${serverNowHmTz()}`;
  // Прошедшие ДАТЫ (встреча закончилась до серверного «сегодня») — всегда в
  // группу «Прошедшие», даже если статус ещё не обновлён планировщиком
  // (meetings:auto-complete крутится каждые 5 минут, и после деплоя/простоя
  // cron'а встречи за 02.11 могли висеть со статусом scheduled): раньше они
  // попадали в «Ближайшая неделя»/«Без точной даты» и фронт показывал их как
  // будущие.
  const endStr = `${m.date}T${m.endTime || m.startTime || "23:59"}`;
  if (endStr.slice(0, 10) < serverToday || endStr < nowStr) {
    return { key: "past", label: "Прошедшие и отменённые" };
  }
  if (dt.slice(0, 10) === serverToday) return { key: "today", label: "Сегодня" };
  if (dt.slice(0, 10) === tomorrowServer) return { key: "tomorrow", label: "Завтра" };
  if (dt.slice(0, 10) <= weekEndKey) return { key: "week", label: "Ближайшая неделя" };
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
