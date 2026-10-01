// Store с поддержкой API Laravel

import {
  authAPI,
  usersAPI,
  meetingsAPI,
  notificationsAPI,
  settingsAPI,
  profileAPI,
  tagsAPI,
  templatesAPI,
  attachmentsAPI,
  meetingHistoryAPI,
  minutesAPI,
  meetingTasksAPI,
  rsvpAPI,
  trashAPI,
} from "./api/client";
import {
  User,
  Meeting,
  Notification,
  Settings,
  Tag,
  MeetingTemplate,
  Attachment,
  MeetingHistory,
  MeetingMinute,
  MeetingTask,
  TaskComment,
  ScheduleConflict,
  RsvpData,
  MeetingRsvp,
  RsvpResponse,
} from "./types";

// ============ AUTH ============
export async function login(
  login: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const response = await authAPI.login(login, password);
    localStorage.setItem(
      "vks_auth",
      JSON.stringify({
        token: response.token,
        refreshToken: response.refresh_token ?? null,
        user: mapUser(response.user ?? response.data ?? response),
      })
    );
    return { success: true, user: mapUser(response.user ?? response.data ?? response) };
  } catch (error: any) {
    return { success: false, error: error.message || "Ошибка входа" };
  }
}

export async function register(
  name: string,
  login: string,
  password: string,
  phone?: string,
  department?: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const response = await authAPI.register({ name, login, password, phone, department });
    localStorage.setItem(
      "vks_auth",
      JSON.stringify({
        token: response.token,
        refreshToken: response.refresh_token ?? null,
        user: mapUser(response.user ?? response.data ?? response),
      })
    );
    return { success: true, user: mapUser(response.user ?? response.data ?? response) };
  } catch (error: any) {
    return { success: false, error: error.message || "Ошибка регистрации" };
  }
}

export async function logout(): Promise<void> {
  try {
    await authAPI.logout();
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    localStorage.removeItem("vks_auth");
  }
}

export function getCurrentUser(): User | null {
  const data = localStorage.getItem("vks_auth");
  if (!data) return null;
  return JSON.parse(data).user;
}

export function getToken(): string | null {
  const data = localStorage.getItem("vks_auth");
  if (!data) return null;
  return JSON.parse(data).token;
}

// ============ Маппинги snake_case (Laravel) <-> camelCase (UI) ============
const toCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());

export function mapUser(raw: any): User {
  const out: any = {};
  for (const k of Object.keys(raw ?? {})) out[toCamel(k)] = raw[k];
  if (out.createdAt && typeof out.createdAt === "string") out.createdAt = out.createdAt.replace(" ", "T");
  return out as User;
}

export function userToApi(data: any): any {
  const out: any = {};
  for (const k of Object.keys(data ?? {})) {
    if (k === "id" || k === "createdAt" || k === "lastLogin" || k === "password_hash") continue;
    out[toSnake(k)] = data[k];
  }
  return out;
}

export function mapMeeting(raw: any): Meeting {
  const out: any = {};
  for (const k of Object.keys(raw ?? {})) out[toCamel(k)] = raw[k];
  if (raw?.start_time !== undefined) out.startTime = String(raw.start_time).slice(0, 5);
  if (raw?.end_time !== undefined) out.endTime = String(raw.end_time).slice(0, 5);
  if (Array.isArray(out.participants)) out.participants = out.participants.map(String);
  if (Array.isArray(out.organizer)) out.organizer = undefined;
  if (typeof out.date === "string") out.date = out.date.slice(0, 10);
  if (typeof out.repeatUntil === "string") out.repeatUntil = out.repeatUntil.slice(0, 10);
  if (out.createdAt && typeof out.createdAt === "string") out.createdAt = out.createdAt.replace(" ", "T");
  // Бэкенд возвращает теги объектами ({id, name, color}) — для UI оставляем только id
  if (Array.isArray(out.tags)) {
    out.tags = out.tags
      .map((t: any) => String(typeof t === "object" && t !== null ? t.id : t))
      .filter((s: string) => s && s !== "undefined" && s !== "null");
  }
  return out as Meeting;
}

