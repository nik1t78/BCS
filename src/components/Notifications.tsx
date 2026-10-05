import React, { useState, useEffect, useRef } from "react";
import { User, Notification } from "../types";
import { getNotifications, markNotificationRead, markAllNotificationsRead, clearAllNotifications } from "../store-api";
import { notificationsAPI } from "../api/client";

// --- Toast-уведомления: всплывают на любом экране (правый нижний угол) ---
interface ToastItem {
  id: string;
  message: string;
  type: string;
}

interface RealtimeEvent {
  id: string;
  message?: string;
  type?: string;
}

// Подписка на realtime-канал уведомлений (SSE). Возвращает функцию отписки
// или null, если EventSource недоступен / нет токена — тогда работают только
// поллинг-циклы (обратная совместимость гарантирована).
export function subscribeToNotifications(onNotification: (n: RealtimeEvent) => void): (() => void) | null {
  const es = notificationsAPI.stream();
  if (!es) return null;
  const handler = (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      if (data && data.id) onNotification(data);
    } catch {
      /* игнорируем битые кадры */
    }
  };
  es.addEventListener("notification", handler);
  return () => es.close();
}

export function useNewNotificationToasts(enabled: boolean) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastSeenRef = useRef<string | null>(null); // id самого нового уведомления при последней проверке

  const pushToast = (id: string, message?: string, type?: string) => {
    if (!message) return;
    setToasts((prev) =>
      prev.some((t) => t.id === id) ? prev : [...prev.slice(-4), { id, message, type: type ?? "info" }]
    );
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  };

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    // Мгновенная доставка через SSE (если сервер её отдаёт). Поллинг ниже
    // остаётся запасным механизмом: при недоступном Redis/прокси-буферизации
    // EventSource просто молча не получит ни одного кадра.
    const unsubscribe = subscribeToNotifications((n) => {
      if (cancelled) return;
      // помечаем как известный, чтобы поллинг не показал это же повторно
      if (lastSeenRef.current === null || Number(n.id) > Number(lastSeenRef.current)) {
        lastSeenRef.current = n.id;
      }
      pushToast(n.id, n.message, n.type);
    });

    const check = async () => {
      try {
        const res = await notificationsAPI.getAll({ unread: true, per_page: 10 });
        if (cancelled) return;
        const items: any[] = res.data ?? [];
        const newestId = items.length ? String(items[0].id) : null;

        if (lastSeenRef.current === null) {
          // Первая проверка после входа — не показываем старые непрочитанные
          lastSeenRef.current = newestId;
          return;
        }

        const known = new Set<string>();
        let current = newestId;
        while (current && current !== lastSeenRef.current) {
          const found = items.find((n) => String(n.id) === current);
          if (!found) break;
          known.add(current);
          if (found.message) {
            setToasts((prev) =>
              prev.some((t) => t.id === current)
                ? prev
                : [...prev.slice(-4), { id: current!, message: found.message, type: found.type ?? "info" }]
            );
          }
          const idx = items.findIndex((n) => String(n.id) === current);
          current = idx + 1 < items.length ? String(items[idx + 1].id) : null;
        }
        if (newestId) lastSeenRef.current = newestId;

        // Автоскрытие через 6 секунд
        window.setTimeout(() => {
          if (cancelled || known.size === 0) return;
          setToasts((prev) => prev.filter((t) => !known.has(t.id)));
        }, 6000);
      } catch {
        /* сеть недоступна — молча пропускаем цикл */
      }
    };

    check();
    const timer = setInterval(check, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (unsubscribe) unsubscribe();
    };
  }, [enabled]);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return { toasts, dismiss };
}

