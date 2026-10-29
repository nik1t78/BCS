import React, { useEffect, useMemo, useState } from "react";
import { roomsAPI } from "../api/client";

/**
 * Предпросмотр «экрана ожидания» ТВ прямо в админке (вкладка «Статус системы»).
 * Список залов берём через /api/rooms — админу RoomController отдаёт tv_token.
 * iframe грузит реальный маршрут /tv/{id}?token=... — то есть ровно то,
 * что видит телевизор, включая тот же JS-поллинг /api/tv/{id}/next.
 */
export default function TvScreenPreview() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    roomsAPI
      .list()
      .then((res: any) => {
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const withToken = list.filter((r: any) => r.tv_token);
        setRooms(withToken);
        if (withToken.length && !selectedId) setSelectedId(String(withToken[0].id));
      })
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const room = useMemo(
    () => rooms.find((r) => String(r.id) === selectedId),
    [rooms, selectedId]
  );

  // Путь строим от id зала — экран поллит /api/tv/{id}/next, названия с пробелами больше не ломают запрос.
  const src = room
    ? `/tv/${encodeURIComponent(String(room.id))}?token=${encodeURIComponent(String(room.tv_token))}&preview=1`
    : "";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-bold text-gray-800 dark:text-gray-100">
          <i className="fas fa-tv text-indigo-600 mr-2"></i>Предпросмотр экрана ТВ
        </h3>
        <div className="flex items-center gap-2">
          {rooms.length > 0 ? (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
            >
              {rooms.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.name}
                </option>
              ))}
            </select>
          ) : null}
          {src && (
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
              title="Открыть в новой вкладке"
            >
              <i className="fas fa-expand mr-1"></i>Открыть
            </a>
          )}
        </div>
      </div>
      {loading ? (
        <p className="p-4 text-sm text-gray-500">Загрузка залов…</p>
      ) : rooms.length === 0 ? (
        <p className="p-4 text-sm text-gray-500">
          У залов ещё нет токенов экрана. Откройте вкладку «Комнаты» — токен
          генерируется автоматически при просмотре списка админом.
        </p>
      ) : (
        <iframe
          title="Предпросмотр экрана ТВ"
          src={src}
          className="w-full h-[480px] border-0 bg-slate-900"
          sandbox="allow-scripts allow-same-origin"
        />
      )}
    </div>
  );
}
