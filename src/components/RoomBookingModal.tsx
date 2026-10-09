import React, { useEffect, useMemo, useState } from "react";
import { Room, RoomAvailability } from "../types";
import { roomsAPI } from "../api/client";
import { computeFreeSlots, minToHm, hmToMin, WORK_DAY_START_MIN, WORK_DAY_END_MIN } from "../utils/freeSlots";

interface RoomBookingModalProps {
  open: boolean;
  /** Стартовая дата предзаполнения (YYYY-MM-DD) */
  date: string;
  /** Стартовое время предзаполнения (HH:mm) */
  startTime: string;
  /** Предзаполнить переговорную (например, из виджета свободных залов) */
  roomName?: string;
  /** Конец выбранного интервала (HH:mm) — для точного восстановления длительности */
  endTime?: string;
  /** Закрыть без создания */
  onClose: () => void;
  /** Выбор подтверждён → родитель открывает форму ВКС с предзаполнением */
  onConfirm: (roomName: string, date: string, startTime: string, endTime: string) => void;
}

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** «HH:MM» → минуты; поддержка 24:00 */
const toMin = (s: string): number => {
  if (/^\d{1,2}:\d{2}$/.test(s)) return hmToMin(s);
  const d = new Date(s);
  return d.getHours() * 60 + d.getMinutes();
};

const SNAP = 15; // шаг прилипания как в Outlook

/**
 * Модальное окно выбора зала в стиле Outlook: слева список переговорных,
 * справа суточная шкала времени 00:00–24:00 — занятые блоки серые, свободные
 * зелёные. Клик по свободному времени выбирает слот (по умолчанию 1 час),
 * кнопка «Занять и создать ВКС» отправляет пользователя в форму создания
 * конференции с предзаполненными залом/датой/временем и автогенерацией ссылки.
 */
