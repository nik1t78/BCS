import React, { useEffect, useState } from "react";
import { Room, RoomAvailability } from "../types";
import { roomsAPI } from "../api/client";
import {
  computeFreeSlots,
  minToHm,
  humanDuration,
  WORK_DAY_START_MIN,
  WORK_DAY_END_MIN,
  type FreeSlot,
} from "../utils/freeSlots";

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface RoomInfo {
  room: Room;
  slots: FreeSlot[];
  busy: { startMin: number; endMin: number; title?: string }[];
}

interface FreeRoomsWidgetProps {
  /** Клик по свободному слоту → родитель переходит к созданию ВКС с предзаполнением */
  onPickSlot?: (roomName: string, startTime: string, endTime: string, date: string) => void;
}

/**
 * Виджет «Свободные залы» в стиле Outlook: горизонтальная шкала времени
 * (суточный диапазон 00:00–24:00) с часовой линейкой. Для каждого зала — полоса,
 * где занятое время показано серыми блоками, а свободные окна — зелёными
 * сегментами с подписью «HH:MM–HH:MM». Клик по свободному окну открывает
 * форму создания ВКС с предзаполненными датой, временем и залом.
 */
export default function FreeRoomsWidget({ onPickSlot }: FreeRoomsWidgetProps) {
  const [date, setDate] = useState<string>(todayKey());
  const [infos, setInfos] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  // «Линия текущего времени» как в Outlook — обновляем раз в минуту
  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res: any = await roomsAPI.list();
        const rooms: Room[] = Array.isArray(res) ? res : res?.data ?? [];
        const active = rooms.filter((r) => r.isActive !== false);
        const results = await Promise.allSettled(active.map((r) => roomsAPI.availability(r.id, { date })));
        if (cancelled) return;
        const now = new Date();
        const curMin = now.getHours() * 60 + now.getMinutes();
        const isToday = date === todayKey();
        const toMin = (s: string): number => {
          if (/^\d{1,2}:\d{2}$/.test(s)) {
            const [h, m] = s.split(":").map(Number);
            return h * 60 + m;
          }
          const d = new Date(s);
          return d.getHours() * 60 + d.getMinutes();
        };
        const next: RoomInfo[] = [];
        results.forEach((resItem, i) => {
          const room = active[i];
          if (resItem.status !== "fulfilled") {
            next.push({ room, slots: [], busy: [] });
            return;
          }
          const avail: RoomAvailability = (resItem.value as any)?.data ?? resItem.value;
          const slots = computeFreeSlots(avail.busy ?? [], { isToday, nowMin: curMin });
          const busy = (avail.busy ?? []).map((b: any) => ({
            startMin: Math.max(toMin(b.start), WORK_DAY_START_MIN),
            endMin: Math.min(toMin(b.end), WORK_DAY_END_MIN),
            title: b.title || b.meetingTitle || "",
          })).filter((b: any) => b.endMin > b.startMin);
          next.push({ room, slots, busy });
        });
        // Свободные залы — выше списка; внутри — по ближайшему слоту
        next.sort((a, b) => {
          if (a.slots.length !== b.slots.length) return b.slots.length - a.slots.length;
          return (a.slots[0]?.startMin ?? 1e9) - (b.slots[0]?.startMin ?? 1e9);
        });
        setInfos(next);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Не удалось загрузить комнаты");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const daySpan = WORK_DAY_END_MIN - WORK_DAY_START_MIN;
  const pct = (min: number) => ((min - WORK_DAY_START_MIN) / daySpan) * 100;
  const hours: number[] = [];
  for (let m = WORK_DAY_START_MIN; m <= WORK_DAY_END_MIN; m += 60) hours.push(m);
  const isToday = date === todayKey();
  const showNowLine = isToday && nowMin >= WORK_DAY_START_MIN && nowMin <= WORK_DAY_END_MIN;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">
          <i className="fas fa-door-open mr-2 text-blue-600" aria-hidden="true"></i>
          Свободные залы
          <span className="text-xs font-normal text-gray-400 ml-2">рабочий день {minToHm(WORK_DAY_START_MIN)}–{minToHm(WORK_DAY_END_MIN)}</span>
        </h3>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm border rounded-lg px-2 py-1 bg-white dark:bg-slate-700 dark:text-gray-100 dark:border-slate-600"
          aria-label="Дата проверки занятости"
        />
      </div>

      {loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <i className="fas fa-circle-notch fa-spin mr-1" aria-hidden="true"></i> Загрузка…
        </p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && !error && infos.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Комнаты не настроены.</p>
      )}

      {!loading && !error && infos.length > 0 && (
        <div className="overflow-x-auto">
          {/* Часовая линейка как в Outlook */}
          <div className="flex items-center text-[10px] text-gray-400 dark:text-gray-500 mb-1 min-w-[640px]">
            <div className="w-36 shrink-0" />
            <div className="relative flex-1 h-4">
              {hours.map((m) => (
                <span key={m} className="absolute -translate-x-1/2" style={{ left: `${pct(m)}%` }}>
                  {minToHm(m)}
                </span>
              ))}
            </div>
          </div>

          <ul className="space-y-2 min-w-[640px]">
            {infos.map(({ room, slots, busy }) => (
              <li key={room.id}>
                <div className="flex items-center">
                  <div className="w-36 shrink-0 pr-2 text-sm text-gray-700 dark:text-gray-200 font-medium truncate" title={`${room.name} • ${room.capacity} чел.${room.location ? ` • ${room.location}` : ""}`}>
                    <i className={`fas fa-circle ${slots.length ? "text-emerald-500" : "text-red-400"} text-[8px] mr-2`} aria-hidden="true"></i>
                    {room.name}
                  </div>

                  {/* Полоса времени зала */}
                  <div className="relative flex-1 h-9 rounded-md bg-gray-100 dark:bg-slate-700 overflow-hidden">
                    {/* получасовые деления */}
                    {hours.slice(1).map((m) => (
                      <div key={m} className="absolute top-0 bottom-0 w-px bg-gray-200 dark:bg-slate-600" style={{ left: `${pct(m)}%` }} />
                    ))}
                    {/* занятые блоки */}
                    {busy.map((b, i) => (
                      <div
                        key={`b${i}`}
                        className="absolute top-0 bottom-0 bg-gray-300/80 dark:bg-slate-500/70 border-l-2 border-gray-400 dark:border-slate-400"
                        style={{ left: `${pct(b.startMin)}%`, width: `${pct(b.endMin) - pct(b.startMin)}%` }}
                        title={`Занято ${minToHm(b.startMin)}–${minToHm(b.endMin)}${b.title ? `: ${b.title}` : ""}`}
                      />
                    ))}
                    {/* свободные окна — кликабельные, с временем как в Outlook */}
                    {slots.map((s) => {
                      const bookEnd = Math.min(s.endMin, s.startMin + 60);
                      return (
                        <button
                          key={`${s.startMin}-${s.endMin}`}
                          type="button"
                          onClick={() => onPickSlot?.(room.name, minToHm(s.startMin), minToHm(bookEnd), date)}
                          title={`Забронировать ${minToHm(s.startMin)}–${minToHm(bookEnd)} (${humanDuration(bookEnd - s.startMin)}) и создать ВКС`}
                          className="absolute top-1 bottom-1 rounded bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:hover:bg-emerald-800/60 border border-emerald-300 dark:border-emerald-600 text-emerald-800 dark:text-emerald-200 text-[11px] font-medium px-1 overflow-hidden whitespace-nowrap transition-colors"
                          style={{ left: `${pct(s.startMin)}%`, width: `${Math.max(pct(s.endMin) - pct(s.startMin), 3)}%` }}
                        >
                          <i className="fas fa-plus mr-1 opacity-70" aria-hidden="true"></i>
                          {minToHm(s.startMin)}–{minToHm(s.endMin)}
                        </button>
                      );
                    })}
                    {/* линия «сейчас» */}
                    {showNowLine && (
                      <div className="absolute top-0 bottom-0 w-[2px] bg-red-500 pointer-events-none" style={{ left: `${pct(nowMin)}%` }} />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Легенда */}
          <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-gray-500 dark:text-gray-400 min-w-[640px]">
            <span><span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300 align-middle mr-1" />Свободно (клик — создать ВКС)</span>
            <span><span className="inline-block w-3 h-3 rounded bg-gray-300 align-middle mr-1" />Занято</span>
            <span><span className="inline-block w-3 h-[2px] bg-red-500 align-middle mr-1" />Текущее время</span>
          </div>
        </div>
      )}
    </div>
  );
}