export function meetingToApi(data: any): any {
  const out: any = {};
  for (const k of Object.keys(data ?? {})) {
    if (k === "id" || k === "createdAt" || k === "updatedAt" || k === "organizer" || k === "_occurrenceOf") continue;
    out[toSnake(k)] = data[k];
  }
  if (data.startTime) out.start_time = data.startTime;
  if (data.endTime) out.end_time = data.endTime;
  if (Array.isArray(out.participants))
    out.participants = out.participants.map((v: any) => Number(v)).filter((v: number) => !Number.isNaN(v));
  // Теги встречи — id тегов из справочника (meeting_tag); бэкенд валидирует их как integer[]
  if (Array.isArray(out.tags)) out.tags = out.tags.map((v: any) => Number(v)).filter((v: number) => !Number.isNaN(v));
  delete out.start_time_text;
  delete out.end_time_text;
  return out;
}

export function unwrapList(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response.data)) return response.data;
  return [];
}

// ============ USERS ============
// Бэкенд пагинирует /admin/users (50 записей на страницу) — грузим ВСЕ
// страницы, иначе список пользователей и статистика в админке считаются
// только по первой странице и выглядят пустыми/некорректными.
export async function getUsers(): Promise<User[]> {
  try {
    const all: User[] = [];
    let page = 1;
    for (;;) {
      const response = await usersAPI.getAll({ per_page: 200, page });
      const items = unwrapList(response)
        .map(mapUser)
        .filter((u: any) => u && u.id != null && u.name && u.login) as User[];
      all.push(...items);
      const lastPage = Number(response?.last_page ?? page);
      if (items.length === 0 || page >= lastPage) break;
      page++;
    }
    return all;
  } catch (error) {
    console.error("Get users error:", error);
    return [];
  }
}

// Справочник пользователей для отображения ФИО (календарь, карточки, выбор
// участников). Обычные пользователи не имеют доступа к /admin/users (403),
// поэтому сначала пробуем публичный GET /users, а для админа/модератора
// используем расширенный список /admin/users.
export async function getUsersForDisplay(currentRole?: string): Promise<User[]> {
  if (currentRole === "admin" || currentRole === "moderator") {
    const adminList = await getUsers();
    if (adminList.length > 0) return adminList;
  }
  try {
    const response = await usersAPI.getPublicList();
    return unwrapList(response)
      .map(mapUser)
      .filter((u: any) => u && u.id != null && u.name);
  } catch (error) {
    console.error("Get public users error:", error);
    return getUsers();
  }
}

// Laravel Paginate::toArray() возвращает { data, current_page, ... } —
// и для списка пользователей, и для созданной модели (она сериализуется в
// {"data": {...}}). Достаём первую запись из возможной обёртки пагинации.
function unwrapOne(response: any): any {
  if (response && typeof response === "object" && !Array.isArray(response) && Array.isArray((response as any).data)) {
    return (response as any).data[0] ?? null;
  }
  return response;
}

export async function createUser(data: any): Promise<User | null> {
  try {
    // Бэкенд принимает только поля модели (snake_case); лишние поля
    // (createdAt, isActive и т.п.) раньше ломали создание пользователя.
    const payload: any = {
      name: data.name,
      login: data.login,
      password: data.password,
      role: data.role || "user",
    };
    if (data.phone) payload.phone = data.phone;
    if (data.department) payload.department = data.department;
    if (data.position) payload.position = data.position;
    if (typeof data.isActive === "boolean") payload.is_active = data.isActive;
    const response = await usersAPI.create(payload);
    return mapUser(unwrapOne(response));
  } catch (error) {
    console.error("Create user error:", error);
    return null;
  }
}