export function NotificationToasts({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  const iconFor = (type: string) =>
    type === "starting"
      ? "🔴"
      : type === "reminder"
        ? "⏰"
        : type === "warning"
          ? "⚠️"
          : type === "user-added"
            ? "👤"
            : "📅";

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] sm:w-80 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 shadow-lg rounded-xl p-3 flex items-start gap-2 animate-[slideInRight_0.25s_ease-out]"
        >
          <span className="text-xl leading-none shrink-0">{iconFor(t.type)}</span>
          <p className="text-sm text-gray-800 dark:text-gray-100 flex-1 break-words">{t.message}</p>
          <button
            onClick={() => onDismiss(t.id)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

interface NotificationsProps {
  user: User;
}

export default function Notifications({ user }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [showAllUsers, setShowAllUsers] = useState(true); // админ по умолчанию видит уведомления всех пользователей
  const [loading, setLoading] = useState(true);
  const isAdmin = user.role === "admin";
  const cancelledRef = useRef(false); // защита от setState после размонтирования (SSE-колбэк)

  useEffect(() => {
    cancelledRef.current = false;
    loadNotifications();

    // Обновляем уведомления каждые 30 секунд (запасной механизм при недоступном SSE)
    const timer = setInterval(loadNotifications, 30000);

    // Realtime: мгновенное обновление списка при новом уведомлении.
    // В режиме «все пользователи» (админ) SSE-событие касается другого
    // пользователя — перезагрузку делаем только в персональном режиме.
    const unsubscribe = subscribeToNotifications(() => {
      if (!cancelledRef.current && !(isAdmin && showAllUsers)) loadNotifications();
    });

    return () => {
      cancelledRef.current = true;
      clearInterval(timer);
      if (unsubscribe) unsubscribe();
    };
  }, [user.id, showAllUsers]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const allNotifications = await getNotifications(isAdmin && showAllUsers ? { all: true } : undefined);
      // В обычном режиме показываем только свои; в режиме «все» (только для админа сервер
      // уже вернул уведомления всех пользователей) — без фильтрации.
      setNotifications(
        isAdmin && showAllUsers
          ? allNotifications
          : allNotifications.filter((n) => String(n.userId) === String(user.id))
      );
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    loadNotifications();
  };

  const handleMarkAllRead = async () => {
    // В режиме «все пользователи» админ отмечает прочитанными уведомления всех, а не только свои
    await markAllNotificationsRead(isAdmin && showAllUsers ? { all: true } : undefined);
    loadNotifications();
  };

  const handleClearAll = async () => {
    if (confirm("Очистить все уведомления?")) {
      await clearAllNotifications();
      setNotifications([]);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "read") return n.read;
    return true;
  });

  const getTypeInfo = (type: string) => {
    switch (type) {
      case "reminder":
        return { icon: "fa-bell", color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/20" };
      case "starting":
        return { icon: "fa-video", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" };
      case "info":
        return { icon: "fa-info-circle", color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" };
      case "warning":
        return { icon: "fa-exclamation-triangle", color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20" };
      case "user-added":
        return { icon: "fa-user-plus", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" };
      default:
        return { icon: "fa-bell", color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-800" };
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Группировка: Сегодня / На этой неделе / Ранее (по дате уведомления)
  const getGroup = (ts: string): "today" | "week" | "earlier" => {
    const d = new Date(ts);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - ((startOfToday.getDay() + 6) % 7)); // понедельник
    if (d >= startOfToday) return "today";
    if (d >= startOfWeek) return "week";
    return "earlier";
  };

  const sortedByDate = [...filtered].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
  const groups: { key: string; label: string; icon: string; items: Notification[] }[] = [
    {
      key: "today",
      label: "Сегодня",
      icon: "fa-sun",
      items: sortedByDate.filter((n) => getGroup(n.timestamp) === "today"),
    },
    {
      key: "week",
      label: "На этой неделе",
      icon: "fa-calendar-week",
      items: sortedByDate.filter((n) => getGroup(n.timestamp) === "week"),
    },
    {
      key: "earlier",
      label: "Ранее",
      icon: "fa-history",
      items: sortedByDate.filter((n) => getGroup(n.timestamp) === "earlier"),
    },
  ].filter((g) => g.items.length > 0);

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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
              <i className="fas fa-bell text-orange-500"></i>
              Уведомления
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-sm px-2 py-0.5 rounded-full">{unreadCount}</span>
              )}
            </h1>
            {isAdmin && (
              <button
                onClick={() => setShowAllUsers((v) => !v)}
                title="Показывать уведомления всех пользователей ВКС"
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${showAllUsers ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
              >
                <i className="fas fa-users mr-1"></i>
                {showAllUsers ? "Все пользователи" : "Только мои"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30"
            >
              <i className="fas fa-check-double mr-1"></i>Прочитать все
            </button>
            <button
              onClick={handleClearAll}
              className="px-3 py-2 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
            >
              <i className="fas fa-trash mr-1"></i>
              {isAdmin && showAllUsers ? "Очистить мои" : "Очистить"}
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          {(["all", "unread", "read"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${filter === f ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
            >
              {f === "all" ? "Все" : f === "unread" ? "Непрочитанные" : "Прочитанные"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <i className="fas fa-bell-slash text-5xl mb-4"></i>
            <p className="text-lg">Нет уведомлений</p>
          </div>
        ) : (
          <div>
            {groups.map((group) => (
              <div key={group.key}>
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/40 sticky top-0 z-10 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <i className={`fas ${group.icon} mr-2 text-orange-400`}></i>
                    {group.label}
                    <span className="ml-2 text-gray-400">({group.items.length})</span>
                  </span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {group.items.map((notification) => {
                    const typeInfo = getTypeInfo(notification.type);
                    return (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${!notification.read ? "bg-blue-50/30 dark:bg-blue-900/10" : ""}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`${typeInfo.bg} rounded-lg p-2.5 flex-shrink-0`}>
                            <i className={`fas ${typeInfo.icon} ${typeInfo.color}`}></i>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`font-medium ${!notification.read ? "text-gray-800 dark:text-gray-100" : "text-gray-600 dark:text-gray-300"}`}
                              >
                                {notification.message}
                              </p>
                              {!notification.read && (
                                <button
                                  onClick={() => handleMarkRead(notification.id)}
                                  className="text-blue-500 hover:text-blue-700 text-sm whitespace-nowrap"
                                >
                                  Прочитано
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                              {isAdmin && showAllUsers && (
                                <span className="mr-2 text-gray-500 dark:text-gray-400">
                                  <i className="fas fa-user mr-1"></i>
                                  {notification.userName || `Пользователь #${notification.userId}`}
                                </span>
                              )}
                              {new Date(notification.timestamp).toLocaleString("ru-RU")}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
