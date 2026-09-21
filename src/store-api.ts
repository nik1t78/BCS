// Store с поддержкой API Laravel

import { authAPI, usersAPI, meetingsAPI, notificationsAPI, settingsAPI, profileAPI, tagsAPI, templatesAPI, attachmentsAPI, meetingHistoryAPI } from './api/client';
import { User, Meeting, Notification, Settings, Tag, MeetingTemplate, Attachment, MeetingHistory } from './types';

// ============ AUTH ============
export async function login(login: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const response = await authAPI.login(login, password);
    localStorage.setItem('vks_auth', JSON.stringify({ token: response.token, user: response.user }));
    return { success: true, user: response.user };
  } catch (error: any) {
    return { success: false, error: error.message || 'Ошибка входа' };
  }
}

export async function register(name: string, login: string, password: string, phone?: string, department?: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const response = await authAPI.register({ name, login, password, phone, department });
    localStorage.setItem('vks_auth', JSON.stringify({ token: response.token, user: response.user }));
    return { success: true, user: response.user };
  } catch (error: any) {
    return { success: false, error: error.message || 'Ошибка регистрации' };
  }
}

export async function logout(): Promise<void> {
  try {
    await authAPI.logout();
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    localStorage.removeItem('vks_auth');
  }
}

export function getCurrentUser(): User | null {
  const data = localStorage.getItem('vks_auth');
  if (!data) return null;
  return JSON.parse(data).user;
}

export function getToken(): string | null {
  const data = localStorage.getItem('vks_auth');
  if (!data) return null;
  return JSON.parse(data).token;
}

// ============ USERS ============
export async function getUsers(): Promise<User[]> {
  try {
    const response = await usersAPI.getAll();
    return response.data;
  } catch (error) {
    console.error('Get users error:', error);
    return [];
  }
}

export async function createUser(data: any): Promise<User | null> {
  try {
    const response = await usersAPI.create(data);
    return response;
  } catch (error) {
    console.error('Create user error:', error);
    return null;
  }
}

export async function updateUser(id: string, data: any): Promise<User | null> {
  try {
    const response = await usersAPI.update(id, data);
    return response;
  } catch (error) {
    console.error('Update user error:', error);
    return null;
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    await usersAPI.delete(id);
    return true;
  } catch (error) {
    console.error('Delete user error:', error);
    return false;
  }
}

export async function changeUserRole(id: string, role: string): Promise<boolean> {
  try {
    await usersAPI.changeRole(id, role);
    return true;
  } catch (error) {
    console.error('Change role error:', error);
    return false;
  }
}

export async function toggleUserActive(id: string): Promise<boolean> {
  try {
    await usersAPI.toggleActive(id);
    return true;
  } catch (error) {
    console.error('Toggle active error:', error);
    return false;
  }
}

export async function resetUserPassword(id: string, password: string): Promise<boolean> {
  try {
    await usersAPI.resetPassword(id, password);
    return true;
  } catch (error) {
    console.error('Reset password error:', error);
    return false;
  }
}

// ============ MEETINGS ============
export async function getMeetings(params?: { status?: string; date?: string; my?: boolean; search?: string }): Promise<Meeting[]> {
  try {
    const response = await meetingsAPI.getAll(params);
    return response.data;
  } catch (error) {
    console.error('Get meetings error:', error);
    return [];
  }
}

export async function createMeeting(data: any): Promise<Meeting | null> {
  try {
    const response = await meetingsAPI.create(data);
    return response;
  } catch (error) {
    console.error('Create meeting error:', error);
    return null;
  }
}

export async function updateMeeting(id: string, data: any): Promise<Meeting | null> {
  try {
    const response = await meetingsAPI.update(id, data);
    return response;
  } catch (error) {
    console.error('Update meeting error:', error);
    return null;
  }
}

export async function deleteMeeting(id: string): Promise<boolean> {
  try {
    await meetingsAPI.delete(id);
    return true;
  } catch (error) {
    console.error('Delete meeting error:', error);
    return false;
  }
}

export async function getMeetingStats(): Promise<any> {
  try {
    const response = await meetingsAPI.getStats();
    return response;
  } catch (error) {
    console.error('Get meeting stats error:', error);
    return null;
  }
}

// ============ NOTIFICATIONS ============
export async function getNotifications(params?: { type?: string; unread?: boolean }): Promise<Notification[]> {
  try {
    const response = await notificationsAPI.getAll(params);
    return response.data;
  } catch (error) {
    console.error('Get notifications error:', error);
    return [];
  }
}

