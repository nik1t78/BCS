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

// AUTH
export function getCurrentUser(): User | null {
  const data = localStorage.getItem(AUTH_KEY);
  if (!data) return null;
  const auth = JSON.parse(data);
  return auth.user || null;
}

export function getToken(): string | null {
  const data = localStorage.getItem(AUTH_KEY);
  if (!data) return null;
  return JSON.parse(data).token;
}

export function login(login: string, password: string): { success: boolean; user?: User; error?: string } {
  const users = getUsers();
  const user = users.find(u => u.login.toLowerCase() === login.toLowerCase() && u.password === password);
  if (!user) return { success: false, error: 'Неверный логин или пароль' };
  if (!user.isActive) return { success: false, error: 'Аккаунт заблокирован' };

  const token = 'tok_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  const updatedUser = { ...user, lastLogin: new Date().toISOString() };
  
  const usersUpdated = users.map(u => u.id === user.id ? updatedUser : u);
  localStorage.setItem(USERS_KEY, JSON.stringify(usersUpdated));
  localStorage.setItem(AUTH_KEY, JSON.stringify({ token, user: updatedUser }));
  
  return { success: true, user: updatedUser };
}

export function register(name: string, login: string, password: string, phone?: string, department?: string): { success: boolean; user?: User; error?: string } {
  const users = getUsers();
  if (users.find(u => u.login.toLowerCase() === login.toLowerCase())) {
    return { success: false, error: 'Пользователь с таким логином уже существует' };
  }

  const newUser: User = {
    id: generateId(),
    name,
    login,
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

// USERS
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

// MEETINGS
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

// NOTIFICATIONS
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

// SETTINGS
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
  const existing = getUsers();
  if (existing.length > 0) return;

  const adminId = generateId();
  const modId = generateId();
  const user1Id = generateId();
  const user2Id = generateId();

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const demoUsers: User[] = [
    {
      id: adminId,
      name: 'Администратор Системы',
      login: 'admin',
      password: 'admin123',
      role: 'admin',
      phone: '+7 (999) 000-00-01',
      department: 'IT',
      position: 'Системный администратор',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: modId,
      name: 'Сидоров Константин Львович',
      login: 'sidorov',
      password: 'mod123',
      role: 'moderator',
      phone: '+7 (999) 333-44-55',
      department: 'HR',
      position: 'HR Manager',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: user1Id,
      name: 'Иванов Алексей Сергеевич',
      login: 'ivanov',
      password: 'user123',
      role: 'user',
      phone: '+7 (999) 111-22-33',
      department: 'Разработка',
      position: 'Frontend Developer',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: user2Id,
      name: 'Петрова Мария Владимировна',
      login: 'petrova',
      password: 'user123',
      role: 'user',
      phone: '+7 (999) 222-33-44',
      department: 'Менеджмент',
      position: 'Project Manager',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
  ];

  localStorage.setItem('vks_users', JSON.stringify(demoUsers));

  const demoMeetings: Meeting[] = [
    {
      id: generateId(),
      title: 'Еженедельный стендап',
      description: 'Обсуждение прогресса команды',
      date: today,
      startTime: '10:00',
      endTime: '10:30',
      organizerId: user2Id,
      participants: [user1Id, user2Id, modId],
      participantEmails: [],
      link: 'https://meet.example.com/standup',
      room: 'Переговорная №1',
      status: 'scheduled',
      reminderMinutes: 10,
      recurring: 'weekly',
      priority: 'high',
      createdAt: new Date().toISOString(),
      isPrivate: false,
    },
    {
      id: generateId(),
      title: 'Обзор проекта Q4',
      description: 'Презентация результатов квартала',
      date: today,
      startTime: '14:00',
      endTime: '15:30',
      organizerId: adminId,
      participants: [user1Id, user2Id],
      participantEmails: [],
      link: 'https://meet.example.com/q4',
      room: 'Конференц-зал А',
      status: 'scheduled',
      reminderMinutes: 30,
      recurring: 'none',
      priority: 'high',
      createdAt: new Date().toISOString(),
      isPrivate: false,
    },
    {
      id: generateId(),
      title: 'Собеседование',
      description: 'Senior Frontend Developer',
      date: tomorrowStr,
      startTime: '11:00',
      endTime: '12:00',
      organizerId: modId,
      participants: [modId],
      participantEmails: [],
      link: 'https://meet.example.com/interview',
      room: 'Онлайн',
      status: 'scheduled',
      reminderMinutes: 15,
      recurring: 'none',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      isPrivate: true,
    },
    {
      id: generateId(),
      title: 'Демо нового функционала',
      description: 'Показ новой версии продукта заказчику',
      date: tomorrowStr,
      startTime: '16:00',
      endTime: '17:00',
      organizerId: user2Id,
      participants: [user1Id, user2Id, adminId],
      participantEmails: [],
      link: 'https://meet.example.com/demo',
      room: 'Переговорная №3',
      status: 'scheduled',
      reminderMinutes: 15,
      recurring: 'none',
      priority: 'high',
      createdAt: new Date().toISOString(),
      isPrivate: false,
    },
  ];

  localStorage.setItem('vks_meetings', JSON.stringify(demoMeetings));
}

// THEME
export function getTheme(): 'light' | 'dark' {
  return (localStorage.getItem('vks_theme') as 'light' | 'dark') || 'light';
}

export function setTheme(theme: 'light' | 'dark'): void {
  localStorage.setItem('vks_theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

// TEMPLATES
export function getTemplates(): any[] {
  const data = localStorage.getItem('vks_templates');
  return data ? JSON.parse(data) : [];
}

export function addTemplate(template: any): void {
  const templates = getTemplates();
  templates.push(template);
  localStorage.setItem('vks_templates', JSON.stringify(templates));
}

export function updateTemplate(updated: any): void {
  const templates = getTemplates();
  const index = templates.findIndex((t: any) => t.id === updated.id);
  if (index !== -1) {
    templates[index] = updated;
    localStorage.setItem('vks_templates', JSON.stringify(templates));
  }
}

export function deleteTemplate(id: string): void {
  const templates = getTemplates().filter((t: any) => t.id !== id);
  localStorage.setItem('vks_templates', JSON.stringify(templates));
}

// TAGS
export function getTags(): any[] {
  const data = localStorage.getItem('vks_tags');
  return data ? JSON.parse(data) : [];
}

export function addTag(tag: any): void {
  const tags = getTags();
  tags.push(tag);
  localStorage.setItem('vks_tags', JSON.stringify(tags));
}

export function updateTag(updated: any): void {
  const tags = getTags();
  const index = tags.findIndex((t: any) => t.id === updated.id);
  if (index !== -1) {
    tags[index] = updated;
    localStorage.setItem('vks_tags', JSON.stringify(tags));
  }
}

export function deleteTag(id: string): void {
  const tags = getTags().filter((t: any) => t.id !== id);
  localStorage.setItem('vks_tags', JSON.stringify(tags));
}

// ATTACHMENTS
export function getAttachments(meetingId?: string): any[] {
  const data = localStorage.getItem('vks_attachments');
  const attachments = data ? JSON.parse(data) : [];
  return meetingId ? attachments.filter((a: any) => a.meetingId === meetingId) : attachments;
}

export function addAttachment(attachment: any): void {
  const attachments = getAttachments();
  attachments.push(attachment);
  localStorage.setItem('vks_attachments', JSON.stringify(attachments));
}

export function deleteAttachment(id: string): void {
  const attachments = getAttachments().filter((a: any) => a.id !== id);
  localStorage.setItem('vks_attachments', JSON.stringify(attachments));
}

// HISTORY
export function getHistory(meetingId?: string): any[] {
  const data = localStorage.getItem('vks_history');
  const history = data ? JSON.parse(data) : [];
  return meetingId ? history.filter((h: any) => h.meetingId === meetingId) : history;
}
