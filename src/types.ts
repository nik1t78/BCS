export interface User {
  id: string;
  name: string;
  login: string;
  password: string; // In real Laravel this would be hashed on server
  role: 'admin' | 'user' | 'moderator';
  avatar?: string;
  phone?: string;
  department?: string;
  position?: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
  mustChangePassword?: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  organizerId: string;
  /** Заполняется на фронте из списка пользователей (для отображения в админке/корзине) */
  organizerName?: string;
  participants: string[]; // user IDs
  participantEmails?: string[]; // for guests
  link?: string;
  room?: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  reminderMinutes: number;
  recurring: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
  /** Упрощённый RRULE для recurring === 'custom', напр. FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1 */
  rrule?: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  isPrivate: boolean;
  tags?: string[];
  isFavorite?: boolean;
  repeatUntil?: string; // дата окончания повтора YYYY-MM-DD (для recurring != 'none')
  /** Служебное: id родительской встречи у occurrence-копии из utils/recurrence */
  _occurrenceOf?: string;
}

export interface MeetingTemplate {
  id: string;
  userId: string;
  name: string;
  description: string;
  durationMinutes: number;
  room: string;
  link: string;
  priority: 'low' | 'medium' | 'high';
  reminderMinutes: number;
  recurring: 'none' | 'daily' | 'weekly' | 'monthly';
  isPrivate: boolean;
  defaultParticipants: string[];
  createdAt: string;
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  meetingId: string;
  userId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export interface MeetingHistory {
  id: string;
  meetingId: string;
  userId: string;
  action: 'created' | 'updated' | 'status_changed' | 'deleted';
  oldValues: any;
  newValues: any;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  userName?: string; // заполняется только в режиме «все уведомления» у админа
  meetingId: string;
  message: string;
  type: 'reminder' | 'starting' | 'info' | 'warning' | 'user-added';
  timestamp: string;
  read: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

// Протокол встречи (запись обсуждения/решения)
export interface MeetingMinute {
  id: string;
  meetingId: string;
  userId: string; // автор записи
  authorName?: string;
  discussion?: string;
  decisions?: string;
  responsible?: string;
  createdAt: string;
}

export type MeetingTaskStatus = 'pending' | 'in_progress' | 'done';

// Задача / action item внутри встречи
export interface MeetingTask {
  id: string;
  meetingId: string;
  title: string;
  assigneeId?: string | null;
  assigneeName?: string;
  /** Множественные ответственные (id пользователей) */
  assigneeIds?: string[];
  /** ФИО всех ответственных (по порядку assigneeIds) */
  assigneeNames?: string[];
  deadline?: string | null; // YYYY-MM-DD
  status: MeetingTaskStatus;
  comments?: TaskComment[];
  createdAt: string;
}

// Комментарий к задаче (action item)
export interface TaskComment {
  id: string;
  meetingTaskId: string;
  userId: string;
  userName?: string;
  body: string;
  createdAt: string;
}

// Конфликт расписания (пересечение по времени у одних и тех же участников)
export interface ScheduleConflict {
  meeting_id: string | number;
  title: string;
  start_time: string;
  end_time: string;
  overlapping_user_ids: (string | number)[];
}

export interface Settings {
  soundEnabled: boolean;
  browserNotifications: boolean;
  defaultReminderMinutes: number;
  workHoursStart: string;
  workHoursEnd: string;
}

// RSVP — подтверждение присутствия
export type RsvpResponse = 'yes' | 'no' | 'maybe';

export interface MeetingRsvp {
  userId: string;
  name?: string;
  response: RsvpResponse;
  respondedAt?: string;
}

export interface RsvpSummary {
  yes: number;
  no: number;
  maybe: number;
  pending: number;
  totalParticipants: number;
}

export interface RsvpData {
  rsvps: MeetingRsvp[];
  summary: RsvpSummary;
  myResponse: RsvpResponse | null;
}

/** Переговорная комната / зал с оборудованием */
export interface Room {
  id: string;
  name: string;
  capacity: number;
  location?: string;
  equipment?: string[];
  description?: string;
  isActive: boolean;
}

/** Занятость комнаты на день */
export interface RoomAvailability {
  room: Room;
  date: string;
  busy: { meetingId: string; title: string; start: string; end: string }[];
  free: { start: string; end: string }[];
  available: boolean;
}

/** Статус интеграции с мессенджером MAX */
export interface MaxStatus {
  enabled: boolean;
  botLink: string;
  linkedChatId: string | null;
}