export async function updateUser(id: string, data: any): Promise<User | null> {
  try {
    // PUT /admin/users/{id} принимает только name/login/phone/department/position.
    // Отправляем userToApi(data) без id/createdAt/password/is_active — иначе
    // Laravel валидация отбивалась (422) и админка «не работала».
    const payload = userToApi(data);
    delete payload.password;
    delete payload.is_active;
    delete payload.avatar;
    delete payload.role;
    delete payload.last_login;
    const response = await usersAPI.update(id, payload);
    return mapUser(unwrapOne(response));
  } catch (error) {
    console.error("Update user error:", error);
    return null;
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    await usersAPI.delete(id);
    return true;
  } catch (error) {
    console.error("Delete user error:", error);
    return false;
  }
}

export async function changeUserRole(id: string, role: string): Promise<boolean> {
  try {
    await usersAPI.changeRole(id, role);
    return true;
  } catch (error) {
    console.error("Change role error:", error);
    return false;
  }
}

export async function toggleUserActive(id: string): Promise<boolean> {
  try {
    await usersAPI.toggleActive(id);
    return true;
  } catch (error) {
    console.error("Toggle active error:", error);
    return false;
  }
}

export async function resetUserPassword(id: string, password: string): Promise<boolean> {
  try {
    await usersAPI.resetPassword(id, password);
    return true;
  } catch (error) {
    console.error("Reset password error:", error);
    return false;
  }
}

// ============ MEETINGS ============
// Бэкенд пагинирует /meetings (по умолчанию 50 записей на страницу).
// getMeetings без явного page/per_page грузит ВСЕ страницы, иначе фильтры
// «Организованные/Участие», календарь и статистика видят только первую
// страницу и выглядят пустыми/некорректными.
async function loadAllMeetingPages(params?: any): Promise<Meeting[]> {
  const all: Meeting[] = [];
  let page = 1;
  for (;;) {
    const response = await meetingsAPI.getAll({ ...(params ?? {}), per_page: 200, page });
    const items = unwrapList(response).map(mapMeeting) as Meeting[];
    all.push(...items);
    const lastPage = Number(response?.last_page ?? page);
    if (items.length === 0 || page >= lastPage) break;
    page++;
  }
  return all;
}

export async function getMeetings(params?: {
  status?: string;
  date?: string;
  my?: boolean;
  search?: string;
}): Promise<Meeting[]> {
  try {
    return await loadAllMeetingPages(params);
  } catch (error: any) {
    // 401 — истёкший токен Sanctum: показываем понятный экран входа, а не пустой список
    if (String(error?.message ?? "").includes("401")) forceRelogin();
    console.error("Get meetings error:", error);
    return [];
  }
}

// При 401 на любой запрос чистим локальные данные авторизации — App.tsx
// перерендерится на страницу входа (без «белого экрана»/вечной загрузки).
let reloginShown = false;
function forceRelogin() {
  if (reloginShown) return;
  reloginShown = true;
  localStorage.removeItem("vks_auth");
  window.dispatchEvent(new Event("vks-unauthorized"));
  setTimeout(() => {
    reloginShown = false;
  }, 3000);
}

export async function createMeeting(data: any): Promise<Meeting | null> {
  try {
    // Бэкенд ждёт обязательные поля (priority, reminder_minutes, recurring и
    // формат времени H:i). Отправляем только валидные поля в snake_case.
    const response = await meetingsAPI.create(meetingToApi(data));
    return mapMeeting(unwrapOne(response));
  } catch (error) {
    console.error("Create meeting error:", error);
    return null;
  }
}

export async function updateMeeting(id: string, data: any): Promise<Meeting | null> {
  try {
    const response = await meetingsAPI.update(id, meetingToApi(data));
    return mapMeeting(unwrapOne(response));
  } catch (error) {
    console.error("Update meeting error:", error);
    return null;
  }
}

export async function deleteMeeting(id: string): Promise<boolean> {
  try {
    await meetingsAPI.delete(id);
    return true;
  } catch (error) {
    console.error("Delete meeting error:", error);
    return false;
  }
}

// Отмена встречи через специальный эндпоинт: сервер уведомляет участников
export async function cancelMeeting(id: string, reason?: string): Promise<Meeting | null> {
  try {
    const response = await meetingsAPI.cancel(id, reason);
    return mapMeeting(unwrapOne(response));
  } catch (error) {
    console.error("Cancel meeting error:", error);
    return null;
  }
}

