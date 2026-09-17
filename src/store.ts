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

  createAdminUser();
  createModeratorUser();
  createTestUsers();
  createTestMeetings();
}

export function createAdminUser(): void {
  const adminId = generateId();

  // Создаём администратора со статическим паролем
  const adminUser: User = {
    id: adminId,
    name: 'Администратор Системы',
    login: 'admin',
    password: 'admin123', // Статический пароль - смените после первого входа!
    role: 'admin',
    phone: '',
    department: 'IT',
    position: 'Системный администратор',
    createdAt: new Date().toISOString(),
    isActive: true,
  };

  const users = getUsers();
  users.push(adminUser);
  localStorage.setItem('vks_users', JSON.stringify(users));
  
  // Пустой список конференций при первом запуске
  localStorage.setItem('vks_meetings', JSON.stringify([]));
}

export function createModeratorUser(): void {
  const moderatorId = generateId();

  // Создаём модератора со статическим паролем
  const moderatorUser: User = {
    id: moderatorId,
    name: 'Модератор Системы',
    login: 'moderator',
    password: 'mod123', // Статический пароль - смените после первого входа!
    role: 'moderator',
    phone: '',
    department: 'IT',
    position: 'Модератор',
    createdAt: new Date().toISOString(),
    isActive: true,
  };

  const users = getUsers();
  users.push(moderatorUser);
  localStorage.setItem('vks_users', JSON.stringify(users));
}

export function createTestUsers(): void {
  // Тестовые сотрудники для демонстрации
  const testUsers: User[] = [
    {
      id: generateId(),
      name: 'Иванов Иван Иванович',
      login: 'ivanov',
      password: 'user123',
      role: 'user',
      phone: '+7 (999) 123-45-67',
      department: 'Разработка',
      position: 'Frontend Developer',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: generateId(),
      name: 'Петрова Мария Сергеевна',
      login: 'petrova',
      password: 'user123',
      role: 'user',
      phone: '+7 (999) 234-56-78',
      department: 'Разработка',
      position: 'Backend Developer',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: generateId(),
      name: 'Сидоров Алексей Петрович',
      login: 'sidorov',
      password: 'user123',
      role: 'user',
      phone: '+7 (999) 345-67-89',
      department: 'Дизайн',
      position: 'UI/UX Designer',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: generateId(),
      name: 'Козлова Анна Владимировна',
      login: 'kozlova',
      password: 'user123',
      role: 'user',
      phone: '+7 (999) 456-78-90',
      department: 'Менеджмент',
      position: 'Project Manager',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: generateId(),
      name: 'Николаев Дмитрий Сергеевич',
      login: 'nikolaev',
      password: 'user123',
      role: 'user',
      phone: '+7 (999) 567-89-01',
      department: 'Маркетинг',
      position: 'Marketing Specialist',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: generateId(),
      name: 'Федорова Елена Александровна',
      login: 'fedorova',
      password: 'user123',
      role: 'user',
      phone: '+7 (999) 678-90-12',
      department: 'HR',
      position: 'HR Manager',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: generateId(),
      name: 'Морозов Сергей Иванович',
      login: 'morozov',
      password: 'user123',
      role: 'user',
      phone: '+7 (999) 789-01-23',
      department: 'Финансы',
      position: 'Financial Analyst',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: generateId(),
      name: 'Волкова Ольга Дмитриевна',
      login: 'volkova',
      password: 'user123',
      role: 'user',
      phone: '+7 (999) 890-12-34',
      department: 'Продажи',
      position: 'Sales Manager',
      createdAt: new Date().toISOString(),
      isActive: true,
    },
  ];

  const users = getUsers();
  users.push(...testUsers);
  localStorage.setItem('vks_users', JSON.stringify(users));
}

