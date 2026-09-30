import React, { useState, useEffect } from "react";
import { User, Meeting, Tag, ScheduleConflict } from "../types";
import { roomsAPI } from "../api/client";
import {
  getMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  cancelMeeting,
  getUsersForDisplay,
  getTags,
  checkConflictsApi,
} from "../store-api";
import TagsSelector from "./TagsSelector";
import MeetingRsvp from "./MeetingRsvp";
import { describeRRule } from "../utils/recurrence";
import MeetingHistoryView from "./MeetingHistoryView";
import MeetingMinutes from "./MeetingMinutes";
import { SortMode, SORT_OPTIONS, sortMeetings, getMeetingGroup } from "../utils/meetingSort";
import { exportMeetingToIcs } from "../utils/ics";
import { getFavoriteIds, toggleFavorite, addFavorites } from "../utils/favorites";

interface UserPanelProps {
  user: User;
  onNavigate: (page: string) => void;
}

const PAGE_SIZE = 20;

// Напоминания по умолчанию для новых конференций — из настроек пользователя
const getDefaultReminder = (): number => {
  try {
    const raw = localStorage.getItem("vks_reminder_default");
    const v = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isNaN(v) && v >= 5 && v <= 1440) return v;
  } catch {
    /* ignore */
  }
  return 15;
};