export default function RoomBookingModal({ open, date, startTime, roomName, endTime, onClose, onConfirm }: RoomBookingModalProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selRoomId, setSelRoomId] = useState<string | null>(null);
  const [availDate, setAvailDate] = useState(date || todayKey());
  const [busy, setBusy] = useState<{ startMin: number; endMin: number; title: string }[]>([]);
  const [free, setFree] = useState<{ startMin: number; endMin: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startMin, setStartMin] = useState<number>(() => {
    const m = hmToMin(startTime || "09:00");
    return Math.round(m / SNAP) * SNAP;
  });
  const [durMin, setDurMin] = useState(() => {
    if (!endTime) return 60;
    const d = hmToMin(endTime) - hmToMin(startTime || "00:00");
    return d >= SNAP && d <= 24 * 60 ? d : 60;
  });
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 60000);
    return () => clearInterval(t);
  }, [open]);

  // Синхронизация с предзаполнением (дата/время/зал/длительность из виджета или календаря)
  useEffect(() => {
    if (!open) return;
    setAvailDate(date || todayKey());
    const s = Math.round(hmToMin(startTime || "09:00") / SNAP) * SNAP;
    setStartMin(s);
    if (endTime) {
      const d = hmToMin(endTime) - hmToMin(startTime || "00:00");
      if (d >= SNAP && d <= 24 * 60) setDurMin(d);
    }
    if (roomName && rooms.length) {
      const hit = rooms.find((r) => r.name === roomName);
      if (hit) setSelRoomId(String(hit.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, startTime, endTime, roomName, rooms]);

  // Список активных комнат — один раз при открытии
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res: any = await roomsAPI.list();
        const list: Room[] = Array.isArray(res) ? res : res?.data ?? [];
        const active = list.filter((r) => r.isActive !== false);
        if (cancelled) return;
        setRooms(active);
        // Выбрать предзаполненный зал, иначе — первый активный
        const wanted = roomName ? active.find((r) => r.name === roomName) : undefined;
        if (wanted) {
          setSelRoomId(String(wanted.id));
        } else if (active.length && !active.some((r) => String(r.id) === selRoomId)) {
          setSelRoomId(String(active[0].id));
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Не удалось загрузить комнаты");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, startTime]);

  // Занятость выбранной комнаты на выбранную дату
  useEffect(() => {
    if (!open || !selRoomId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res: any = await roomsAPI.availability(selRoomId, { date: availDate });
        const avail: RoomAvailability = res?.data ?? res;
        if (cancelled) return;
        const b = (avail.busy ?? [])
          .map((x) => ({
            startMin: Math.max(toMin(x.start), WORK_DAY_START_MIN),
            endMin: Math.min(toMin(x.end), WORK_DAY_END_MIN),
            title: x.title || "занято",
          }))
          .filter((x) => x.endMin > x.startMin);
        setBusy(b);
        setFree(computeFreeSlots(avail.busy ?? [], { isToday: availDate === todayKey(), nowMin }).map((s) => ({ startMin: s.startMin, endMin: s.endMin })));
      } catch (e: any) {
        if (!cancelled) {
          setBusy([]);
          setFree([]);
          setError(e?.message || "Нет данных о занятости");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, selRoomId, availDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const daySpan = WORK_DAY_END_MIN - WORK_DAY_START_MIN;
  const pct = (min: number) => ((min - WORK_DAY_START_MIN) / daySpan) * 100;

  const endMin = Math.min(startMin + durMin, WORK_DAY_END_MIN);

  /** Пересечение выбранного интервала с занятостью или прошедшим временем */
  const conflict = useMemo(() => {
    const pastLimit = availDate === todayKey() ? nowMin : WORK_DAY_START_MIN;
    if (startMin < pastLimit) return "Это время уже прошло";
    if (endMin <= startMin) return "Некорректный интервал";
    const hit = busy.find((b) => b.startMin < endMin && b.endMin > startMin);
    if (hit) return `Зал занят: ${hit.title} (${minToHm(hit.startMin)}–${minToHm(hit.endMin)})`;
    return null;
  }, [startMin, endMin, busy, availDate, nowMin]);

  // Клик по шкале → выбрать начало встречи (прилипание к 15 мин)
  const handleScaleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    const raw = WORK_DAY_START_MIN + ratio * daySpan;
    const snapped = Math.floor(raw / SNAP) * SNAP;
    setStartMin(Math.min(snapped, WORK_DAY_END_MIN - SNAP));
  };

  const selRoom = rooms.find((r) => String(r.id) === selRoomId);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            <i className="fas fa-door-open mr-2 text-blue-600"></i>Выбор зала — занять время и создать ВКС
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none" aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
          {/* Левая колонка: комната, дата, длительность */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Переговорная</label>
              <select
                value={selRoomId ?? ""}
                onChange={(e) => setSelRoomId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-gray-100 dark:border-slate-600"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.capacity ? ` · ${r.capacity} мест` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Дата</label>
              <input
                type="date"
                value={availDate}
                onChange={(e) => setAvailDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-gray-100 dark:border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Длительность</label>
              <select
                value={durMin}
                onChange={(e) => setDurMin(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-gray-100 dark:border-slate-600"
              >
                {[15, 30, 45, 60, 90, 120, 180].map((d) => (
                  <option key={d} value={d}>
                    {d < 60 ? `${d} мин` : d % 60 === 0 ? `${d / 60} ч` : `${Math.floor(d / 60)} ч ${d % 60} мин`}
                  </option>
                ))}
                {/* Точная длительность из предзаполнения (например, 20 мин из виджета залов) */}
                {![15, 30, 45, 60, 90, 120, 180].includes(durMin) && (
                  <option value={durMin}>
                    {durMin < 60 ? `${durMin} мин` : `${Math.floor(durMin / 60)} ч ${durMin % 60} мин`}
                  </option>
                )}
              </select>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
              <p className="font-semibold text-blue-700 dark:text-blue-300">{selRoom?.name || "—"}</p>
              <p className="text-gray-700 dark:text-gray-300">
                {minToHm(startMin)} – {minToHm(endMin)}
              </p>
              {conflict ? (
                <p className="text-red-600 dark:text-red-400 mt-1">
                  <i className="fas fa-exclamation-triangle mr-1"></i>
                  {conflict}
                </p>
              ) : (
                <p className="text-emerald-600 dark:text-emerald-400 mt-1">
                  <i className="fas fa-check-circle mr-1"></i>
                  Зал свободен
                </p>
              )}
            </div>
            <button
              disabled={!!conflict || !selRoom}
              onClick={() => selRoom && onConfirm(selRoom.name, availDate, minToHm(startMin), minToHm(endMin))}
              className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <i className="fas fa-video mr-2"></i>Занять и создать ВКС
            </button>
          </div>

          {/* Правая колонка: суточная шкала как в Outlook */}
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Шкала дня 00:00–24:00 — кликните свободное место, чтобы выбрать время начала.
              Зелёные окна — свободно, серые — занято.
            </p>
            {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
            <div className="relative h-[480px] rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden select-none">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <i className="fas fa-circle-notch fa-spin mr-2"></i> Загрузка занятости…
                </div>
              ) : (
                <div className="absolute inset-0 cursor-pointer" onClick={handleScaleClick}>
                  {/* Часовые линии и подписи */}
                  {Array.from({ length: 25 }, (_, i) => i * 60).map((m) => (
                    <div
                      key={m}
                      className={`absolute left-0 right-0 border-t ${m % 120 === 0 ? "border-gray-200 dark:border-slate-600" : "border-dashed border-gray-100 dark:border-slate-700"}`}
                      style={{ top: `${pct(m)}%` }}
                    >
                      {m % 120 === 0 && (
                        <span className="absolute -top-2 left-1 text-[10px] text-gray-400 bg-white/80 dark:bg-slate-800/80 px-0.5 rounded">
                          {minToHm(m)}
                        </span>
                      )}
                    </div>
                  ))}
                  {/* Свободные окна */}
                  {free.map((f, i) => (
                    <div
                      key={`f${i}`}
                      className="absolute left-16 right-2 rounded bg-emerald-100/70 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700"
                      style={{ top: `${pct(f.startMin)}%`, height: `${pct(f.endMin) - pct(f.startMin)}%` }}
                      title={`Свободно ${minToHm(f.startMin)}–${minToHm(f.endMin)}`}
                    />
                  ))}
                  {/* Занятые блоки */}
                  {busy.map((b, i) => (
                    <div
                      key={`b${i}`}
                      className="absolute left-16 right-2 rounded bg-gray-200 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 overflow-hidden"
                      style={{ top: `${pct(b.startMin)}%`, height: `${Math.max(pct(b.endMin) - pct(b.startMin), 1.2)}%` }}
                      title={`${b.title} ${minToHm(b.startMin)}–${minToHm(b.endMin)}`}
                    >
                      <span className="block truncate text-[11px] text-gray-600 dark:text-gray-300 px-2 py-0.5">
                        {b.title} · {minToHm(b.startMin)}–{minToHm(b.endMin)}
                      </span>
                    </div>
                  ))}
                  {/* Выбранный интервал поверх */}
                  {!conflict && (
                    <div
                      className="absolute left-24 right-4 rounded-md bg-blue-600/85 border-2 border-blue-700 shadow-lg pointer-events-none"
                      style={{ top: `${pct(startMin)}%`, height: `${Math.max(pct(endMin) - pct(startMin), 1.5)}%` }}
                    >
                      <span className="block text-[11px] font-semibold text-white px-2 py-0.5 truncate">
                        Ваша ВКС · {minToHm(startMin)}–{minToHm(endMin)}
                      </span>
                    </div>
                  )}
                  {/* Конфликтующий выбранный интервал */}
                  {conflict && (
                    <div
                      className="absolute left-24 right-4 rounded-md bg-red-500/60 border-2 border-red-600 pointer-events-none"
                      style={{ top: `${pct(startMin)}%`, height: `${Math.max(pct(endMin) - pct(startMin), 1.5)}%` }}
                    />
                  )}
                  {/* Линия «сейчас» */}
                  {availDate === todayKey() && nowMin >= WORK_DAY_START_MIN && nowMin <= WORK_DAY_END_MIN && (
                    <div className="absolute left-0 right-0 pointer-events-none" style={{ top: `${pct(nowMin)}%` }}>
                      <div className="h-0.5 bg-red-500 relative">
                        <span className="absolute -left-1 -top-[5px] w-3 h-3 rounded-full bg-red-500" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
