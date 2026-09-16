import { Meeting, Notification, Settings } from './types';

const MEETINGS_KEY = 'vks_meetings';
const NOTIFICATIONS_KEY = 'vks_notifications';
const SETTINGS_KEY = 'vks_settings';

export const defaultSettings: Settings = {
  soundEnabled: true,
  browserNotifications: true,
  defaultReminderMinutes: 15,
  workHoursStart: '09:00',
  workHoursEnd: '18:00',
};

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

export function getNotifications(): Notification[] {
  const data = localStorage.getItem(NOTIFICATIONS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveNotifications(notifications: Notification[]): void {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

export function addNotification(notification: Notification): void {
  const notifications = getNotifications();
  notifications.unshift(notification);
  // Keep only last 100 notifications
  if (notifications.length > 100) notifications.length = 100;
  saveNotifications(notifications);
}

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

export function initializeDemoData(): void {
  const existing = getMeetings();
  if (existing.length > 0) return; // Don't overwrite existing data

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterStr = dayAfter.toISOString().split('T')[0];

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 5);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const demoMeetings: Meeting[] = [
    {
      id: generateId(),
      title: 'Еженедельный стендап команды',
      description: 'Обсуждение прогресса за неделю, планирование задач',
      date: todayStr,
      startTime: '10:00',
      endTime: '10:30',
      participants: ['Иванов А.С.', 'Петрова М.В.', 'Сидоров К.Л.', 'Козлова Е.Н.'],
      link: 'https://meet.example.com/standup',
      room: 'Переговорная №1',
      status: 'scheduled',
      reminderMinutes: 10,
      recurring: 'weekly',
      priority: 'high',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      title: 'Обзор проекта Q4',
      description: 'Презентация результатов квартала для руководства',
      date: todayStr,
      startTime: '14:00',
      endTime: '15:30',
      participants: ['Директор', 'Руководители отделов', 'PM команды'],
      link: 'https://meet.example.com/q4-review',
      room: 'Конференц-зал А',
      status: 'scheduled',
      reminderMinutes: 30,
      recurring: 'none',
      priority: 'high',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      title: 'Техническое собеседование',
      description: 'Собеседование на позицию Senior Frontend Developer',
      date: tomorrowStr,
      startTime: '11:00',
      endTime: '12:00',
      participants: ['HR Отдел', 'Tech Lead', 'Кандидат'],
      link: 'https://meet.example.com/interview',
      room: 'Онлайн',
      status: 'scheduled',
      reminderMinutes: 15,
      recurring: 'none',
      priority: 'medium',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      title: 'Демо нового функционала',
      description: 'Показ новой версии продукта заказчику',
      date: tomorrowStr,
      startTime: '16:00',
      endTime: '17:00',
      participants: ['Команда разработки', 'Заказчик', 'Менеджер проекта'],
      link: 'https://meet.example.com/demo',
      room: 'Переговорная №3',
      status: 'scheduled',
      reminderMinutes: 15,
      recurring: 'none',
      priority: 'high',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      title: 'Ретроспектива спринта',
      description: 'Анализ прошедшего спринта',
      date: dayAfterStr,
      startTime: '15:00',
      endTime: '16:00',
      participants: ['Scrum Master', 'Команда разработки'],
      link: 'https://meet.example.com/retro',
      room: 'Переговорная №2',
      status: 'scheduled',
      reminderMinutes: 10,
      recurring: 'weekly',
      priority: 'medium',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      title: 'Обучение: Новый стек технологий',
      description: 'Внутренний тренинг по новым инструментам',
      date: nextWeekStr,
      startTime: '10:00',
      endTime: '12:00',
      participants: ['Вся команда', 'Внешний тренер'],
      link: 'https://meet.example.com/training',
      room: 'Конференц-зал Б',
      status: 'scheduled',
      reminderMinutes: 60,
      recurring: 'none',
      priority: 'low',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      title: 'Планёрка с клиентом',
      description: 'Обсуждение требований к новому модулю',
      date: yesterdayStr,
      startTime: '09:00',
      endTime: '10:00',
      participants: ['PM', 'Аналитик', 'Клиент'],
      link: 'https://meet.example.com/client',
      room: 'Онлайн',
      status: 'completed',
      reminderMinutes: 15,
      recurring: 'none',
      priority: 'medium',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      title: 'Архитектурный комитет',
      description: 'Рассмотрение новых архитектурных решений',
      date: yesterdayStr,
      startTime: '14:00',
      endTime: '15:00',
      participants: ['Архитекторы', 'Tech Lead', 'CTO'],
      link: 'https://meet.example.com/arch',
      room: 'Переговорная №1',
      status: 'completed',
      reminderMinutes: 15,
      recurring: 'monthly',
      priority: 'high',
      createdAt: new Date().toISOString(),
    },
  ];

  saveMeetings(demoMeetings);

  // Add some demo notifications
  const demoNotifications: Notification[] = [
    {
      id: generateId(),
      meetingId: demoMeetings[0].id,
      message: '⏰ Напоминание: через 10 мин. начнётся "Еженедельный стендап команды"',
      type: 'reminder',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      read: false,
    },
    {
      id: generateId(),
      meetingId: demoMeetings[6].id,
      message: '✅ Конференция "Планёрка с клиентом" завершена',
      type: 'info',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      read: true,
    },
    {
      id: generateId(),
      meetingId: demoMeetings[0].id,
      message: '🔴 Конференция "Еженедельный стендап команды" начинается!',
      type: 'starting',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      read: true,
    },
  ];

  saveNotifications(demoNotifications);
}
