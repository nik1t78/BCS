export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // In real Laravel this would be hashed on server
  role: 'admin' | 'user' | 'moderator';
  avatar?: string;
  phone?: string;
  department?: string;
  position?: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  organizerId: string;
  participants: string[]; // user IDs
  participantEmails: string[]; // for guests
  link: string;
  room: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  reminderMinutes: number;
  recurring: 'none' | 'daily' | 'weekly' | 'monthly';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  isPrivate: boolean;
  tags?: string[];
  isFavorite?: boolean;
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

export interface Settings {
  soundEnabled: boolean;
  browserNotifications: boolean;
  defaultReminderMinutes: number;
  workHoursStart: string;
  workHoursEnd: string;
}
