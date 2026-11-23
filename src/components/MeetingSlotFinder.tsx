import React, { useMemo, useState } from "react";
import { User } from "../types";
import { meetingsAPI } from "../api/client";
import { serverTodayKey } from "../api/serverTime";

interface Suggestion {
  room_id: number;
  room: string;
  date: string;
  start: string;
  end: string;
  duration: number;
}

interface MeetingSlotFinderProps {
  users: User[];
  onClose: () => void;
  onPickSlot: (roomName: string, startTime: string, endTime: string, date: string) => void;
}

function shiftDateKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

function formatDate(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  });
}

export default function MeetingSlotFinder({ users, onClose, onPickSlot }: MeetingSlotFinderProps) {
  const today = serverTodayKey();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(shiftDateKey(today, 7));
  const [duration, setDuration] = useState(60);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ru-RU");
    return users
      .filter((user) => !q || (user.name || "").toLocaleLowerCase("ru-RU").includes(q))
      .slice(0, 100);
  }, [users, query]);

  const toggleUser = (id: number) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  const search = async () => {
    setError("");
    setLoading(true);
    setSearched(true);
    setSuggestions([]);
    try {
      const response: any = await meetingsAPI.suggestSlots({
        date_from: dateFrom,
        date_to: dateTo,
        duration,
        participant_ids: selectedIds,
        limit: 30,
      });
      setSuggestions(Array.isArray(response?.data) ? response.data : []);
    } catch (e: any) {
      setError(e?.message || "Не удалось подобрать свободное время");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-3 sm:p-5" onMouseDown={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <header className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">
              <i className="fas fa-calendar-check text-blue-600 mr-2"></i>Подбор общего времени
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Найдём свободный интервал сразу для участников и переговорной.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl" aria-label="Закрыть">×</button>
        </header>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-300">
              С даты
              <input type="date" min={today} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2" />
            </label>
            <label className="text-sm text-gray-600 dark:text-gray-300">
              По дату
              <input type="date" min={dateFrom || today} max={shiftDateKey(dateFrom || today, 14)} value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2" />
            </label>
            <label className="text-sm text-gray-600 dark:text-gray-300">
              Длительность
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2">
                {[30, 45, 60, 90, 120, 180, 240].map((value) => <option key={value} value={value}>{value < 60 ? `${value} мин` : `${value / 60} ч`}</option>)}
              </select>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Участники</label>
              <span className="text-xs text-gray-500">Выбрано: {selectedIds.length}; ваше время учитывается автоматически</span>
            </div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти сотрудника..." className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 mb-2" />
            <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
              {filteredUsers.map((user) => {
                const id = Number(user.id);
                return (
                  <label key={id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 rounded px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input type="checkbox" checked={selectedIds.includes(id)} onChange={() => toggleUser(id)} />
                    <span className="truncate">{user.name}</span>
                  </label>
                );
              })}
              {filteredUsers.length === 0 && <p className="text-xs text-gray-400 p-2">Сотрудники не найдены.</p>}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" disabled={loading || !dateFrom || !dateTo || dateTo < dateFrom} onClick={search} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium">
              {loading ? <><i className="fas fa-spinner fa-spin mr-2"></i>Подбираем...</> : <><i className="fas fa-search mr-2"></i>Найти свободное время</>}
            </button>
          </div>

          {error && <div role="alert" className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3 text-sm">{error}</div>}
          {searched && !loading && !error && suggestions.length === 0 && <p className="text-sm text-gray-500 text-center py-5">Подходящих интервалов не найдено. Попробуйте изменить даты или длительность.</p>}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Подходящие варианты</h4>
              {suggestions.map((slot, index) => (
                <div key={`${slot.room_id}-${slot.date}-${slot.start}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <div>
                    <div className="font-semibold text-gray-800 dark:text-gray-100">{slot.room}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{formatDate(slot.date)} · {slot.start}–{slot.end}</div>
                  </div>
                  <button type="button" onClick={() => onPickSlot(slot.room, slot.start, slot.end, slot.date)} className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium">
                    Выбрать время
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
