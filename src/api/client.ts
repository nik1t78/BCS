// API клиент для работы с Laravel backend

// По умолчанию API доступен на том же origin через nginx (location /api/ -> Laravel),
// поэтому относительный путь '/api' работает и в docker, и без настройки CORS.
// Переопределить можно переменной окружения VITE_API_URL при сборке.
export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

// Получение токена из localStorage
export const getToken = (): string | null => {
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

// При 401 от API чистим локальные данные авторизации — App.tsx слушает это
// событие и показывает экран входа. Делается ДО попытки refresh и независимо
// от её результата, поэтому сессия никогда не «зависает» в состоянии
// «пользователь как будто залогинен, а все запросы падают с Unauthenticated».
let reloginShown = false;
export function forceRelogin() {
  if (reloginShown) return;
  reloginShown = true;
  localStorage.removeItem("vks_auth");
  window.dispatchEvent(new Event("vks-unauthorized"));
  setTimeout(() => {
    reloginShown = false;
  }, 3000);
}

// Базовая функция для запросов
export const apiRequest = async (endpoint: string, options: RequestInit = {}, _retried = false): Promise<any> => {
  const token = getToken();

  // Для multipart/FormData заголовок Content-Type не устанавливаем —
  // браузер сам добавит его с корректным boundary (иначе Laravel не
  // распознаёт загружаемый файл и валидация «file is required» падает).
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? { Accept: "application/json" }
    : { "Content-Type": "application/json", Accept: "application/json" };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Истёк access-токен — один раз пробуем обновить его по refresh-токену.
    // Если обновить не удалось (refresh-токена нет/истёк/сервер отверг) —
    // сразу чистим сессию и показываем экран входа: иначе пользователь
    // остаётся «залогиненным», а каждый запрос падает с 401 Unauthenticated
    // (именно это наблюдали на страницах встреч/уведомлений).
    if (response.status === 401 && !_retried) {
      const refreshed = await tryRefreshToken();
      if (refreshed) return apiRequest(endpoint, options, true);
      forceRelogin();
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}) as any);
      // Laravel при валидации (422) возвращает { message, errors: { field: [msgs] } },
      // а не поле "message" с текстом ошибки — достаём текст из errors
      let message = typeof error.message === "string" ? error.message : undefined;
      if (!message && error.errors) {
        const firstMessages = Object.values(error.errors).flat() as string[];
        if (firstMessages.length > 0) {
          message = firstMessages.join("; ");
        }
      }
      // Кастомный рендер ошибок бэкенда (bootstrap/app.php) кладёт точную
      // причину в поле detail — показываем её, если message неинформативен.
      if ((!message || message === "Server Error") && typeof error.detail === "string" && error.detail) {
        message = error.detail;
      }
      // 5xx: Laravel при APP_DEBUG=false отдаёт {"message":"Server Error"} без
      // деталей — пользователь видел только «проверьте поля». Пытаемся вытащить
      // реальную причину из нетипичных форм ответа (exception / message в виде
      // объекта / текстовый ответ nginx/PHP-FPM).
      if (!message && response.status >= 500) {
        if (typeof error.message === "object" && error.message) {
          message = String((error.message as any).message ?? "");
        } else if (typeof error.exception === "string") {
          message = error.exception;
        } else if (typeof error.error === "string") {
          message = error.error;
        }
        if (!message) {
          try {
            const text = typeof response.clone === "function" ? await response.clone().text() : "";
            const m = text.match(/Undefined array key[^<"]*|Column not found[^<"]*|SQLSTATE\[\d+\][^<"]*|Data too long[^<"]*|Base table or view not found[^<"]*/i);
            if (m) message = m[0];
          } catch {
            /* не критично */
          }
        }
      }
      const err: any = new Error(message || `Ошибка сервера (HTTP ${response.status}). Подробности — в логах: docker compose logs backend`);
      // Пробрасываем объект errors целиком: store-api извлекает конкретную
      // причину валидации («время уже прошло» и т.п.) для сообщения в UI.
      err.errors = error.errors ?? null;
      // Пробрасываем HTTP-статус: компоненты должны различать 401/403/404/5xx
      // и корректно включать fallback-сценарии (например, список залов через
      // /meetings/rooms-availability при 403 на GET /rooms).
      err.status = response.status;
      throw err;
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

// Скачивание файла (CSV/Excel/PDF) с авторизацией — возвращает Blob.
export const downloadBlob = async (endpoint: string): Promise<Blob> => {
  const token = getToken();
  const headers: Record<string, string> = { Accept: "text/csv,application/pdf,application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
  if (!response.ok) throw new Error(`Ошибка скачивания: HTTP ${response.status}`);
  return await response.blob();
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

  // Скачивание файла (CSV/Excel/PDF) — см. экспортируемую функцию downloadBlob
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

  // Агрегированная доступность всех залов на дату (доступно всем авторизованным,
  // включая роль «user», без прав на справочник комнат)
  roomsAvailability: (params?: { date?: string }) => {
    const queryString = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return apiRequest(`/meetings/rooms-availability${queryString}`);
  },

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

  // Экспорт протокола: скачивание PDF (или печатопригодного HTML, если
  // dompdf не установлен на сервере). Возвращает Blob.
  exportPdf: (meetingId: string) => downloadBlob(`/meetings/${meetingId}/minutes/export-pdf`),

  // Отправка протокола PDF-файлом в MAX участникам с привязанным chat_id
  sendToMax: (meetingId: string) => apiRequest(`/meetings/${meetingId}/minutes/send-max`, { method: "POST" }),
};

// Дашборд нагрузки системы (админ/модератор): GET /api/admin/load
export const adminLoadAPI = {
  get: (weeks = 4) => apiRequest(`/admin/load?weeks=${weeks}`),
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

// MEETING HISTORY API
export const meetingHistoryAPI = {
  getByMeeting: (meetingId: string) => apiRequest(`/meetings/${meetingId}/history`),
};

// HEALTH CHECK
export const healthAPI = {
  check: () => apiRequest("/health"),
};

// Синхронизация часов с сервером (см. GET /api/time в backend/routes/api.php).
// Браузерные часы могут расходиться с часами контейнера Laravel — тогда
// корректный выбор времени в форме создания встречи сервер отклоняет как
// «прошедшее время» («время не совпадает»). Здесь фронт замеряет смещение
// offset = serverTime - clientTime, а форма использует «серверное сейчас».
let timeOffsetMs = 0;
let timeSyncedAt = 0;
const TIME_SYNC_TTL_MS = 5 * 60 * 1000; // пересинхронизация не чаще раза в 5 минут

// ФИКС «ВКС уезжает прошедшим числом» (Кола 02.11, когда на сервере уже 03.11):
// раньше при загрузке страницы offset молча восстанавливался из localStorage
// ("vks_time_offset_ms") — значения, которому мы НЕ можем доверять:
//  • запись могла пролежать в браузере неделями (протухший замер);
//  • её оставляли тесты с переведёнными системными часами (пользователь
//    проверял «а что если дата другая», Windows отставал на сутки — offset
//    ~-24ч фиксировался и переживал перезагрузку);
//  • при смене пояса/летнего времени он тоже съезжает.
// Этот «призрачный offset» участвовал в расчёте «серверного сейчас» ещё ДО
// первой сверки с /api/time: guessServerTodayKey()/serverNowDate() считали
// «сегодня» вчерашним, форма стартовала с прошедшей датой, min у поля «Дата»
// её же и ставил — и встреча сохранялась «в прошедшее число», хотя на компе и
// на сервере всё было корректно.
//
// НОВОЕ ПРАВИЛО: offset живёт ТОЛЬКО в памяти вкладки и подтверждается свежим
// ответом GET /api/time (syncServerTime). localStorage больше не участвует в
// вычислениях — при отсутствии сверки система работает по честным локальным
// часам (ошибка ≤ нескольких минут вместо суток). Старые записи удаляются.
try {
  localStorage.removeItem("vks_time_offset_ms");
} catch {
  /* приватный режим — не страшно */
}

/** Смещение серверных часов относительно локальных (мс). 0 — синхронизация не выполнялась. */
export function getTimeOffsetMs(): number {
  return timeOffsetMs;
}

/** Была ли синхронизация часов УСПЕШНОЙ (а не дефолтный offset=0).
 *  Ключевой флаг для формы создания: пока он false, любое «серверное сейчас»
 *  фактически равно локальному времени браузера. Если часы пользователя или
 *  его дата сбиты, форма молча подставляла в заявку ЛОКАЛЬНУЮ дату/время —
 *  пользователь выбирал 30-е, а создавалось 29-е («неправильная дата»). */
let timeSyncOk = false;
export function isTimeSynced(): boolean {
  return timeSyncOk;
}

/** «Сегодня» по ЧАСАМ КОМПЬЮТЕРА пользователя (YYYY-MM-DD, локальный пояс).
 *  Используется как ОБОРОНИТЕЛЬНЫЙ ориентир на сервере: если клиент прислал
 *  дату из прошлого, но она совпадает с «сегодня» по его собственным часам
 *  (echo_client_today), это почти наверняка рассинхрон часов/offset'а на
 *  клиенте, а не осознанный выбор прошедшего дня. Раньше такой встречи
 *  пользователь получал 422 «Нельзя создать встречу в прошедшем времени» —
 *  при том что на его компьютере было корректное 02.11, а до сервера долетало
 *  01.11 (старый дефолт формы / кривой offset / протухший кэш /api/time). */
export function clientTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Локальное «сейчас» в HH:mm по часам компьютера пользователя.
 *  В связке с clientTodayKey() даёт полный локальный момент — используется
 *  как echo_client_now для серверной подсказки в тексте ошибки 422. */
export function clientNowHm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Момент «сейчас» на СЕРВЕРЕ (Unix-мс) — абсолютный, не зависит от часов
 *  браузера: это Date.now() ответа /api/time плюс измеренное смещение.
 *  Критично для проверки «выбранное время уже прошло?»: раньше форма
 *  сверялась только с offset'ом и при рассинхроненном календаре ОС молча
 *  отправляла прошедшую дату/время, а сервер записывал её как есть либо
 *  отбивал невнятной ошибкой. Если синхронизация ещё не выполнена —
 *  null (вызывающий обязан сначала дождаться syncServerTime или
 *  положиться на серверную проверку). */
export function serverNowMsOrNull(): number | null {
  if (!timeSyncOk) return null;
  return Date.now() + timeOffsetMs;
}

/** Актуализировать смещение часов (вызывается при открытии формы создания). */
export async function syncServerTime(force = false): Promise<void> {
  // force=true — «принудительно, прямо сейчас». Критично для submit-проверок:
  // без него повторное нажатие «Создать ВКС» в течение 5 минут молча
  // использовало старый offset, и форма отклоняла корректный слот как
  // «прошедший» (или наоборот — пропускала реально прошедший).
  if (!force && Date.now() - timeSyncedAt < TIME_SYNC_TTL_MS) return;
  try {
    const t0 = Date.now();
    // Фикс «сервер говорит, что я создаю встречу в прошедшем»: если VITE_API_URL
    // задан с завершающим слэшем ("/api/"), старый код собирал "//time" -> 404,
    // syncServerTime() молча падал, isTimeSynced() оставался false, offset=0 и
    // форма считала «сейчас» по локальным (возможно сбитым) часам Windows —
    // корректный выбор на сегодня отклонялся как «прошедший».
    const timeUrl = `${API_BASE_URL.replace(/\/+$/, "")}/time?_=${t0}`;
    // cache: 'no-store' + фикс «сегодня 02.11, а создаёт 01.11»: без него nginx/
    // браузер могли отдать закешированный ответ /api/time вчерашней выдержки —
    // offset получался смещённым на сутки, «серверное сегодня» отставало, и
    // форма молча подставляла в заявку предыдущий день.
    const res = await fetch(timeUrl, { headers: { Accept: "application/json", "Cache-Control": "no-cache" }, cache: "no-store" });
    if (!res.ok) return;
    const t1 = Date.now();
    const data = await res.json();
    // Сервер эхом возвращает наш cache-bust ('echo'). Если echo не совпал —
    // это протухший (закэшированный) ответ из прокси: доверять ему нельзя.
    if (data?.echo !== undefined && data.echo !== null && Number(data.echo) !== t0) return;
    const serverMs = Date.parse(data?.server_time ?? "");
    if (Number.isNaN(serverMs)) return;
    // Оценка серверного «сейчас» на момент t1: прибавляем половину времени запроса
    timeOffsetMs = serverMs + Math.round((t1 - t0) / 2) - t1;
    timeSyncedAt = Date.now();
    timeSyncOk = true;
    // Offset больше НЕ сохраняем в localStorage: «серверное сейчас» доверяет
    // только свежей сверке с /api/time в текущей вкладке (см. комментарий у
    // removeItem выше). Сохранённый вчерашний/протухший замер и был причиной
    // «ВКС уходит прошедшим числом».
    // Сохраняем таймзону сервера (например "Europe/Moscow") — она нужна,
    // чтобы пересчитать «серверное сейчас» в корректные HH:mm/дату независимо
    // от того, в каком поясе живёт браузер пользователя.
    if (typeof data?.timezone === "string" && data.timezone) {
      serverTimezone = data.timezone;
      try {
        localStorage.setItem("vks_server_tz", data.timezone);
      } catch {
        /* приватный режим браузера — не страшно, дефолт Europe/Moscow ниже */
      }
    }
  } catch {
    /* сервер времени недоступен — работаем по локальным часам */
  }
}

/** Таймзона сервера из GET /api/time (дефолт — Europe/Moscow, как в docker-образах). */
let serverTimezone = (() => {
  try {
    return localStorage.getItem("vks_server_tz") || "Europe/Moscow";
  } catch {
    return "Europe/Moscow";
  }
})();

/** Таймзона сервера (для пересчёта «локальных» серверных суток/часов в UTC —
 *  например при экспорте .ics). */
export function getServerTimezone(): string {
  return serverTimezone;
}

/** Явная «сегодня» по поясу сервера для произвольного момента времени. */
export function todayKeyInServerTz(at: Date): string {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: serverTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Синхронная оценка «серверного сегодня» (YYYY-MM-DD) БЕЗ ожидания /api/time.
 * Используется для начального дефолта даты в формах создания: раньше он
 * считался через toDateKey(new Date()) — т.е. по ЛОКАЛЬНЫМ часам устройства.
 * Если на компьютере пользователя сбиты дата/часы или пояс отличается от
 * серверного, форма стартовала с «29», когда на сервере уже «30» («выбрал
 * 30-е — записало 29-е»). Здесь берём локальную дату и корректируем её по
 * смещению часов из последней успешной синхронизации (offset сохраняется в
 * localStorage, поэтому доступен и после перезагрузки страницы до первого
 * /api/time). При отсутствии offset возвращается локальная дата — эффект
 * синхронизации при открытии формы всё равно переставит дефолт на серверный.
 */
export function guessServerTodayKey(): string {
  // ФИКС «ВКС уходит прошедшим числом»: localStorage-Offset больше НЕ
  // используется (см. removeItem выше) — протухший/тестовый замер отставших
  // часов делал «серверное сегодня» вчерашним ещё до первой сверки.
  // Приоритет теперь такой:
  //  1) подтверждённая синхронизация ЭТОЙ вкладки (/api/time) — серверное
  //     «сегодня»;
  //  2) иначе — локальная дата браузера по поясу сервера (ошибка ≤ минут,
  //     а не суток); эффект синхронизации при открытии формы уточнит её
  //     сразу после /api/time.
  if (timeSyncOk) {
    return todayKeyInServerTz(new Date(Date.now() + timeOffsetMs));
  }
  return todayKeyInServerTz(new Date());
}

/** «Сейчас» с поправкой на серверные часы (Date учитывает offset).
 *  КРИТИЧНО: offset доверяется ТОЛЬКО успешной сверке /api/time в текущей
 *  вкладке (timeSyncOk). Значение из localStorage раньше подтягивалось сюда
 *  даже без подтверждения — протухший замер (или след теста с переведёнными
 *  системными часами) смещал «сейчас» на сутки назад, и все проверки формы
 *  («дата в прошлом», min у поля даты, дефолт слотов) молча ломались —
 *  отсюда «выбрал 03.11, а записало 02.11». Без сверки = честные локальные
 *  часы браузера. */
export function serverNowDate(): Date {
  return new Date(Date.now() + (timeSyncOk ? timeOffsetMs : 0));
}

/** Серверное «сейчас» в Unix-мс с учётом подтверждённого offset. */
export function serverNowMs(): number {
  return serverNowDate().getTime();
}

/** Форматирует «серверное сейчас» в виде YYYY-MM-DD ПО ЧАСОВОЙ ЗОНЕ СЕРВЕРА.
 *  Важно: Date внутри serverNowDate() абсолютный момент времени, но getFullYear()/
 *  getHours() читают его в поясе БРАУЗЕРА. Если у пользователя пояс отличается
 *  от серверного (командировка, VPS в UTC), дата «сегодня» съедет на день.
 *  Intl.DateTimeFormat с serverTimezone гарантирует те же сутки, что и Laravel. */
export function serverTodayKeyTz(): string {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: serverTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(serverNowDate());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** «Серверное сейчас» в HH:mm по поясу сервера (нижняя граница слотов формы). */
export function serverNowHmTz(): string {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: serverTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(serverNowDate());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

/** «Серверное сейчас» в HH:mm по поясу сервера + произвольное число минут
 *  (для нижнего слота формы: «сейчас+10»). Пересчёт через Date в UTC-компонентах
 *  и Intl с timeZone — не зависит от пояса браузера. */
export function serverNowHmPlusMinTz(addMinutes: number): string {
  const d = new Date(serverNowDate().getTime() + addMinutes * 60_000);
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: serverTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

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

// Массовая загрузка участников встречи списком/CSV (id, логин или ФИО через ; , \n)
export const bulkParticipantsAPI = {
  add: (meetingId: string | number, participants: string, notify = true) =>
    apiRequest(`/meetings/${meetingId}/participants/bulk`, {
      method: "POST",
      body: JSON.stringify({ participants, notify }),
    }),
};

// Экспорт расписания в iCalendar (.ics)
export const icsAPI = {
  download: () => downloadBlob("/schedule.ics"),
};

// Web Push подписки браузера
export const pushAPI = {
  subscribe: (sub: PushSubscriptionJSON) =>
    apiRequest("/push/subscribe", { method: "POST", body: JSON.stringify(sub) }),
  list: () => apiRequest("/push/subscriptions"),
  unsubscribe: (id: string | number) => apiRequest(`/push/subscribe/${id}`, { method: "DELETE" }),
  test: () => apiRequest("/push/test", { method: "POST" }),
};
