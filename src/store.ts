import { User, Meeting, Notification, Settings } from './types';

const USERS_KEY = 'vks_users';
const MEETINGS_KEY = 'vks_meetings';
const NOTIFICATIONS_KEY = 'vks_notifications';
const SETTINGS_KEY = 'vks_settings';
const AUTH_KEY = 'vks_auth';

export const defaultSettings: Settings = {
  soundEnabled: true,
  browserNotifications: true,
  defaultReminderMinutes: 15,
  workHoursStart: '09:00',
  workHoursEnd: '18:00',
};

// ============ AUTH ============
export function getCurrentUser(): User | null {
  const data = localStorage.getItem(AUTH_KEY);
  if (!data) return null;
  const auth = JSON.parse(data);
  if (!auth.token || !auth.user) return null;
  return auth.user;
}

export function getToken(): string | null {
  const data = localStorage.getItem(AUTH_KEY);
  if (!data) return null;
  return JSON.parse(data).token;
}

export function login(email: string, password: string): { success: boolean; user?: User; error?: string } {
  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!user) return { success: false, error: 'Неверный email или пароль' };
  if (!user.isActive) return { success: false, error: 'Аккаунт заблокирован. Обратитесь к администратору.' };

  const token = 'tok_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  const updatedUser = { ...user, lastLogin: new Date().toISOString() };
  
  // Update user in storage
  const usersUpdated = users.map(u => u.id === user.id ? updatedUser : u);
  localStorage.setItem(USERS_KEY, JSON.stringify(usersUpdated));
  
  localStorage.setItem(AUTH_KEY, JSON.stringify({ token, user: updatedUser }));
  return { success: true, user: updatedUser };
}

export function register(name: string, email: string, password: string, phone?: string, department?: string): { success: boolean; user?: User; error?: string } {
  const users = getUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, error: 'Пользователь с таким email уже существует' };
  }

  const newUser: User = {
    id: generateId(),
    name,
    email,
    password,
    role: 'user',
    phone: phone || '',
    department: department || '',
    position: '',
    createdAt: new Date().toISOString(),
    isActive: true,
  };

  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  const token = 'tok_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  localStorage.setItem(AUTH_KEY, JSON.stringify({ token, user: newUser }));

  return { success: true, user: newUser };
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
}

export function updateProfile(user: User): void {
  const users = getUsers();
  const updated = users.map(u => u.id === user.id ? user : u);
  localStorage.setItem(USERS_KEY, JSON.stringify(updated));
  localStorage.setItem(AUTH_KEY, JSON.stringify({ token: getToken(), user }));
}

// ============ USERS (Admin) ============
export function getUsers(): User[] {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
}

export function updateUser(user: User): void {
  const users = getUsers();
  const updated = users.map(u => u.id === user.id ? user : u);
  localStorage.setItem(USERS_KEY, JSON.stringify(updated));
}

