import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface MeetingTemplate {
  id: string;
  name: string;
  description: string;
  duration: number;
  room: string;
  link: string;
  priority: 'low' | 'medium' | 'high';
  reminderMinutes: number;
  recurring: 'none' | 'daily' | 'weekly' | 'monthly';
  isPrivate: boolean;
  createdAt: string;
}

interface TemplatesProps {
  user: User;
}

export default function Templates({ user }: TemplatesProps) {
  const [templates, setTemplates] = useState<MeetingTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MeetingTemplate | null>(null);

  const emptyTemplate: MeetingTemplate = {
    id: '',
    name: '',
    description: '',
    duration: 60,
    room: '',
    link: '',
    priority: 'medium',
    reminderMinutes: 15,
    recurring: 'none',
    isPrivate: false,
    createdAt: new Date().toISOString(),
  };

  const [formData, setFormData] = useState<MeetingTemplate>(emptyTemplate);

  useEffect(() => {
    const data = localStorage.getItem('vks_templates');
    if (data) {
      setTemplates(JSON.parse(data));
    }
  }, []);

  const saveTemplates = (newTemplates: MeetingTemplate[]) => {
    localStorage.setItem('vks_templates', JSON.stringify(newTemplates));
    setTemplates(newTemplates);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTemplate) {
      const updated = templates.map(t => t.id === editingTemplate.id ? { ...formData, id: editingTemplate.id } : t);
      saveTemplates(updated);
    } else {
      const newTemplate = { ...formData, id: Date.now().toString() };
      saveTemplates([...templates, newTemplate]);
    }

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
      saveTemplates(templates.filter(t => t.id !== id));
    }
  };

  const handleUseTemplate = (template: MeetingTemplate) => {
    // Перенаправляем на создание конференции с предзаполненными данными
    const params = new URLSearchParams({
      title: template.name,
      description: template.description,
      duration: template.duration.toString(),
      room: template.room,
      link: template.link,
      priority: template.priority,
      reminderMinutes: template.reminderMinutes.toString(),
      recurring: template.recurring,
      isPrivate: template.isPrivate.toString(),
    });
    window.location.href = `/meetings?create=1&${params.toString()}`;
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
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
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
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    : template.priority === 'medium'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
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
                {template.duration} мин
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
