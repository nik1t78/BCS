import React, { useState, useEffect } from 'react';
import { User, Meeting } from '../types';
import { getMeetings, createMeeting, updateMeeting, deleteMeeting, getUsersForDisplay } from '../store-api';
import TagsSelector from './TagsSelector';

interface UserPanelProps {
  user: User;
  onNavigate: (page: string) => void;
}

export default function UserPanel({ user, onNavigate }: UserPanelProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Модальное окно просмотра конференции (доступен всем участникам)
  const [viewMeeting, setViewMeeting] = useState<Meeting | null>(null);

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
    loadData();
  }, [user.id, showForm]);

  const loadData = async () => {
    setLoading(true);
    const [allMeetings, allUsers] = await Promise.all([getMeetings(), getUsersForDisplay(user.role)]);
    
    // Модераторы и админы видят все конференции, обычные пользователи - тоже все
    // (но могут редактировать только свои)
    setMeetings(allMeetings);
    setUsers(allUsers);
    // getMeetings при ошибке API (401/500/нет связи с бэкендом) возвращает [] —
    // показываем явную ошибку вместо пустого «Нет конференций»
    setError(allMeetings.length === 0 && allUsers.length === 0);
    setLoading(false);
  };

  // Все конференции видны в списке без фильтров «Организованные/Участие»
  const filteredMeetings = meetings;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.startTime || !formData.endTime) {
      alert('Заполните все обязательные поля');
      return;
    }
    if (formData.endTime <= formData.startTime) {
      alert('Время окончания должно быть позже времени начала');
      return;
    }

    // createMeeting/updateMeeting возвращают null при ошибке сервера
    // (422 валидация, истёкший токен и т.п.) — без проверки форма
    // «тихо» закрывалась, и казалось, что создание конференции не работает.
    const payload: Meeting = { ...formData };
    if (payload.recurring === 'none') delete payload.repeatUntil;
    else if (payload.repeatUntil && payload.repeatUntil < payload.date) {
      alert('Дата окончания повтора не может быть раньше даты встречи');
      return;
    }
    const saved = editingMeeting
      ? await updateMeeting(editingMeeting.id, payload)
      : await createMeeting(payload);

    if (!saved) {
      alert('Не удалось сохранить конференцию. Проверьте поля: время начала должно быть раньше времени окончания, ссылка — корректный URL, напоминание — от 5 до 1440 минут.');
      return;
    }

    loadData();
    setShowForm(false);
    setEditingMeeting(null);
    setFormData(emptyMeeting);
  };

  const handleEdit = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setFormData(meeting);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Удалить конференцию?')) {
      await deleteMeeting(id);
      loadData();
    }
  };

  // ID из API приходят числами, а user.id — строка; сравниваем через Number,
  // иначе фильтры «Организованные/Участие» и кнопки редактирования не срабатывают
  const isOrganizer = (m: Meeting) => Number(m.organizerId) === Number(user.id);
  const isParticipant = (m: Meeting) => (m.participants ?? []).some((p) => Number(p) === Number(user.id));

  const toggleParticipant = (userId: string) => {
    const participants = formData.participants.includes(userId)
      ? formData.participants.filter(id => id !== userId)
      : [...formData.participants, userId];
    setFormData({ ...formData, participants });
  };

  const getUserName = (id: string) => users.find(u => Number(u.id) === Number(id))?.name || 'Неизвестный';

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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Повтор</label>
                    <select
                      value={formData.recurring}
                      onChange={(e) => setFormData({ ...formData, recurring: e.target.value as Meeting['recurring'] })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="none">Без повтора</option>
                      <option value="daily">Ежедневно</option>
                      <option value="weekly">Еженедельно</option>
                      <option value="monthly">Ежемесячно</option>
                    </select>
                  </div>
                  {formData.recurring !== 'none' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Повторять до (опционально)
                      </label>
                      <input
                        type="date"
                        value={formData.repeatUntil ?? ''}
                        min={formData.date}
                        onChange={(e) => setFormData({ ...formData, repeatUntil: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
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
                  
                  {users.length === 0 ? (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <i className="fas fa-exclamation-triangle mr-2"></i>
                        В системе нет зарегистрированных пользователей.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 max-h-64 overflow-y-auto">
                      <div className="space-y-2">
                        {users.filter(u => u.isActive).map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleParticipant(u.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center gap-3 ${
                              (formData.participants ?? []).some((id) => String(id) === String(u.id))
                                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              (formData.participants ?? []).some((id) => String(id) === String(u.id))
                                ? 'bg-blue-600 border-blue-600'
                                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500'
                            }`}>
                              {(formData.participants ?? []).some((id) => String(id) === String(u.id)) && (
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
                              </div>
                            </div>
                          </button>
                        ))}
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

      {/* Просмотр конференции — доступен всем, кто видит конференцию в списке */}
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
                  {isOrganizer(vm) && (
                    <button
                      onClick={() => { setViewMeeting(null); handleEdit(vm); }}
                      className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      <i className="fas fa-edit mr-1"></i>Редактировать
                    </button>
                  )}
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

      {/* Meetings List */}
      {error && filteredMeetings.length === 0 ? (
        <div className="text-center py-12 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl">
          <i className="fas fa-plug text-4xl text-yellow-500 mb-3"></i>
          <p className="text-yellow-800 dark:text-yellow-200 font-medium">Не удалось загрузить данные с сервера</p>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            Проверьте, что бэкенд запущен (<code>php artisan serve</code> или контейнер <code>vks-backend</code>) и выполнены миграции.
          </p>
          <button onClick={loadData} className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm">
            <i className="fas fa-redo mr-1"></i> Повторить
          </button>
        </div>
      ) : (
      <div className="space-y-3">
        {filteredMeetings.map(meeting => (
          <div
            key={meeting.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setViewMeeting(meeting)}
                    className="font-bold text-gray-800 dark:text-gray-100 hover:text-blue-600 text-left"
                    title="Открыть конференцию"
                  >
                    {meeting.title}
                  </button>
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
                  {meeting.recurring !== 'none' && (
                    <>
                      <span className="mx-2">•</span>
                      <i className="fas fa-sync-alt text-blue-500 mr-1"></i>
                      <span className="text-blue-600 dark:text-blue-400">
                        {meeting.recurring === 'daily' ? 'Ежедневно' : meeting.recurring === 'weekly' ? 'Еженедельно' : 'Ежемесячно'}
                        {meeting.repeatUntil ? ` до ${new Date(meeting.repeatUntil).toLocaleDateString('ru-RU')}` : ''}
                      </span>
                    </>
                  )}
                </p>
                {meeting.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2 whitespace-pre-line">
                    {meeting.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMeeting(meeting)}
                  className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <i className="fas fa-eye mr-1"></i>Просмотр
                </button>
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
                {isOrganizer(meeting) && (
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
      )}
    </div>
  );
}