// Перенос встречи (drag&drop в Schedule / кнопка «Перенести»)
export async function rescheduleMeeting(
  id: string,
  data: { date: string; startTime: string; endTime?: string; notify?: boolean; force?: boolean }
): Promise<Meeting | null> {
  try {
    const response = await meetingsAPI.reschedule(id, {
      date: data.date,
      start_time: data.startTime,
      ...(data.endTime ? { end_time: data.endTime } : {}),
      ...(data.notify !== undefined ? { notify: data.notify } : {}),
      ...(data.force !== undefined ? { force: data.force } : {}),
    });
    return mapMeeting(unwrapOne(response));
  } catch (error: any) {
    // Помечаем ошибку конфликта, чтобы UI мог предложить повтор с force=true
    if (String(error?.message ?? "").includes("409")) error.isConflict = true;
    console.error("Reschedule meeting error:", error);
    return null;
  }
}

// Проверка конфликтов перед drag&drop-переносом в Schedule
export async function checkRescheduleConflicts(meeting: Meeting, newDateKey: string): Promise<ScheduleConflict[]> {
  const userIds = [...(meeting.participants ?? []), meeting.organizerId].map(String).filter(Boolean);
  return checkConflictsApi({
    date: newDateKey,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    userIds,
    excludeMeetingId: meeting.id,
  });
}

// ============ ПРОТОКОЛ ВСТРЕЧИ (MINUTES) ============
function mapMinute(raw: any): MeetingMinute {
  return {
    id: String(raw?.id ?? ""),
    meetingId: String(raw?.meeting_id ?? raw?.meetingId ?? ""),
    userId: String(raw?.user_id ?? raw?.userId ?? ""),
    authorName: raw?.author?.name,
    discussion: raw?.discussion ?? undefined,
    decisions: raw?.decisions ?? undefined,
    responsible: raw?.responsible ?? undefined,
    createdAt: typeof raw?.created_at === "string" ? raw.created_at.replace(" ", "T") : (raw?.createdAt ?? ""),
  };
}

export async function getMinutes(meetingId: string): Promise<MeetingMinute[]> {
  try {
    const response = await minutesAPI.list(meetingId);
    return unwrapList(response).map(mapMinute);
  } catch (error) {
    console.error("Get minutes error:", error);
    return [];
  }
}

export async function addMinute(
  meetingId: string,
  data: { discussion?: string; decisions?: string; responsible?: string }
): Promise<MeetingMinute | null> {
  try {
    const response = await minutesAPI.create(meetingId, data);
    return mapMinute(unwrapOne(response));
  } catch (error) {
    console.error("Add minute error:", error);
    return null;
  }
}

export async function updateMinuteApi(
  meetingId: string,
  minuteId: string,
  data: { discussion?: string; decisions?: string; responsible?: string }
): Promise<MeetingMinute | null> {
  try {
    const response = await minutesAPI.update(meetingId, minuteId, data);
    return mapMinute(unwrapOne(response));
  } catch (error) {
    console.error("Update minute error:", error);
    return null;
  }
}

export async function deleteMinuteApi(meetingId: string, minuteId: string): Promise<boolean> {
  try {
    await minutesAPI.remove(meetingId, minuteId);
    return true;
  } catch (error) {
    console.error("Delete minute error:", error);
    return false;
  }
}

// ============ ЗАДАЧИ ВСТРЕЧИ (ACTION ITEMS) ============
function mapTaskComment(raw: any): TaskComment {
  return {
    id: String(raw?.id ?? ""),
    meetingTaskId: String(raw?.meeting_task_id ?? raw?.meetingTaskId ?? ""),
    userId: String(raw?.user_id ?? ""),
    userName: raw?.user?.name,
    body: raw?.body ?? "",
    createdAt: typeof raw?.created_at === "string" ? raw.created_at.replace(" ", "T") : (raw?.createdAt ?? ""),
  };
}