export async function markNotificationRead(id: string): Promise<boolean> {
  try {
    await notificationsAPI.markAsRead(id);
    return true;
  } catch (error) {
    console.error('Mark notification read error:', error);
    return false;
  }
}

export async function markAllNotificationsRead(): Promise<boolean> {
  try {
    await notificationsAPI.markAllAsRead();
    return true;
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return false;
  }
}

export async function clearAllNotifications(): Promise<boolean> {
  try {
    await notificationsAPI.clearAll();
    return true;
  } catch (error) {
    console.error('Clear all notifications error:', error);
    return false;
  }
}

export async function getUnreadNotificationsCount(): Promise<number> {
  try {
    const response = await notificationsAPI.getUnreadCount();
    return response.count;
  } catch (error) {
    console.error('Get unread count error:', error);
    return 0;
  }
}

// ============ SETTINGS ============
export async function getSettings(): Promise<Settings | null> {
  try {
    const response = await settingsAPI.get();
    return response;
  } catch (error) {
    console.error('Get settings error:', error);
    return null;
  }
}

export async function updateSettings(data: any): Promise<boolean> {
  try {
    await settingsAPI.update(data);
    return true;
  } catch (error) {
    console.error('Update settings error:', error);
    return false;
  }
}

// ============ PROFILE ============
export async function updateProfile(data: any): Promise<User | null> {
  try {
    const response = await profileAPI.update(data);
    // Обновляем пользователя в localStorage
    const auth = localStorage.getItem('vks_auth');
    if (auth) {
      const authData = JSON.parse(auth);
      authData.user = response;
      localStorage.setItem('vks_auth', JSON.stringify(authData));
    }
    return response;
  } catch (error) {
    console.error('Update profile error:', error);
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
    console.error('Change password error:', error);
    return false;
  }
}

// ============ TAGS ============
export async function getTags(): Promise<Tag[]> {
  try {
    const response = await tagsAPI.getAll();
    return response.data || response;
  } catch (error) {
    console.error('Get tags error:', error);
    return [];
  }
}

export async function createTag(data: any): Promise<Tag | null> {
  try {
    const response = await tagsAPI.create(data);
    return response;
  } catch (error) {
    console.error('Create tag error:', error);
    return null;
  }
}

export async function updateTag(id: string, data: any): Promise<Tag | null> {
  try {
    const response = await tagsAPI.update(id, data);
    return response;
  } catch (error) {
    console.error('Update tag error:', error);
    return null;
  }
}

export async function deleteTag(id: string): Promise<boolean> {
  try {
    await tagsAPI.delete(id);
    return true;
  } catch (error) {
    console.error('Delete tag error:', error);
    return false;
  }
}

// ============ TEMPLATES ============
export async function getTemplates(): Promise<MeetingTemplate[]> {
  try {
    const response = await templatesAPI.getAll();
    return response.data || response;
  } catch (error) {
    console.error('Get templates error:', error);
    return [];
  }
}

export async function createTemplate(data: any): Promise<MeetingTemplate | null> {
  try {
    const response = await templatesAPI.create(data);
    return response;
  } catch (error) {
    console.error('Create template error:', error);
    return null;
  }
}

export async function updateTemplate(id: string, data: any): Promise<MeetingTemplate | null> {
  try {
    const response = await templatesAPI.update(id, data);
    return response;
  } catch (error) {
    console.error('Update template error:', error);
    return null;
  }
}

export async function deleteTemplate(id: string): Promise<boolean> {
  try {
    await templatesAPI.delete(id);
    return true;
  } catch (error) {
    console.error('Delete template error:', error);
    return false;
  }
}

// ============ ATTACHMENTS ============
export async function getAttachments(meetingId: string): Promise<Attachment[]> {
  try {
    const response = await attachmentsAPI.getByMeeting(meetingId);
    return response.data || response;
  } catch (error) {
    console.error('Get attachments error:', error);
    return [];
  }
}

export async function uploadAttachment(meetingId: string, file: File): Promise<Attachment | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await attachmentsAPI.upload(meetingId, formData);
    return response;
  } catch (error) {
    console.error('Upload attachment error:', error);
    return null;
  }
}

export async function deleteAttachment(id: string): Promise<boolean> {
  try {
    await attachmentsAPI.delete(id);
    return true;
  } catch (error) {
    console.error('Delete attachment error:', error);
    return false;
  }
}

// ============ MEETING HISTORY ============
export async function getMeetingHistory(meetingId: string): Promise<MeetingHistory[]> {
  try {
    const response = await meetingHistoryAPI.getByMeeting(meetingId);
    return response.data || response;
  } catch (error) {
    console.error('Get meeting history error:', error);
    return [];
  }
}

// ============ UTILS ============
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