export function createTestMeetings(): void {
  const users = getUsers();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Получаем ID пользователей для демонстрации
  const adminUser = users.find(u => u.login === 'admin');
  const moderatorUser = users.find(u => u.login === 'moderator');
  const ivanov = users.find(u => u.login === 'ivanov');
  const petrova = users.find(u => u.login === 'petrova');
  const sidorov = users.find(u => u.login === 'sidorov');
  const kozlova = users.find(u => u.login === 'kozlova');
  const nikolaev = users.find(u => u.login === 'nikolaev');
  const fedorova = users.find(u => u.login === 'fedorova');

  const testMeetings: Meeting[] = [
    {
      id: generateId(),
      title: 'Еженедельный стендап команды разработки',
      description: 'Обсуждение прогресса за неделю, планирование задач на следующую неделю',
      date: formatDate(today),
      startTime: '10:00',
      endTime: '10:30',
      organizerId: kozlova?.id || '',
      participants: [ivanov?.id || '', petrova?.id || '', sidorov?.id || ''],
      participantEmails: [],
      link: 'https://meet.google.com/abc-defg-hij',
      room: 'Переговорная №1',
      status: 'scheduled',
      reminderMinutes: 15,
      recurring: 'weekly',
      priority: 'high',
      createdAt: new Date().toISOString(),
      isPrivate: false,
    },
    {
      id: generateId(),
      title: 'Обзор проекта Q4',
      description: 'Презентация результатов квартала для руководства',
      date: formatDate(today),
      startTime: '14:00',
      endTime: '15:30',
      organizerId: adminUser?.id || '',
      participants: [kozlova?.id || '', nikolaev?.id || '', fedorova?.id || ''],
      participantEmails: [],
      link: 'https://zoom.us/j/123456789',
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
      title: 'Дизайн-ревью нового интерфейса',
      description: 'Обсуждение макетов и пользовательского опыта',
      date: formatDate(tomorrow),
      startTime: '11:00',
      endTime: '12:00',
      organizerId: sidorov?.id || '',
      participants: [ivanov?.id || '', petrova?.id || '', kozlova?.id || ''],
      participantEmails: [],
      link: 'https://teams.microsoft.com/meet/123',
      room: 'Онлайн',
      status: 'scheduled',
      reminderMinutes: 15,
      recurring: 'none',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      isPrivate: false,
    },
    {
      id: generateId(),
      title: 'Планирование маркетинговой кампании',
      description: 'Стратегия продвижения нового продукта',
      date: formatDate(tomorrow),
      startTime: '15:00',
      endTime: '16:30',
      organizerId: nikolaev?.id || '',
      participants: [kozlova?.id || '', fedorova?.id || ''],
      participantEmails: [],
      link: 'https://meet.google.com/xyz-uvwx-rst',
      room: 'Переговорная №2',
      status: 'scheduled',
      reminderMinutes: 15,
      recurring: 'none',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      isPrivate: false,
    },
    {
      id: generateId(),
      title: 'Собеседование с кандидатом',
      description: 'Техническое собеседование на позицию Senior Developer',
      date: formatDate(nextWeek),
      startTime: '10:00',
      endTime: '11:00',
      organizerId: fedorova?.id || '',
      participants: [ivanov?.id || '', petrova?.id || ''],
      participantEmails: ['candidate@example.com'],
      link: 'https://zoom.us/j/987654321',
      room: 'Онлайн',
      status: 'scheduled',
      reminderMinutes: 30,
      recurring: 'none',
      priority: 'high',
      createdAt: new Date().toISOString(),
      isPrivate: true,
    },
    {
      id: generateId(),
      title: 'Финансовый отчёт за месяц',
      description: 'Анализ финансовых показателей и бюджетирование',
      date: formatDate(nextWeek),
      startTime: '14:00',
      endTime: '15:00',
      organizerId: moderatorUser?.id || '',
      participants: [kozlova?.id || ''],
      participantEmails: [],
      link: 'https://teams.microsoft.com/meet/456',
      room: 'Кабинет директора',
      status: 'scheduled',
      reminderMinutes: 15,
      recurring: 'monthly',
      priority: 'high',
      createdAt: new Date().toISOString(),
      isPrivate: false,
    },
    {
      id: generateId(),
      title: 'Тренинг по новым технологиям',
      description: 'Обучение команды работе с новыми инструментами',
      date: formatDate(nextWeek),
      startTime: '16:00',
      endTime: '17:30',
      organizerId: adminUser?.id || '',
      participants: [ivanov?.id || '', petrova?.id || '', sidorov?.id || '', kozlova?.id || ''],
      participantEmails: [],
      link: 'https://meet.google.com/training-123',
      room: 'Учебный класс',
      status: 'scheduled',
      reminderMinutes: 60,
      recurring: 'none',
      priority: 'low',
      createdAt: new Date().toISOString(),
      isPrivate: false,
    },
  ];

  localStorage.setItem('vks_meetings', JSON.stringify(testMeetings));
}

export function forceReset(): void {
  localStorage.clear();
  createAdminUser();
  createModeratorUser();
  createTestUsers();
  createTestMeetings();
}

export function getAdminTempPassword(): string | null {
  return localStorage.getItem('vks_admin_temp_password');
}

export function clearAdminTempPassword(): void {
  localStorage.removeItem('vks_admin_temp_password');
}

export function mustChangePassword(userId: string): boolean {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  return user?.mustChangePassword || false;
}

export function setPasswordChanged(userId: string): void {
  const users = getUsers();
  const updated = users.map(u => u.id === userId ? { ...u, mustChangePassword: false } : u);
  localStorage.setItem('vks_users', JSON.stringify(updated));
  
  // Обновляем текущего пользователя если это он
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.id === userId) {
    const updatedUser = { ...currentUser, mustChangePassword: false };
    localStorage.setItem('vks_auth', JSON.stringify({ token: getToken(), user: updatedUser }));
  }
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
