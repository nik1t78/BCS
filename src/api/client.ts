// API клиент для работы с Laravel backend

// По умолчанию API доступен на том же origin через nginx (location /api/ -> Laravel),
// поэтому относительный путь '/api' работает и в docker, и без настройки CORS.
// Переопределить можно переменной окружения VITE_API_URL при сборке.
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

// Получение токена из localStorage
const getToken = (): string | null => {
  const auth = localStorage.getItem("vks_auth");
  if (!auth) return null;
  return JSON.parse(auth).token;
};

// Обновление пары токенов по одноразовому refresh-токену (POST /auth/refresh)
let refreshPromise: Promise<boolean> | null = null;
const tryRefreshToken = (): Promise<boolean> => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const raw = localStorage.getItem("vks_auth");
      if (!raw) return false;
      const auth = JSON.parse(raw);
      if (!auth.refreshToken) return false;
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refresh_token: auth.refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem(
        "vks_auth",
        JSON.stringify({
          ...auth,
          token: data.token,
          refreshToken: data.refresh_token ?? auth.refreshToken,
        })
      );
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
};

// Базовая функция для запросов
const apiRequest = async (endpoint: string, options: RequestInit = {}, _retried = false): Promise<any> => {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Истёк access-токен — один раз пробуем обновить его по refresh-токену
    if (response.status === 401 && !_retried) {
      const refreshed = await tryRefreshToken();
      if (refreshed) return apiRequest(endpoint, options, true);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}) as any);
      // Laravel при валидации (422) возвращает { message, errors: { field: [msgs] } },
      // а не поле "message" с текстом ошибки — достаём текст из errors
      let message = error.message;
      if (!message && error.errors) {
        const firstMessages = Object.values(error.errors).flat() as string[];
        if (firstMessages.length > 0) {
          message = firstMessages.join("; ");
        }
      }
      throw new Error(message || "Ошибка запроса");
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

// AUTH API
export const authAPI = {
  login: (login: string, password: string) =>
    apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ login, password }),
    }),

  register: (data: { name: string; login: string; password: string; phone?: string; department?: string }) =>
    apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: () =>
    apiRequest("/auth/logout", {
      method: "POST",
    }),

  logoutAll: () => apiRequest("/auth/logout-all", { method: "POST" }),

  sessions: () => apiRequest("/auth/sessions"),

  heatmap: (weeks = 8) => apiRequest(`/admin/heatmap?weeks=${weeks}`),

  getUser: () => apiRequest("/auth/user"),

  // Любой GET-эндпоинт API с авторизацией (используется админ-панелью для
  // постраничной загрузки полных списков).
  rawGet: (endpoint: string) => apiRequest(endpoint),

  // Скачивание файла (CSV/Excel) с авторизацией — возвращает Blob.
  downloadBlob: async (endpoint: string): Promise<Blob> => {
    const token = getToken();
    const headers: Record<string, string> = { Accept: "text/csv,application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
    if (!response.ok) throw new Error(`Ошибка скачивания: HTTP ${response.status}`);
    return await response.blob();
  },
};

