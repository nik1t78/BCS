import React, { useState, useEffect } from 'react';
import { User, Meeting } from '../types';
import { getUsers, getMeetings, updateUser, deleteUser, toggleUserActive, changeUserRole, updateMeeting, deleteMeeting, generateId, addMeeting } from '../store';

interface AdminPanelProps {
  user: User;
}

export default function AdminPanel({ user }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'meetings' | 'stats'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const emptyUser: User = {
    id: '', name: '', login: '', password: '', role: 'user',
    phone: '', department: '', position: '', createdAt: '', isActive: true,
  };
  const [userForm, setUserForm] = useState<User>(emptyUser);

  const emptyMeeting: Meeting = {
    id: '', title: '', description: '', date: new Date().toISOString().split('T')[0],
    startTime: '10:00', endTime: '11:00', organizerId: user.id, participants: [],
    participantEmails: [], link: '', room: '', status: 'scheduled', reminderMinutes: 15,
    recurring: 'none', priority: 'medium', createdAt: new Date().toISOString(), isPrivate: false,
  };
  const [meetingForm, setMeetingForm] = useState<Meeting>(emptyMeeting);

  useEffect(() => {
    setUsers(getUsers());
    setMeetings(getMeetings());
  }, []);

  // User management
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateUser({ ...userForm, id: editingUser.id });
    } else {
      if (!userForm.name || !userForm.login || !userForm.password) {
        alert('Заполните обязательные поля');
        return;
      }
      if (users.find(u => u.login === userForm.login)) {
        alert('Логин уже используется');
        return;
      }
      const newUser = { ...userForm, id: generateId(), createdAt: new Date().toISOString() };
      const allUsers = getUsers();
      allUsers.push(newUser);
      localStorage.setItem('vks_users', JSON.stringify(allUsers));
    }
    setUsers(getUsers());
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

  const handleResetPassword = () => {
    if (!passwordUserId) return;
    
    if (newPassword.length < 6) {
      alert('Пароль должен быть не менее 6 символов');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      alert('Пароли не совпадают');
      return;
    }
    
    const userToUpdate = users.find(u => u.id === passwordUserId);
    if (userToUpdate) {
      updateUser({ ...userToUpdate, password: newPassword });
      setUsers(getUsers());
      setShowPasswordModal(false);
      setPasswordUserId(null);
      setNewPassword('');
      setConfirmPassword('');
      alert('Пароль успешно изменён');
    }
  };

  const handleDeleteUser = (id: string) => {
    if (id === user.id) { alert('Нельзя удалить свой аккаунт'); return; }
    if (confirm('Удалить пользователя?')) {
      deleteUser(id);
      setUsers(getUsers());
    }
  };

  const handleToggleActive = (id: string) => {
    if (id === user.id) { alert('Нельзя заблокировать свой аккаунт'); return; }
    toggleUserActive(id);
    setUsers(getUsers());
  };

  const handleChangeRole = (id: string, role: User['role']) => {
    changeUserRole(id, role);
    setUsers(getUsers());
  };

  // Meeting management
  const handleSaveMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMeeting) {
      updateMeeting({ ...meetingForm, id: editingMeeting.id });
    } else {
      addMeeting({ ...meetingForm, id: generateId(), organizerId: user.id });
    }
    setMeetings(getMeetings());
    setShowMeetingForm(false);
    setEditingMeeting(null);
    setMeetingForm(emptyMeeting);
  };

  const handleEditMeeting = (m: Meeting) => {
    setEditingMeeting(m);
    setMeetingForm(m);
    setShowMeetingForm(true);
  };

  const handleDeleteMeeting = (id: string) => {
    if (confirm('Удалить конференцию?')) {
      deleteMeeting(id);
      setMeetings(getMeetings());
    }
  };

  const handleStatusChange = (id: string, status: Meeting['status']) => {
    const meeting = meetings.find(m => m.id === id);
    if (meeting) {
      updateMeeting({ ...meeting, status });
      setMeetings(getMeetings());
    }
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || '—';

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.login.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.department || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMeetings = meetings.filter(m =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.room.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.isActive).length,
    admins: users.filter(u => u.role === 'admin').length,
    totalMeetings: meetings.length,
    scheduled: meetings.filter(m => m.status === 'scheduled').length,
    completed: meetings.filter(m => m.status === 'completed').length,
    cancelled: meetings.filter(m => m.status === 'cancelled').length,
    thisWeek: meetings.filter(m => {
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

  return (
    <div className="space-y-6">
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Пароль {!editingUser && '*'}</label>
                      <input type="text" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                        placeholder={editingUser ? 'Оставьте пустым чтобы не менять' : 'Минимум 6 символов'} />
                    </div>
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
            <button onClick={() => { setShowMeetingForm(true); setEditingMeeting(null); setMeetingForm(emptyMeeting); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <i className="fas fa-plus"></i>Создать
            </button>
          </div>

          {/* Meeting Form Modal */}
          {showMeetingForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                      {editingMeeting ? 'Редактировать конференцию' : 'Новая конференция'}
                    </h2>
                    <button onClick={() => setShowMeetingForm(false)} className="text-gray-400 hover:text-gray-600">
                      <i className="fas fa-times text-xl"></i>
                    </button>
                  </div>

                  <form onSubmit={handleSaveMeeting} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название *</label>
                        <input type="text" required value={meetingForm.title}
                          onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                          placeholder="Название конференции" />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
                        <textarea value={meetingForm.description}
                          onChange={(e) => setMeetingForm({ ...meetingForm, description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                          rows={3} placeholder="Описание конференции" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Дата *</label>
                        <input type="date" required value={meetingForm.date}
                          onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Комната</label>
                        <input type="text" value={meetingForm.room}
                          onChange={(e) => setMeetingForm({ ...meetingForm, room: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                          placeholder="Переговорная №1" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Начало *</label>
                        <input type="time" required value={meetingForm.startTime}
                          onChange={(e) => setMeetingForm({ ...meetingForm, startTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Конец *</label>
                        <input type="time" required value={meetingForm.endTime}
                          onChange={(e) => setMeetingForm({ ...meetingForm, endTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500" />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ссылка на ВКС</label>
                        <input type="url" value={meetingForm.link}
                          onChange={(e) => setMeetingForm({ ...meetingForm, link: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                          placeholder="https://zoom.us/j/..." />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Приоритет</label>
                        <select value={meetingForm.priority}
                          onChange={(e) => setMeetingForm({ ...meetingForm, priority: e.target.value as Meeting['priority'] })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500">
                          <option value="low">Низкий</option>
                          <option value="medium">Средний</option>
                          <option value="high">Высокий</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Напоминание (мин)</label>
                        <input type="number" value={meetingForm.reminderMinutes}
                          onChange={(e) => setMeetingForm({ ...meetingForm, reminderMinutes: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                          min="5" max="1440" />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Участники</label>
                        <div className="flex flex-wrap gap-2">
                          {users.filter(u => u.isActive).map(u => (
                            <button key={u.id} type="button"
                              onClick={() => {
                                const participants = meetingForm.participants.includes(u.id)
                                  ? meetingForm.participants.filter(p => p !== u.id)
                                  : [...meetingForm.participants, u.id];
                                setMeetingForm({ ...meetingForm, participants });
                              }}
                              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                                meetingForm.participants.includes(u.id)
                                  ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                                  : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                              }`}>
                              {u.name.split(' ').slice(0, 2).join(' ')}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 md:col-span-2">
                        <input type="checkbox" id="isPrivate" checked={meetingForm.isPrivate}
                          onChange={(e) => setMeetingForm({ ...meetingForm, isPrivate: e.target.checked })}
                          className="w-4 h-4" />
                        <label htmlFor="isPrivate" className="text-sm text-gray-700 dark:text-gray-300">Приватная конференция</label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-600">
                      <button type="button" onClick={() => setShowMeetingForm(false)}
                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        Отмена
                      </button>
                      <button type="submit"
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        {editingMeeting ? 'Сохранить' : 'Создать'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Meetings Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Название</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Дата</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Организатор</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Статус</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredMeetings.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">{m.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{m.startTime} - {m.endTime} • {m.room || 'Онлайн'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{new Date(m.date).toLocaleDateString('ru-RU')}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{getUserName(m.organizerId)}</td>
                      <td className="px-4 py-3">
                        <select value={m.status} onChange={(e) => handleStatusChange(m.id, e.target.value as Meeting['status'])}
                          className={`text-xs px-2 py-1 rounded-full font-medium border-0 ${
                            m.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                            m.status === 'in-progress' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                            m.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}>
                          <option value="scheduled">Запланирована</option>
                          <option value="in-progress">Идёт</option>
                          <option value="completed">Завершена</option>
                          <option value="cancelled">Отменена</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEditMeeting(m)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-600 rounded" title="Редактировать"><i className="fas fa-edit"></i></button>
                          <button onClick={() => handleDeleteMeeting(m.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-600 rounded" title="Удалить"><i className="fas fa-trash"></i></button>
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

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Пользователей</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.totalUsers}</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">{stats.activeUsers} активных</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Конференций</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.totalMeetings}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{stats.thisWeek} на этой неделе</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Администраторов</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.admins}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Завершено</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.completed}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Статусы конференций</h3>
            <div className="space-y-3">
              {[
                { label: 'Запланированные', count: stats.scheduled, color: 'bg-gray-400' },
                { label: 'Завершённые', count: stats.completed, color: 'bg-green-500' },
                { label: 'Отменённые', count: stats.cancelled, color: 'bg-red-500' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300 w-40">{item.label}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: stats.totalMeetings > 0 ? `${(item.count / stats.totalMeetings) * 100}%` : '0%' }}></div>
                  </div>
                  <span className="text-sm font-medium w-8 text-right text-gray-800 dark:text-gray-100">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
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
                  Пользователь: <strong>{users.find(u => u.id === passwordUserId)?.name}</strong>
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
