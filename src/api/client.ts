// API клиент для работы с Laravel backend

// По умолчанию API доступен на том же origin через nginx (location /api/ -> Laravel),
// поэтому относительный путь '/api' работает и в docker, и без настройки CORS.
// Переопределить можно переменной окружения VITE_API_URL при сборке.
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Получение токена из localStorage
const getToken = (): string | null => {
  const auth = localStorage.getItem('vks_auth');
  if (!auth) return null;
  return JSON.parse(auth).token;
};

// Базовая функция для запросов
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({} as any));
      // Laravel при валидации (422) возвращает { message, errors: { field: [msgs] } },
      // а не поле "message" с текстом ошибки — достаём текст из errors
      let message = error.message;
      if (!message && error.errors) {
        const firstMessages = Object.values(error.errors).flat() as string[];
        if (firstMessages.length > 0) {
          message = firstMessages.join('; ');
        }
      }
      throw new Error(message || 'Ошибка запроса');
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// AUTH API
export const authAPI = {
  login: (login: string, password: string) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),

  register: (data: { name: string; login: string; password: string; phone?: string; department?: string }) =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    apiRequest('/auth/logout', {
      method: 'POST',
    }),

  getUser: () =>
    apiRequest('/auth/user'),

  // Любой GET-эндпоинт API с авторизацией (используется админ-панелью для
  // постраничной загрузки полных списков).
  rawGet: (endpoint: string) =>
    apiRequest(endpoint),
};

// USERS API
export const usersAPI = {
  // Публичный справочник пользователей (ФИО участников для календаря/карточек).
  // Доступен любому авторизованному пользователю — не требует прав админа.
  getPublicList: () =>
    apiRequest('/users'),

  getAll: (params?: { per_page?: number; page?: number; search?: string; role?: string }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiRequest(`/admin/users${queryString}`);
  },

  create: (data: any) =>
    apiRequest('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    apiRequest(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest(`/admin/users/${id}`, {
      method: 'DELETE',
    }),

  changeRole: (id: string, role: string) =>
    apiRequest(`/admin/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  toggleActive: (id: string) =>
    apiRequest(`/admin/users/${id}/toggle-active`, {
      method: 'PUT',
    }),

  getAdminStats: () =>
    apiRequest('/admin/stats'),

  resetPassword: (id: string, password: string) =>
    apiRequest(`/admin/users/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    }),
};

// MEETINGS API
export const meetingsAPI = {
  getAll: (params?: { status?: string; date?: string; my?: boolean; search?: string }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiRequest(`/meetings${queryString}`);
  },

  get: (id: string) =>
    apiRequest(`/meetings/${id}`),

  create: (data: any) =>
    apiRequest('/meetings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    apiRequest(`/meetings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest(`/meetings/${id}`, {
      method: 'DELETE',
    }),

  getStats: () =>
    apiRequest('/meetings-stats'),
};

// NOTIFICATIONS API
export const notificationsAPI = {
  getAll: (params?: { type?: string; unread?: boolean; all?: boolean }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiRequest(`/notifications${queryString}`);
  },

  markAsRead: (id: string) =>
    apiRequest(`/notifications/${id}/read`, {
      method: 'PUT',
    }),

  markAllAsRead: (params?: { all?: boolean }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiRequest(`/notifications/read-all${queryString}`, {
      method: 'PUT',
    });
  },

  clearAll: () =>
    apiRequest('/notifications/clear', {
      method: 'DELETE',
    }),

  getUnreadCount: () =>
    apiRequest('/notifications/unread-count'),
};

// SETTINGS API
export const settingsAPI = {
  get: () =>
    apiRequest('/settings'),

  update: (data: any) =>
    apiRequest('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// PROFILE API
export const profileAPI = {
  update: (data: any) =>
    apiRequest('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  changePassword: (data: { current_password: string; password: string; password_confirmation: string }) =>
    apiRequest('/profile/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// TAGS API
export const tagsAPI = {
  getAll: () =>
    apiRequest('/tags'),

  create: (data: any) =>
    apiRequest('/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    apiRequest(`/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest(`/tags/${id}`, {
      method: 'DELETE',
    }),
};

// TEMPLATES API
export const templatesAPI = {
  getAll: () =>
    apiRequest('/templates'),

  create: (data: any) =>
    apiRequest('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    apiRequest(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest(`/templates/${id}`, {
      method: 'DELETE',
    }),
};

// ATTACHMENTS API
export const attachmentsAPI = {
  getByMeeting: (meetingId: string) =>
    apiRequest(`/meetings/${meetingId}/attachments`),

  upload: (meetingId: string, formData: FormData) =>
    apiRequest(`/meetings/${meetingId}/attachments`, {
      method: 'POST',
      body: formData,
      headers: {}, // Не устанавливаем Content-Type, чтобы браузер установил multipart/form-data
    }),

  delete: (id: string) =>
    apiRequest(`/attachments/${id}`, {
      method: 'DELETE',
    }),
};

// MEETING HISTORY API
export const meetingHistoryAPI = {
  getByMeeting: (meetingId: string) =>
    apiRequest(`/meetings/${meetingId}/history`),
};

// HEALTH CHECK
export const healthAPI = {
  check: () =>
    apiRequest('/health'),
};
