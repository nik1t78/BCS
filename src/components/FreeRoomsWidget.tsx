import React, { useEffect, useState } from "react";
import { Room, RoomAvailability } from "../types";
import { roomsAPI } from "../api/client";
import { computeFreeSlots, minToHm, type FreeSlot } from "../utils/freeSlots";

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface RoomInfo {
  room: Room;
  slots: FreeSlot[];
}

interface FreeRoomsWidgetProps {
  /** Клик по свободному слоту → родитель переходит к созданию ВКС с предзаполнением */
  onPickSlot?: (roomName: string, startTime: string, endTime: string, date: string) => void;
}

/**
 * Виджет «Свободные залы»: для каждой переговорной комнаты показывает
 * ближайшие свободные интервалы до конца рабочего дня (08:00–19:00).
 * Клик по интервалу автоматически открывает форму создания ВКС с
 * предзаполненными датой, временем и залом (+ автогенерация ссылки ВКС).
 */
export default function FreeRoomsWidget({ onPickSlot }: FreeRoomsWidgetProps) {
  const [date, setDate] = useState<string>(todayKey());
  const [infos, setInfos] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const isToday = date === todayKey();
        const next: RoomInfo[] = [];
        results.forEach((resItem, i) => {
          const room = active[i];
          if (resItem.status !== "fulfilled") {
            next.push({ room, slots: [] });
            return;
          }
          const avail: RoomAvailability = (resItem.value as any)?.data ?? resItem.value;
          const slots = computeFreeSlots(avail.busy ?? [], { isToday, nowMin });
          next.push({ room, slots });
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

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">
          <i className="fas fa-door-open mr-2 text-blue-600" aria-hidden="true"></i>
          Свободные залы
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

      {!loading && !error && (
        <ul className="space-y-3">
          {infos.map(({ room, slots }) => (
            <li key={room.id} className="border-b border-gray-100 dark:border-slate-700 pb-2 last:border-0">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-gray-700 dark:text-gray-200 font-medium">
                  <i className={`fas ${slots.length ? "fa-circle text-emerald-500" : "fa-circle text-red-400"} text-[8px] mr-2`} aria-hidden="true"></i>
                  {room.name}
                  <span className="text-xs text-gray-400 ml-2">
                    {room.capacity} чел.{room.location ? ` • ${room.location}` : ""}
                  </span>
                </span>
                {!slots.length && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">занят до конца дня</span>
                )}
              </div>
              {slots.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {slots.slice(0, 4).map((s) => {
                    const startHm = minToHm(s.startMin);
                    // конец окна: не больше часа по умолчанию, но в пределах слота
                    const endHm = minToHm(Math.min(s.endMin, s.startMin + 60));
                    return (
                      <button
                        key={`${s.startMin}-${s.endMin}`}
                        type="button"
                        onClick={() => onPickSlot?.(room.name, startHm, endHm, date)}
                        title={`Забронировать ${startHm}–${endHm} и создать ВКС`}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-900/50 transition-colors"
                      >
                        <i className="fas fa-plus mr-1" aria-hidden="true"></i>
                        {startHm}–{endHm}
                        <span className="text-emerald-500/80 ml-1">({Math.round(s.lengthMin / 60 * 10) / 10} ч)</span>
                      </button>
                    );
                  })}
                  {slots.length > 4 && (
                    <span className="text-xs text-gray-400 self-center">+{slots.length - 4}</span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
