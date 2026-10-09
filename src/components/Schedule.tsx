import { useState, useEffect } from "react";
import { User, Meeting } from "../types";
import { getMeetings, getUsersForDisplay, rescheduleMeeting, checkRescheduleConflicts, updateMeeting } from "../store-api";
import { roomsAPI } from "../api/client";
import { occursOn } from "../utils/recurrence";
import OutlookCalendar, { OutlookView } from "./OutlookCalendar";

interface ScheduleProps {
  user: User;
  onNavigate: (page: string) => void;
}

export default function Schedule({ user, onNavigate }: ScheduleProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [view, setView] = useState<OutlookView>("week");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filter, setFilter] = useState<"all" | "my" | "today" | "upcoming">("all");
  // Справочник всех переговорных комнат (включая созданные пользователями)
  // и фильтр календаря по комнате.
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomFilter, setRoomFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  // Детальная карточка ВКС (просмотр описания/комнаты по клику) и режим редактирования
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", startTime: "", endTime: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  // Загружаем справочник комнат — пользователи видят ВСЕ комнаты,
  // включая те, что создали другие пользователи (даже без встреч).
  useEffect(() => {
    roomsAPI
      .list()
      .then((res: any) => setRooms(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []))
      .catch(() => setRooms([]));
  }, []);

  const openMeeting = (m: Meeting) => {
    setSelectedMeeting(m);
    setEditing(false);
    setSaveError(null);
  };

  const startEdit = (m: Meeting) => {
    setEditForm({ title: m.title ?? "", startTime: m.startTime, endTime: m.endTime });
    setEditing(true);
    setSaveError(null);
  };

  const saveEdit = async () => {
    if (!selectedMeeting || !editForm.title.trim()) return;
    setSaving(true);
    setSaveError(null);
    const res = await updateMeeting(selectedMeeting.id, {
      ...selectedMeeting,
      title: editForm.title.trim(),
      startTime: editForm.startTime,
      endTime: editForm.endTime,
    });
    setSaving(false);
    if (res) {
      await loadData();
      setSelectedMeeting({ ...selectedMeeting, ...editForm });
      setEditing(false);
    } else {
      setSaveError("Не удалось сохранить изменения");
    }
  };

  // API возвращает id числами, user.id — строка: сравниваем через Number
  const hasAccessTo = (m: Meeting) =>
    Number(m.organizerId) === Number(user.id) || (m.participants ?? []).some((p) => Number(p) === Number(user.id));

  const isAdminLike = user.role === "admin" || user.role === "moderator";

  const loadData = async () => {
    setLoading(true);
    const [allMeetings, users] = await Promise.all([getMeetings(), getUsersForDisplay(user.role)]);

    // Админ/модератор — все конференции. Обычный пользователь — ВСЕ ВКС:
    // организованные им, с его участием + общедоступные (не приватные).
    // Приватная встреча без участия скрыта; у приватных с участием название
    // остаётся закрытым («Конференция») — см. canSeeDetails ниже.
    const visibleMeetings =
      isAdminLike ? allMeetings : allMeetings.filter((m) => m.isPrivate !== true || hasAccessTo(m));

    setMeetings(visibleMeetings);
    setAllUsers(users);
    setLoading(false);
  };

  const calendarMeetings = meetings.filter((m) => {
    if (roomFilter && m.room !== roomFilter) return false;
    if (filter === "my") return hasAccessTo(m);
    if (filter === "today") return occursOn(m, new Date());
    if (filter === "upcoming") return m.status !== "completed" && m.status !== "cancelled";
    return true;
  });

  const getUserName = (id: string) => allUsers.find((u) => Number(u.id) === Number(id))?.name || "—";

  // Можно ли перетаскивать встречу (только организатор или админ — как на бэкенде)
  const canDrag = (m: Meeting) =>
    m.status !== "cancelled" &&
    m.status !== "completed" &&
    (Number(m.organizerId) === Number(user.id) || isAdminLike || hasAccessTo(m));

  // Для повторяющихся встреч occurrence-копия имеет id родителя — переносим оригинал
  const originalOf = (m: Meeting): Meeting => meetings.find((x) => String(x.id) === String(m._occurrenceOf ?? m.id)) ?? m;

  // Перенос встречи drag&drop в сетке Outlook (день + время с шагом 15 минут)
  const handleRequestMove = async (occ: Meeting, dateKey: string, startTime: string) => {
    const m = originalOf(occ);
    if (!canDrag(m)) return;
    const sameDay = m.date === dateKey && m.startTime === startTime;
    if (sameDay) return;

    const durationMin = Math.max(
      (() => {
        const [sh, sm] = m.startTime.split(":").map(Number);
        const [eh, em] = m.endTime.split(":").map(Number);
        return eh * 60 + em - (sh * 60 + sm);
      })(),
      15
    );
    const [nh, nm] = startTime.split(":").map(Number);
    const endTotal = Math.min(nh * 60 + nm + durationMin, 23 * 60 + 45);
    const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`;

    const when = new Date(dateKey + "T00:00:00").toLocaleDateString("ru-RU");
    if (!confirm(`Перенести «${m.title}» на ${when}, ${startTime}? Участники получат уведомление.`)) return;

    // Проверка конфликтов расписания у участников на новой дате
    try {
      const found = await checkRescheduleConflicts({ ...m, startTime, endTime }, dateKey);
      if (found.length > 0) {
        const names = found.map((c) => `«${c.title}» ${c.start_time}–${c.end_time}`).join("\n");
        if (
          !confirm(
            `⚠️ Конфликты при переносе на ${when}:\n${names}\n\nПеренести всё равно?`
          )
        ) {
          return;
        }
      }
    } catch {
      /* если проверка недоступна — продолжаем без неё */
    }

    setMoving(true);
    const saved = await rescheduleMeeting(String(m.id), {
      date: dateKey,
      startTime,
      endTime,
      force: true,
    });
    setMoving(false);
    if (saved) loadData();
    else alert("Не удалось перенести встречу");
  };

  // Приватные встречи для посторонних показываем как «Конференция» (без деталей)
  const displayTitle = (m: Meeting) =>
    isAdminLike || hasAccessTo(m) ? m.title : m.isPrivate ? "Конференция" : m.title;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
          <p className="text-gray-600 dark:text-gray-400">Загрузка расписания...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-700 dark:text-gray-100">
              <i className="fas fa-calendar-alt text-blue-600 mr-2"></i>
              Расписание
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Переключатель видов — как в Outlook: День / Рабочая неделя / Неделя / Месяц */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {(
                [
                  ["day", "День"],
                  ["workweek", "Рабочая неделя"],
                  ["week", "Неделя"],
                  ["month", "Месяц"],
                ] as [OutlookView, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    view === v
                      ? "bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400 font-medium"
                      : "text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => onNavigate("meetings")}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <i className="fas fa-video mr-1"></i>Мои конференции
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {(["all", "my", "today", "upcoming"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${filter === f ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
            >
              {f === "all" ? "Все" : f === "my" ? "Мои" : f === "today" ? "Сегодня" : "Ближайшие"}
            </button>
          ))}
        </div>

        {/* Комнаты: в календаре показываем ВСЕ переговорные комнаты справочника,
            включая те, что создали пользователи и в которых пока нет встреч. */}
        {rooms.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <i className="fas fa-door-open mr-1"></i>Комнаты:
            </span>
            {rooms.map((r: any) => {
              const active = roomFilter === r.name;
              return (
                <button
                  key={r.id ?? r.name}
                  onClick={() => setRoomFilter(active ? "" : r.name)}
                  title={active ? "Показать все комнаты" : `Показать только «${r.name}»`}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    active
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-red-400"
                  }`}
                >
                  {r.name}
                  {r.capacity ? <span className="opacity-60 ml-1">·{r.capacity}</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Календарь в стиле Outlook: сетка времени, линия «сейчас», drag&drop переноса */}
      <OutlookCalendar
        meetings={calendarMeetings}
        view={view}
        selectedDate={selectedDate}
        onSelectedDateChange={setSelectedDate}
        onSelectMeeting={openMeeting}
        canDragMeeting={canDrag}
        onRequestMove={handleRequestMove}
        displayTitle={displayTitle}
      />

      {moving && (
        <div className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <i className="fas fa-spinner fa-spin"></i> Перенос встречи...
        </div>
      )}

      {/* Детальная карточка ВКС: описание, комната, время; редактирование названия/времени */}
      {selectedMeeting &&
        (() => {
          const canSee = isAdminLike || hasAccessTo(selectedMeeting);
          const canEdit = canSee && selectedMeeting.status !== "cancelled" && selectedMeeting.status !== "completed";
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setSelectedMeeting(null)}
            >
              <div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                    {canSee ? selectedMeeting.title : "Конференция"}
                  </h3>
                  <button
                    onClick={() => setSelectedMeeting(null)}
                    className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                    aria-label="Закрыть"
                  >
                    &times;
                  </button>
                </div>

                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Название</label>
                      <input
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Начало</label>
                        <input
                          type="time"
                          value={editForm.startTime}
                          onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Окончание</label>
                        <input
                          type="time"
                          value={editForm.endTime}
                          onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                        />
                      </div>
                    </div>
                    {saveError && <p className="text-sm text-red-500">{saveError}</p>}
                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        onClick={() => setEditing(false)}
                        className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                      >
                        Отмена
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? "Сохранение..." : "Сохранить"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <p>
                      <i className="fas fa-calendar mr-2 text-blue-500"></i>
                      {new Date(`${selectedMeeting.date}T00:00:00`).toLocaleDateString("ru-RU")}, {selectedMeeting.startTime} –{" "}
                      {selectedMeeting.endTime}
                    </p>
                    <p>
                      <i className="fas fa-map-marker-alt mr-2 text-red-500"></i>
                      {canSee ? selectedMeeting.room || "Комната не указана" : "Место скрыто"}
                    </p>
                    <p>
                      <i className="fas fa-user mr-2 text-green-500"></i>Организатор:{" "}
                      {canSee ? getUserName(selectedMeeting.organizerId) : "—"}
                    </p>
                    {canSee && selectedMeeting.description && (
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <p className="font-medium text-gray-800 dark:text-gray-100 mb-1">Описание:</p>
                        <p className="text-gray-600 dark:text-gray-400 whitespace-pre-line">{selectedMeeting.description}</p>
                      </div>
                    )}
                    {canSee && selectedMeeting.link && (
                      <a
                        href={selectedMeeting.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        <i className="fas fa-video mr-1"></i>Войти в ВКС
                      </a>
                    )}
                    {!canSee && (
                      <p className="text-gray-400 italic pt-2">Детали скрыты: вы не участник этой приватной конференции.</p>
                    )}
                    {canEdit && (
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                        <button
                          onClick={() => startEdit(selectedMeeting)}
                          className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200"
                        >
                          <i className="fas fa-pen mr-1"></i>Редактировать название и время
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
