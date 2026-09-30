import { useEffect, useState } from "react";
import { roomsAPI } from "../api/client";
import type { Room, RoomAvailability } from "../types";

interface RoomsManagerProps {
  isAdmin: boolean;
  /** Подразделение текущего пользователя — для фильтра «доступные мне» (RBAC) */
  userDepartment?: string;
}

const toTime = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);

/** Таймлайн занятости комнаты 08:00–20:00 */
function AvailabilityTimeline({ availability }: { availability: RoomAvailability }) {
  const total = 12 * 60; // 08:00–20:00
  return (
    <div className="mt-2">
      <div className="relative h-6 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden">
        {availability.busy.map((b) => {
          const left = ((toTime(b.start) - 480) / total) * 100;
          const width = ((toTime(b.end) - toTime(b.start)) / total) * 100;
          return (
            <div
              key={b.meetingId}
              title={`${b.title} (${b.start}–${b.end})`}
              className="absolute top-0 h-full bg-red-400/80 text-[10px] text-white px-1 truncate leading-6"
              style={{ left: `${Math.max(left, 0)}%`, width: `${Math.min(width, 100 - Math.max(left, 0))}%` }}
            >
              {b.title}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
        <span>08:00</span>
        <span>14:00</span>
        <span>20:00</span>
      </div>
      {availability.free.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Свободно: {availability.free.map((f) => `${f.start}–${f.end}`).join(", ")}
        </p>
      )}
    </div>
  );
}

export default function RoomsManager({ isAdmin, userDepartment }: RoomsManagerProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", capacity: 6, location: "", equipment: "", departmentId: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [avail, setAvail] = useState<Record<string, RoomAvailability>>({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  // RBAC-фильтр: только комнаты, доступные текущему пользователю
  // (публичные + своего подразделения). Показывать все — переключатель.
  const [onlyMine, setOnlyMine] = useState(false);

  // Список подразделений уникален по всем комнатам с department_id
  const departments = Array.from(new Set(rooms.map((r) => r.departmentId).filter((d): d is number => d != null))).sort(
    (a, b) => a - b
  );

  // RBAC-фильтр: комната публичная (без department_id) либо «своего» отдела.
  // Сопоставление отдела пользователя — по имени/номеру из справочника rooms.
  const canAccessRoom = (r: Room) => {
    if (!r.departmentId) return true;
    if (isAdmin) return true;
    if (!userDepartment) return false;
    const deptNum = parseInt(String(userDepartment).replace(/\D+/g, ""), 10);
    if (Number.isFinite(deptNum) && deptNum === r.departmentId) return true;
    return String(r.departmentId) === String(userDepartment);
  };
  const visibleRooms = onlyMine && !isAdmin ? rooms.filter(canAccessRoom) : rooms;

  const load = async () => {
    setLoading(true);
    try {
      const res = await roomsAPI.list();
      const data = (res?.data ?? []).map((r: any) => ({
        id: String(r.id),
        name: r.name,
        capacity: r.capacity ?? 0,
        location: r.location ?? undefined,
        departmentId: r.department_id ?? null,
        equipment: r.equipment ?? [],
        description: r.description ?? undefined,
        isActive: !!r.is_active,
      }));
      setRooms(data);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить комнаты");
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async (roomIds: string[], d: string) => {
    for (const id of roomIds) {
      try {
        const res: any = await roomsAPI.availability(id, { date: d });
        if (res && !res.error) {
          setAvail((prev) => ({
            ...prev,
            [id]: {
              room: res.room,
              date: res.date,
              available: res.available,
              busy: (res.busy || []).map((b: any) => ({
                meetingId: String(b.meeting_id),
                title: b.title,
                start: b.start,
                end: b.end,
              })),
              free: res.free || [],
            },
          }));
        }
      } catch {
        /* ignore per-room errors */
      }
    }
  };

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (rooms.length)
      loadAvailability(
        rooms.map((r) => r.id),
        date
      );
  }, [rooms, date]);

  const submit = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      capacity: Number(form.capacity) || 1,
      location: form.location.trim() || null,
      department_id: form.departmentId ? Number(form.departmentId) : null,
      equipment: form.equipment
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      if (editingId) await roomsAPI.update(editingId, payload as any);
      else await roomsAPI.create(payload as any);
      setForm({ name: "", capacity: 6, location: "", equipment: "", departmentId: "" });
      setEditingId(null);
      load();
    } catch (e: any) {
      setError(e?.message || "Ошибка сохранения комнаты");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить комнату из справочника?")) return;
    await roomsAPI.remove(id);
    load();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-bold text-gray-800 dark:text-gray-100">
          <i className="fas fa-door-open mr-2 text-blue-500"></i>Переговорные комнаты
        </h3>
        {!isAdmin && (
          <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 cursor-pointer select-none">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            Только доступные мне
          </label>
        )}
        <label className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          Дата занятости:
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-2 px-2 py-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
          <input
            className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="Название *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            type="number"
            min={1}
            placeholder="Мест"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
          />
          <input
            className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="Этаж/крыло"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
          <input
            className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 sm:col-span-1"
            placeholder="Оборудование (через запятую)"
            value={form.equipment}
            onChange={(e) => setForm({ ...form, equipment: e.target.value })}
          />
          <select
            className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
            title="Подразделение (RBAC): пустое значение — публичная комната, доступна всем"
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
          >
            <option value="">Публичная (все)</option>
            {Array.from(new Set([...departments, ...(form.departmentId ? [Number(form.departmentId)] : [])]))
              .sort((a, b) => a - b)
              .map((d) => (
                <option key={d} value={d}>
                  Отдел #{d}
                </option>
              ))}
          </select>
          <button
            onClick={submit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            {editingId ? "Сохранить" : "Добавить"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Загрузка…</p>
      ) : rooms.length === 0 ? (
        <p className="text-sm text-gray-500">Комнаты не заведены. Добавьте их в админке.</p>
      ) : (
        <div className="space-y-3">
          {visibleRooms.map((r) => (
            <div
              key={r.id}
              className={`border rounded-lg p-3 ${canAccessRoom(r) ? "border-gray-200 dark:border-gray-700" : "border-gray-100 dark:border-gray-800 opacity-60"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-gray-800 dark:text-gray-100">{r.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  👤 {r.capacity} мест{r.location ? ` • ${r.location}` : ""}
                </span>
                {r.departmentId != null && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      canAccessRoom(r)
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        : "bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                    }`}
                    title={
                      canAccessRoom(r)
                        ? "Комната закреплена за подразделение — вам доступна"
                        : "Закреплена за другим подразделением"
                    }
                  >
                    🏢 Отдел #{r.departmentId}
                  </span>
                )}
                {(r.equipment || []).map((eq) => (
                  <span
                    key={eq}
                    className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  >
                    {eq}
                  </span>
                ))}
                {avail[r.id] &&
                  (avail[r.id].busy.length ? (
                    <span className="ml-auto text-xs text-red-600">занята {avail[r.id].busy.length} раз(а)</span>
                  ) : (
                    <span className="ml-auto text-xs text-green-600">свободна весь день</span>
                  ))}
                {isAdmin && (
                  <span className="flex gap-2 ml-2">
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => {
                        setEditingId(r.id);
                        setForm({
                          name: r.name,
                          capacity: r.capacity,
                          location: r.location || "",
                          equipment: (r.equipment || []).join(", "),
                          departmentId: r.departmentId != null ? String(r.departmentId) : "",
                        });
                      }}
                    >
                      Изменить
                    </button>
                    <button className="text-xs text-red-600 hover:underline" onClick={() => remove(r.id)}>
                      Удалить
                    </button>
                  </span>
                )}
              </div>
              {avail[r.id] && <AvailabilityTimeline availability={avail[r.id]} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
