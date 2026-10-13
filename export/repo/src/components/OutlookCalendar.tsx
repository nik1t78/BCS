// Календарь в стиле Microsoft Outlook: сетка времени с вертикальными колонками
// дней, часовой линейкой слева, позиционированием встреч по времени и высоте
// по длительности, зоной «сейчас», перетаскиванием встреч между днями/временем.
// Используется и в пользовательском «Расписании», и в админ-панели.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Meeting } from "../types";
import { occursOn, withDate } from "../utils/recurrence";
import { toDateKey } from "../utils/dateKey";

export type OutlookView = "day" | "week" | "workweek" | "month";

export interface OutlookCalendarProps {
  meetings: Meeting[];
  view: OutlookView;
  selectedDate: Date;
  onSelectedDateChange: (d: Date) => void;
  /** Вызов при клике на встречу (карточка деталей — у родителя) */
  onSelectMeeting?: (m: Meeting) => void;
  /** Двойной клик / клик по пустому слоту — создание встречи на это время */
  onCreateAt?: (dateKey: string, startTime: string) => void;
  /** Разрешает drag&drop перенос конкретной встречи */
  canDragMeeting?: (m: Meeting) => boolean;
  /** Запрос на перенос: встреча id → новая дата/время (родитель проверяет конфликты) */
  onRequestMove?: (meeting: Meeting, dateKey: string, startTime: string) => void;
  /** Скрытие деталей приватных встреч для посторонних: возвращает отображаемый заголовок */
  displayTitle?: (m: Meeting) => string;
  /** Подпись внутри блока под заголовком (например, комната или организатор) */
  blockSubtitle?: (m: Meeting) => string | undefined;
}

const HOUR_HEIGHT = 48; // px на один час — как в Outlook
const HOURS_PER_DAY = 24;
const SNAP_MINUTES = 15; // шаг «прилипания» при перетаскивании
const WEEKDAYS_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const WEEKDAYS_FULL = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
const MONTHS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];


/** Пн–Вс (Mon=0 … Sun=6) */
const isoDayIndex = (d: Date): number => (d.getDay() + 6) % 7;

const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const startOfWeek = (d: Date): Date => addDays(d, -isoDayIndex(d));

const timeToMinutes = (t: string): number => {
  const [h, m] = (t || "0:0").split(":").map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
};

const minutesToTime = (mins: number): string => {
  const clamped = Math.max(0, Math.min(HOURS_PER_DAY * 60 - 1, mins));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
};

const snapMinutes = (mins: number): number => Math.round(mins / SNAP_MINUTES) * SNAP_MINUTES;

/** Цвет event-блока по приоритету — палитра Outlook (синий/оранжевый/зелёный) */
const priorityClasses = (priority: string): string => {
  switch (priority) {
    case "high":
      return "bg-orange-100 dark:bg-orange-900/40 border-orange-400 dark:border-orange-500 text-orange-900 dark:text-orange-200";
    case "low":
      return "bg-green-100 dark:bg-green-900/40 border-green-400 dark:border-green-500 text-green-900 dark:text-green-200";
    case "medium":
      return "bg-sky-100 dark:bg-sky-900/40 border-sky-400 dark:border-sky-500 text-sky-900 dark:text-sky-200";
    default:
      return "bg-gray-100 dark:bg-gray-700 border-gray-400 dark:border-gray-500 text-gray-800 dark:text-gray-200";
  }
};

interface PositionedEvent {
  meeting: Meeting;
  topPx: number;
  heightPx: number;
  leftPct: number;
  widthPct: number;
}

/**
 * Раскладка пересекающихся встреч по columns-алгоритму (как в Outlook/Google
 * Calendar): пересекающиеся группы делят ширину колонки поровну.
 */
