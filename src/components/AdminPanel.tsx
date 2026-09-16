import React, { useState, useEffect } from 'react';
import { Meeting, Settings } from '../types';
import { getMeetings, addMeeting, updateMeeting, deleteMeeting, getSettings, saveSettings, generateId } from '../store';

export default function AdminPanel() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [settings, setSettings] = useState<Settings>(getSettings());
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'meetings' | 'settings' | 'stats'>('meetings');
  const [searchQuery, setSearchQuery] = useState('');

  const emptyMeeting: Meeting = {
    id: '',
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '11:00',
    participants: [],
    link: '',
    room: '',
    status: 'scheduled',
    reminderMinutes: 15,
    recurring: 'none',
    priority: 'medium',
    createdAt: new Date().toISOString(),
  };

  const [formData, setFormData] = useState<Meeting>(emptyMeeting);
  const [participantInput, setParticipantInput] = useState('');

  useEffect(() => {
    setMeetings(getMeetings());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.startTime || !formData.endTime) {
      alert('Заполните все обязательные поля');
      return;
    }

    if (editingMeeting) {
      const updated = { ...formData, id: editingMeeting.id };
      updateMeeting(updated);
    } else {
      const newMeeting = { ...formData, id: generateId() };
      addMeeting(newMeeting);
    }

    setMeetings(getMeetings());
    setShowForm(false);
    setEditingMeeting(null);
    setFormData(emptyMeeting);
  };

  const handleEdit = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setFormData(meeting);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Вы уверены, что хотите удалить эту конференцию?')) {
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

  const addParticipant = () => {
    if (participantInput.trim()) {
      setFormData({
        ...formData,
        participants: [...formData.participants, participantInput.trim()]
      });
      setParticipantInput('');
    }
  };

  const removeParticipant = (index: number) => {
    setFormData({
      ...formData,
      participants: formData.participants.filter((_, i) => i !== index)
    });
  };

  const handleSettingsSave = () => {
    saveSettings(settings);
    alert('Настройки сохранены!');
  };

  const filteredMeetings = meetings.filter(m =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.participants.some(p => p.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const stats = {
    total: meetings.length,
    scheduled: meetings.filter(m => m.status === 'scheduled').length,
    inProgress: meetings.filter(m => m.status === 'in-progress').length,
    completed: meetings.filter(m => m.status === 'completed').length,
    cancelled: meetings.filter(m => m.status === 'cancelled').length,
    thisWeek: meetings.filter(m => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const mDate = new Date(m.date);
      return mDate >= weekStart && mDate <= weekEnd;
    }).length,
    highPriority: meetings.filter(m => m.priority === 'high').length,
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-2">
        <div className="flex gap-1">
          {[
            { id: 'meetings', label: 'Управление', icon: 'fa-video' },
            { id: 'settings', label: 'Настройки', icon: 'fa-cog' },
            { id: 'stats', label: 'Статистика', icon: 'fa-chart-bar' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              <i className={`fas ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meetings Tab */}
      {activeTab === 'meetings' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="Поиск по названию, комнате, участникам..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <button onClick={() => { setShowForm(true); setEditingMeeting(null); setFormData(emptyMeeting); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
              <i className="fas fa-plus"></i>
              Новая конференция
            </button>
          </div>

          {/* Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-800">
                      {editingMeeting ? 'Редактировать конференцию' : 'Новая конференция'}
                    </h2>
                    <button onClick={() => { setShowForm(false); setEditingMeeting(null); }}
                      className="text-gray-400 hover:text-gray-600 text-xl">
                      <i className="fas fa-times"></i>
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                        <input type="text" required value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="Название конференции" />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                        <textarea value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          rows={2} placeholder="Описание конференции" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Дата *</label>
                        <input type="date" required value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Комната / Переговорная</label>
                        <input type="text" value={formData.room}
                          onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="Например: Переговорная №3" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Начало *</label>
                        <input type="time" required value={formData.startTime}
                          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Конец *</label>
                        <input type="time" required value={formData.endTime}
                          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ссылка на ВКС</label>
                        <input type="url" value={formData.link}
                          onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="https://meet.example.com/..." />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Приоритет</label>
                        <select value={formData.priority}
                          onChange={(e) => setFormData({ ...formData, priority: e.target.value as Meeting['priority'] })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                          <option value="low">Низкий</option>
                          <option value="medium">Средний</option>
                          <option value="high">Высокий</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Напоминание (мин)</label>
                        <select value={formData.reminderMinutes}
                          onChange={(e) => setFormData({ ...formData, reminderMinutes: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                          <option value={5}>5 минут</option>
                          <option value={10}>10 минут</option>
                          <option value={15}>15 минут</option>
                          <option value={30}>30 минут</option>
                          <option value={60}>1 час</option>
                          <option value={1440}>1 день</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Повторение</label>
                        <select value={formData.recurring}
                          onChange={(e) => setFormData({ ...formData, recurring: e.target.value as Meeting['recurring'] })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                          <option value="none">Не повторять</option>
                          <option value="daily">Ежедневно</option>
                          <option value="weekly">Еженедельно</option>
                          <option value="monthly">Ежемесячно</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
                        <select value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as Meeting['status'] })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                          <option value="scheduled">Запланирована</option>
                          <option value="in-progress">Идёт</option>
                          <option value="completed">Завершена</option>
                          <option value="cancelled">Отменена</option>
                        </select>
                      </div>

                      {/* Participants */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Участники</label>
                        <div className="flex gap-2">
                          <input type="text" value={participantInput}
                            onChange={(e) => setParticipantInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addParticipant(); } }}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="Имя участника" />
                          <button type="button" onClick={addParticipant}
                            className="bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors">
                            <i className="fas fa-plus text-gray-600"></i>
                          </button>
                        </div>
                        {formData.participants.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {formData.participants.map((p, i) => (
                              <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-sm">
                                <i className="fas fa-user text-xs"></i>
                                {p}
                                <button type="button" onClick={() => removeParticipant(i)}
                                  className="ml-1 text-blue-400 hover:text-blue-600">
                                  <i className="fas fa-times text-xs"></i>
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <button type="button" onClick={() => { setShowForm(false); setEditingMeeting(null); }}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
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

          {/* Meetings List */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Название</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Дата</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Время</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Комната</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Статус</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredMeetings.map(meeting => (
                    <tr key={meeting.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-800">{meeting.title}</p>
                          <p className="text-xs text-gray-500">{meeting.participants.length} участников</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(meeting.date).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {meeting.startTime} - {meeting.endTime}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {meeting.room || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <select value={meeting.status}
                          onChange={(e) => handleStatusChange(meeting.id, e.target.value as Meeting['status'])}
                          className={`text-xs px-2 py-1 rounded-full border-0 font-medium ${
                            meeting.status === 'completed' ? 'bg-green-100 text-green-700' :
                            meeting.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                            meeting.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                          <option value="scheduled">Запланирована</option>
                          <option value="in-progress">Идёт</option>
                          <option value="completed">Завершена</option>
                          <option value="cancelled">Отменена</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEdit(meeting)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Редактировать">
                            <i className="fas fa-edit"></i>
                          </button>
                          <button onClick={() => handleDelete(meeting.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Удалить">
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredMeetings.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <i className="fas fa-video text-4xl mb-3"></i>
                  <p>Нет конференций</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Настройки системы</h2>
          <div className="space-y-6 max-w-lg">
            <div>
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">Звуковые уведомления</p>
                  <p className="text-sm text-gray-500">Воспроизводить звук при напоминании</p>
                </div>
                <input type="checkbox" checked={settings.soundEnabled}
                  onChange={(e) => setSettings({ ...settings, soundEnabled: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded" />
              </label>
            </div>

            <div>
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">Браузерные уведомления</p>
                  <p className="text-sm text-gray-500">Показывать системные уведомления</p>
                </div>
                <input type="checkbox" checked={settings.browserNotifications}
                  onChange={(e) => setSettings({ ...settings, browserNotifications: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded" />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Напоминание по умолчанию</label>
              <select value={settings.defaultReminderMinutes}
                onChange={(e) => setSettings({ ...settings, defaultReminderMinutes: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <option value={5}>5 минут</option>
                <option value={10}>10 минут</option>
                <option value={15}>15 минут</option>
                <option value={30}>30 минут</option>
                <option value={60}>1 час</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Начало рабочего дня</label>
                <input type="time" value={settings.workHoursStart}
                  onChange={(e) => setSettings({ ...settings, workHoursStart: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Конец рабочего дня</label>
                <input type="time" value={settings.workHoursEnd}
                  onChange={(e) => setSettings({ ...settings, workHoursEnd: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>

            <button onClick={handleSettingsSave}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              <i className="fas fa-save mr-2"></i>Сохранить настройки
            </button>
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <p className="text-sm text-gray-500">Всего конференций</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <p className="text-sm text-gray-500">На этой неделе</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{stats.thisWeek}</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <p className="text-sm text-gray-500">Высокий приоритет</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.highPriority}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Распределение по статусам</h3>
            <div className="space-y-3">
              {[
                { label: 'Запланированные', count: stats.scheduled, color: 'bg-gray-400', icon: 'fa-clock' },
                { label: 'В процессе', count: stats.inProgress, color: 'bg-blue-500', icon: 'fa-play' },
                { label: 'Завершённые', count: stats.completed, color: 'bg-green-500', icon: 'fa-check' },
                { label: 'Отменённые', count: stats.cancelled, color: 'bg-red-500', icon: 'fa-times' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <i className={`fas ${item.icon} text-gray-400 w-5`}></i>
                  <span className="text-sm text-gray-600 w-40">{item.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all`}
                      style={{ width: stats.total > 0 ? `${(item.count / stats.total) * 100}%` : '0%' }}></div>
                  </div>
                  <span className="text-sm font-medium text-gray-800 w-8 text-right">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Быстрые действия</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button onClick={() => {
                if (confirm('Отменить все незавершённые конференции?')) {
                  meetings.filter(m => m.status === 'scheduled').forEach(m => {
                    updateMeeting({ ...m, status: 'cancelled' });
                  });
                  setMeetings(getMeetings());
                }
              }} className="p-4 bg-red-50 border border-red-200 rounded-lg text-left hover:bg-red-100 transition-colors">
                <p className="font-medium text-red-700">Отменить все запланированные</p>
                <p className="text-sm text-red-500">Массовая отмена</p>
              </button>
              <button onClick={() => {
                if (confirm('Удалить все завершённые конференции?')) {
                  meetings.filter(m => m.status === 'completed').forEach(m => {
                    deleteMeeting(m.id);
                  });
                  setMeetings(getMeetings());
                }
              }} className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-left hover:bg-gray-100 transition-colors">
                <p className="font-medium text-gray-700">Очистить завершённые</p>
                <p className="text-sm text-gray-500">Удалить из истории</p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
