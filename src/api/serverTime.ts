// ===== Единый модуль серверного времени (упрощённая версия) =====
// Идея максимально простая: есть ОДНА функция serverNowStr(), которая всегда
// возвращает «сейчас на сервере» строкой "YYYY-MM-DDTHH:mm" — ровно в том же
// формате, в котором бэкенд хранит встречи (`${m.date}T${m.startTime}`).
// Любые сравнения «прошла/сегодня/завтра» сводятся к сравнению строк.
//
// Как получается честное серверное время:
//  1) GET /api/time отдаёт { server_time: "...+03:00", timezone: "Europe/Moscow" }.
//     Date.parse(server_time) — абсолютный момент; из него меряем ДРЕЙФ часов
//     браузера относительно серверных (offsetSec).
//  2) «Сейчас на сервере» = Date.now() + offsetSec*1000, форматируется через
//     Intl В ПОЯСЕ СЕРВЕРА. Часы и пояс браузера не влияют на результат.
//  3) Offset и таймзона переживают перезагрузку страницы (localStorage),
//     поэтому корректное «серверное сейчас» доступно сразу, до первого запроса.
//  4) Если /api/time НИКОГДА не отвечал на этом устройстве — syncOk=false:
//     «сейчас» равно локальным часам браузера (как было до всех фиксов), а
//     формы по isTimeSynced()==false НЕ делают автоподгонку времени, чтобы не
//     перебить выбор пользователя неверными данными.
//
// Синхронизация: syncServerTime() вызывается при загрузке приложения и раз в
// минуту; TTL 5 минут защищает от лишних запросов; force=true используется
// перед отправкой формы («Создать ВКС»), чтобы проверка прошлого шла по самым
// свежим данным.

import { API_BASE_URL } from "./client";

const OFFSET_KEY = "vks_time_offset_sec"; // смещение серверных часов, секунды
const TZ_KEY = "vks_server_tz";           // таймзона сервера из /api/time
const MAX_OFFSET_SEC = 6 * 3600;          // больше полусуток — явный мусор
const SYNC_TTL_MS = 5 * 60_000;

let offsetSec = 0;
let syncedAt = 0;
let syncInFlight: Promise<void> | null = null;

// Успешная сверка была ХОТЬ РАЗ на этом устройстве? (переживает перезагрузку)
let syncOk = false;
try {
  const raw = localStorage.getItem(OFFSET_KEY);
  if (raw) {
    const v = Number(raw);
    if (Number.isFinite(v) && Math.abs(v) <= MAX_OFFSET_SEC) {
      offsetSec = v;
      syncOk = true;
    }
  }
} catch {
  /* приватный режим */
}

/** Подтверждена ли хоть одна сверка с /api/time (offset актуален). */
export function isTimeSynced(): boolean {
  return syncOk;
}

/** Актуализировать смещение серверных часов. Ошибки проглатывает: при
 *  недоступном /api/time продолжаем по последнему известному offset. */
export async function syncServerTime(force = false): Promise<void> {
  if (!force && Date.now() - syncedAt < SYNC_TTL_MS) return;
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    try {
      const t0 = Date.now();
      // cache-bust + no-store: nginx/браузер не должны отдать протухший ответ
      // (кэш /api/time был реальным источником бага «дата отстала на сутки»).
      const url = `${API_BASE_URL.replace(/\/+$/, "")}/time?_=${t0}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      // Сервер эхом возвращает наш '_'. Не совпал — ответ из кэша, игнорируем.
      if (data?.echo != null && Number(data.echo) !== t0) return;
      const serverMs = Date.parse(String(data?.server_time ?? ""));
      if (Number.isNaN(serverMs)) return;
      const rttHalf = Math.round((Date.now() - t0) / 2);
      const next = Math.round((serverMs + rttHalf - Date.now()) / 1000);
      if (Math.abs(next) > MAX_OFFSET_SEC) return; // подозрительные данные
      offsetSec = next;
      syncedAt = Date.now();
      syncOk = true;
      try {
        localStorage.setItem(OFFSET_KEY, String(offsetSec));
        if (typeof data?.timezone === "string" && data.timezone) {
          localStorage.setItem(TZ_KEY, data.timezone);
        }
      } catch {
        /* приватный режим — не страшно */
      }
    } catch {
      /* сеть недоступна — оставляем прежний offset */
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

/** Таймзона сервера (для Intl-форматирования). Дефолт — Europe/Moscow. */
export function getServerTimezone(): string {
  try {
    return localStorage.getItem(TZ_KEY) || "Europe/Moscow";
  } catch {
    return "Europe/Moscow";
  }
}

/** Абсолютный момент «сейчас на сервере». НЕ читайте из него getHours()/
 *  getDate() напрямую (это пояс браузера) — используйте функции ниже. */
export function serverNowDate(): Date {
  return new Date(Date.now() + offsetSec * 1000);
}

function keyAt(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: getServerTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

/** «Сегодня» на сервере: YYYY-MM-DD. */
export function serverTodayKey(): string {
  return keyAt(serverNowDate());
}

/** «Завтра» на сервере: YYYY-MM-DD. */
export function serverTomorrowKey(): string {
  return keyAt(new Date(serverNowDate().getTime() + 86_400_000));
}

/** «Сегодня + N дней» на сервере: YYYY-MM-DD (граница «недели» и т.п.). */
export function serverPlusDaysKey(days: number): string {
  return keyAt(new Date(serverNowDate().getTime() + days * 86_400_000));
}

/** «Сейчас» на сервере: HH:mm. */
export function serverNowHm(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: getServerTimezone(),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(serverNowDate());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("hour")}:${g("minute")}`;
}

/** ГЛАВНАЯ функция модуля: «сейчас на сервере» как "YYYY-MM-DDTHH:mm".
 *  Сравнивается СТРОКАМИ с `${meeting.date}T${meeting.startTime}`. */
export function serverNowStr(): string {
  return `${serverTodayKey()}T${serverNowHm()}`;
}