function mapTask(raw: any): MeetingTask {
  const assigneeIds: string[] = Array.isArray(raw?.assignee_ids)
    ? raw.assignee_ids.map(String)
    : Array.isArray(raw?.assignees)
      ? raw.assignees.map((u: any) => String(u.id))
      : [];
  const assigneeNames: string[] = Array.isArray(raw?.assignees)
    ? raw.assignees.map((u: any) => u.name).filter(Boolean)
    : raw?.assignee?.name
      ? [raw.assignee.name]
      : [];
  return {
    id: String(raw?.id ?? ""),
    meetingId: String(raw?.meeting_id ?? raw?.meetingId ?? ""),
    title: raw?.title ?? "",
    assigneeId: raw?.assignee_id != null ? String(raw.assignee_id) : null,
    assigneeName: raw?.assignee?.name,
    assigneeIds,
    assigneeNames,
    deadline: typeof raw?.deadline === "string" ? raw.deadline.slice(0, 10) : (raw?.deadline ?? null),
    status: (raw?.status as MeetingTask["status"]) ?? "pending",
    comments: Array.isArray(raw?.comments) ? raw.comments.map(mapTaskComment) : [],
    createdAt: typeof raw?.created_at === "string" ? raw.created_at.replace(" ", "T") : (raw?.createdAt ?? ""),
  };
}

export async function getMeetingTasks(meetingId: string): Promise<MeetingTask[]> {
  try {
    const response = await meetingTasksAPI.list(meetingId);
    return unwrapList(response).map(mapTask);
  } catch (error) {
    console.error("Get meeting tasks error:", error);
    return [];
  }
}

export async function addMeetingTask(
  meetingId: string,
  data: { title: string; assigneeId?: string | null; assigneeIds?: string[]; deadline?: string | null }
): Promise<MeetingTask | null> {
  try {
    const ids = (data.assigneeIds ?? []).map(Number).filter((n) => !Number.isNaN(n));
    if (data.assigneeId) {
      const single = Number(data.assigneeId);
      if (!ids.includes(single)) ids.unshift(single);
    }
    const response = await meetingTasksAPI.create(meetingId, {
      title: data.title,
      assignee_ids: ids.length ? ids : undefined,
      assignee_id: ids.length ? ids[0] : null,
      deadline: data.deadline || null,
    });
    return mapTask(unwrapOne(response));
  } catch (error) {
    console.error("Add meeting task error:", error);
    return null;
  }
}

export async function updateMeetingTaskApi(
  meetingId: string,
  taskId: string,
  data: {
    title?: string;
    assigneeId?: string | null;
    assigneeIds?: string[];
    deadline?: string | null;
    status?: string;
  }
): Promise<MeetingTask | null> {
  try {
    const payload: any = {};
    if (data.title !== undefined) payload.title = data.title;
    if (data.assigneeIds !== undefined) {
      const ids = data.assigneeIds.map(Number).filter((n) => !Number.isNaN(n));
      payload.assignee_ids = ids;
      payload.assignee_id = ids[0] ?? null;
    } else if (data.assigneeId !== undefined) {
      payload.assignee_id = data.assigneeId ? Number(data.assigneeId) : null;
    }
    if (data.deadline !== undefined) payload.deadline = data.deadline || null;
    if (data.status !== undefined) payload.status = data.status;
    const response = await meetingTasksAPI.update(meetingId, taskId, payload);
    return mapTask(unwrapOne(response));
  } catch (error) {
    console.error("Update meeting task error:", error);
    return null;
  }
}

export async function deleteMeetingTaskApi(meetingId: string, taskId: string): Promise<boolean> {
  try {
    await meetingTasksAPI.remove(meetingId, taskId);
    return true;
  } catch (error) {
    console.error("Delete meeting task error:", error);
    return false;
  }
}

export async function addTaskCommentApi(meetingId: string, taskId: string, body: string): Promise<TaskComment | null> {
  try {
    const response = await meetingTasksAPI.addComment(meetingId, taskId, body);
    return mapTaskComment(unwrapOne(response));
  } catch (error) {
    console.error("Add task comment error:", error);
    return null;
  }
}

