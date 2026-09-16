import React, { useState, useEffect } from 'react';
import { MeetingTemplate, Meeting } from '../types';
import { getTemplates, addTemplate, updateTemplate, deleteTemplate, generateId, addMeeting } from '../store';

interface TemplatesProps {
  userId: string;
  onUseTemplate?: (template: MeetingTemplate) => void;
}

export default function Templates({ userId, onUseTemplate }: TemplatesProps) {
  const [templates, setTemplates] = useState<MeetingTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MeetingTemplate | null>(null);

  const emptyTemplate: MeetingTemplate = {
    id: '',
    userId,
    name: '',
    description: '',
    durationMinutes: 60,
    room: '',
    link: '',
    priority: 'medium',
    reminderMinutes: 15,
    recurring: 'none',
    isPrivate: false,
    defaultParticipants: [],
    createdAt: new Date().toISOString(),
  };

  const [formData, setFormData] = useState<MeetingTemplate>(emptyTemplate);

  useEffect(() => {
    setTemplates(getTemplates().filter(t => t.userId === userId));
  }, [userId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Введите название шаблона');
      return;
    }

    if (editingTemplate) {
      updateTemplate({ ...formData, id: editingTemplate.id });
    } else {
      addTemplate({ ...formData, id: generateId() });
    }

    setTemplates(getTemplates().filter(t => t.userId === userId));
    setShowForm(false);
    setEditingTemplate(null);
    setFormData(emptyTemplate);
  };

  const handleEdit = (template: MeetingTemplate) => {
    setEditingTemplate(template);
    setFormData(template);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить шаблон?')) {
      deleteTemplate(id);
      setTemplates(getTemplates().filter(t => t.userId === userId));
    }
  };

  const handleUseTemplate = (template: MeetingTemplate) => {
    if (onUseTemplate) {
      onUseTemplate(template);
    } else {
      // Создать новую конференцию из шаблона
      const newMeeting: Meeting = {
        id: generateId(),
        title: template.name,
        description: template.description,
        date: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        endTime: `${10 + Math.floor(template.durationMinutes / 60)}:${(template.durationMinutes % 60).toString().padStart(2, '0')}`,
        organizerId: userId,
        participants: template.defaultParticipants,
        participantEmails: [],
        link: template.link,
        room: template.room,
        status: 'scheduled',
        reminderMinutes: template.reminderMinutes,
        recurring: template.recurring,
        priority: template.priority,
        createdAt: new Date().toISOString(),
        isPrivate: template.isPrivate,
      };
      addMeeting(newMeeting);
      alert('Конференция создана из шаблона!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          <i className="fas fa-copy mr-2 text-blue-500"></i>
          Шаблоны конференций
        </h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingTemplate(null);
            setFormData(emptyTemplate);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <i className="fas fa-plus mr-2"></i>
          Создать шаблон
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  {editingTemplate ? 'Редактировать шаблон' : 'Новый шаблон'}
                </h3>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Название шаблона *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="Например: Еженедельный стендап"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Описание
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Длительность (мин)
                    </label>
                    <input
                      type="number"
                      value={formData.durationMinutes}
                      onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Комната
                    </label>
                    <input
                      type="text"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ссылка на ВКС
                  </label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="https://..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Приоритет
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="low">Низкий</option>
                      <option value="medium">Средний</option>
                      <option value="high">Высокий</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Напоминание (мин)
                    </label>
                    <input
                      type="number"
                      value={formData.reminderMinutes}
                      onChange={(e) => setFormData({ ...formData, reminderMinutes: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Повторение
                    </label>
                    <select
                      value={formData.recurring}
                      onChange={(e) => setFormData({ ...formData, recurring: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="none">Не повторять</option>
                      <option value="daily">Ежедневно</option>
                      <option value="weekly">Еженедельно</option>
                      <option value="monthly">Ежемесячно</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPrivate"
                    checked={formData.isPrivate}
                    onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="isPrivate" className="text-sm text-gray-700 dark:text-gray-300">
                    Приватная конференция
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-600">
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
                    {editingTemplate ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(template => (
          <div
            key={template.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg">
                {template.name}
              </h3>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  template.priority === 'high'
                    ? 'bg-red-100 text-red-700'
                    : template.priority === 'medium'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {template.priority === 'high' ? 'Высокий' : template.priority === 'medium' ? 'Средний' : 'Низкий'}
              </span>
            </div>

            {template.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{template.description}</p>
            )}

            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
              <p>
                <i className="far fa-clock mr-2"></i>
                {template.durationMinutes} мин
              </p>
              {template.room && (
                <p>
                  <i className="fas fa-map-marker-alt mr-2"></i>
                  {template.room}
                </p>
              )}
              {template.recurring !== 'none' && (
                <p>
                  <i className="fas fa-sync mr-2"></i>
                  {template.recurring === 'daily' ? 'Ежедневно' : template.recurring === 'weekly' ? 'Еженедельно' : 'Ежемесячно'}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleUseTemplate(template)}
                className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <i className="fas fa-play mr-1"></i>
                Использовать
              </button>
              <button
                onClick={() => handleEdit(template)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg"
              >
                <i className="fas fa-edit"></i>
              </button>
              <button
                onClick={() => handleDelete(template.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded-lg"
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <i className="fas fa-copy text-5xl mb-4"></i>
          <p className="text-lg">Нет шаблонов</p>
          <p className="text-sm mt-2">Создайте шаблон для быстрого создания конференций</p>
        </div>
      )}
    </div>
  );
}
