// Простой store с localStorage для локальной работы
import { User, Meeting, Notification, Tag, MeetingTemplate } from './types';

export type { User, Meeting, Notification, Tag, MeetingTemplate };

// Генерация ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// USERS
export function getUsers(): User[] {
  const data = localStorage.getItem('vks_users');
  return data ? JSON.parse(data) : [];
}

export function saveUsers(users: User[]): void {
  localStorage.setItem('vks_users', JSON.stringify(users));
}

export function createUser(user: Omit<User, 'id' | 'createdAt'>): User {
  const users = getUsers();
  const newUser: User = {
    ...user,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  saveUsers(users);
  return newUser;
}

export function updateUser(id: string, data: Partial<User>): User | null {
  const users = getUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return null;
  users[index] = { ...users[index], ...data };
  saveUsers(users);
  return users[index];
}

export function deleteUser(id: string): boolean {
  const users = getUsers();
  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) return false;
  saveUsers(filtered);
  return true;
}

export function toggleUserActive(id: string): User | null {
  const users = getUsers();
  const user = users.find(u => u.id === id);
  if (!user) return null;
  user.isActive = !user.isActive;
  saveUsers(users);
  return user;
}

export function changeUserRole(id: string, role: User['role']): User | null {
  return updateUser(id, { role });
}

export function resetUserPassword(id: string, password: string): User | null {
  return updateUser(id, { password });
}

// MEETINGS
export function getMeetings(): Meeting[] {
  const data = localStorage.getItem('vks_meetings');
  return data ? (JSON.parse(data) as Meeting[]) : [];
}

export function saveMeetings(meetings: Meeting[]): void {
  localStorage.setItem('vks_meetings', JSON.stringify(meetings));
}

export function createMeeting(meeting: Omit<Meeting, 'id' | 'createdAt'>): Meeting {
  const meetings = getMeetings();
  const newMeeting: Meeting = {
    ...meeting,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  meetings.push(newMeeting);
  saveMeetings(meetings);
  
  // Создаём уведомления для участников
  meeting.participants.forEach(participantId => {
    if (participantId !== meeting.organizerId) {
      addNotification({
        userId: participantId,
        meetingId: newMeeting.id,
        message: `👤 Вас добавили в конференцию "${meeting.title}"`,
        type: 'user-added',
        timestamp: new Date().toISOString(),
        read: false,
      });
    }
  });
  
  return newMeeting;
}

export function updateMeeting(id: string, data: Partial<Meeting>): Meeting | null {
  const meetings = getMeetings();
  const index = meetings.findIndex(m => m.id === id);
  if (index === -1) return null;
  meetings[index] = { ...meetings[index], ...data };
  saveMeetings(meetings);
  return meetings[index];
}

export function deleteMeeting(id: string): boolean {
  const meetings = getMeetings();
  const filtered = meetings.filter(m => m.id !== id);
  if (filtered.length === meetings.length) return false;
  saveMeetings(filtered);
  return true;
}

// NOTIFICATIONS
export function getNotifications(): Notification[] {
  const data = localStorage.getItem('vks_notifications');
  return data ? JSON.parse(data) : [];
}

export function saveNotifications(notifications: Notification[]): void {
  localStorage.setItem('vks_notifications', JSON.stringify(notifications));
}

export function addNotification(notification: Omit<Notification, 'id'>): Notification {
  const notifications = getNotifications();
  const newNotification: Notification = {
    ...notification,
    id: generateId(),
  };
  notifications.unshift(newNotification);
  saveNotifications(notifications);
  return newNotification;
}

export function markNotificationRead(id: string): void {
  const notifications = getNotifications();
  const notification = notifications.find(n => n.id === id);
  if (notification) {
    notification.read = true;
    saveNotifications(notifications);
  }
}

export function markAllNotificationsRead(): void {
  const notifications = getNotifications();
  notifications.forEach(n => n.read = true);
  saveNotifications(notifications);
}

export function clearAllNotifications(): void {
  saveNotifications([]);
}

// TAGS
export function getTags(): Tag[] {
  const data = localStorage.getItem('vks_tags');
  return data ? JSON.parse(data) : [];
}

export function createTag(tag: Omit<Tag, 'id'>): Tag {
  const tags = getTags();
  const newTag: Tag = {
    ...tag,
    id: generateId(),
  };
  tags.push(newTag);
  localStorage.setItem('vks_tags', JSON.stringify(tags));
  return newTag;
}

export function updateTag(id: string, data: Partial<Tag>): Tag | null {
  const tags = getTags();
  const index = tags.findIndex(t => t.id === id);
  if (index === -1) return null;
  tags[index] = { ...tags[index], ...data };
  localStorage.setItem('vks_tags', JSON.stringify(tags));
  return tags[index];
}

export function deleteTag(id: string): boolean {
  const tags = getTags();
  const filtered = tags.filter(t => t.id !== id);
  if (filtered.length === tags.length) return false;
  localStorage.setItem('vks_tags', JSON.stringify(filtered));
  return true;
}

// TEMPLATES
export function getTemplates(): MeetingTemplate[] {
  const data = localStorage.getItem('vks_templates');
  return data ? JSON.parse(data) : [];
}

export function createTemplate(template: Omit<MeetingTemplate, 'id'>): MeetingTemplate {
  const templates = getTemplates();
  const newTemplate: MeetingTemplate = {
    ...template,
    id: generateId(),
  };
  templates.push(newTemplate);
  localStorage.setItem('vks_templates', JSON.stringify(templates));
  return newTemplate;
}

export function updateTemplate(id: string, data: Partial<MeetingTemplate>): MeetingTemplate | null {
  const templates = getTemplates();
  const index = templates.findIndex(t => t.id === id);
  if (index === -1) return null;
  templates[index] = { ...templates[index], ...data };
  localStorage.setItem('vks_templates', JSON.stringify(templates));
  return templates[index];
}

export function deleteTemplate(id: string): boolean {
  const templates = getTemplates();
  const filtered = templates.filter(t => t.id !== id);
  if (filtered.length === templates.length) return false;
  localStorage.setItem('vks_templates', JSON.stringify(filtered));
  return true;
}

// AUTH
export function login(login: string, password: string): { success: boolean; user?: User; error?: string } {
  const users = getUsers();
  const user = users.find(u => u.login === login && u.password === password);
  if (!user) {
    return { success: false, error: 'Неверный логин или пароль' };
  }
  if (!user.isActive) {
    return { success: false, error: 'Аккаунт заблокирован' };
  }
  localStorage.setItem('vks_current_user', JSON.stringify(user));
  return { success: true, user };
}

export function register(name: string, login: string, password: string, phone?: string, department?: string): { success: boolean; user?: User; error?: string } {
  const users = getUsers();
  if (users.find(u => u.login === login)) {
    return { success: false, error: 'Пользователь с таким логином уже существует' };
  }
  const newUser = createUser({
    name,
    login,
    password,
    role: 'user',
    phone,
    department,
    isActive: true,
  });
  localStorage.setItem('vks_current_user', JSON.stringify(newUser));
  return { success: true, user: newUser };
}

export function logout(): void {
  localStorage.removeItem('vks_current_user');
}

export function getCurrentUser(): User | null {
  const data = localStorage.getItem('vks_current_user');
  return data ? JSON.parse(data) : null;
}

export function updateProfile(data: Partial<User>): User | null {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;
  const updated = updateUser(currentUser.id, data);
  if (updated) {
    localStorage.setItem('vks_current_user', JSON.stringify(updated));
  }
  return updated;
}

export function changePassword(currentPassword: string, newPassword: string): boolean {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.password !== currentPassword) {
    return false;
  }
  updateUser(currentUser.id, { password: newPassword });
  return true;
}