export async function deleteTaskCommentApi(meetingId: string, taskId: string, commentId: string): Promise<boolean> {
  try {
    await meetingTasksAPI.removeComment(meetingId, taskId, commentId);
    return true;
  } catch (error) {
    console.error("Delete task comment error:", error);
    return false;
  }
}

// ============ КОНФЛИКТЫ РАСПИСАНИЯ ============
export async function checkConflictsApi(params: {
  date: string;
  startTime: string;
  endTime: string;
  userIds: (string | number)[];
  excludeMeetingId?: string | number;
}): Promise<ScheduleConflict[]> {
  try {
    const response = await meetingsAPI.checkConflicts({
      date: params.date,
      start_time: params.startTime,
      end_time: params.endTime,
      users: params.userIds.join(","),
      ...(params.excludeMeetingId ? { exclude: String(params.excludeMeetingId) } : {}),
    });
    const data = response?.conflicts ?? unwrapList(response);
    return Array.isArray(data) ? (data as ScheduleConflict[]) : [];
  } catch (error) {
    console.error("Check conflicts error:", error);
    return [];
  }
}

// ============ СЕССИИ И ВЫХОД НА ВСЕХ УСТРОЙСТВАХ ============
export async function logoutAllDevices(): Promise<boolean> {
  try {
    await authAPI.logoutAll();
    return true;
  } catch (error) {
    console.error("Logout all devices error:", error);
    return false;
  } finally {
    localStorage.removeItem("vks_auth");
  }
}

export interface SessionInfo {
  id: number;
  ip: string | null;
  user_agent: string | null;
  created_at: string | null;
}

export async function getActiveSessions(): Promise<SessionInfo[]> {
  try {
    const response = await authAPI.sessions();
    return (response?.data ?? []) as SessionInfo[];
  } catch (error) {
    console.error("Get sessions error:", error);
    return [];
  }
}

// ============ КОРЗИНА (УДАЛЁННЫЕ ВСТРЕЧИ) ============
export async function getTrashedMeetings(): Promise<Meeting[]> {
  try {
    const response = await trashAPI.list();
    return unwrapList(response).map(mapMeeting);
  } catch (error) {
    console.error("Get trashed meetings error:", error);
    return [];
  }
}

export async function restoreMeetingFromTrash(id: string): Promise<Meeting | null> {
  try {
    const response = await trashAPI.restore(id);
    return mapMeeting(unwrapOne(response));
  } catch (error) {
    console.error("Restore meeting error:", error);
    return null;
  }
}

export async function deleteMeetingForever(id: string): Promise<boolean> {
  try {
    await trashAPI.destroyForever(id);
    return true;
  } catch (error) {
    console.error("Delete meeting forever error:", error);
    return false;
  }
}

// Серверная статистика для админ-панели: сводка по конференциям
// (/meetings-stats) + сводка по пользователям (/admin/stats, только admin).
export async function getAdminPanelStats(currentRole?: string): Promise<any> {
  const requests: Promise<any>[] = [getMeetingStats()];
  if (currentRole === "admin") {
    requests.push(
      usersAPI.getAdminStats().catch((error) => {
        console.error("Get admin stats error:", error);
        return null;
      })
    );
  }
  const results = await Promise.all(requests);
  return { ...(results[0] || {}), ...(results[1] || {}) };
}

export async function getMeetingStats(): Promise<any> {
  try {
    const response = await meetingsAPI.getStats();
    return response;
  } catch (error) {
    console.error("Get meeting stats error:", error);
    return null;
  }
}

// ============ NOTIFICATIONS ============
const mapNotification = (n: any): Notification => ({
  id: String(n.id),
  userId: String(n.user_id ?? n.userId),
  userName: n.user?.name,
  meetingId: n.meeting_id != null ? String(n.meeting_id) : "",
  message: n.message,
  type: n.type,
  timestamp: n.created_at ?? n.timestamp,
  read: Boolean(n.read),
});

