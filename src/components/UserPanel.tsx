import React, { useState, useEffect } from 'react';
import { User, Meeting } from '../types';
import { getMeetings, getUsers, addMeeting, updateMeeting, deleteMeeting, generateId } from '../store';

interface UserPanelProps {
  user: User;
  onNavigate: (page: string) => void;
}

export default function UserPanel({ user, onNavigate }: UserPanelProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filter, setFilter] = useState<'all' | 'organized' | 'participating' | 'upcoming'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const emptyMeeting: Meeting = {
    id: '', title: '', description: '', date: new Date().toISOString().split('T')[0],
    startTime: '10:00', endTime: '11:00', organizerId: user.id, participants: [user.id],
    participantEmails: [], link: '', room: '', status: 'scheduled', reminderMinutes: 15,
    recurring: 'none', priority: 'medium', createdAt: new Date().toISOString(), isPrivate: false,
  };

  const [formData, setFormData] = useState<Meeting>(emptyMeeting);
  const [emailInput, setEmailInput] = useState('');
  const allUsers = getUsers();

  useEffect(() => { setMeetings(getMeetings()); }, []);

  const myMeetings = meetings.filter(m => m.participants.includes(user.id) || m.organizerId === user.id);

  const filtered = myMeetings.filter(m => {
    if (filter === 'organized') return m.organizerId === user.id;
    if (filter === 'participating') return m.participants.includes(user.id) && m.organizerId !== user.id;
    if (filter === 'upcoming') return m.date >= new Date().toISOString().split('T')[0] && m.status !== 'completed' && m.status !== 'cancelled';
    return true;
  }).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.startTime || !formData.endTime) {
      alert('Заполните все обязательные поля');
      return;
    }
    if (editingMeeting) {
      updateMeeting({ ...formData, id: editingMeeting.id });
    } else {
      addMeeting({ ...formData, id: generateId() });
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
    if (confirm('Удалить конференцию?')) {
      deleteMeeting(id);
      setMeetings(getMeetings());
    }
  };

  const addEmailParticipant = () => {
    if (emailInput.trim() && emailInput.includes('@')) {
      setFormData({ ...formData, participantEmails: [...formData.participantEmails, emailInput.trim()] });
      setEmailInput('');
    }
  };

  const toggleUserParticipant = (userId: string) => {
    const participants = formData.participants.includes(userId)
      ? formData.participants.filter(p => p !== userId)
      : [...formData.participants, userId];
    setFormData({ ...formData, participants });
  };

  const getUserName = (id: string) => allUsers.find(u => u.id === id)?.name || 'Неизвестный';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'organized', 'participating', 'upcoming'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
              {f === 'all' ? 'Все' : f === 'organized' ? 'Организованные' : f === 'participating' ? 'Участие' : 'Ближайшие'}
            </button>
          ))}
        </div>
        <button onClick={() => { setShowForm(true); setEditingMeeting(null); setFormData(emptyMeeting); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
          <i className="fas fa-plus"></i>Создать конференцию
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">{editingMeeting ? 'Редактировать' : 'Новая конференция'}</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times text-xl"></i></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                    <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" placeholder="Название" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                    <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" rows={2} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Дата *</label>
                    <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Комната</label>
                    <input type="text" value={formData.room} onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" placeholder="Переговорная" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Начало *</label>
                    <input type="time" required value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Конец *</label>
                    <input type="time" required value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ссылка ВКС</label>
                    <input type="url" value={formData.link} onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Приоритет</label>
                    <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as Meeting['priority'] })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500">
                      <option value="low">Низкий</option>
                      <option value="medium">Средний</option>
                      <option value="high">Высокий</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Напоминание</label>
                    <select value={formData.reminderMinutes} onChange={(e) => setFormData({ ...formData, reminderMinutes: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500">
                      <option value={5}>5 мин</option>
                      <option value={10}>10 мин</option>
                      <option value={15}>15 мин</option>
                      <option value={30}>30 мин</option>
                      <option value={60}>1 час</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Повторение</label>
                    <select value={formData.recurring} onChange={(e) => setFormData({ ...formData, recurring: e.target.value as Meeting['recurring'] })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500">
                      <option value="none">Не повторять</option>
                      <option value="daily">Ежедневно</option>
                      <option value="weekly">Еженедельно</option>
                      <option value="monthly">Ежемесячно</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="private" checked={formData.isPrivate}
                      onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })} className="w-4 h-4" />
                    <label htmlFor="private" className="text-sm text-gray-700">Приватная конференция</label>
                  </div>
                </div>

                {/* Participants */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Участники (пользователи системы)</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {allUsers.filter(u => u.isActive).map(u => (
                      <button key={u.id} type="button" onClick={() => toggleUserParticipant(u.id)}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                          formData.participants.includes(u.id) ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}>
                        {u.name.split(' ').slice(0, 2).join(' ')}
                      </button>
                    ))}
                  </div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Внешние участники (email)</label>
                  <div className="flex gap-2">
                    <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmailParticipant(); } }}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" placeholder="email@example.com" />
                    <button type="button" onClick={addEmailParticipant} className="bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200">
                      <i className="fas fa-plus text-gray-600"></i>
                    </button>
                  </div>
                  {formData.participantEmails.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.participantEmails.map((email, i) => (
                        <span key={i} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-sm">
                          {email}
                          <button type="button" onClick={() => setFormData({ ...formData, participantEmails: formData.participantEmails.filter((_, idx) => idx !== i) })}
                            className="text-gray-400 hover:text-red-500"><i className="fas fa-times text-xs"></i></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Отмена</button>
                  <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    {editingMeeting ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Meetings List */}
      <div className="space-y-3">
        {filtered.map(meeting => (
          <div key={meeting.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-800">{meeting.title}</h3>
                  {meeting.isPrivate && <i className="fas fa-lock text-gray-400 text-sm"></i>}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    meeting.priority === 'high' ? 'bg-red-100 text-red-700' :
                    meeting.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                  }`}>{meeting.priority === 'high' ? 'Высокий' : meeting.priority === 'medium' ? 'Средний' : 'Низкий'}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  <i className="far fa-calendar mr-1"></i>{new Date(meeting.date).toLocaleDateString('ru-RU')}
                  <span className="ml-3"><i className="far fa-clock mr-1"></i>{meeting.startTime} - {meeting.endTime}</span>
                  {meeting.room && <span className="ml-3"><i className="fas fa-map-marker-alt mr-1"></i>{meeting.room}</span>}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  <i className="fas fa-user mr-1"></i>Организатор: {getUserName(meeting.organizerId)}
                  <span className="ml-3"><i className="fas fa-users mr-1"></i>{meeting.participants.length + meeting.participantEmails.length} участников</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {meeting.link && (
                  <a href={meeting.link} target="_blank" rel="noopener noreferrer"
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors">
                    <i className="fas fa-video mr-1"></i>Войти
                  </a>
                )}
                {meeting.organizerId === user.id && (
                  <>
                    <button onClick={() => handleEdit(meeting)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><i className="fas fa-edit"></i></button>
                    <button onClick={() => handleDelete(meeting.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><i className="fas fa-trash"></i></button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl shadow-sm border border-gray-100">
            <i className="fas fa-video text-4xl mb-3"></i>
            <p>Нет конференций</p>
          </div>
        )}
      </div>
    </div>
  );
}
