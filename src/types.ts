export interface Meeting {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  participants: string[];
  link: string;
  room: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  reminderMinutes: number; // за сколько минут напомнить
  recurring: 'none' | 'daily' | 'weekly' | 'monthly';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface Notification {
  id: string;
  meetingId: string;
  message: string;
  type: 'reminder' | 'starting' | 'info' | 'warning';
  timestamp: string;
  read: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export interface Settings {
  soundEnabled: boolean;
  browserNotifications: boolean;
  defaultReminderMinutes: number;
  workHoursStart: string;
  workHoursEnd: string;
}
