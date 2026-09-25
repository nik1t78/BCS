import React, { useState, useEffect } from 'react';
import { User, Meeting } from '../types';
import { authAPI } from '../api/client';
import { unwrapList, mapMeeting } from '../store-api';
import { exportToExcel } from '../utils/export';
import { getUsers, getMeetings, getAdminPanelStats, createUser, updateUser, deleteUser, toggleUserActive, changeUserRole, resetUserPassword, updateMeeting, deleteMeeting, createMeeting } from '../store-api';

// Админский список всех конференций: обычный GET /meetings доступён только
// по роли/приватности и на бэкенде пагинируется (50 записей на страницу).
// Для вкладки «Конференции» грузим все страницы целиком.
async function getAllMeetingsForAdmin(): Promise<Meeting[]> {
  const all: Meeting[] = [];
  let page = 1;
  for (;;) {
    const response = await authAPI.rawGet(`/meetings?per_page=200&page=${page}`);
    const items = unwrapList(response).map(mapMeeting) as Meeting[];
    all.push(...items);
    const lastPage = response?.last_page ?? page;
    if (items.length === 0 || page >= lastPage) break;
    page++;
  }
  return all;
}

interface AdminPanelProps {
  user: User;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  login: 'Вход в систему',
  logout: 'Выход из системы',
  meeting_created: 'Создание конференции',
  meeting_updated: 'Изменение конференции',
  meeting_deleted: 'Удаление конференции',
  user_created: 'Создание пользователя',
  user_deleted: 'Удаление пользователя',
  user_role_changed: 'Смена роли пользователя',
  user_blocked: 'Блокировка пользователя',
  user_unblocked: 'Разблокировка пользователя',
  password_changed: 'Смена пароля',
};

// Поля, которые не стоит показывать в колонке «Изменения»
const AUDIT_HIDDEN_FIELDS = new Set(['id', 'created_at', 'updated_at', 'password', 'organizer_id']);

function renderAuditChanges(log: { old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null }) {
  const changed = Object.entries(log.new_values ?? {}).filter(
    ([key, value]) => !AUDIT_HIDDEN_FIELDS.has(key) && String(log.old_values?.[key] ?? '') !== String(value ?? '')
  );
  if (changed.length === 0) return <span className="text-gray-400">—</span>;
  return (
    <div className="space-y-0.5">
      {changed.slice(0, 3).map(([key, value]) => (
        <div key={key}>
          <span className="font-medium text-gray-600 dark:text-gray-300">{key}</span>
          {log.old_values?.[key] !== undefined && log.old_values?.[key] !== null && (
            <span className="text-red-500 line-through mx-1">{String(log.old_values[key]).slice(0, 20)}</span>
          )}
          <i className="fas fa-arrow-right text-[10px] text-gray-400 mr-1"></i>
          <span className="text-green-600 dark:text-green-400">{String(value).slice(0, 20)}</span>
        </div>
      ))}
      {changed.length > 3 && <div className="text-gray-400">…и ещё {changed.length - 3}</div>}
    </div>
  );
}