export async function getNotifications(params?: {
  type?: string;
  unread?: boolean;
  all?: boolean;
}): Promise<Notification[]> {
  try {
    const response = await notificationsAPI.getAll(params);
    return (response.data ?? []).map(mapNotification);
  } catch (error) {
    console.error("Get notifications error:", error);
    return [];
  }
}

export async function markNotificationRead(id: string): Promise<boolean> {
  try {
    await notificationsAPI.markAsRead(id);
    return true;
  } catch (error) {
    console.error("Mark notification read error:", error);
    return false;
  }
}

export async function markAllNotificationsRead(params?: { all?: boolean }): Promise<boolean> {
  try {
    await notificationsAPI.markAllAsRead(params);
    return true;
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    return false;
  }
}

export async function clearAllNotifications(): Promise<boolean> {
  try {
    await notificationsAPI.clearAll();
    return true;
  } catch (error) {
    console.error("Clear all notifications error:", error);
    return false;
  }
}

export async function getUnreadNotificationsCount(): Promise<number> {
  try {
    const response = await notificationsAPI.getUnreadCount();
    return response.count;
  } catch (error) {
    console.error("Get unread count error:", error);
    return 0;
  }
}

// ============ SETTINGS ============
export async function getSettings(): Promise<Settings | null> {
  try {
    const response = await settingsAPI.get();
    return response;
  } catch (error) {
    console.error("Get settings error:", error);
    return null;
  }
}

export async function updateSettings(data: any): Promise<boolean> {
  try {
    await settingsAPI.update(data);
    return true;
  } catch (error) {
    console.error("Update settings error:", error);
    return false;
  }
}

// ============ PROFILE ============
export async function updateProfile(data: any): Promise<User | null> {
  try {
    const response = await profileAPI.update(data);
    // Обновляем пользователя в localStorage
    const auth = localStorage.getItem("vks_auth");
    if (auth) {
      const authData = JSON.parse(auth);
      authData.user = response;
      localStorage.setItem("vks_auth", JSON.stringify(authData));
    }
    return response;
  } catch (error) {
    console.error("Update profile error:", error);
    return null;
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
  try {
    await profileAPI.changePassword({
      current_password: currentPassword,
      password: newPassword,
      password_confirmation: newPassword,
    });
    return true;
  } catch (error) {
    console.error("Change password error:", error);
    return false;
  }
}

// ============ TAGS ============
function mapTag(raw: any): Tag {
  return {
    id: String(raw?.id ?? ""),
    userId: String(raw?.user_id ?? raw?.userId ?? ""),
    name: raw?.name ?? "",
    color: raw?.color ?? "#3b82f6",
    createdAt: typeof raw?.created_at === "string" ? raw.created_at.replace(" ", "T") : (raw?.createdAt ?? ""),
  };
}

function tagToApi(data: any): any {
  const out: any = {};
  if (data?.name !== undefined) out.name = data.name;
  if (data?.color !== undefined) out.color = data.color;
  if (data?.userId !== undefined) out.user_id = data.userId;
  return out;
}

export async function getTags(): Promise<Tag[]> {
  try {
    const response = await tagsAPI.getAll();
    const list = unwrapList(response);
    return list.map(mapTag);
  } catch (error) {
    console.error("Get tags error:", error);
    return [];
  }
}

export async function createTag(data: any): Promise<Tag | null> {
  try {
    const response = await tagsAPI.create(tagToApi(data));
    return mapTag(unwrapOne(response));
  } catch (error) {
    console.error("Create tag error:", error);
    return null;
  }
}

export async function updateTag(id: string, data: any): Promise<Tag | null> {
  try {
    const response = await tagsAPI.update(id, tagToApi(data));
    return mapTag(unwrapOne(response));
  } catch (error) {
    console.error("Update tag error:", error);
    return null;
  }
}

export async function deleteTag(id: string): Promise<boolean> {
  try {
    await tagsAPI.delete(id);
    return true;
  } catch (error) {
    console.error("Delete tag error:", error);
    return false;
  }
}

// ============ TEMPLATES ============
export function mapTemplate(raw: any): MeetingTemplate {
  const out: any = {};
  for (const k of Object.keys(raw ?? {})) out[toCamel(k)] = raw[k];
  if (Array.isArray(out.defaultParticipants)) out.defaultParticipants = out.defaultParticipants.map(String);
  if (out.createdAt && typeof out.createdAt === "string") out.createdAt = out.createdAt.replace(" ", "T");
  return out as MeetingTemplate;
}

export async function getTemplates(): Promise<MeetingTemplate[]> {
  try {
    const response = await templatesAPI.getAll();
    return unwrapList(response).map(mapTemplate);
  } catch (error) {
    console.error("Get templates error:", error);
    return [];
  }
}

export async function createTemplate(data: any): Promise<MeetingTemplate | null> {
  try {
    const response = await templatesAPI.create(userToApi(data));
    return mapTemplate(unwrapOne(response));
  } catch (error) {
    console.error("Create template error:", error);
    return null;
  }
}

export async function updateTemplate(id: string, data: any): Promise<MeetingTemplate | null> {
  try {
    const response = await templatesAPI.update(id, userToApi(data));
    return mapTemplate(unwrapOne(response));
  } catch (error) {
    console.error("Update template error:", error);
    return null;
  }
}

export async function deleteTemplate(id: string): Promise<boolean> {
  try {
    await templatesAPI.delete(id);
    return true;
  } catch (error) {
    console.error("Delete template error:", error);
    return false;
  }
}

// ============ ATTACHMENTS ============
export async function getAttachments(meetingId: string): Promise<Attachment[]> {
  try {
    const response = await attachmentsAPI.getByMeeting(meetingId);
    return response.data || response;
  } catch (error) {
    console.error("Get attachments error:", error);
    return [];
  }
}

export async function uploadAttachment(meetingId: string, file: File): Promise<Attachment | null> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await attachmentsAPI.upload(meetingId, formData);
    return response;
  } catch (error) {
    console.error("Upload attachment error:", error);
    return null;
  }
}