// USERS API
export const usersAPI = {
  // Публичный справочник пользователей (ФИО участников для календаря/карточек).
  // Доступен любому авторизованному пользователю — не требует прав админа.
  getPublicList: () => apiRequest("/users"),

  getAll: (params?: { per_page?: number; page?: number; search?: string; role?: string }) => {
    const queryString = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return apiRequest(`/admin/users${queryString}`);
  },

  create: (data: any) =>
    apiRequest("/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    apiRequest(`/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest(`/admin/users/${id}`, {
      method: "DELETE",
    }),

  changeRole: (id: string, role: string) =>
    apiRequest(`/admin/users/${id}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),

  toggleActive: (id: string) =>
    apiRequest(`/admin/users/${id}/toggle-active`, {
      method: "PUT",
    }),

  getAdminStats: () => apiRequest("/admin/stats"),

  resetPassword: (id: string, password: string) =>
    apiRequest(`/admin/users/${id}/reset-password`, {
      method: "PUT",
      body: JSON.stringify({ password }),
    }),
};

// MEETINGS API
export const meetingsAPI = {
  getAll: (params?: { status?: string; date?: string; my?: boolean; search?: string }) => {
    const queryString = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return apiRequest(`/meetings${queryString}`);
  },

  get: (id: string) => apiRequest(`/meetings/${id}`),

  create: (data: any) =>
    apiRequest("/meetings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    apiRequest(`/meetings/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest(`/meetings/${id}`, {
      method: "DELETE",
    }),

  // Отмена встречи с уведомлением участников (сервер рассылает уведомления)
  cancel: (id: string, reason?: string) =>
    apiRequest(`/meetings/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    }),

  // Перенос встречи на другую дату/время (drag&drop в Schedule)
  reschedule: (
    id: string,
    data: { date: string; start_time: string; end_time?: string; notify?: boolean; force?: boolean }
  ) =>
    apiRequest(`/meetings/${id}/reschedule`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getStats: () => apiRequest("/meetings-stats"),

  // Проверка конфликтов расписания: пересекающиеся встречи у тех же людей
  checkConflicts: (params: {
    date: string;
    start_time: string;
    end_time: string;
    users: string;
    exclude?: string | number;
  }) => apiRequest(`/meetings/check-conflicts?${new URLSearchParams(params as any).toString()}`),
};

// КОРЗИНА (soft-deleted встречи)
export const trashAPI = {
  list: (params?: { per_page?: number; page?: number }) => {
    const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return apiRequest(`/trash${qs}`);
  },

  restore: (id: string) => apiRequest(`/trash/${id}/restore`, { method: "POST" }),

  destroyForever: (id: string) => apiRequest(`/trash/${id}`, { method: "DELETE" }),
};

// ПРОТОКОЛ ВСТРЕЧИ (MINUTES) И ЗАДАЧИ (ACTION ITEMS) API
export const minutesAPI = {
  list: (meetingId: string) => apiRequest(`/meetings/${meetingId}/minutes`),

  create: (meetingId: string, data: { discussion?: string; decisions?: string; responsible?: string }) =>
    apiRequest(`/meetings/${meetingId}/minutes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    meetingId: string,
    minuteId: string,
    data: { discussion?: string; decisions?: string; responsible?: string }
  ) =>
    apiRequest(`/meetings/${meetingId}/minutes/${minuteId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (meetingId: string, minuteId: string) =>
    apiRequest(`/meetings/${meetingId}/minutes/${minuteId}`, {
      method: "DELETE",
    }),
};

export const meetingTasksAPI = {
  list: (meetingId: string) => apiRequest(`/meetings/${meetingId}/tasks`),

  create: (
    meetingId: string,
    data: { title: string; assignee_id?: number | null; assignee_ids?: number[]; deadline?: string | null }
  ) =>
    apiRequest(`/meetings/${meetingId}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    meetingId: string,
    taskId: string,
    data: {
      title?: string;
      assignee_id?: number | null;
      assignee_ids?: number[];
      deadline?: string | null;
      status?: string;
    }
  ) =>
    apiRequest(`/meetings/${meetingId}/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (meetingId: string, taskId: string) =>
    apiRequest(`/meetings/${meetingId}/tasks/${taskId}`, {
      method: "DELETE",
    }),

  addComment: (meetingId: string, taskId: string, body: string) =>
    apiRequest(`/meetings/${meetingId}/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  removeComment: (meetingId: string, taskId: string, commentId: string) =>
    apiRequest(`/meetings/${meetingId}/tasks/${taskId}/comments/${commentId}`, {
      method: "DELETE",
    }),
};

// RSVP — подтверждение присутствия
export const rsvpAPI = {
  get: (meetingId: string) => apiRequest(`/meetings/${meetingId}/rsvp`),

  respond: (meetingId: string, response: "yes" | "no" | "maybe") =>
    apiRequest(`/meetings/${meetingId}/rsvp`, {
      method: "POST",
      body: JSON.stringify({ response }),
    }),
};

// NOTIFICATIONS API
export const notificationsAPI = {
  /**
   * Realtime-канал уведомлений (Server-Sent Events). Возвращает EventSource,
   * если браузер его поддерживает и пользователь авторизован; иначе null —
   * вызывающий код остаётся на поллинге. Событие "notification": {id, message, type}.
   */
  stream: (): EventSource | null => {
    if (typeof EventSource === "undefined") return null;
    const token = getToken();
    if (!token) return null;
    // Laravel отдаёт StreamedResponse без Content-Encoding, поэтому gzip в
    // Accept-Encoding здесь не нужен и не передаётся (иначе буферизация).
    return new EventSource(`${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`);
  },

  getAll: (params?: { type?: string; unread?: boolean; all?: boolean; per_page?: number }) => {
    const queryString = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return apiRequest(`/notifications${queryString}`);
  },

  markAsRead: (id: string) =>
    apiRequest(`/notifications/${id}/read`, {
      method: "PUT",
    }),

  markAllAsRead: (params?: { all?: boolean }) => {
    const queryString = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return apiRequest(`/notifications/read-all${queryString}`, {
      method: "PUT",
    });
  },

  clearAll: () =>
    apiRequest("/notifications/clear", {
      method: "DELETE",
    }),

  getUnreadCount: () => apiRequest("/notifications/unread-count"),
};

// SETTINGS API
export const settingsAPI = {
  get: () => apiRequest("/settings"),

  update: (data: any) =>
    apiRequest("/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// PROFILE API
export const profileAPI = {
  update: (data: any) =>
    apiRequest("/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  changePassword: (data: { current_password: string; password: string; password_confirmation: string }) =>
    apiRequest("/profile/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// TAGS API
export const tagsAPI = {
  getAll: () => apiRequest("/tags"),

  create: (data: any) =>
    apiRequest("/tags", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    apiRequest(`/tags/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest(`/tags/${id}`, {
      method: "DELETE",
    }),
};

// TEMPLATES API
export const templatesAPI = {
  getAll: () => apiRequest("/templates"),

  create: (data: any) =>
    apiRequest("/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    apiRequest(`/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest(`/templates/${id}`, {
      method: "DELETE",
    }),
};

// ATTACHMENTS API
export const attachmentsAPI = {
  getByMeeting: (meetingId: string) => apiRequest(`/meetings/${meetingId}/attachments`),

  upload: (meetingId: string, formData: FormData) =>
    apiRequest(`/meetings/${meetingId}/attachments`, {
      method: "POST",
      body: formData,
      headers: {}, // Не устанавливаем Content-Type, чтобы браузер установил multipart/form-data
    }),

  delete: (id: string) =>
    apiRequest(`/attachments/${id}`, {
      method: "DELETE",
    }),
};

// MEETING HISTORY API
export const meetingHistoryAPI = {
  getByMeeting: (meetingId: string) => apiRequest(`/meetings/${meetingId}/history`),
};

// HEALTH CHECK
export const healthAPI = {
  check: () => apiRequest("/health"),
};

// ROOMS API — переговорные комнаты и доступность (резервирование)
export const roomsAPI = {
  list: () => apiRequest("/rooms"),
  availability: (
    roomId: string | number,
    params: { date: string; start_time?: string; end_time?: string; exclude?: string | number }
  ) => apiRequest(`/rooms/${roomId}/availability?${new URLSearchParams(params as any).toString()}`),
  create: (data: Record<string, unknown>) => apiRequest("/rooms", { method: "POST", body: JSON.stringify(data) }),
  update: (roomId: string | number, data: Record<string, unknown>) =>
    apiRequest(`/rooms/${roomId}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (roomId: string | number) => apiRequest(`/rooms/${roomId}`, { method: "DELETE" }),
};

// MAX MESSENGER API — привязка аккаунта мессенджера MAX для уведомлений
export const maxAPI = {
  status: () => apiRequest("/max/status"),
  link: (chatId: string) => apiRequest("/max/link", { method: "PUT", body: JSON.stringify({ chat_id: chatId }) }),
  unlink: () => apiRequest("/max/link", { method: "DELETE" }),
};

// TELEGRAM API — привязка Telegram-бота для push-уведомлений о встречах
export const telegramAPI = {
  status: (): Promise<{ enabled: boolean; driver: string; linked: boolean; botLink: string }> =>
    apiRequest("/telegram/status"),
  link: (): Promise<{ botLink: string; linkCode: string; instruction: string }> =>
    apiRequest("/telegram/link", { method: "POST" }),
  unlink: () => apiRequest("/telegram/link", { method: "DELETE" }),
};