export default function AdminPanel({ user }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'meetings' | 'stats' | 'audit'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  // Модальное окно просмотра конференции (как в «Мои конференции»)
  const [viewMeeting, setViewMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiStats, setApiStats] = useState<any>(null);

  // Аудит-лог (вкладка «Аудит», видна только администратору)
  interface AuditEntry {
    id: number;
    action: string;
    user?: { id: number; name: string; login: string; role: string } | null;
    auditable_type: string | null;
    auditable_id: number | null;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    ip_address: string | null;
    created_at: string;
  }
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLastPage, setAuditLastPage] = useState(1);
  const [auditAction, setAuditAction] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);

  const loadAuditLogs = async (page = 1, action = auditAction) => {
    if (user.role !== 'admin') return;
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({ per_page: '25', page: String(page) });
      if (action) params.set('action', action);
      const response = await authAPI.rawGet(`/admin/audit-logs?${params.toString()}`);
      setAuditLogs(unwrapList(response) as AuditEntry[]);
      setAuditPage(Number(response?.current_page ?? page));
      setAuditLastPage(Number(response?.last_page ?? 1));
    } catch (e) {
      console.error('Audit logs load error:', e);
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') loadAuditLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const emptyUser: User = {
    id: '', name: '', login: '', password: '', role: 'user',
    phone: '', department: '', position: '', createdAt: '', isActive: true,
  };
  const [userForm, setUserForm] = useState<User>(emptyUser);

  const emptyMeeting: Meeting = {
    id: '', title: '', description: '',
    date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
    startTime: '10:00', endTime: '11:00', organizerId: user.id, participants: [],
    participantEmails: [], link: '', room: '', status: 'scheduled', reminderMinutes: 15,
    recurring: 'none', priority: 'medium', createdAt: new Date().toISOString(), isPrivate: false,
  };
  const [meetingForm, setMeetingForm] = useState<Meeting>(emptyMeeting);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // getMeetings/getUsers сами не бросают исключение, а возвращают [] при
      // ошибке запроса — проверяем ответ сервера отдельно, чтобы админка не
      // выглядела «пустой» без объяснений.
      const [usersData, meetingsData, statsData] = await Promise.all([
        getUsers(),
        getAllMeetingsForAdmin().catch(() => getMeetings()),
        getAdminPanelStats(user.role),
      ]);
      if (usersData.length === 0 && meetingsData.length === 0 && !statsData) {
        setError('Не удалось загрузить данные с сервера. Проверьте, что backend запущен и у вашей роли есть доступ к админ-панели.');
      }
      setUsers(usersData);
      setMeetings(meetingsData);
      setApiStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Ошибка загрузки данных админ-панели');
    } finally {
      setLoading(false);
    }
  };

  // User management
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingUser) {
      const ok = await updateUser(editingUser.id, userForm);
      if (!ok) { alert('Не удалось сохранить изменения пользователя. Проверьте поля (логин должен быть уникальным).'); return; }
    } else {
      if (!userForm.name || !userForm.login || !userForm.password) {
        alert('Заполните обязательные поля');
        return;
      }
      const created = await createUser(userForm);
      if (!created) { alert('Не удалось создать пользователя. Проверьте поля: логин должен быть уникальным, пароль — не короче 6 символов.'); return; }
    }

    setUsers(await getUsers());
    setApiStats(await getAdminPanelStats(user.role));
    setShowUserForm(false);
    setEditingUser(null);
    setUserForm(emptyUser);
  };

  const handleEditUser = (u: User) => {
    setEditingUser(u);
    setUserForm(u);
    setShowUserForm(true);
  };

  const handleOpenPasswordModal = (userId: string) => {
    setPasswordUserId(userId);
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const handleResetPassword = async () => {
    if (!passwordUserId) return;
    
    if (newPassword.length < 6) {
      alert('Пароль должен быть не менее 6 символов');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      alert('Пароли не совпадают');
      return;
    }
    
    const ok = await resetUserPassword(passwordUserId, newPassword);
    if (!ok) {
      alert('Не удалось изменить пароль (доступно только администраторам)');
      return;
    }
    setShowPasswordModal(false);
    setPasswordUserId(null);
    setNewPassword('');
    setConfirmPassword('');
    alert('Пароль успешно изменён');
  };

  const handleDeleteUser = async (id: string) => {
    if (id === user.id) { 
      alert('Нельзя удалить свой аккаунт'); 
      return; 
    }
    
    if (confirm('Удалить пользователя?')) {
      const ok = await deleteUser(id);
      if (!ok) { alert('Не удалось удалить пользователя'); return; }
      setUsers(await getUsers());
      setApiStats(await getAdminPanelStats(user.role));
    }
  };

  const handleToggleActive = async (id: string) => {
    if (id === user.id) { 
      alert('Нельзя заблокировать свой аккаунт'); 
      return; 
    }
    
    const ok = await toggleUserActive(id);
    if (!ok) { alert('Не удалось изменить статус пользователя'); return; }
    setUsers(await getUsers());
    setApiStats(await getAdminPanelStats(user.role));
  };

  const handleChangeRole = async (id: string, role: User['role']) => {
    const ok = await changeUserRole(id, role);
    if (!ok) { alert('Не удалось изменить роль (доступно только администраторам)'); return; }
    setUsers(await getUsers());
    setApiStats(await getAdminPanelStats(user.role));
  };

  // Meeting management
  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();

    let ok: any;
    if (editingMeeting) {
      ok = await updateMeeting(editingMeeting.id, meetingForm);
    } else {
      ok = await createMeeting({ ...meetingForm, organizerId: user.id });
    }
    // createMeeting/updateMeeting возвращают null при ошибке сервера
    // (например, 422 валидация) — показываем причину вместо «тихого» отказа.
    if (!ok) {
      alert('Не удалось сохранить конференцию. Проверьте обязательные поля: название, дата, время начала раньше времени окончания, приоритет, напоминание (5–1440 мин).');
      return;
    }

    setMeetings(await getAllMeetingsForAdmin().catch(() => getMeetings()));
    setApiStats(await getAdminPanelStats(user.role));
    setShowMeetingForm(false);
    setEditingMeeting(null);
    setMeetingForm(emptyMeeting);
  };

  const handleEditMeeting = (m: Meeting) => {
    setEditingMeeting(m);
    setMeetingForm(m);
    setShowMeetingForm(true);
  };

  const handleDeleteMeeting = async (id: string) => {
    if (confirm('Удалить конференцию?')) {
      const ok = await deleteMeeting(id);
      if (!ok) { alert('Не удалось удалить конференцию (доступно только организатору или администратору)'); return; }
      setMeetings(await getAllMeetingsForAdmin().catch(() => getMeetings()));
      setApiStats(await getAdminPanelStats(user.role));
    }
  };

  const handleStatusChange = async (id: string, status: Meeting['status']) => {
    const meeting = meetings.find(m => m.id === id);
    if (meeting) {
      await updateMeeting(id, { status });
      setMeetings(await getAllMeetingsForAdmin().catch(() => getMeetings()));
    }
  };

  const getUserName = (id: string) => users.find(u => Number(u.id) === Number(id))?.name || '—';

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.login.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.department || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMeetings = meetings.filter(m =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.room || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Базовые цифры считаем из загруженных списков; если сервер вернул
  // агрегированную статистику (/meetings-stats, /admin/stats) — берём её,
  // т.к. она учитывает все записи на бэкенде, а не только первую страницу.
  const stats = {
    totalUsers: apiStats?.total_users ?? users.length,
    activeUsers: apiStats?.active_users ?? users.filter(u => u.isActive).length,
    admins: apiStats?.admins ?? users.filter(u => u.role === 'admin').length,
    totalMeetings: apiStats?.total ?? meetings.length,
    scheduled: apiStats?.scheduled ?? meetings.filter(m => m.status === 'scheduled').length,
    completed: apiStats?.completed ?? meetings.filter(m => m.status === 'completed').length,
    cancelled: apiStats?.cancelled ?? meetings.filter(m => m.status === 'cancelled').length,
    thisWeek: apiStats?.this_week ?? meetings.filter(m => {
      const now = new Date(); const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
      const mDate = new Date(m.date); return mDate >= weekStart && mDate <= weekEnd;
    }).length,
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'moderator': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
          <p className="text-gray-600 dark:text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
          <i className="fas fa-exclamation-triangle text-red-500 mt-0.5"></i>
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
          <button onClick={loadData} className="text-sm px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700">
            <i className="fas fa-sync-alt mr-1"></i>Повторить
          </button>
        </div>
      )}

      {/* Admin Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 rounded-lg p-3"><i className="fas fa-shield-alt text-2xl"></i></div>
          <div>
            <h2 className="text-xl font-bold">Админ-панель</h2>
            <p className="text-gray-300 text-sm">Управление пользователями и конференциями</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-2">
        <div className="flex gap-1">
          {[
            { id: 'users', label: 'Пользователи', icon: 'fa-users', count: users.length },
            { id: 'meetings', label: 'Конференции', icon: 'fa-video', count: meetings.length },
            { id: 'stats', label: 'Статистика', icon: 'fa-chart-bar' },
            ...(user.role === 'admin' ? [{ id: 'audit', label: 'Аудит', icon: 'fa-shield-alt' }] : []),
          ].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setSearchQuery(''); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}>
              <i className={`fas ${tab.icon}`}></i>{tab.label}
              {tab.count !== undefined && <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'}`}>{tab.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      {(activeTab === 'users' || activeTab === 'meetings') && (
        <div className="relative max-w-md">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input type="text" placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-blue-500" />
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Всего: {filteredUsers.length} пользователей</p>
            <button onClick={() => { setShowUserForm(true); setEditingUser(null); setUserForm(emptyUser); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <i className="fas fa-user-plus"></i>Добавить
            </button>
          </div>

          {/* User Form Modal */}
          {showUserForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{editingUser ? 'Редактировать пользователя' : 'Новый пользователь'}</h2>
                    <button onClick={() => setShowUserForm(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times text-xl"></i></button>
                  </div>
                  <form onSubmit={handleSaveUser} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ФИО *</label>
                      <input type="text" required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Логин *</label>
                      <input type="text" required value={userForm.login} onChange={(e) => setUserForm({ ...userForm, login: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500" />
                    </div>
                    {!editingUser && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Пароль *</label>
                        <input type="password" required value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                          placeholder="Минимум 6 символов" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Роль</label>
                        <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as User['role'] })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500">
                          <option value="user">Пользователь</option>
                          <option value="moderator">Модератор</option>
                          <option value="admin">Администратор</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Отдел</label>
                        <input type="text" value={userForm.department || ''} onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="active" checked={userForm.isActive}
                        onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })} className="w-4 h-4" />
                      <label htmlFor="active" className="text-sm text-gray-700 dark:text-gray-300">Активен</label>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-600">
                      <button type="button" onClick={() => setShowUserForm(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Отмена</button>
                      <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        {editingUser ? 'Сохранить' : 'Создать'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Users Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Пользователь</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Роль</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Отдел</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Статус</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">{u.name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">{u.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">@{u.login}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select value={u.role} onChange={(e) => handleChangeRole(u.id, e.target.value as User['role'])}
                          className={`text-xs px-2 py-1 rounded-full font-medium border-0 ${getRoleBadge(u.role)}`}>
                          <option value="user">Пользователь</option>
                          <option value="moderator">Модератор</option>
                          <option value="admin">Администратор</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{u.department || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleToggleActive(u.id)}
                          className={`text-xs px-2 py-1 rounded-full font-medium ${u.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                          {u.isActive ? '● Активен' : '● Заблокирован'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEditUser(u)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-600 rounded" title="Редактировать"><i className="fas fa-edit"></i></button>
                          <button onClick={() => handleOpenPasswordModal(u.id)} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-gray-600 rounded" title="Сменить пароль"><i className="fas fa-key"></i></button>
                          <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-600 rounded" title="Удалить"><i className="fas fa-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Meetings Tab */}
      {activeTab === 'meetings' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Всего: {filteredMeetings.length} конференций</p>
            <div className="flex items-center gap-2">
              <button onClick={() => exportToExcel(filteredMeetings, user.login || user.name)}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-2">
                <i className="fas fa-file-excel"></i>Экспорт в Excel
              </button>
              <button onClick={() => { setShowMeetingForm(true); setEditingMeeting(null); setMeetingForm({ ...emptyMeeting, date: new Date().toISOString().slice(0, 10) }); }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <i className="fas fa-plus"></i>Создать конференцию
              </button>
            </div>
          </div>

          {/* Meeting Form Modal */}
          {showMeetingForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{editingMeeting ? 'Редактировать конференцию' : 'Новая конференция'}</h2>
                    <button onClick={() => setShowMeetingForm(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times text-xl"></i></button>
                  </div>
                  <form onSubmit={handleSaveMeeting} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название *</label>
                      <input type="text" required value={meetingForm.title} onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
                      <textarea value={meetingForm.description || ''} onChange={(e) => setMeetingForm({ ...meetingForm, description: e.target.value })} rows={2}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Дата *</label>
                        <input type="date" required value={meetingForm.date} onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Начало *</label>
                        <input type="time" required value={meetingForm.startTime} onChange={(e) => setMeetingForm({ ...meetingForm, startTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Окончание *</label>
                        <input type="time" required value={meetingForm.endTime} onChange={(e) => setMeetingForm({ ...meetingForm, endTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Кабинет</label>
                        <input type="text" value={meetingForm.room || ''} onChange={(e) => setMeetingForm({ ...meetingForm, room: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Приоритет</label>
                        <select value={meetingForm.priority} onChange={(e) => setMeetingForm({ ...meetingForm, priority: e.target.value as Meeting['priority'] })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500">
                          <option value="low">Низкий</option>
                          <option value="medium">Средний</option>
                          <option value="high">Высокий</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ссылка ВКС</label>
                      <input type="url" value={meetingForm.link || ''} onChange={(e) => setMeetingForm({ ...meetingForm, link: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-600">
                      <button type="button" onClick={() => setShowMeetingForm(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Отмена</button>
                      <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingMeeting ? 'Сохранить' : 'Создать'}</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Просмотр конференции — как в «Мои конференции»: полные детали, вход по ссылке ВКС, редактирование */}
          {viewMeeting && (() => {
            const vm = viewMeeting;
            return (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewMeeting(null)}>
                <div
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{vm.title}</h2>
                      <button onClick={() => setViewMeeting(null)} className="text-gray-400 hover:text-gray-600">
                        <i className="fas fa-times text-xl"></i>
                      </button>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                      <p>
                        <i className="far fa-calendar mr-2 text-blue-500"></i>
                        {new Date(vm.date).toLocaleDateString('ru-RU')}
                        <span className="mx-2">•</span>
                        <i className="far fa-clock mr-2 text-blue-500"></i>
                        {vm.startTime} - {vm.endTime}
                      </p>
                      {vm.room && (
                        <p><i className="fas fa-map-marker-alt mr-2 text-blue-500"></i>{vm.room}</p>
                      )}
                      <p>
                        <i className="fas fa-user mr-2 text-blue-500"></i>
                        Организатор: {getUserName(vm.organizerId)}
                      </p>
                      <p>
                        <i className="fas fa-users mr-2 text-blue-500"></i>
                        Участники ({(vm.participants ?? []).length}):{' '}
                        {(vm.participants ?? []).map(p => getUserName(p)).join(', ') || 'нет'}
                      </p>
                      {vm.recurring !== 'none' && (
                        <p>
                          <i className="fas fa-sync-alt mr-2 text-blue-500"></i>
                          {vm.recurring === 'daily' ? 'Ежедневно' : vm.recurring === 'weekly' ? 'Еженедельно' : 'Ежемесячно'}
                          {vm.repeatUntil ? ` до ${new Date(vm.repeatUntil).toLocaleDateString('ru-RU')}` : ''}
                        </p>
                      )}
                      {vm.description && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg whitespace-pre-line">
                          {vm.description}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-3 pt-4 mt-4 border-t dark:border-gray-700">
                      <button
                        onClick={() => { setViewMeeting(null); handleEditMeeting(vm); }}
                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      >
                        <i className="fas fa-edit mr-1"></i>Редактировать
                      </button>
                      {vm.link && (
                        <a
                          href={vm.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <i className="fas fa-video mr-1"></i>Войти в конференцию
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Meetings Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Конференция</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Дата / Время</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Организатор</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Кабинет</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Статус</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredMeetings.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setViewMeeting(m)}
                          className="font-medium text-gray-800 dark:text-gray-100 text-sm hover:text-blue-600 text-left"
                          title="Открыть конференцию"
                        >
                          {m.title}
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{(m.participants ?? []).length} участник(ов)</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {m.date}<br /><span className="text-xs text-gray-400">{m.startTime}–{m.endTime}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{getUserName(m.organizerId)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{m.room || '—'}</td>
                      <td className="px-4 py-3">
                        <select value={m.status} onChange={(e) => handleStatusChange(m.id, e.target.value as Meeting['status'])}
                          className={`text-xs px-2 py-1 rounded-full font-medium border-0 ${
                            m.status === 'scheduled' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                            m.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                            'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                          <option value="scheduled">Запланирована</option>
                          <option value="completed">Завершена</option>
                          <option value="cancelled">Отменена</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewMeeting(m)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-600 rounded" title="Просмотр"><i className="fas fa-eye"></i></button>
                          {m.link && (
                            <a href={m.link} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-600 rounded" title="Войти в конференцию"><i className="fas fa-video"></i></a>
                          )}
                          <button onClick={() => handleEditMeeting(m)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-600 rounded" title="Редактировать"><i className="fas fa-edit"></i></button>
                          <button onClick={() => handleDeleteMeeting(m.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-600 rounded" title="Удалить"><i className="fas fa-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredMeetings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        <i className="fas fa-video-slash mr-2"></i>Конференции не найдены
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Пользователей', value: stats.totalUsers, icon: 'fa-users', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
            { label: 'Активных', value: stats.activeUsers, icon: 'fa-user-check', color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
            { label: 'Администраторов', value: stats.admins, icon: 'fa-shield-alt', color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
            { label: 'Всего конференций', value: stats.totalMeetings, icon: 'fa-video', color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400' },
            { label: 'Запланировано', value: stats.scheduled, icon: 'fa-clock', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
            { label: 'Завершено', value: stats.completed, icon: 'fa-check-circle', color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
            { label: 'Отменено', value: stats.cancelled, icon: 'fa-times-circle', color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
            { label: 'На этой неделе', value: stats.thisWeek, icon: 'fa-calendar-week', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                <i className={`fas ${s.icon}`}></i>
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{s.value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Audit Tab (только администратор) */}
      {activeTab === 'audit' && user.role === 'admin' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-gray-800 dark:text-gray-100">
                <i className="fas fa-shield-alt text-blue-600 mr-2"></i>Журнал действий
              </h3>
              <select
                value={auditAction}
                onChange={(e) => { setAuditAction(e.target.value); loadAuditLogs(1, e.target.value); }}
                className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200">
                <option value="">Все действия</option>
                <option value="login">Вход</option>
                <option value="logout">Выход</option>
                <option value="meeting_created">Создание конференции</option>
                <option value="meeting_updated">Изменение конференции</option>
                <option value="meeting_deleted">Удаление конференции</option>
                <option value="user_created">Создание пользователя</option>
                <option value="user_deleted">Удаление пользователя</option>
                <option value="user_role_changed">Смена роли</option>
                <option value="user_blocked">Блокировка</option>
                <option value="user_unblocked">Разблокировка</option>
                <option value="password_changed">Смена пароля</option>
              </select>
            </div>
            <button onClick={() => loadAuditLogs(auditPage)}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-200">
              <i className={`fas fa-sync-alt mr-1 ${auditLoading ? 'fa-spin' : ''}`}></i>Обновить
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Дата / время</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Пользователь</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Действие</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Объект</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Изменения</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-100">
                      {log.user ? `${log.user.name} (${log.user.login})` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 whitespace-nowrap">
                        {AUDIT_ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {log.auditable_type ? `${log.auditable_type} #${log.auditable_id}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                      {renderAuditChanges(log)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {log.ip_address || '—'}
                    </td>
                  </tr>
                ))}
                {auditLogs.length === 0 && !auditLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                      Записей аудита нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {auditLastPage > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
              <button disabled={auditPage <= 1} onClick={() => loadAuditLogs(auditPage - 1)}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-40">
                <i className="fas fa-chevron-left mr-1"></i>Назад
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">Стр. {auditPage} из {auditLastPage}</span>
              <button disabled={auditPage >= auditLastPage} onClick={() => loadAuditLogs(auditPage + 1)}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-40">
                Вперёд<i className="fas fa-chevron-right ml-1"></i>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && passwordUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <i className="fas fa-key text-yellow-500"></i>
                  Смена пароля
                </h2>
                <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 hover:text-gray-600">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  <i className="fas fa-info-circle mr-1"></i>
                  Пользователь: <strong>{users.find(u => Number(u.id) === Number(passwordUserId))?.name}</strong>
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Новый пароль *</label>
                  <input 
                    type="password" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="Минимум 6 символов"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Подтвердите пароль *</label>
                  <input 
                    type="password" 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="Повторите пароль"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-600">
                  <button 
                    onClick={() => setShowPasswordModal(false)} 
                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    Отмена
                  </button>
                  <button 
                    onClick={handleResetPassword} 
                    className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors">
                    <i className="fas fa-save mr-2"></i>Изменить пароль
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