export default function UserPanel({ user, onNavigate }: UserPanelProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Модальное окно просмотра конференции (доступен всем участникам)
  const [viewMeeting, setViewMeeting] = useState<Meeting | null>(null);
  // Фильтры, календарь, избранное, массовые действия, история изменений
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "past" | "cancelled">("all");
  const [roomFilter, setRoomFilter] = useState("");
  const [roomsCatalog, setRoomsCatalog] = useState<{ name: string; capacity: number; equipment: string[] }[]>([]);
  const [tagFilter, setTagFilter] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
  });
  const [calView, setCalView] = useState<"month" | "week">("month");
  const [favorites, setFavorites] = useState<Set<string>>(() => getFavoriteIds(user.id));
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Компактный режим списка (адаптивен для мобильных и «плотного» просмотра)
  const [compact, setCompact] = useState<boolean>(() => {
    try {
      return localStorage.getItem("vks_compact_list") === "1";
    } catch {
      return false;
    }
  });
  const toggleCompact = () =>
    setCompact((c) => {
      try {
        localStorage.setItem("vks_compact_list", c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });

  const emptyMeeting: Meeting = {
    id: "",
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "10:00",
    endTime: "11:00",
    organizerId: user.id,
    participants: [user.id],
    participantEmails: [],
    link: "",
    room: "",
    status: "scheduled",
    reminderMinutes: getDefaultReminder(),
    recurring: "none",
    priority: "medium",
    createdAt: new Date().toISOString(),
    isPrivate: false,
  };

  const [formData, setFormData] = useState<Meeting>(emptyMeeting);

  useEffect(() => {
    loadData();
  }, [user.id, showForm]);

  const loadData = async () => {
    setLoading(true);
    const [allMeetings, allUsers, allTags] = await Promise.all([
      getMeetings(),
      getUsersForDisplay(user.role),
      getTags(),
    ]);

    // Модераторы и админы видят все конференции, обычные пользователи - тоже все
    // (но могут редактировать только свои)
    setMeetings(allMeetings);
    setUsers(allUsers);
    setTags(allTags);
    // getMeetings при ошибке API (401/500/нет связи с бэкендом) возвращает [] —
    // показываем явную ошибку вместо пустого «Нет конференций»
    setError(allMeetings.length === 0 && allUsers.length === 0);
    setLoading(false);
  };

  // Все конференции видны в списке без фильтров «Организованные/Участие».
  // Сортировка: по умолчанию «умная» — сначала сегодняшние ВКС, затем завтра,
  // ближайшая неделя, поздние и в конце прошедшие/отменённые.
  const [sortMode, setSortMode] = useState<SortMode>("smart");

  // ===== Фильтры: статус / комната / тег / поиск по названию, описанию, участникам =====
  const nowIso = () => new Date().toISOString().slice(0, 16);
  useEffect(() => {
    roomsAPI
      .list()
      .then((res: any) => {
        setRoomsCatalog(
          (res?.data ?? []).map((r: any) => ({
            name: r.name,
            capacity: r.capacity ?? 0,
            equipment: r.equipment ?? [],
          }))
        );
      })
      .catch(() => {});
  }, []);

  const rooms = Array.from(
    new Set([...(meetings.map((m) => m.room).filter(Boolean) as string[]), ...roomsCatalog.map((r) => r.name)])
  ).sort();
  const matchSearch = (m: Meeting) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const inTitle = m.title.toLowerCase().includes(q);
    const inDesc = (m.description ?? "").toLowerCase().includes(q);
    const inPeople =
      getUserName(m.organizerId).toLowerCase().includes(q) ||
      (m.participants ?? []).some((p) => getUserName(p).toLowerCase().includes(q));
    return inTitle || inDesc || inPeople;
  };
  const filteredMeetings = meetings.filter((m) => {
    if (onlyFavorites && !favorites.has(String(m.id))) return false;
    if (roomFilter && (m.room ?? "") !== roomFilter) return false;
    if (tagFilter && !(m.tags ?? []).map(String).includes(tagFilter)) return false;
    if (statusFilter === "cancelled" && m.status !== "cancelled") return false;
    if (statusFilter === "past") {
      const isPast = m.status === "completed" || `${m.date}T${m.endTime || "23:59"}` < nowIso();
      if (!isPast || m.status === "cancelled") return false;
    }
    if (statusFilter === "upcoming") {
      const isUpcoming = m.status === "scheduled" || m.status === "in-progress";
      if (!isUpcoming || `${m.date}T${m.endTime || "23:59"}` < nowIso()) return false;
    }
    return matchSearch(m);
  });
  const sortedMeetings = sortMeetings(filteredMeetings, sortMode);
  // В «умном» режиме группы показываем заголовками-разделителями
  const showGroups = sortMode === "smart";

  // Сброс пагинации при смене фильтров
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setSelected(new Set());
  }, [statusFilter, roomFilter, tagFilter, search, onlyFavorites, sortMode]);

  const toggleFavoriteMeeting = (id: string) => setFavorites(toggleFavorite(user.id, id));
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allVisibleSelected = sortedMeetings.length > 0 && sortedMeetings.every((m) => selected.has(String(m.id)));
  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelected(new Set());
    else setSelected(new Set(sortedMeetings.map((m) => String(m.id))));
  };

  // Массовые действия: отмена / удаление / избранное для выделенных чекбоксами
  const bulkAction = async (action: "cancel" | "delete" | "favorite") => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action === "delete" && !confirm(`Удалить выбранные конференции (${ids.length})?`)) return;
    if (
      action === "cancel" &&
      !confirm(`Отменить выбранные конференции (${ids.length})? Участники получат уведомление.`)
    )
      return;
    if (action === "favorite") {
      setFavorites(addFavorites(user.id, ids));
      setSelected(new Set());
      return;
    }
    for (const id of ids) {
      const m = meetings.find((x) => String(x.id) === id);
      if (!m) continue;
      if (action === "delete") await deleteMeeting(id);
      else if (action === "cancel") await updateMeeting(id, { ...m, status: "cancelled" });
    }
    setSelected(new Set());
    loadData();
  };

  // Отмена встречи организатором из модалки — специальный эндпоинт:
  // сервер ставит статус cancelled и рассылает уведомления участникам.
  const handleCancelMeeting = async (m: Meeting) => {
    const reason = window.prompt("Причина отмены (необязательно, увидят участники):", "") ?? undefined;
    const saved = await cancelMeeting(m.id, reason?.trim() || undefined);
    if (!saved) {
      alert("Не удалось отменить конференцию");
      return;
    }
    setViewMeeting(null);
    loadData();
  };

  // Перенос встречи из модалки — открывает форму редактирования
  const handleRescheduleMeeting = (m: Meeting) => {
    setViewMeeting(null);
    handleEdit(m);
  };

  // История изменений (audit log на бэкенде) выводится компонентом MeetingHistoryView внутри модалки

  // Приглашение/удаление участников прямо из модалки (только организатор)
  const manageParticipantFromModal = async (target: User, add: boolean) => {
    if (!viewMeeting) return;
    const cur = (viewMeeting.participants ?? []).map(String);
    const tid = String(target.id);
    const next = add ? [...cur, tid] : cur.filter((id) => id !== tid);
    const saved = await updateMeeting(viewMeeting.id, { ...viewMeeting, participants: next });
    if (!saved) {
      alert("Не удалось изменить список участников");
      return;
    }
    setViewMeeting({ ...viewMeeting, participants: next });
    loadData();
  };

  // Конфликты расписания при создании/редактировании встречи
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [conflictChecked, setConflictChecked] = useState(false);
  const [forceSave, setForceSave] = useState(false);

  const runConflictCheck = async (): Promise<ScheduleConflict[]> => {
    const userIds = [...(formData.participants ?? []), editingMeeting ? editingMeeting.organizerId : user.id]
      .map((x) => String(x))
      .filter(Boolean);
    const found = await checkConflictsApi({
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      userIds,
      excludeMeetingId: editingMeeting?.id,
    });
    setConflicts(found);
    return found;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.startTime || !formData.endTime) {
      alert("Заполните все обязательные поля");
      return;
    }
    if (formData.endTime <= formData.startTime) {
      alert("Время окончания должно быть позже времени начала");
      return;
    }

    // Валидация пересечений у тех же участников (кроме принудительного сохранения)
    if (!conflictChecked && !forceSave) {
      const found = await runConflictCheck();
      setConflictChecked(true);
      if (found.length > 0) {
        const NL = String.fromCharCode(10);
        const proceed = window.confirm(
          `Обнаружены конфликты расписания (${found.length}):` +
            NL +
            found.map((c) => `• «${c.title}» ${c.start_time}–${c.end_time}`).join(NL) +
            NL +
            NL +
            "Создать встречу всё равно?"
        );
        if (!proceed) return;
        setForceSave(true);
      }
    }

    // createMeeting/updateMeeting возвращают null при ошибке сервера
    // (422 валидация, истёкший токен и т.п.) — без проверки форма
    // «тихо» закрывалась, и казалось, что создание конференции не работает.
    const payload: Meeting = { ...formData };
    if (payload.recurring === "none") delete payload.repeatUntil;
    else if (payload.repeatUntil && payload.repeatUntil < payload.date) {
      alert("Дата окончания повтора не может быть раньше даты встречи");
      return;
    }
    const saved = editingMeeting ? await updateMeeting(editingMeeting.id, payload) : await createMeeting(payload);

    if (!saved) {
      alert(
        "Не удалось сохранить конференцию. Проверьте поля: время начала должно быть раньше времени окончания, ссылка — корректный URL, напоминание — от 5 до 1440 минут."
      );
      return;
    }

    loadData();
    setShowForm(false);
    setEditingMeeting(null);
    setFormData(emptyMeeting);
    setConflicts([]);
    setConflictChecked(false);
    setForceSave(false);
  };

  const handleEdit = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setFormData(meeting);
    setShowForm(true);
    setConflicts([]);
    setConflictChecked(false);
    setForceSave(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Удалить конференцию?")) {
      await deleteMeeting(id);
      loadData();
    }
  };

  // ID из API приходят числами, а user.id — строка; сравниваем через Number,
  // иначе фильтры «Организованные/Участие» и кнопки редактирования не срабатывают
  const isOrganizer = (m: Meeting) => Number(m.organizerId) === Number(user.id);
  const isParticipant = (m: Meeting) => (m.participants ?? []).some((p) => Number(p) === Number(user.id));

  const toggleParticipant = (userId: string) => {
    const participants = formData.participants.includes(userId)
      ? formData.participants.filter((id) => id !== userId)
      : [...formData.participants, userId];
    setFormData({ ...formData, participants });
  };

  const getUserName = (id: string) => users.find((u) => Number(u.id) === Number(id))?.name || "Неизвестный";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
          <p className="text-gray-600 dark:text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => {
            setShowForm(true);
            setEditingMeeting(null);
            setFormData(emptyMeeting);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <i className="fas fa-plus"></i>
          Создать конференцию
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Переключатель Список / Календарь */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => setView("list")}
              className={`px-3 py-2 text-sm ${view === "list" ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
              title="Список конференций"
            >
              <i className="fas fa-list mr-1"></i>Список
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`px-3 py-2 text-sm ${view === "calendar" ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
              title="Календарь (месяц/неделя)"
            >
              <i className="far fa-calendar-alt mr-1"></i>Календарь
            </button>
          </div>
          {/* Переключатель компактного режима списка */}
          {view === "list" && (
            <button
              onClick={toggleCompact}
              className={`px-3 py-2 text-sm rounded-lg border ${
                compact
                  ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400"
                  : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              title={compact ? "Обычный режим" : "Компактный режим"}
            >
              <i className="fas fa-compress-alt mr-1"></i>
              {compact ? "Компактно" : "Обычно"}
            </button>
          )}
          <label className="text-sm text-gray-600 dark:text-gray-400">
            <i className="fas fa-sort mr-1"></i>Сортировка:
          </label>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Панель фильтров: статус, комната, тег, поиск, избранное */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, описанию, участникам…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          >
            <option value="all">Все статусы</option>
            <option value="upcoming">Предстоящие</option>
            <option value="past">Прошедшие</option>
            <option value="cancelled">Отменённые</option>
          </select>
          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          >
            <option value="">Все комнаты</option>
            {rooms.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          >
            <option value="">Все теги</option>
            {tags.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setOnlyFavorites((v) => !v)}
            title="Показать только избранные"
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
              onlyFavorites
                ? "bg-yellow-400 border-yellow-500 text-yellow-900"
                : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            <i className={`fas fa-star mr-1 ${onlyFavorites ? "" : "text-yellow-400"}`}></i>Избранные
          </button>
          {(statusFilter !== "all" || roomFilter || tagFilter || search || onlyFavorites) && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setRoomFilter("");
                setTagFilter("");
                setSearch("");
                setOnlyFavorites(false);
              }}
              className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            >
              <i className="fas fa-times-circle mr-1"></i>Сбросить
            </button>
          )}
        </div>

        {/* Массовые действия — появляются при выделении чекбоксами */}
        {selected.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Выбрано: {selected.size}</span>
            <button
              onClick={() => bulkAction("favorite")}
              className="px-3 py-1.5 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
            >
              <i className="fas fa-star mr-1"></i>В избранное
            </button>
            <button
              onClick={() => bulkAction("cancel")}
              className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              <i className="fas fa-ban mr-1"></i>Отменить
            </button>
            <button
              onClick={() => bulkAction("delete")}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <i className="fas fa-trash mr-1"></i>Удалить
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Снять выделение
            </button>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  {editingMeeting ? "Редактировать конференцию" : "Новая конференция"}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setConflicts([]);
                    setConflictChecked(false);
                    setForceSave(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {conflicts.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium mb-1">
                      <i className="fas fa-exclamation-triangle mr-1"></i>Конфликты расписания ({conflicts.length}):
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {conflicts.map((c: ScheduleConflict) => (
                        <li key={String(c.meeting_id)}>
                          «{c.title}» {c.start_time}–{c.end_time}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Название *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="Название конференции"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Дата *</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Комната</label>
                    <input
                      type="text"
                      list="rooms-catalog"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="Переговорная №1"
                    />
                    <datalist id="rooms-catalog">
                      {roomsCatalog.map((r) => (
                        <option
                          key={r.name}
                          value={r.name}
                        >{`${r.capacity} мест${r.equipment.length ? " • " + r.equipment.join(", ") : ""}`}</option>
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Начало *</label>
                    <input
                      type="time"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Конец *</label>
                    <input
                      type="time"
                      required
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Ссылка ВКС
                    </label>
                    <input
                      type="url"
                      value={formData.link}
                      onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="https://zoom.us/..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Приоритет</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as Meeting["priority"] })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="low">Низкий</option>
                      <option value="medium">Средний</option>
                      <option value="high">Высокий</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Повтор</label>
                    <select
                      value={formData.recurring}
                      onChange={(e) => setFormData({ ...formData, recurring: e.target.value as Meeting["recurring"] })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="none">Без повтора</option>
                      <option value="daily">Ежедневно</option>
                      <option value="weekly">Еженедельно</option>
                      <option value="monthly">Ежемесячно</option>
                      <option value="custom">По правилу (RRULE)…</option>
                    </select>
                  </div>
                  {formData.recurring === "custom" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Правило RRULE
                      </label>
                      <input
                        type="text"
                        value={formData.rrule ?? ""}
                        placeholder="FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1"
                        onChange={(e) => setFormData({ ...formData, rrule: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-xs"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {[
                          ["FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", "кажд. 2 нед. пн"],
                          ["FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1", "послед. пятница мес."],
                          ["FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1", "перв. понедельник мес."],
                          ["FREQ=DAILY;INTERVAL=3", "каждые 3 дня"],
                        ].map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setFormData({ ...formData, rrule: val })}
                            className={`px-2 py-0.5 rounded text-[11px] border ${formData.rrule === val ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                            title={val}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {formData.rrule && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          <i className="fas fa-sync-alt mr-1"></i>
                          {describeRRule(formData.rrule)}
                        </p>
                      )}
                    </div>
                  )}
                  {formData.recurring !== "none" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Повторять до (опционально)
                      </label>
                      <input
                        type="date"
                        value={formData.repeatUntil ?? ""}
                        min={formData.date}
                        onChange={(e) => setFormData({ ...formData, repeatUntil: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>

                {/* Participants */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Участники ({formData.participants.length} выбрано)
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    <i className="fas fa-info-circle mr-1"></i>
                    Выберите зарегистрированных пользователей из списка ниже
                  </p>

                  {users.length === 0 ? (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <i className="fas fa-exclamation-triangle mr-2"></i>В системе нет зарегистрированных
                        пользователей.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 max-h-64 overflow-y-auto">
                      <div className="space-y-2">
                        {users
                          .filter((u) => u.isActive)
                          .map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => toggleParticipant(u.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center gap-3 ${
                                (formData.participants ?? []).some((id) => String(id) === String(u.id))
                                  ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700"
                                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                  (formData.participants ?? []).some((id) => String(id) === String(u.id))
                                    ? "bg-blue-600 border-blue-600"
                                    : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500"
                                }`}
                              >
                                {(formData.participants ?? []).some((id) => String(id) === String(u.id)) && (
                                  <i className="fas fa-check text-white text-xs"></i>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-800 dark:text-gray-100 text-sm">{u.name}</span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs ${
                                      u.role === "admin"
                                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                        : u.role === "moderator"
                                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                                          : "bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                                    }`}
                                  >
                                    {u.role === "admin"
                                      ? "Админ"
                                      : u.role === "moderator"
                                        ? "Модератор"
                                        : "Пользователь"}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  @{u.login}
                                  {u.department && <span className="ml-2">• {u.department}</span>}
                                </div>
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setConflicts([]);
                      setConflictChecked(false);
                      setForceSave(false);
                    }}
                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Отмена
                  </button>
                  <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    {editingMeeting ? "Сохранить" : "Создать"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Просмотр конференции — доступен всем, кто видит конференцию в списке */}
      {viewMeeting &&
        (() => {
          const vm = viewMeeting;
          return (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setViewMeeting(null)}
            >
              <div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{vm.title}</h2>
                    <button onClick={() => setViewMeeting(null)} className="text-gray-400 hover:text-gray-600">
                      <i className="fas fa-times text-xl"></i>
                    </button>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <p>
                      <i className="far fa-calendar mr-2 text-blue-500"></i>
                      {new Date(vm.date).toLocaleDateString("ru-RU")}
                      <span className="mx-2">•</span>
                      <i className="far fa-clock mr-2 text-blue-500"></i>
                      {vm.startTime} - {vm.endTime}
                    </p>
                    {vm.room && (
                      <p>
                        <i className="fas fa-map-marker-alt mr-2 text-blue-500"></i>
                        {vm.room}
                      </p>
                    )}
                    <p>
                      <i className="fas fa-user mr-2 text-blue-500"></i>
                      Организатор: {getUserName(vm.organizerId)}
                    </p>
                    <p>
                      <i className="fas fa-users mr-2 text-blue-500"></i>
                      Участники ({(vm.participants ?? []).length}):{" "}
                      {(vm.participants ?? []).map((p) => getUserName(p)).join(", ") || "нет"}
                    </p>
                    {vm.recurring !== "none" && (
                      <p>
                        <i className="fas fa-sync-alt mr-2 text-blue-500"></i>
                        {vm.recurring === "daily"
                          ? "Ежедневно"
                          : vm.recurring === "weekly"
                            ? "Еженедельно"
                            : "Ежемесячно"}
                        {vm.repeatUntil ? ` до ${new Date(vm.repeatUntil).toLocaleDateString("ru-RU")}` : ""}
                      </p>
                    )}
                    {vm.description && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg whitespace-pre-line">
                        {vm.description}
                      </div>
                    )}
                  </div>

                  {/* Приглашение участников — организатор может добавлять/удалять прямо из модалки */}
                  {isOrganizer(vm) && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        <i className="fas fa-user-plus mr-1 text-blue-500"></i>Участники
                      </h4>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                        {users
                          .filter((u) => Number(u.id) !== Number(vm.organizerId))
                          .map((u) => {
                            const isIn = (vm.participants ?? []).map(String).includes(String(u.id));
                            return (
                              <div key={u.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                                <span className="text-gray-700 dark:text-gray-200">
                                  {u.name}
                                  <span className="text-gray-400 ml-1">@{u.login}</span>
                                </span>
                                <button
                                  onClick={() => manageParticipantFromModal(u, !isIn)}
                                  className={`px-2 py-0.5 rounded text-xs ${
                                    isIn
                                      ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100"
                                      : "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100"
                                  }`}
                                >
                                  {isIn ? "Удалить" : "Пригласить"}
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* RSVP — подтверждение участия */}
                  <MeetingRsvp meeting={vm} user={user} />

                  {/* Протокол встречи и задачи (action items) */}
                  <MeetingMinutes
                    meetingId={vm.id}
                    user={user}
                    users={users}
                    canWrite={
                      isOrganizer(vm) ||
                      user.role === "admin" ||
                      user.role === "moderator" ||
                      (vm.participants ?? []).some((p) => Number(p) === Number(user.id))
                    }
                  />

                  {/* История изменений — audit log с бэкенда */}
                  <div className="mt-4">
                    <MeetingHistoryView meetingId={vm.id} />
                  </div>
                  <div className="flex flex-wrap justify-end gap-3 pt-4 mt-4 border-t dark:border-gray-700">
                    <button
                      onClick={() => exportMeetingToIcs(vm)}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                      title="Добавить в Outlook / Google Calendar"
                    >
                      <i className="fas fa-file-download mr-1"></i>.ics
                    </button>
                    {isOrganizer(vm) && vm.status !== "cancelled" && (
                      <>
                        <button
                          onClick={() => handleRescheduleMeeting(vm)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                          title="Изменить дату и время конференции"
                        >
                          <i className="fas fa-clock mr-1"></i>Перенести
                        </button>
                        <button
                          onClick={() => handleCancelMeeting(vm)}
                          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                          title="Отменить встречу (участники получат уведомление)"
                        >
                          <i className="fas fa-ban mr-1"></i>Отменить встречу
                        </button>
                      </>
                    )}
                    {isOrganizer(vm) && (
                      <button
                        onClick={() => {
                          setViewMeeting(null);
                          handleEdit(vm);
                        }}
                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      >
                        <i className="fas fa-edit mr-1"></i>Редактировать
                      </button>
                    )}
                    {vm.link && (
                      <a
                        href={vm.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <i className="fas fa-video mr-1"></i>Войти в конференцию
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Meetings List / Calendar */}
      {view === "calendar" ? (
        (() => {
          const MONTH_NAMES = [
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
          const isoOf = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const byDate = new Map<string, Meeting[]>();
          sortedMeetings.forEach((m) => {
            const arr = byDate.get(m.date) ?? [];
            arr.push(m);
            byDate.set(m.date, arr);
          });
          const todayIso = isoOf(new Date());
          const cells: { d: Date; inMonth: boolean }[] = [];
          if (calView === "month") {
            const first = new Date(calMonth.y, calMonth.m, 1);
            let startDow = first.getDay(); // 0 — воскресенье
            if (startDow === 0) startDow = 7;
            for (let i = startDow - 1; i >= 0; i--)
              cells.push({ d: new Date(first.getFullYear(), first.getMonth(), 1 - i), inMonth: false });
            const last = new Date(calMonth.y, calMonth.m + 1, 0);
            for (let day = 1; day <= last.getDate(); day++)
              cells.push({ d: new Date(calMonth.y, calMonth.m, day), inMonth: true });
            while (cells.length % 7 !== 0)
              cells.push({
                d: new Date(
                  calMonth.y,
                  calMonth.m,
                  last.getDate() +
                    (cells.length % 7 === 0 ? 7 : cells.length - Math.floor(cells.length / 7) * 7 - last.getDate() + 1)
                ),
                inMonth: false,
              });
          } else {
            const anchor = new Date(calMonth.y, calMonth.m, calMonth.d || new Date().getDate());
            let dow = anchor.getDay();
            if (dow === 0) dow = 7;
            const monday = new Date(anchor);
            monday.setDate(anchor.getDate() - (dow - 1));
            for (let i = 0; i < 7; i++) {
              const d = new Date(monday);
              d.setDate(monday.getDate() + i);
              cells.push({ d, inMonth: true });
            }
          }
          const shiftMonth = (delta: number) => {
            const nd = new Date(calMonth.y, calMonth.m + delta, 1);
            setCalMonth({ y: nd.getFullYear(), m: nd.getMonth(), d: 1 });
          };
          const shiftWeek = (delta: number) => {
            const base = new Date(calMonth.y, calMonth.m, calMonth.d || new Date().getDate());
            base.setDate(base.getDate() + delta * 7);
            setCalMonth({ y: base.getFullYear(), m: base.getMonth(), d: base.getDate() });
          };
          return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => (calView === "month" ? shiftMonth(-1) : shiftWeek(-1))}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 min-w-[180px] text-center">
                    {calView === "month"
                      ? `${MONTH_NAMES[calMonth.m]} ${calMonth.y}`
                      : `Неделя ${new Date(calMonth.y, calMonth.m, calMonth.d || 1).toLocaleDateString("ru-RU")} — ${(() => {
                          const e = new Date(calMonth.y, calMonth.m, calMonth.d || 1);
                          e.setDate(e.getDate() + 6);
                          return e.toLocaleDateString("ru-RU");
                        })()}`}
                  </h3>
                  <button
                    onClick={() => (calView === "month" ? shiftMonth(1) : shiftWeek(1))}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                  <button
                    onClick={() => {
                      const n = new Date();
                      setCalMonth({ y: n.getFullYear(), m: n.getMonth(), d: n.getDate() });
                    }}
                    className="px-3 py-1.5 text-sm rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
                  >
                    Сегодня
                  </button>
                </div>
                <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                  <button
                    onClick={() => setCalView("month")}
                    className={`px-3 py-1.5 text-sm ${calView === "month" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                  >
                    Месяц
                  </button>
                  <button
                    onClick={() => setCalView("week")}
                    className={`px-3 py-1.5 text-sm ${calView === "week" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                  >
                    Неделя
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((wd) => (
                  <div key={wd} className="py-1">
                    {wd}
                  </div>
                ))}
              </div>
              <div className={`grid grid-cols-7 gap-1 ${calView === "week" ? "" : "auto-rows-fr"}`}>
                {cells.map(({ d, inMonth }, idx) => {
                  const iso = isoOf(d);
                  const dayMeetings = (byDate.get(iso) ?? []).slice(0, 4);
                  const isToday = iso === todayIso;
                  return (
                    <div
                      key={idx}
                      className={`border rounded-lg p-1 min-h-[92px] text-left ${inMonth ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" : "bg-gray-50 dark:bg-gray-900/40 border-gray-100 dark:border-gray-700/50"} ${isToday ? "ring-2 ring-blue-500" : ""}`}
                    >
                      <div
                        className={`text-xs font-medium mb-1 ${isToday ? "text-blue-600" : inMonth ? "text-gray-600 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"}`}
                      >
                        {d.getDate()}
                      </div>
                      {dayMeetings.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setViewMeeting(m)}
                          title={`${m.title} ${m.startTime}`}
                          className={`block w-full truncate text-left text-[11px] px-1 py-0.5 rounded mb-0.5 ${
                            m.status === "cancelled"
                              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 line-through"
                              : m.priority === "high"
                                ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          }`}
                        >
                          {m.startTime} {m.title}
                        </button>
                      ))}
                      {(byDate.get(iso) ?? []).length > 4 && (
                        <div className="text-[10px] text-gray-400">+{(byDate.get(iso) ?? []).length - 4} ещё</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
      ) : error && sortedMeetings.length === 0 ? (
        <div className="text-center py-12 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl">
          <i className="fas fa-plug text-4xl text-yellow-500 mb-3"></i>
          <p className="text-yellow-800 dark:text-yellow-200 font-medium">Не удалось загрузить данные с сервера</p>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            Проверьте, что бэкенд запущен (<code>php artisan serve</code> или контейнер <code>vks-backend</code>) и
            выполнены миграции.
          </p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
          >
            <i className="fas fa-redo mr-1"></i> Повторить
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {(() => {
            // В «умном» режиме вставляем заголовки групп (Сегодня / Завтра / …)
            let lastGroup = "";
            return sortedMeetings.slice(0, visibleCount).map((meeting) => {
              const group = showGroups ? getMeetingGroup(meeting) : null;
              const header =
                group && group.key !== lastGroup ? (
                  <div key={`grp-${group.key}`} className="pt-2 pb-1 first:pt-0">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
                      <i
                        className={`fas ${group.key === "today" ? "fa-calendar-day text-blue-500" : group.key === "tomorrow" ? "fa-calendar text-indigo-500" : group.key === "past" ? "fa-history text-gray-400" : "fa-calendar-week text-purple-500"}`}
                      ></i>
                      {group.label}
                    </h3>
                  </div>
                ) : null;
              if (group) lastGroup = group.key;
              return (
                <React.Fragment key={meeting.id}>
                  {header}
                  <div
                    className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow ${compact ? "p-2.5" : "p-4"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2 self-start mt-1">
                        {/* Чекбокс для массовых действий */}
                        <input
                          type="checkbox"
                          checked={selected.has(String(meeting.id))}
                          onChange={() => toggleSelect(String(meeting.id))}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          title="Выделить для массовых действий"
                        />
                      </div>
                      <div className="flex-1">
                        <div className={`flex items-center gap-2 ${compact ? "" : "mb-2"}`}>
                          <button
                            onClick={() => setViewMeeting(meeting)}
                            className="font-bold text-gray-800 dark:text-gray-100 hover:text-blue-600 text-left"
                            title="Открыть конференцию"
                          >
                            {meeting.title}
                          </button>
                          {/* Избранное — звёздочка на карточке */}
                          <button
                            onClick={() => toggleFavoriteMeeting(String(meeting.id))}
                            className="text-lg leading-none"
                            title={favorites.has(String(meeting.id)) ? "Убрать из избранного" : "Добавить в избранное"}
                          >
                            <i
                              className={`fas fa-star ${favorites.has(String(meeting.id)) ? "text-yellow-400" : "text-gray-300 dark:text-gray-600 hover:text-yellow-300"}`}
                            ></i>
                          </button>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              meeting.priority === "high"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                : meeting.priority === "medium"
                                  ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                                  : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            }`}
                          >
                            {meeting.priority === "high"
                              ? "Высокий"
                              : meeting.priority === "medium"
                                ? "Средний"
                                : "Низкий"}
                          </span>
                        </div>
                        <p className={`${compact ? "text-xs" : "text-sm"} text-gray-600 dark:text-gray-400`}>
                          <i className="far fa-calendar mr-1"></i>
                          {new Date(meeting.date).toLocaleDateString("ru-RU")}
                          <span className="mx-2">•</span>
                          <i className="far fa-clock mr-1"></i>
                          {meeting.startTime} - {meeting.endTime}
                          {meeting.room && (
                            <>
                              <span className="mx-2">•</span>
                              <i className="fas fa-map-marker-alt mr-1"></i>
                              {meeting.room}
                            </>
                          )}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                          <i className="fas fa-user mr-1"></i>
                          Организатор: {getUserName(meeting.organizerId)}
                          <span className="mx-2">•</span>
                          <i className="fas fa-users mr-1"></i>
                          {meeting.participants.length} участников
                          {meeting.recurring !== "none" && (
                            <>
                              <span className="mx-2">•</span>
                              <i className="fas fa-sync-alt text-blue-500 mr-1"></i>
                              <span className="text-blue-600 dark:text-blue-400">
                                {meeting.recurring === "daily"
                                  ? "Ежедневно"
                                  : meeting.recurring === "weekly"
                                    ? "Еженедельно"
                                    : "Ежемесячно"}
                                {meeting.recurring === "custom" && meeting.rrule
                                  ? ` (${describeRRule(meeting.rrule)})`
                                  : ""}
                                {meeting.repeatUntil
                                  ? ` до ${new Date(meeting.repeatUntil).toLocaleDateString("ru-RU")}`
                                  : ""}
                              </span>
                            </>
                          )}
                        </p>
                        {meeting.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2 whitespace-pre-line">
                            {meeting.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Экспорт встречи в календарь (.ics — Outlook / Google Calendar) */}
                        <button
                          onClick={() => exportMeetingToIcs(meeting)}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-gray-700 rounded"
                          title="Скачать .ics для Outlook / Google Calendar"
                        >
                          <i className="fas fa-calendar-plus"></i>
                        </button>
                        <button
                          onClick={() => setViewMeeting(meeting)}
                          className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          <i className="fas fa-eye mr-1"></i>Просмотр
                        </button>
                        {meeting.link && (
                          <a
                            href={meeting.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                          >
                            <i className="fas fa-video mr-1"></i>Войти
                          </a>
                        )}
                        {isOrganizer(meeting) && (
                          <>
                            <button
                              onClick={() => handleEdit(meeting)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(meeting.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            });
          })()}
          {sortedMeetings.length === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <i className="fas fa-video text-4xl mb-3"></i>
              <p>Нет конференций</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