export async function deleteAttachment(id: string): Promise<boolean> {
  try {
    await attachmentsAPI.delete(id);
    return true;
  } catch (error) {
    console.error("Delete attachment error:", error);
    return false;
  }
}

// ============ MEETING HISTORY ============
export async function getMeetingHistory(meetingId: string): Promise<MeetingHistory[]> {
  try {
    const response = await meetingHistoryAPI.getByMeeting(meetingId);
    return response.data || response;
  } catch (error) {
    console.error("Get meeting history error:", error);
    return [];
  }
}

// ============ UTILS ============
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ==================== RSVP ====================
function mapRsvp(raw: any): MeetingRsvp {
  return {
    userId: String(raw?.user_id ?? raw?.userId ?? ""),
    name: raw?.name ?? raw?.user?.name,
    response: (raw?.response as RsvpResponse) ?? "maybe",
    respondedAt: typeof raw?.responded_at === "string" ? raw.responded_at : (raw?.respondedAt ?? undefined),
  };
}

export async function getMeetingRsvp(meetingId: string): Promise<RsvpData | null> {
  try {
    const data = await rsvpAPI.get(meetingId);
    return {
      rsvps: (data?.rsvps ?? []).map(mapRsvp),
      summary: {
        yes: data?.summary?.yes ?? 0,
        no: data?.summary?.no ?? 0,
        maybe: data?.summary?.maybe ?? 0,
        pending: data?.summary?.pending ?? 0,
        totalParticipants: data?.summary?.total_participants ?? data?.summary?.totalParticipants ?? 0,
      },
      myResponse: (data?.my_response ?? data?.myResponse ?? null) as RsvpResponse | null,
    };
  } catch (error) {
    console.error("Get RSVP error:", error);
    return null;
  }
}

export async function respondRsvp(meetingId: string, response: RsvpResponse): Promise<boolean> {
  try {
    await rsvpAPI.respond(meetingId, response);
    return true;
  } catch (error) {
    console.error("Respond RSVP error:", error);
    return false;
  }
}