function layoutDayEvents(dayMeetings: Meeting[]): PositionedEvent[] {
  const items = dayMeetings
    .map((m) => {
      const start = timeToMinutes(m.startTime);
      let end = timeToMinutes(m.endTime);
      if (end <= start) end = Math.min(start + 30, HOURS_PER_DAY * 60);
      return { m, start, end };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  // Группы транзитивно пересекающихся событий
  const groups: (typeof items)[] = [];
  let current: typeof items = [];
  let groupEnd = -1;
  for (const it of items) {
    if (current.length && it.start >= groupEnd) {
      groups.push(current);
      current = [];
      groupEnd = -1;
    }
    current.push(it);
    groupEnd = Math.max(groupEnd, it.end);
  }
  if (current.length) groups.push(current);

  const result: PositionedEvent[] = [];
  for (const group of groups) {
    const colEnds: number[] = []; // время окончания последней встречи в каждой колонке
    const placed = group.map((it) => {
      let col = colEnds.findIndex((e) => e <= it.start);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(it.end);
      } else {
        colEnds[col] = it.end;
      }
      return { ...it, col };
    });
    const totalCols = colEnds.length;
    for (const p of placed) {
      const durationMin = Math.max(p.end - p.start, 15);
      const heightPx = Math.max((durationMin / 60) * HOUR_HEIGHT, 18);
      const gap = totalCols > 1 ? 1 : 2;
      const widthPct = 100 / totalCols;
      result.push({
        meeting: p.m,
        topPx: (p.start / 60) * HOUR_HEIGHT,
        heightPx,
        leftPct: p.col * widthPct,
        widthPct: widthPct - (totalCols > 1 ? gap : 0),
      });
    }
  }
  return result;
}

export default function OutlookCalendar({
  meetings,
  view,
  selectedDate,
  onSelectedDateChange,
  onSelectMeeting,
  onCreateAt,
  canDragMeeting,
  onRequestMove,
  displayTitle,
  blockSubtitle,
}: OutlookCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // Живая линия «сейчас»
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // При переключении вида/даты прокручиваем к рабочему времени (~8:00),
  // чтобы день не открывался с полуночи (как в Outlook).
  const selectedKey = toDateKey(selectedDate);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 7.5 * HOUR_HEIGHT;
  }, [view, selectedKey]);

  const visibleDays: Date[] = useMemo(() => {
    if (view === "day") return [selectedDate];
    if (view === "week") {
      const s = startOfWeek(selectedDate);
      return Array.from({ length: 7 }, (_, i) => addDays(s, i));
    }
    if (view === "workweek") {
      const s = startOfWeek(selectedDate);
      return Array.from({ length: 7 }, (_, i) => addDays(s, i)).slice(0, 5);
    }
    // Месяц: сетка 6×7, начинаем с понедельника недели, содержащей 1-е число
    const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [view, selectedDate]);

  const title = useMemo(() => {
    if (view === "month") return `${MONTHS_RU[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
    if (view === "day") {
      const wd = WEEKDAYS_FULL[isoDayIndex(selectedDate)];
      return `${wd.charAt(0).toUpperCase() + wd.slice(1)}, ${selectedDate.getDate()} ${MONTHS_RU[selectedDate.getMonth()].toLowerCase()} ${selectedDate.getFullYear()}`;
    }
    const s = visibleDays[0];
    const e = visibleDays[visibleDays.length - 1];
    const fmt = (d: Date) => `${d.getDate()} ${MONTHS_RU[d.getMonth()].slice(0, 3).toLowerCase()}`;
    const sameMonth = s.getMonth() === e.getMonth();
    return sameMonth
      ? `${fmt(s)} – ${e.getDate()} ${MONTHS_RU[e.getMonth()].slice(0, 3).toLowerCase()} ${e.getFullYear()}`
      : `${fmt(s)} ${s.getFullYear()} – ${fmt(e)} ${e.getFullYear()}`;
  }, [view, selectedDate, visibleDays]);

  const navigate = (delta: number) => {
    const d = new Date(selectedDate);
    if (view === "month") d.setMonth(d.getMonth() + delta);
    else if (view === "week") d.setDate(d.getDate() + delta * 7);
    else if (view === "workweek") d.setDate(d.getDate() + delta * 5);
    else d.setDate(d.getDate() + delta);
    onSelectedDateChange(d);
  };

  const eventsForDate = (date: Date): Meeting[] =>
    meetings
      .filter((m) => occursOn(m, date))
      .map((m) => (m.date === toDateKey(date) ? m : withDate(m, date)))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const handleDrop = (dateKey: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverKey(null);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const m = meetings.find((x) => String(x.id) === id);
    if (!m) return;
    // Точное время броска из координат колонки (fallback — исходное время).
    // getBoundingClientRect() колонки уже учитывает прокрутку контейнера.
    let startTime = m.startTime;
    let target: Element | null = e.target instanceof HTMLElement ? e.target : null;
    if (!target) {
      // на некоторых браузерах e.target при drop недоступен — ищем колонку под курсором
      const el = document.elementFromPoint(e.clientX, e.clientY);
      target = el instanceof HTMLElement ? el : null;
    }
    const column = target?.closest("[data-timegrid]") as HTMLElement | null;
    if (column) {
      const r = column.getBoundingClientRect();
      const mins = snapMinutes(((e.clientY - r.top) / r.height) * HOURS_PER_DAY * 60);
      startTime = minutesToTime(mins);
    }
    if (m.date === dateKey && m.startTime === startTime) return;
    if (onRequestMove) onRequestMove(m, dateKey, startTime);
  };

  const slotClickProps = (date: Date) =>
    onCreateAt
      ? {
          onClick: (e: React.MouseEvent) => {
            // клик именно по фону сетки, а не по блоку встречи
            if (!(e.target as HTMLElement).hasAttribute("data-timegrid")) return;
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const mins = snapMinutes(((e.clientY - r.top) / r.height) * HOURS_PER_DAY * 60);
            onCreateAt(toDateKey(date), minutesToTime(mins));
          },
        }
      : {};

  // ==================== Month view (mini-Outlook) ====================
  if (view === "month") {
    const todayKey = toDateKey(now);
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden select-none">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Предыдущий месяц">
              <i className="fas fa-chevron-left text-gray-600 dark:text-gray-300"></i>
            </button>
            <button onClick={() => navigate(1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Следующий месяц">
              <i className="fas fa-chevron-right text-gray-600 dark:text-gray-300"></i>
            </button>
            <button
              onClick={() => onSelectedDateChange(new Date())}
              className="px-3 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Сегодня
            </button>
            <span className="text-lg font-semibold text-gray-800 dark:text-gray-100 ml-1">{title}</span>
          </div>
        </div>

        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
          {WEEKDAYS_SHORT.map((wd) => (
            <div key={wd} className="py-1.5 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {visibleDays.map((date, i) => {
            const key = toDateKey(date);
            const evts = eventsForDate(date);
            const inMonth = date.getMonth() === selectedDate.getMonth();
            const isToday = key === todayKey;
            return (
              <div
                key={i}
                {...slotClickProps(date)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverKey(key);
                }}
                onDragLeave={() => setDragOverKey((cur) => (cur === key ? null : cur))}
                onDrop={(e) => handleDrop(key, e)}
                className={`min-h-[110px] border-b border-r border-gray-100 dark:border-gray-700 p-1 transition-colors ${
                  dragOverKey === key ? "bg-blue-50 dark:bg-blue-900/30 ring-2 ring-inset ring-blue-400" : ""
                } ${onCreateAt ? "cursor-pointer" : ""}`}
              >
                <div className="flex justify-end">
                  <span
                    className={`text-xs leading-6 w-6 h-6 inline-flex items-center justify-center rounded-full ${
                      isToday
                        ? "bg-blue-600 text-white font-semibold"
                        : inMonth
                          ? "text-gray-700 dark:text-gray-200"
                          : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {evts.slice(0, 3).map((m) => {
                    const c = priorityClasses(m.priority);
                    const draggable = !!canDragMeeting?.(m);
                    return (
                      <div
                        key={`${m.id}-${m.date}`}
                        draggable={draggable}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(m.id));
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMeeting?.(m);
                        }}
                        title={`${m.startTime}–${m.endTime} ${displayTitle ? displayTitle(m) : m.title}`}
                        className={`rounded px-1.5 py-0.5 text-[11px] leading-tight truncate cursor-pointer ${c} border-l-2 ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                        <span className="font-medium">{m.startTime}</span>{" "}
                        {displayTitle ? displayTitle(m) : m.title}
                      </div>
                    );
                  })}
                  {evts.length > 3 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectedDateChange(date);
                      }}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline px-1"
                    >
                      Ещё {evts.length - 3}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==================== Day / Week / Workweek (time grid) ====================
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayKey = toDateKey(now);
  const cols = visibleDays.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden select-none">
      {/* Header: навигация + диапазон дат */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Назад">
            <i className="fas fa-chevron-left text-gray-600 dark:text-gray-300"></i>
          </button>
          <button onClick={() => navigate(1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Вперёд">
            <i className="fas fa-chevron-right text-gray-600 dark:text-gray-300"></i>
          </button>
          <button
            onClick={() => onSelectedDateChange(new Date())}
            className="px-3 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Сегодня
          </button>
          <span className="text-lg font-semibold text-gray-800 dark:text-gray-100 ml-1">{title}</span>
        </div>
      </div>

      {/* Шапка колонок дней (зафиксирована над скроллом) */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <div className="w-14 flex-shrink-0" />
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {visibleDays.map((date, i) => {
            const key = toDateKey(date);
            const isToday = key === todayKey;
            return (
              <div
                key={i}
                onClick={() => onSelectedDateChange(date)}
                className="py-2 text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-r border-gray-100 dark:border-gray-700 last:border-r-0"
                title="Показать этот день"
              >
                <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {WEEKDAYS_SHORT[isoDayIndex(date)]}
                </p>
                <p
                  className={`mx-auto mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full text-base font-semibold ${
                    isToday ? "bg-blue-600 text-white" : "text-gray-800 dark:text-gray-100"
                  }`}
                >
                  {date.getDate()}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Прокручиваемая область с часовой линейкой и колонками */}
      <div ref={scrollRef} className="overflow-y-auto max-h-[600px]">
        <div className="flex">
          {/* Часовая линейка */}
          <div className="w-14 flex-shrink-0">
            {Array.from({ length: HOURS_PER_DAY }, (_, h) => (
              <div key={h} className="relative text-[11px] text-gray-400 dark:text-gray-500" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute -top-2 right-1.5">{h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}</span>
              </div>
            ))}
          </div>

          {/* Колонки дней */}
          <div className="grid flex-1 relative" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {visibleDays.map((date, di) => {
              const key = toDateKey(date);
              const isToday = key === todayKey;
              const positioned = layoutDayEvents(eventsForDate(date));
              return (
                <div
                  key={di}
                  data-timegrid
                  {...slotClickProps(date)}
                  onDragOver={(e) => {
                    if (!onRequestMove) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverKey(key);
                  }}
                  onDragLeave={() => setDragOverKey((cur) => (cur === key ? null : cur))}
                  onDrop={(e) => handleDrop(key, e)}
                  className={`relative border-r border-gray-100 dark:border-gray-700 last:border-r-0 ${
                    dragOverKey === key ? "bg-blue-50 dark:bg-blue-900/30" : ""
                  } ${onCreateAt ? "cursor-pointer" : ""}`}
                  style={{ height: HOURS_PER_DAY * HOUR_HEIGHT }}
                >
                  {/* Горизонтальные линии часов */}
                  {Array.from({ length: HOURS_PER_DAY }, (_, h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-700/70 pointer-events-none"
                      style={{ top: h * HOUR_HEIGHT }}
                    />
                  ))}
                  {/* Полувечерние пунктирные разделители (как в Outlook) */}
                  {Array.from({ length: HOURS_PER_DAY }, (_, h) => (
                    <div
                      key={`half-${h}`}
                      className="absolute left-0 right-0 border-t border-dashed border-gray-50 dark:border-gray-700/40 pointer-events-none"
                      style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                    />
                  ))}

                  {/* Линия «сейчас» */}
                  {isToday && (
                    <div
                      className="absolute left-0 right-0 z-20 pointer-events-none"
                      style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                    >
                      <div className="relative h-0 border-t-2 border-red-500">
                        <span className="absolute -left-1 -top-[5px] w-2.5 h-2.5 rounded-full bg-red-500" />
                      </div>
                    </div>
                  )}

                  {/* Блоки встреч */}
                  {positioned.map(({ meeting: m, topPx, heightPx, leftPct, widthPct }) => {
                    const c = priorityClasses(m.priority);
                    const draggable = !!canDragMeeting?.(m);
                    const cancelled = m.status === "cancelled";
                    const completed = m.status === "completed";
                    const compact = heightPx < 34;
                    return (
                      <div
                        key={`${m.id}-${m.date}`}
                        draggable={draggable}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(m.id));
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMeeting?.(m);
                        }}
                        title={`${m.startTime}–${m.endTime}\n${displayTitle ? displayTitle(m) : m.title}${m.room ? `\n${m.room}` : ""}`}
                        className={`absolute z-10 overflow-hidden rounded-md border-l-4 ${c} ${
                          cancelled ? "opacity-50 line-through" : ""
                        } ${completed ? "opacity-70" : ""} px-1.5 py-1 text-[11px] leading-tight cursor-pointer shadow-sm hover:shadow-md hover:brightness-95 transition ${
                          draggable ? "cursor-grab active:cursor-grabbing" : ""
                        }`}
                        style={{
                          top: topPx,
                          height: heightPx,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                        }}
                      >
                        <p className="font-semibold truncate">{displayTitle ? displayTitle(m) : m.title}</p>
                        {!compact && (
                          <p className="truncate opacity-80">
                            {m.startTime}–{m.endTime}
                            {blockSubtitle ? ` · ${blockSubtitle(m) ?? ""}` : m.room ? ` · ${m.room}` : ""}
                          </p>
                        )}
                        {m.recurring !== "none" && (
                          <i className="fas fa-sync-alt absolute bottom-1 right-1 text-[9px] opacity-50" title="Повторяющаяся встреча"></i>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
