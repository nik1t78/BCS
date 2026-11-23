import React, { useEffect, useState } from "react";
import { Room, RoomAvailability } from "../types";
import { roomsAPI, meetingsAPI } from "../api/client";
import { syncServerTime, serverNowHm as serverNowHmTz, serverTodayKey as serverTodayKeyTz } from "../api/serverTime";
import {
  computeFreeSlots,
  splitSlotIntoBlocks,
  minToHm,
  humanDuration,
  hmToMin,
  WORK_DAY_END_MIN,
  type FreeSlot,
} from "../utils/freeSlots";
import { hoursForDate, type DayHours } from "../utils/roomSchedule";

/** «Сейчас» в минутах дня ПО ЧАСАМ И ПОЯСУ СЕРВЕРА (Europe/Moscow, см. /api/time).
 *  Фикс «Свободные залы пустеют после обновления страницы»: расчёт свободных
 *  окон шёл по локальным часам браузера. Если часы устройства расходились с
 *  сервером или пояс браузера не московский, все окна дня ошибочно помечались
 *  прошедшими (isPast) и исчезали из зелёной зоны — виджет выглядел пустым.
 *  Важно: serverNowHmTz() читает время через Intl в поясе сервера; getHours()
 *  от Date вернул бы локальный час браузера (расхождение до ±3ч для MSK). */

/** Сдвигает календарную дату без UTC-преобразований и сдвига суток. */
function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(year, month - 1, day);
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

