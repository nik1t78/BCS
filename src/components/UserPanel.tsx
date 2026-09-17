import React, { useState, useEffect } from 'react';
import { User, Meeting } from '../types';
import { getMeetings, addMeeting, updateMeeting, deleteMeeting, generateId, getUsers } from '../store';

interface UserPanelProps {
  user: User;
  onNavigate: (page: string) => void;
}

export default function UserPanel({ user, onNavigate }: UserPanelProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [filter, setFilter] = useState<'all' | 'organized' | 'participating'>('all');
  const [allUsers, setAllUsers] = useState(getUsers());

  const emptyMeeting: Meeting = {
    id: '',
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '11:00',
    organizerId: user.id,
    participants: [user.id],
    participantEmails: [],
    link: '',
    room: '',
    status: 'scheduled',
    reminderMinutes: 15,
    recurring: 'none',
    priority: 'medium',
    createdAt: new Date().toISOString(),
    isPrivate: false,
  };

  const [formData, setFormData] = useState<Meeting>(emptyMeeting);

  useEffect(() => {
    const allMeetings = getMeetings();
    const myMeetings = allMeetings.filter(m => 
      m.organizerId === user.id || m.participants.includes(user.id)
    );
    setMeetings(myMeetings);
    
    // Обновляем список пользователей при открытии формы
    setAllUsers(getUsers());
  }, [user.id, showForm]);

  const filteredMeetings = meetings.filter(m => {
    if (filter === 'organized') return m.organizerId === user.id;
    if (filter === 'participating') return m.participants.includes(user.id) && m.organizerId !== user.id;
    return true;
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

    const allMeetings = getMeetings();
    const myMeetings = allMeetings.filter(m => 
      m.organizerId === user.id || m.participants.includes(user.id)
    );
    setMeetings(myMeetings);
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
      const allMeetings = getMeetings();
      const myMeetings = allMeetings.filter(m => 
        m.organizerId === user.id || m.participants.includes(user.id)
      );
      setMeetings(myMeetings);
    }
  };

  const toggleParticipant = (userId: string) => {
    const participants = formData.participants.includes(userId)
      ? formData.participants.filter(id => id !== userId)
      : [...formData.participants, userId];
    setFormData({ ...formData, participants });
  };

  const getUserName = (id: string) => allUsers.find(u => u.id === id)?.name || 'Неизвестный';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {(['all', 'organized', 'participating'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {f === 'all' ? 'Все' : f === 'organized' ? 'Организованные' : 'Участие'}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingMeeting(null);
            setFormData(emptyMeeting);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <i className="fas fa-plus"></i>
          Создать конференцию
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  {editingMeeting ? 'Редактировать конференцию' : 'Новая конференция'}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название *</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="Название конференции"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Дата *</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Комната</label>
                    <input
                      type="text"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="Переговорная №1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Начало *</label>
                    <input
                      type="time"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Конец *</label>
                    <input
                      type="time"
                      required
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ссылка ВКС</label>
                    <input
                      type="url"
                      value={formData.link}
                      onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="https://zoom.us/..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Приоритет</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as Meeting['priority'] })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="low">Низкий</option>
                      <option value="medium">Средний</option>
                      <option value="high">Высокий</option>
                    </select>
                  </div>
                </div>

                {/* Participants */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Участники ({formData.participants.length} выбрано)
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    <i className="fas fa-info-circle mr-1"></i>
                    Выберите зарегистрированных пользователей из списка ниже
                  </p>
                  
                  {allUsers.length === 0 ? (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <i className="fas fa-exclamation-triangle mr-2"></i>
                        В системе нет зарегистрированных пользователей. 
                        Попросите администратора создать пользователей или зарегистрируйтесь сами.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 max-h-64 overflow-y-auto">
                      <div className="space-y-2">
                        {allUsers.filter(u => u.isActive).map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleParticipant(u.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center gap-3 ${
                              formData.participants.includes(u.id)
                                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              formData.participants.includes(u.id)
                                ? 'bg-blue-600 border-blue-600'
                                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500'
                            }`}>
                              {formData.participants.includes(u.id) && (
                                <i className="fas fa-check text-white text-xs"></i>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-800 dark:text-gray-100 text-sm">
                                  {u.name}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  u.role === 'admin' 
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                    : u.role === 'moderator'
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                    : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                                }`}>
                                  {u.role === 'admin' ? 'Админ' : u.role === 'moderator' ? 'Модератор' : 'Пользователь'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                @{u.login}
                                {u.department && <span className="ml-2">• {u.department}</span>}
                                {u.position && <span className="ml-2">• {u.position}</span>}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {formData.participants.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                        Выбранные участники:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {formData.participants.map(participantId => {
                          const participant = allUsers.find(u => u.id === participantId);
                          if (!participant) return null;
                          return (
                            <span
                              key={participantId}
                              className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full text-xs"
                            >
                              <i className="fas fa-user text-xs"></i>
                              {participant.name.split(' ')[0]}
                              <button
                                type="button"
                                onClick={() => toggleParticipant(participantId)}
                                className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                              >
                                <i className="fas fa-times text-xs"></i>
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
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
        {filteredMeetings.map(meeting => (
          <div
            key={meeting.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">{meeting.title}</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      meeting.priority === 'high'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        : meeting.priority === 'medium'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    }`}
                  >
                    {meeting.priority === 'high' ? 'Высокий' : meeting.priority === 'medium' ? 'Средний' : 'Низкий'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <i className="far fa-calendar mr-1"></i>
                  {new Date(meeting.date).toLocaleDateString('ru-RU')}
                  <span className="mx-2">•</span>
                  <i className="far fa-clock mr-1"></i>
                  {meeting.startTime} - {meeting.endTime}
                  {meeting.room && (
                    <>
                      <span className="mx-2">•</span>
                      <i className="fas fa-map-marker-alt mr-1"></i>
                      {meeting.room}
                    </>
                  )}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  <i className="fas fa-user mr-1"></i>
                  Организатор: {getUserName(meeting.organizerId)}
                  <span className="mx-2">•</span>
                  <i className="fas fa-users mr-1"></i>
                  {meeting.participants.length} участников
                </p>
              </div>
              <div className="flex items-center gap-2">
                {meeting.link && (
                  <a
                    href={meeting.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                  >
                    <i className="fas fa-video mr-1"></i>Войти
                  </a>
                )}
                {meeting.organizerId === user.id && (
                  <>
                    <button
                      onClick={() => handleEdit(meeting)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      onClick={() => handleDelete(meeting.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredMeetings.length === 0 && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <i className="fas fa-video text-4xl mb-3"></i>
            <p>Нет конференций</p>
          </div>
        )}
      </div>
    </div>
  );
}
