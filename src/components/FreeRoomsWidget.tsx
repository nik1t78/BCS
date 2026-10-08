import React, { useEffect, useState } from "react";
import { Room, RoomAvailability } from "../types";
import { roomsAPI } from "../api/client";

/**
 * Виджет «Свободные комнаты»: показывает переговорные комнаты на выбранный
 * день со статусом занятости в текущий момент времени. Доступен всем ролям.
 */
export default function FreeRoomsWidget() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rooms, setRooms] = useState<Room[]>([]);
  const [busyMap, setBusyMap] = useState<Record<string, number>>({}); // roomId -> длительность занятости сегодня (мин)
  const [nowStatus, setNowStatus] = useState<Record<string, boolean>>({}); // roomId -> свободна прямо сейчас
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
        const results = await Promise.allSettled(
          active.map((r) => roomsAPI.availability(r.id, { date }))
        );
        if (cancelled) return;
        const nextBusy: Record<string, number> = {};
        const nextNow: Record<string, boolean> = {};
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        const isToday = date === new Date().toISOString().slice(0, 10);
        results.forEach((resItem, i) => {
          const room = active[i];
          if (resItem.status !== "fulfilled") return;
          const avail: RoomAvailability = resItem.value?.data ?? resItem.value;
          const busy = avail.busy ?? [];
          nextBusy[room.id] = busy.reduce((acc, b) => {
            const s = new Date(b.start).getHours() * 60 + new Date(b.start).getMinutes();
            const e = new Date(b.end).getHours() * 60 + new Date(b.end).getMinutes();
            return acc + Math.max(0, e - s);
          }, 0);
          nextNow[room.id] = isToday
            ? !busy.some((b) => {
                const s = new Date(b.start).getHours() * 60 + new Date(b.start).getMinutes();
                const e = new Date(b.end).getHours() * 60 + new Date(b.end).getMinutes();
                return nowMin >= s && nowMin < e;
              })
            : true;
        });
        setBusyMap(nextBusy);
        setNowStatus(nextNow);
        setRooms(active);
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
          Свободные комнаты
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
      {!loading && !error && rooms.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Комнаты не настроены.</p>
      )}

      {!loading && !error && (
        <ul className="space-y-2">
          {[...rooms]
            .sort((a, b) => (busyMap[a.id] ?? 0) - (busyMap[b.id] ?? 0))
            .map((room) => {
              const freeNow = nowStatus[room.id] !== false;
              const busyMin = busyMap[room.id] ?? 0;
              return (
                <li
                  key={room.id}
                  className="flex items-center justify-between text-sm border-b border-gray-100 dark:border-slate-700 pb-2 last:border-0"
                >
                  <span className="text-gray-700 dark:text-gray-200">
                    {room.name}
                    <span className="text-xs text-gray-400 ml-2">
                      {room.capacity} чел.{room.location ? ` • ${room.location}` : ""}
                    </span>
                  </span>
                  <span
                    className={
                      freeNow
                        ? "text-emerald-600 dark:text-emerald-400 font-medium"
                        : "text-amber-600 dark:text-amber-400 font-medium"
                    }
                  >
                    {freeNow ? "свободна" : `занята • ${Math.round(busyMin / 60 * 10) / 10} ч сегодня`}
                  </span>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
