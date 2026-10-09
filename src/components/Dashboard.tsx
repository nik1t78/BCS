import React, { useState, useEffect } from "react";
import { User, Meeting } from "../types";
import { getMeetings, getUsersForDisplay, updateMeeting } from "../store-api";
import { occursOn, withDate } from "../utils/recurrence";
import FreeRoomsWidget from "./FreeRoomsWidget";
import OutlookCalendar, { OutlookView } from "./OutlookCalendar";
import RoomBookingModal from "./RoomBookingModal";
import UserPanel from "./UserPanel";
import type { MeetingPrefill } from "./UserPanel";
import { toDateKey } from "../utils/dateKey";
import { icsAPI } from "../api/client";

interface DashboardProps {
  user: User;
  onNavigate: (page: string) => void;
  /** Клик по свободному слоту в виджете «Свободные залы» → переход к созданию ВКС */
  onBookSlot?: (roomName: string, startTime: string, endTime: string, date: string) => void;
}

/** Диапазон дат видимых дней календаря (для разворачивания повторов) */
function visibleRange(days: Date[]): { from: string; to: string } {
  const keys = days.map(toDateKey).sort();
  return { from: keys[0], to: keys[keys.length - 1] };
}

const addDaysLocal = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export default function Dashboard({ user, onNavigate, onBookSlot }: DashboardProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  // Outlook-вид расписания аудиторий на главной: день / неделя / месяц
  const [calView, setCalView] = useState<OutlookView>("day");
  const [calDate, setCalDate] = useState(new Date());
  // В одно время может быть несколько конференций — храним все «следующие» (с тем же датой/временем старта)
  const [nextMeetings, setNextMeetings] = useState<Meeting[]>([]);
  const [countdown, setCountdown] = useState("");
  // Экспорт «Мой календарь ВКС» в .ics
  const [icsLoading, setIcsLoading] = useState(false);
  // Модалка выбора зала (клик по пустому слоту календаря / кнопка «Выбрать зал»)
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingAt, setBookingAt] = useState<{ date: string; startTime: string; endTime?: string; room?: string }>({
    date: toDateKey(new Date()),
    startTime: "09:00",
  });
  // Панель создания ВКС прямо на главной (после выбора зала)
  // Панель создания ВКС открыта, когда есть предзаполнение (после выбора времени/зала)
  const [createPrefill, setCreatePrefill] = useState<MeetingPrefill | null>(null);
  const createOpen = createPrefill !== null;

  const handleDownloadIcs = async () => {
    setIcsLoading(true);
    try {
      const blob = await icsAPI.download();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vks-my-schedule.ics";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("ICS export error:", e);
      alert("Не удалось сформировать файл .ics");
    } finally {
      setIcsLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [m, u] = await Promise.all([getMeetings(), getUsersForDisplay(user.role)]);
        setMeetings(m);
        setUsers(u);
      } catch (error) {
        console.error("Error loading dashboard:", error);
      }
    };
    loadData();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const dataTimer = setInterval(loadData, 30000); // Обновляем каждые 30 секунд

    return () => {
      clearInterval(timer);
      clearInterval(dataTimer);
    };
  }, []);

  // API возвращает id числами, user.id — строка: сравниваем через Number
  const hasAccessTo = (m: Meeting) =>
    Number(m.organizerId) === Number(user.id) || (m.participants ?? []).some((p) => Number(p) === Number(user.id));

  // На главной («Обзор») обычный пользователь видит ТОЛЬКО свои ВКС —
  // организованные им или где он участник. Все остальные конференции —
  // в разделе «Расписание». Админ/модератор видят всё.
  const visibleMeetings =
    user.role === "admin" || user.role === "moderator"
      ? meetings
      : meetings.filter((m) => hasAccessTo(m));

  useEffect(() => {
    const today = toDateKey(currentTime);
    const now = currentTime.toTimeString().slice(0, 5);

    const upcoming = visibleMeetings
      .filter((m) => {
        if (m.status === "cancelled" || m.status === "completed") return false;
        if (m.date > today) return true;
        if (m.date === today && m.startTime > now) return true;
        return false;
      })
      .sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime)));

    // Берём все конференции, совпадающие по дате и времени старта с ближайшей —
    // в одно время может быть несколько конференций.
    const first = upcoming[0] || null;
    const simultaneous = first ? upcoming.filter((m) => m.date === first.date && m.startTime === first.startTime) : [];
    setNextMeetings(simultaneous);

    if (first) {
      const targetDate = new Date(`${first.date}T${first.startTime}`);
      const diff = targetDate.getTime() - currentTime.getTime();
      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown(`${hours}ч ${minutes}м ${seconds}с`);
      }
    }
  }, [currentTime, visibleMeetings]);

  const todayMeetings = visibleMeetings.filter((m) => m.date === toDateKey(currentTime));
  const getUserName = (id: string) => users.find((u) => Number(u.id) === Number(id))?.name || "Неизвестный";

  // Видимые дни текущей вкладки (день / неделя / месяц)
  const calDays = (() => {
    if (calView === "day") return [calDate];
    if (calView === "month") return [];
    const iso = (d: Date) => (d.getDay() + 6) % 7; // пн=0
    const start = addDaysLocal(calDate, -iso(calDate));
    const count = calView === "workweek" ? 5 : 7;
    return Array.from({ length: count }, (_, i) => addDaysLocal(start, i));
  })();

  // Разворачиваем повторы occurrences'ами в видимом диапазоне
  const expandedMeetings = (() => {
    if (calView === "month") {
      const from = toDateKey(new Date(calDate.getFullYear(), calDate.getMonth(), 1));
      const to = toDateKey(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 0));
      return visibleMeetings.flatMap((m) => {
        const res: Meeting[] = [];
        const d = new Date(`${from}T00:00`);
        while (toDateKey(d) <= to) {
          if (occursOn(m, d)) res.push(withDate(m, d));
          d.setDate(d.getDate() + 1);
        }
        return res;
      });
    }
    const { from, to } = visibleRange(calDays);
    return visibleMeetings.flatMap((m) => {
      const res: Meeting[] = [];
      const d = new Date(`${from}T00:00`);
      while (toDateKey(d) <= to) {
        if (occursOn(m, d)) res.push(withDate(m, d));
        d.setDate(d.getDate() + 1);
      }
      return res;
    });
  })();

  const isAdminOrMod = user.role === "admin" || user.role === "moderator";
  const displayTitle = (m: Meeting) => (isAdminOrMod || hasAccessTo(m) ? m.title : "Конференция");
  const blockSubtitle = (m: Meeting) =>
    isAdminOrMod || hasAccessTo(m) ? m.room || undefined : undefined;

  // Клик по пустому слоту → открыть выбор зала с предзаполненными датой/временем
  const handleCreateAt = (dateKey: string, startTime: string) => {
    setBookingAt({ date: dateKey, startTime });
    setBookingOpen(true);
  };

  // Подтверждение в модалке выбора зала → панель создания ВКС прямо на главной
  const handleBookingConfirm = (roomName: string, dateKey: string, startTime: string, endTime: string) => {
    setBookingOpen(false);
    if (onBookSlot) {
      // родительский сценарий (переход в раздел «Мои конференции») — если задан
      onBookSlot(roomName, startTime, endTime, dateKey);
      return;
    }
    setCreatePrefill({ date: dateKey, startTime, endTime, room: roomName, autoLink: true });
  };

  // Быстрая кнопка «Выбрать зал» — ближайшее 15-минутное время сегодня
  const openBookingNow = () => {
    const rounded = Math.ceil((currentTime.getHours() * 60 + currentTime.getMinutes()) / 15) * 15;
    const clamped = Math.min(rounded, 23 * 60 + 45);
    const fmt = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    setBookingAt({ date: toDateKey(currentTime), startTime: fmt(clamped) });
    setBookingOpen(true);
  };

  // Перенос встречи drag&drop — только свои (или все для админа)
  const canDragMeeting = (m: Meeting) => isAdminOrMod || hasAccessTo(m);
  const handleRequestMove = async (m: Meeting, dateKey: string, startTime: string) => {
    if (!window.confirm(`Перенести «${displayTitle(m)}» на ${dateKey} ${startTime}?`)) return;
    const realId = String(m._occurrenceOf ?? m.id);
    await updateMeeting(realId, { date: dateKey, startTime });
    setMeetings((prev) =>
      prev.map((x) => (String(x.id) === realId ? { ...x, date: dateKey, startTime } : x))
    );
  };

  // Клик по встрече → карточка как в «Расписании»: ссылка / копирование / отмена
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      alert("Ссылка скопирована");
    } catch {
      alert(link);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold">Добро пожаловать, {user.name}!</h2>
        <p className="text-blue-100 mt-1">
          {currentTime.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Свободные залы — в самом верху, сразу под приветствием */}
      <FreeRoomsWidget onPickSlot={onBookSlot} />

      {/* Stats — нули показываем прочерком, чтобы не мозолили глаза */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">Сегодня</p>
          <p className={`text-2xl font-bold ${todayMeetings.length ? "text-gray-800 dark:text-gray-100" : "text-gray-300 dark:text-gray-600"}`}>
            {todayMeetings.length || "—"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">Всего</p>
          <p className={`text-2xl font-bold ${visibleMeetings.length ? "text-gray-800 dark:text-gray-100" : "text-gray-300 dark:text-gray-600"}`}>
            {visibleMeetings.length || "—"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">Организовано</p>
          <p className={`text-2xl font-bold ${visibleMeetings.filter((m) => Number(m.organizerId) === Number(user.id)).length ? "text-gray-800 dark:text-gray-100" : "text-gray-300 dark:text-gray-600"}`}>
            {visibleMeetings.filter((m) => Number(m.organizerId) === Number(user.id)).length || "—"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">Высокий приоритет</p>
          <p className={`text-2xl font-bold ${visibleMeetings.filter((m) => m.priority === "high").length ? "text-gray-800 dark:text-gray-100" : "text-gray-300 dark:text-gray-600"}`}>
            {visibleMeetings.filter((m) => m.priority === "high").length || "—"}
          </p>
        </div>
      </div>

      {/* Next Meeting(s) — в одно время может быть несколько конференций */}
      {nextMeetings.length > 0 &&
        (() => {
          const multiple = nextMeetings.length > 1;

          return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-blue-200 dark:border-blue-800 p-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                <i className="fas fa-arrow-right text-blue-500 mr-2"></i>
                {multiple ? `Следующие конференции (${nextMeetings.length})` : "Следующая конференция"}
              </h2>

              <div className={multiple ? "space-y-6" : ""}>
                {nextMeetings.map((nextMeeting, idx) => {
                  const canSeeDetails = user.role === "admin" || user.role === "moderator" || hasAccessTo(nextMeeting);

                  return (
                    <div
                      key={nextMeeting.id}
                      className={
                        multiple ? "pb-6 border-b border-gray-200 dark:border-gray-700 last:pb-0 last:border-b-0" : ""
                      }
                    >
                      {multiple && (
                        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">
                          Конференция {idx + 1} из {nextMeetings.length}
                        </p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Название</p>
                          <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-1">
                            {canSeeDetails ? nextMeeting.title : "Конференция"}
                          </p>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                          <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Дата и время</p>
                          <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-1">
                            {new Date(nextMeeting.date).toLocaleDateString("ru-RU")}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {nextMeeting.startTime} - {nextMeeting.endTime}
                          </p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
                          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">До начала</p>
                          <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-1">{countdown}</p>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                          <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Место</p>
                          <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-1">
                            {canSeeDetails ? nextMeeting.room || "Онлайн" : "Скрыто"}
                          </p>
                        </div>
                      </div>

                      {canSeeDetails && (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Организатор</p>
                              <p className="text-gray-800 dark:text-gray-100">{getUserName(nextMeeting.organizerId)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Участники</p>
                              <p className="text-gray-800 dark:text-gray-100">{nextMeeting.participants.length} чел.</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Кабинет</p>
                              <p className="text-gray-800 dark:text-gray-100 font-semibold">
                                {nextMeeting.room ? `📍 ${nextMeeting.room}` : "🌐 Онлайн"}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {nextMeeting.link ? (
                        <a
                          href={nextMeeting.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          <i className="fas fa-video mr-2"></i>
                          Подключиться к конференции
                        </a>
                      ) : (
                        <button
                          disabled
                          className="bg-gray-400 text-white px-6 py-3 rounded-lg font-medium cursor-not-allowed"
                        >
                          <i className="fas fa-video mr-2"></i>
                          Ссылка не указана
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

      {/* Расписание аудиторий — как в Outlook: сетка времени, день/рабочая неделя/неделя/месяц.
          Клик по пустому слоту → создание ВКС; клик по встрече → карточка со ссылкой «Войти». */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            <i className="fas fa-calendar-day text-purple-500 mr-2"></i>
            Расписание аудиторий{todayMeetings.length > 0 ? ` • сегодня ${todayMeetings.length}` : ""}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={openBookingNow}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <i className="fas fa-door-open mr-2"></i>Выбрать зал · Создать ВКС
            </button>
            <button
              onClick={() => onNavigate?.("schedule")}
              className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline whitespace-nowrap"
            >
              Открыть полный календарь <i className="fas fa-arrow-right ml-1 text-xs"></i>
            </button>
          </div>
        </div>

        {/* Переключатель вида — как в Outlook */}
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-4 text-sm">
          {([
            ["day", "День"],
            ["workweek", "Рабочая неделя"],
            ["week", "Неделя"],
            ["month", "Месяц"],
          ] as [OutlookView, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setCalView(v)}
              className={`px-3 py-1.5 transition-colors ${
                calView === v
                  ? "bg-blue-600 text-white font-medium"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <OutlookCalendar
          meetings={expandedMeetings}
          view={calView}
          selectedDate={calDate}
          onSelectedDateChange={setCalDate}
          onSelectMeeting={(m) => setDetailMeeting(m)}
          onCreateAt={handleCreateAt}
          canDragMeeting={canDragMeeting}
          onRequestMove={handleRequestMove}
          displayTitle={displayTitle}
          blockSubtitle={blockSubtitle}
        />
      </div>

      {/* Модалка выбора зала: Outlook-шкала дня 00:00–24:00, клик по свободному времени →
          «Занять и создать ВКС» (переход в форму с автогенерацией ссылки) */}
      <RoomBookingModal
        open={bookingOpen}
        date={bookingAt.date}
        startTime={bookingAt.startTime}
        endTime={bookingAt.endTime}
        roomName={bookingAt.room}
        onClose={() => setBookingOpen(false)}
        onConfirm={handleBookingConfirm}
      />

      {/* Панель создания ВКС прямо поверх главной — без перехода в другой раздел */}
      {createOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-auto" onClick={() => setCreatePrefill(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-xl z-10">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                <i className="fas fa-video text-blue-600 mr-2"></i>Создание ВКС
              </h3>
              <button onClick={() => setCreatePrefill(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none" aria-label="Закрыть">×</button>
            </div>
            <div className="p-6">
              <UserPanel
                user={user}
                onNavigate={onNavigate}
                formOnly
                initialPrefill={createPrefill}
                onCreated={() => {
                  setCreatePrefill(null);
                  setCreatePrefill(null);
                  // обновим список встреч после создания
                  getMeetings().then(setMeetings).catch(() => {});
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Карточка встречи (клик по блоку в календаре) */}
      {detailMeeting &&
        (() => {
          const canSee = isAdminOrMod || hasAccessTo(detailMeeting);
          return (
            <div
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
              onClick={() => setDetailMeeting(null)}
            >
              <div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                    {canSee ? detailMeeting.title : "Конференция"}
                  </h3>
                  <button
                    onClick={() => setDetailMeeting(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
                    aria-label="Закрыть"
                  >
                    ×
                  </button>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-1">
                  <i className="far fa-clock mr-2 text-blue-500"></i>
                  {new Date(detailMeeting.date).toLocaleDateString("ru-RU")} • {detailMeeting.startTime}–{detailMeeting.endTime}
                </p>
                <p className="text-gray-600 dark:text-gray-300 mb-1">
                  <i className="fas fa-map-marker-alt mr-2 text-purple-500"></i>
                  {canSee ? detailMeeting.room || "Онлайн" : "Место скрыто"}
                </p>
                {canSee && (
                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                    <i className="fas fa-user mr-2 text-emerald-500"></i>
                    Организатор: {getUserName(detailMeeting.organizerId)}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-4">
                  {canSee && detailMeeting.link && (
                    <>
                      <a
                        href={detailMeeting.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        <i className="fas fa-video mr-2"></i>Войти в ВКС
                      </a>
                      <button
                        onClick={() => copyLink(detailMeeting.link!)}
                        className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <i className="fas fa-link mr-2"></i>Копировать ссылку
                      </button>
                    </>
                  )}
                  {canSee && Number(detailMeeting.organizerId) === Number(user.id) && detailMeeting.status !== "cancelled" && (
                    <button
                      onClick={async () => {
                        if (!window.confirm("Отменить эту конференцию?")) return;
                        await updateMeeting(String(detailMeeting._occurrenceOf ?? detailMeeting.id), { status: "cancelled" });
                        setMeetings((prev) =>
                          prev.map((x) =>
                            String(x.id) === String(detailMeeting._occurrenceOf ?? detailMeeting.id)
                              ? { ...x, status: "cancelled" as Meeting["status"] }
                              : x
                          )
                        );
                        setDetailMeeting(null);
                      }}
                      className="border border-red-300 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <i className="fas fa-ban mr-2"></i>Отменить
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* Быстрые действия: экспорт календаря (.ics) */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-4 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
            <i className="fas fa-calendar-minus mr-2 text-blue-600" aria-hidden="true"></i>
            Мой календарь ВКС
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Скачайте файл .ics со своими встречами (название, время, комната, описание)
            и добавьте его в Outlook, Яндекс.Календарь или Google Calendar — расписание
            будет видно даже вне системы.
          </p>
        </div>
        <button
          onClick={handleDownloadIcs}
          disabled={icsLoading}
          className="mt-3 self-start bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {icsLoading ? (
            <><i className="fas fa-circle-notch fa-spin mr-1"></i> Формирование…</>
          ) : (
            <><i className="fas fa-download mr-1"></i> Скачать .ics</>
          )}
        </button>
      </div>
    </div>
  );
}