export function deleteUser(id: string): void {
  const users = getUsers().filter(u => u.id !== id);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function changeUserRole(id: string, role: User['role']): void {
  const users = getUsers();
  const updated = users.map(u => u.id === id ? { ...u, role } : u);
  localStorage.setItem(USERS_KEY, JSON.stringify(updated));
}

export function toggleUserActive(id: string): void {
  const users = getUsers();
  const updated = users.map(u => u.id === id ? { ...u, isActive: !u.isActive } : u);
  localStorage.setItem(USERS_KEY, JSON.stringify(updated));
}

// ============ MEETINGS ============
export function getMeetings(): Meeting[] {
  const data = localStorage.getItem(MEETINGS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveMeetings(meetings: Meeting[]): void {
  localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
}

export function addMeeting(meeting: Meeting): void {
  const meetings = getMeetings();
  meetings.push(meeting);
  saveMeetings(meetings);
}

export function updateMeeting(updated: Meeting): void {
  const meetings = getMeetings();
  const index = meetings.findIndex(m => m.id === updated.id);
  if (index !== -1) {
    meetings[index] = updated;
    saveMeetings(meetings);
  }
}

export function deleteMeeting(id: string): void {
  const meetings = getMeetings().filter(m => m.id !== id);
  saveMeetings(meetings);
}

// ============ NOTIFICATIONS ============
export function getNotifications(): Notification[] {
  const data = localStorage.getItem(NOTIFICATIONS_KEY);
  return data ? JSON.parse(data) : [];
}

export function getUserNotifications(userId: string): Notification[] {
  return getNotifications().filter(n => n.userId === userId);
}

export function saveNotifications(notifications: Notification[]): void {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

export function addNotification(notification: Notification): void {
  const notifications = getNotifications();
  notifications.unshift(notification);
  if (notifications.length > 200) notifications.length = 200;
  saveNotifications(notifications);
}

export function markNotificationRead(id: string): void {
  const notifications = getNotifications().map(n => n.id === id ? { ...n, read: true } : n);
  saveNotifications(notifications);
}

export function markAllNotificationsRead(userId: string): void {
  const notifications = getNotifications().map(n => n.userId === userId ? { ...n, read: true } : n);
  saveNotifications(notifications);
}

// ============ SETTINGS ============
export function getSettings(): Settings {
  const data = localStorage.getItem(SETTINGS_KEY);
  return data ? JSON.parse(data) : defaultSettings;
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ============ DEMO DATA ============
export function initializeDemoData(): void {
  const users = getUsers();
  if (users.length > 0) return;

  // Create admin user
  const adminId = generateId();
  const userId1 = generateId();
  const userId2 = generateId();
  const userId3 = generateId();

  const demoUsers: User[] = [
    {
      id: adminId,
      name: 'Администратор Системы',
      email: 'admin@vks.local',
      password: 'admin123',
      role: 'admin',
      phone: '+7 (999) 000-00-01',
      department: 'IT',
      position: 'Системный администратор',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: userId1,
      name: 'Иванов Алексей Сергеевич',
      email: 'ivanov@vks.local',
      password: 'user123',
      role: 'user',
      phone: '+7 (999) 111-22-33',
      department: 'Разработка',
      position: 'Frontend Developer',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: userId2,
      name: 'Петрова Мария Владимировна',
      email: 'petrova@vks.local',
      password: 'user123',
      role: 'user',
      phone: '+7 (999) 222-33-44',
      department: 'Менеджмент',
      position: 'Project Manager',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: userId3,
      name: 'Сидоров Константин Львович',
      email: 'sidorov@vks.local',
      password: 'mod123',
      role: 'moderator',
      phone: '+7 (999) 333-44-55',
      department: 'HR',
      position: 'HR Manager',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
  ];

  localStorage.setItem(USERS_KEY, JSON.stringify(demoUsers));

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const dayAfter = new Date(today); dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterStr = dayAfter.toISOString().split('T')[0];
  const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 5);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const demoMeetings: Meeting[] = [
    {
      id: generateId(), title: 'Еженедельный стендап', description: 'Обсуждение прогресса',
      date: todayStr, startTime: '10:00', endTime: '10:30',
      organizerId: userId2, participants: [userId1, userId2, userId3],
      participantEmails: [], link: 'https://meet.example.com/standup',
      room: 'Переговорная №1', status: 'scheduled', reminderMinutes: 10,
      recurring: 'weekly', priority: 'high', createdAt: new Date().toISOString(), isPrivate: false,
    },
    {
      id: generateId(), title: 'Обзор проекта Q4', description: 'Презентация результатов',
      date: todayStr, startTime: '14:00', endTime: '15:30',
      organizerId: adminId, participants: [userId1, userId2],
      participantEmails: ['client@example.com'], link: 'https://meet.example.com/q4',
      room: 'Конференц-зал А', status: 'scheduled', reminderMinutes: 30,
      recurring: 'none', priority: 'high', createdAt: new Date().toISOString(), isPrivate: false,
    },
    {
      id: generateId(), title: 'Собеседование', description: 'Senior Frontend Developer',
      date: tomorrowStr, startTime: '11:00', endTime: '12:00',
      organizerId: userId3, participants: [userId3],
      participantEmails: ['candidate@example.com'], link: 'https://meet.example.com/interview',
      room: 'Онлайн', status: 'scheduled', reminderMinutes: 15,
      recurring: 'none', priority: 'medium', createdAt: new Date().toISOString(), isPrivate: true,
    },
    {
      id: generateId(), title: 'Демо продукта', description: 'Показ заказчику',
      date: tomorrowStr, startTime: '16:00', endTime: '17:00',
      organizerId: userId2, participants: [userId1, userId2, adminId],
      participantEmails: [], link: 'https://meet.example.com/demo',
      room: 'Переговорная №3', status: 'scheduled', reminderMinutes: 15,
      recurring: 'none', priority: 'high', createdAt: new Date().toISOString(), isPrivate: false,
    },
    {
      id: generateId(), title: 'Ретроспектива', description: 'Анализ спринта',
      date: dayAfterStr, startTime: '15:00', endTime: '16:00',
      organizerId: userId2, participants: [userId1, userId2],
      participantEmails: [], link: 'https://meet.example.com/retro',
      room: 'Переговорная №2', status: 'scheduled', reminderMinutes: 10,
      recurring: 'weekly', priority: 'medium', createdAt: new Date().toISOString(), isPrivate: false,
    },
    {
      id: generateId(), title: 'Обучение: Новый стек', description: 'Тренинг',
      date: nextWeekStr, startTime: '10:00', endTime: '12:00',
      organizerId: adminId, participants: [userId1, userId2, userId3],
      participantEmails: [], link: 'https://meet.example.com/training',
      room: 'Конференц-зал Б', status: 'scheduled', reminderMinutes: 60,
      recurring: 'none', priority: 'low', createdAt: new Date().toISOString(), isPrivate: false,
    },
    {
      id: generateId(), title: 'Планёрка с клиентом', description: 'Обсуждение требований',
      date: yesterdayStr, startTime: '09:00', endTime: '10:00',
      organizerId: userId2, participants: [userId1, userId2],
      participantEmails: ['client@example.com'], link: 'https://meet.example.com/client',
      room: 'Онлайн', status: 'completed', reminderMinutes: 15,
      recurring: 'none', priority: 'medium', createdAt: new Date().toISOString(), isPrivate: false,
    },
    {
      id: generateId(), title: 'Архитектурный комитет', description: 'Новые решения',
      date: yesterdayStr, startTime: '14:00', endTime: '15:00',
      organizerId: adminId, participants: [adminId, userId1],
      participantEmails: [], link: 'https://meet.example.com/arch',
      room: 'Переговорная №1', status: 'completed', reminderMinutes: 15,
      recurring: 'monthly', priority: 'high', createdAt: new Date().toISOString(), isPrivate: false,
    },
  ];

  saveMeetings(demoMeetings);

  const demoNotifications: Notification[] = [
    {
      id: generateId(), userId: userId1, meetingId: demoMeetings[0].id,
      message: '⏰ Напоминание: через 10 мин. начнётся "Еженедельный стендап"',
      type: 'reminder', timestamp: new Date(Date.now() - 3600000).toISOString(), read: false,
    },
    {
      id: generateId(), userId: userId1, meetingId: demoMeetings[0].id,
      message: '🔴 Конференция "Еженедельный стендап" начинается!',
      type: 'starting', timestamp: new Date(Date.now() - 7200000).toISOString(), read: true,
    },
    {
      id: generateId(), userId: userId2, meetingId: demoMeetings[6].id,
      message: '✅ Конференция "Планёрка с клиентом" завершена',
      type: 'info', timestamp: new Date(Date.now() - 86400000).toISOString(), read: true,
    },
    {
      id: generateId(), userId: userId1, meetingId: demoMeetings[0].id,
      message: '👤 Вас добавили в конференцию "Еженедельный стендап"',
      type: 'user-added', timestamp: new Date(Date.now() - 172800000).toISOString(), read: true,
    },
  ];

  saveNotifications(demoNotifications);
}