// THEME
export function getTheme(): 'light' | 'dark' {
  return (localStorage.getItem('vks_theme') as 'light' | 'dark') || 'light';
}

export function setTheme(theme: 'light' | 'dark'): void {
  localStorage.setItem('vks_theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

// INIT DEMO DATA
export function initializeDemoData(): void {
  const users = getUsers();
  if (users.length > 0) return;

  // Создаём администратора
  const admin = createUser({
    name: 'Администратор Системы',
    login: 'admin',
    password: 'admin123',
    role: 'admin',
    phone: '+7 (999) 000-00-01',
    department: 'IT',
    position: 'Системный администратор',
    isActive: true,
  });

  // Создаём модератора
  const moderator = createUser({
    name: 'Сидоров Константин Львович',
    login: 'moderator',
    password: 'mod123',
    role: 'moderator',
    phone: '+7 (999) 333-44-55',
    department: 'HR',
    position: 'HR Manager',
    isActive: true,
  });

  // Создаём тестовых пользователей
  const ivanov = createUser({
    name: 'Иванов Алексей Сергеевич',
    login: 'ivanov',
    password: 'user123',
    role: 'user',
    phone: '+7 (999) 111-22-33',
    department: 'Разработка',
    position: 'Frontend Developer',
    isActive: true,
  });

  const petrova = createUser({
    name: 'Петрова Мария Владимировна',
    login: 'petrova',
    password: 'user123',
    role: 'user',
    phone: '+7 (999) 222-33-44',
    department: 'Менеджмент',
    position: 'Project Manager',
    isActive: true,
  });

  // Создаём тестовые конференции
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  createMeeting({
    title: 'Еженедельный стендап',
    description: 'Обсуждение прогресса команды',
    date: today,
    startTime: '10:00',
    endTime: '10:30',
    organizerId: petrova.id,
    participants: [ivanov.id, petrova.id, moderator.id],
    link: 'https://meet.google.com/abc-defg-hij',
    room: 'Переговорная №1',
    status: 'scheduled',
    priority: 'high',
    reminderMinutes: 15,
    recurring: 'weekly',
    isPrivate: false,
  });

  createMeeting({
    title: 'Обзор проекта Q4',
    description: 'Презентация результатов квартала',
    date: today,
    startTime: '14:00',
    endTime: '15:30',
    organizerId: admin.id,
    participants: [ivanov.id, petrova.id],
    link: 'https://zoom.us/j/123456789',
    room: 'Конференц-зал А',
    status: 'scheduled',
    priority: 'high',
    reminderMinutes: 30,
    recurring: 'none',
    isPrivate: false,
  });

  createMeeting({
    title: 'Дизайн-ревью',
    description: 'Обсуждение нового интерфейса',
    date: tomorrow,
    startTime: '11:00',
    endTime: '12:00',
    organizerId: ivanov.id,
    participants: [ivanov.id, petrova.id],
    link: 'https://teams.microsoft.com/meet/123',
    room: 'Онлайн',
    status: 'scheduled',
    priority: 'medium',
    reminderMinutes: 15,
    recurring: 'none',
    isPrivate: false,
  });
}

// Инициализация при загрузке
initializeDemoData();

// Сброс всех данных
export function forceReset(): void {
  localStorage.clear();
  initializeDemoData();
}