const serverNowMin = (): number => {
  const [h, m] = serverNowHmTz().split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

interface RoomInfo {
  room: Room;
  slots: FreeSlot[];
  busy: { startMin: number; endMin: number; title?: string }[];
  /** Рабочие часы зала на выбранную дату (гибкий график); null — зал закрыт. */
  hours: DayHours | null;
  /** Если занятость не удалось проверить, слоты не предлагаются. */
  availabilityError?: boolean;
}

type AvailabilityCache = {
  date: string;
  active: Room[];
  busyById: Record<string, any[]>;
  hoursById: Record<string, DayHours | null | undefined>;
};

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
  const [date, setDate] = useState<string>(() => serverTodayKeyTz());
  const [infos, setInfos] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMin, setNowMin] = useState<number>(() => serverNowMin());

  // «Линия текущего времени» как в Outlook — обновляем раз в минуту.
  // Каждую минуту пересчитываем и свободные окна (см. эффект ниже), чтобы
  // прошедшее время не предлагалось для брони без перезагрузки страницы.
  useEffect(() => {
    let stopped = false;
    const refresh = () => { if (!stopped) setNowMin(serverNowMin()); };
    // При загрузке сверяемся с серверными часами (/api/time) — иначе при
    // расхождении часов устройства все окна дня ошибочно станут «прошедшими».
    syncServerTime().finally(refresh);
    const t = setInterval(() => { syncServerTime().finally(refresh); }, 60000);
    return () => { stopped = true; clearInterval(t); };
  }, []);

  // Тик «сейчас»: меняется раз в минуту — на нём пересчитываем слоты,
  // помечая уже наступившее время как прошедшее (isPast).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // Кэш последнего ответа занятости по дате: на минутном тике обновляем
  // слоты из кэша БЕСШУМНО (без «Загрузка…»), а не с нуля через API.
  const cacheRef = React.useRef<AvailabilityCache | null>(null);

  useEffect(() => {
    let cancelled = false;
    const useCacheOnly = tick > 0 && cacheRef.current?.date === date;
    if (!useCacheOnly) {
      setLoading(true);
      setError(null);
    }
    const load = async () => {
      try {
        // Агрегированный эндпоинт доступен всем авторизованным ролям и
        // возвращает сразу и список активных залов, и их занятость на дату
        // (один запрос вместо N+1). Используем его как ОСНОВНОЙ источник —
        // так виджет работает одинаково у admin/moderator/user и не зависит
        // от прав на справочник GET /rooms.
        const fetchAggregated = async (): Promise<{ active: Room[]; busyById: Record<string, any[]>; hoursById: Record<string, DayHours | null | undefined> }> => {
          const av: any = await meetingsAPI.roomsAvailability({ date });
          // Backend can return a degraded response if DB/recurrence calculation
          // failed. Such a response is NOT proof that every room is free.
          if (av?.degraded === true) {
            throw new Error("Сервер не смог проверить занятость залов. Бронирование временно недоступно.");
          }
          const list: any[] = av?.data ?? av ?? [];
          if (!Array.isArray(list)) {
            throw new Error("Сервер вернул некорректное расписание залов.");
          }
          const active: Room[] = list.map((r, i) => ({
            id: String(r.id ?? `room-${i}`),
            name: r.name,
            capacity: Number(r.capacity ?? 0),
            location: r.location ?? r.floor ?? undefined,
            isActive: true,
          })) as unknown as Room[];
          const busyById: Record<string, any[]> = {};
          // Гибкий график зала на дату: сервер отдаёт room.hours
          // ({start,end}) либо null (закрыт: выходной день/праздник).
          const hoursById: Record<string, DayHours | null | undefined> = {};
          list.forEach((r, i) => {
            const id = String(r.id ?? `room-${i}`);
            busyById[id] = r.busy ?? [];
            if (r.name) busyById[`name::${r.name}`] = r.busy ?? [];
            hoursById[id] = r.hours === undefined ? undefined : r.hours;
          });
          return { active, busyById, hoursById };
        };

        let active: Room[] = [];
        let busyById: Record<string, any[]> = {};
        let hoursById: Record<string, DayHours | null | undefined> = {};
        if (useCacheOnly && cacheRef.current) {
          // Минутный тик по тому же дню — берём данные из кэша, только
          // пересчитываем «прошедшее время» относительно нового «сейчас».
          ({ active, busyById, hoursById } = cacheRef.current);
        } else {
          try {
            const agg = await fetchAggregated();
            active = agg.active;
            busyById = agg.busyById;
            hoursById = agg.hoursById;
          } catch (aggregateError: any) {
            // Совместимость со старым API: пробуем справочник + отдельную
            // проверку каждого зала. Ошибку проверки ниже оставляем rejected,
            // а не превращаем в busy=[] — иначе занятый зал выглядел бы свободным.
            try {
              const res: any = await roomsAPI.list();
              const roomsList: Room[] = Array.isArray(res) ? res : (res?.data ?? []);
              if (!Array.isArray(roomsList)) throw new Error("Некорректный список залов");
              active = roomsList.filter((r) => r.isActive !== false && (r as any).is_active !== false);
              busyById = {};
              hoursById = {};
            } catch (e2: any) {
              if (e2?.status === 401) throw new Error("Сессия истекла — обновите страницу");
              throw new Error(aggregateError?.message || "Не удалось получить расписание залов. Проверьте подключение к серверу.");
            }
          }
          cacheRef.current = { date, active, busyById, hoursById };
        }
        const results = await Promise.allSettled(
          active.map(async (r) => {
            // Занятость уже получена из агрегированного ответа — не дёргаем
            // /rooms/{id}/availability (у роли «user» он может быть закрыт).
            const byId = busyById[String(r.id)];
            if (byId) return { busy: byId };
            const byName = busyById[`name::${r.name}`];
            if (byName) return { busy: byName };
            return await roomsAPI.availability(r.id, { date });
          })
        );
        if (cancelled) return;
        // «Сейчас» и «сегодня» — по СЕРВЕРНЫМ часам/поясу (см. serverNowMin):
        // иначе при расхождении часов устройства свободные окна ошибочно
        // помечались прошедшими и виджет пустел после перезагрузки страницы.
        const curMin = serverNowMin();
        const isToday = date === serverTodayKeyTz();
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
          // Гибкий график: серверные hours для этого зала (undefined — старый
          // бэкенд без поля → fallback на локальный расчёт по schedule/дефолту).
          let hours: DayHours | null | undefined = hoursById[String(room.id)];
          if (hours === undefined) hours = hoursForDate((room as any).schedule, date);
          if (resItem.status !== "fulfilled") {
            next.push({ room, slots: [], busy: [], hours: hours ?? null, availabilityError: true });
            return;
          }
          const avail: RoomAvailability = (resItem.value as any)?.data ?? resItem.value;
          // Дни, помеченные в графике как выходные/закрытые, не блокируют
          // бронирование на главной. Показываем фактическую занятость и
          // свободные интервалы в стандартном диапазоне 08:00–20:00.
          const effectiveHours = hours ?? { start: "08:00", end: "20:00" };
          const h = effectiveHours;
          const fromMin = hmToMin(h.start);
          const toMin2 = hmToMin(h.end);
          const slots = computeFreeSlots(avail.busy ?? [], {
            isToday,
            nowMin: curMin,
            dayStartMin: fromMin,
            dayEndMin: toMin2,
          });
          const busy = (avail.busy ?? [])
            .map((b: any) => ({
              startMin: toMin(b.start),
              endMin: toMin(b.end),
              title: b.title || b.meetingTitle || "",
            }))
            .filter((b: any) => b.endMin > b.startMin);
          next.push({ room, slots, busy, hours: effectiveHours });
        });
        // Свободные залы — выше списка; внутри — по ближайшему слоту
        // (прошедшие окна в расчёте сортировки не участвуют)
        next.sort((a, b) => {
          const futureA = a.slots.filter((s) => !s.isPast);
          const futureB = b.slots.filter((s) => !s.isPast);
          if (futureA.length !== futureB.length) return futureB.length - futureA.length;
          return (futureA[0]?.startMin ?? 1e9) - (futureB[0]?.startMin ?? 1e9);
        });
        setInfos(next);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Не удалось загрузить комнаты");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, tick]);

  const isToday = date === serverTodayKeyTz();

  // Шкала строится по доступным часам залов. Если дата отмечена в графике
  // как выходная/закрытая, используем стандартный диапазон 08:00–20:00:
  // выходной статус не запрещает пользователю выбрать свободный слот.
  // Все залы отображаются независимо от выходного/праздничного статуса.
  // Для них всегда есть эффективный диапазон времени и возможность брони.
  const openInfos = infos;
  const hasRealHours = openInfos.some((i) => i.hours !== null);
  const scaleStart = hasRealHours
    ? Math.min(...openInfos.map((i) => hmToMin((i.hours ?? { start: "08:00", end: "20:00" }).start)))
    : hmToMin("08:00");
  const scaleEnd = hasRealHours
    ? Math.max(...openInfos.map((i) => hmToMin((i.hours ?? { start: "08:00", end: "20:00" }).end)))
    : hmToMin("20:00");
  const span = Math.max(scaleEnd - scaleStart, 60);
  const spct = (min: number) => ((min - scaleStart) / span) * 100;
  const showNowLine = isToday && nowMin >= scaleStart && nowMin <= scaleEnd;
  const scaleHours: number[] = [];
  for (let m = Math.ceil(scaleStart / 60) * 60; m <= scaleEnd; m += 60) scaleHours.push(m);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">
            <i className="fas fa-door-open mr-2 text-blue-600" aria-hidden="true"></i>
            Свободные залы
            <span className="text-xs font-normal text-gray-400 ml-2">
              {openInfos.length ? `${minToHm(scaleStart)}–${minToHm(scaleEnd)}` : ""}
            </span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button type="button" onClick={() => setDate(serverTodayKeyTz())}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${date === serverTodayKeyTz() ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-200 border-gray-200 dark:border-slate-600"}`}>
              Сегодня
            </button>
            <button type="button" onClick={() => setDate(shiftDateKey(serverTodayKeyTz(), 1))}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${date === shiftDateKey(serverTodayKeyTz(), 1) ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-200 border-gray-200 dark:border-slate-600"}`}>
              Завтра
            </button>
            <button type="button" onClick={() => setDate(shiftDateKey(serverTodayKeyTz(), 2))}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${date === shiftDateKey(serverTodayKeyTz(), 2) ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-200 border-gray-200 dark:border-slate-600"}`}>
              Послезавтра
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span>Дата расписания</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm border rounded-lg px-2 py-1 bg-white dark:bg-slate-700 dark:text-gray-100 dark:border-slate-600"
            aria-label="Дата проверки занятости"
          />
        </label>
      </div>

      {loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <i className="fas fa-circle-notch fa-spin mr-1" aria-hidden="true"></i> Загрузка…
        </p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && !error && infos.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Переговорные залы не настроены. Добавьте их в разделе «Управление залами» (админка) — после этого здесь
          появится расписание занятости.
        </p>
      )}

      {!loading && !error && infos.length > 0 && (
        // max-w-full — чтобы скролл был внутри карточки, а не по всей странице
        <div className="overflow-x-auto max-w-full">
          {/* Часовая линейка как в Outlook. На узких экранах колонка зала сужается
              до компактной, а полоса времени остаётся прокручиваемой. */}
          <div className="flex items-center text-[10px] text-gray-400 dark:text-gray-500 mb-1 min-w-[560px] sm:min-w-[640px]">
            <div className="w-16 sm:w-36 shrink-0" />
            <div className="relative flex-1 h-4">
              {scaleHours.map((m) => (
                <span key={m} className="absolute -translate-x-1/2" style={{ left: `${spct(m)}%` }}>
                  {minToHm(m)}
                </span>
              ))}
            </div>
          </div>

          <ul className="space-y-2 min-w-[560px] sm:min-w-[640px]">
            {infos.map(({ room, slots, busy, hours, availabilityError }) => (
              <li key={room.id}>
                <div className="flex items-center">
                  <div
                    className="w-16 sm:w-36 shrink-0 pr-2 text-sm text-gray-700 dark:text-gray-200 font-medium truncate"
                    title={`${room.name} • ${room.capacity} чел.${room.location ? ` • ${room.location}` : ""}${hours ? ` • ${hours.start}–${hours.end}` : ""}`}
                  >
                    <i
                      className={`fas fa-circle ${availabilityError ? "text-amber-500" : slots.length ? "text-emerald-500" : "text-red-400"} text-[8px] mr-2`}
                      aria-hidden="true"
                    ></i>
                    {room.name}
                    {availabilityError && <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-normal">Не удалось проверить занятость</span>}
                  </div>

                  {/* Полоса времени зала */}
                  <div className="relative flex-1 h-9 rounded-md bg-gray-100 dark:bg-slate-700 overflow-hidden">
                    {/* получасовые деления */}
                    {scaleHours.slice(1).map((m) => (
                      <div
                        key={m}
                        className="absolute top-0 bottom-0 w-px bg-gray-200 dark:bg-slate-600"
                        style={{ left: `${spct(m)}%` }}
                      />
                    ))}
                    {/* занятые блоки */}
                    {busy.map((b, i) => {
                      const visibleStart = Math.max(scaleStart, b.startMin);
                      const visibleEnd = Math.min(scaleEnd, b.endMin);
                      if (visibleEnd <= visibleStart) return null;
                      return (
                      <div
                        key={`b${i}`}
                        className="absolute top-0 bottom-0 bg-gray-300/80 dark:bg-slate-500/70 border-l-2 border-gray-400 dark:border-slate-400"
                        style={{ left: `${spct(visibleStart)}%`, width: `${spct(visibleEnd) - spct(visibleStart)}%` }}
                        title={`Занято ${minToHm(b.startMin)}–${minToHm(b.endMin)}${b.title ? `: ${b.title}` : ""}`}
                      />
                      );
                    })}
                    {/* свободные окна, разбитые на блоки по 30 минут:
                        будущие — кликабельные зелёные сегменты (выбор времени
                        начала брони), прошедшие — серые некликабельные */}
                    {slots.flatMap((s) =>
                      splitSlotIntoBlocks(s).map((blk) => {
                        if (blk.isPast || s.isPast) {
                          return (
                            <div
                              key={`p${blk.startMin}-${blk.endMin}`}
                              title={`Прошедшее время ${minToHm(blk.startMin)}–${minToHm(blk.endMin)} — бронирование невозможно`}
                              className="absolute top-1 bottom-1 rounded bg-gray-200/70 dark:bg-slate-600/50 border border-dashed border-gray-300 dark:border-slate-500 text-gray-400 dark:text-slate-400 text-[11px] px-1 overflow-hidden whitespace-nowrap pointer-events-none select-none"
                              style={{
                                left: `${spct(blk.startMin)}%`,
                                width: `${Math.max(spct(blk.endMin) - spct(blk.startMin), 1.5)}%`,
                              }}
                            >
                              <i className="fas fa-ban mr-1 opacity-60" aria-hidden="true"></i>
                              {minToHm(blk.startMin)}
                            </div>
                          );
                        }
                        const bookEnd = Math.min(blk.endMin, blk.startMin + 60);
                        return (
                          <button
                            key={`${blk.startMin}-${blk.endMin}`}
                            type="button"
                            onClick={() => onPickSlot?.(room.name, minToHm(blk.startMin), minToHm(bookEnd), date)}
                            title={`Забронировать с ${minToHm(blk.startMin)} до ${minToHm(blk.endMin)} (${humanDuration(blk.lengthMin)}) и создать ВКС`}
                            className="absolute top-1 bottom-1 rounded bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:hover:bg-emerald-800/60 border border-emerald-300 dark:border-emerald-600 text-emerald-800 dark:text-emerald-200 text-[11px] font-medium px-1 overflow-hidden whitespace-nowrap transition-colors"
                            style={{
                              left: `${spct(blk.startMin)}%`,
                              width: `${Math.max(spct(blk.endMin) - spct(blk.startMin), 1.5)}%`,
                            }}
                          >
                            <i className="fas fa-plus mr-1 opacity-70" aria-hidden="true"></i>
                            {minToHm(blk.startMin)}
                          </button>
                        );
                      })
                    )}
                    {/* линия «сейчас» */}
                    {showNowLine && (
                      <div
                        className="absolute top-0 bottom-0 w-[2px] bg-red-500 pointer-events-none"
                        style={{ left: `${spct(nowMin)}%` }}
                      />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Легенда */}
          <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-gray-500 dark:text-gray-400">
            <span>
              <span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300 align-middle mr-1" />
              Свободно (клик — создать ВКС)
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded bg-gray-200 border border-dashed border-gray-300 align-middle mr-1" />
              Прошло — бронь невозможна
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded bg-gray-300 align-middle mr-1" />
              Занято
            </span>
            <span>
              <span className="inline-block w-3 h-[2px] bg-red-500 align-middle mr-1" />
              Текущее время
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
