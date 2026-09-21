import React, { useState, useEffect } from 'react';
import { User, Tag } from '../types';
import { getTags, createTag, updateTag, deleteTag } from '../store-api';

interface TagsManagerProps {
  userId: string;
}

export default function TagsManager({ userId }: TagsManagerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#3b82f6');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    setLoading(true);
    try {
      const data = await getTags();
      setTags(data);
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tagName.trim()) {
      alert('Введите название тега');
      return;
    }

    try {
      if (editingTag) {
        await updateTag(editingTag.id, { name: tagName, color: tagColor });
      } else {
        await createTag({ name: tagName, color: tagColor, userId });
      }

      await loadTags();
      setShowForm(false);
      setEditingTag(null);
      setTagName('');
      setTagColor('#3b82f6');
    } catch (error) {
      console.error('Error saving tag:', error);
      alert('Ошибка при сохранении тега');
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Удалить тег?')) {
      try {
        await deleteTag(id);
        await loadTags();
      } catch (error) {
        console.error('Error deleting tag:', error);
        alert('Ошибка при удалении тега');
      }
    }
  };

  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e',
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
          <p className="text-gray-600 dark:text-gray-400">Загрузка тегов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          <i className="fas fa-tags mr-2 text-purple-500"></i>
          Теги и категории
        </h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingTag(null);
            setTagName('');
            setTagColor('#3b82f6');
          }}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          <i className="fas fa-plus mr-2"></i>
          Создать тег
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  {editingTag ? 'Редактировать тег' : 'Новый тег'}
                </h3>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Название тега *
                  </label>
                  <input
                    type="text"
                    required
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-purple-500"
                    placeholder="Например: Важное"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Цвет
                  </label>
                  <div className="grid grid-cols-8 gap-2">
                    {colors.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setTagColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          tagColor === color ? 'border-gray-800 dark:border-gray-200 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
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
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    {editingTag ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {tags.map(tag => (
          <div
            key={tag.id}
            className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 px-4 py-2 hover:shadow-md transition-shadow"
          >
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: tag.color }}
            ></div>
            <span className="font-medium text-gray-800 dark:text-gray-100">{tag.name}</span>
            <button
              onClick={() => handleEdit(tag)}
              className="text-gray-400 hover:text-blue-600 transition-colors"
            >
              <i className="fas fa-edit text-sm"></i>
            </button>
            <button
              onClick={() => handleDelete(tag.id)}
              className="text-gray-400 hover:text-red-600 transition-colors"
            >
              <i className="fas fa-trash text-sm"></i>
            </button>
          </div>
        ))}
      </div>

      {tags.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <i className="fas fa-tags text-5xl mb-4"></i>
          <p className="text-lg">Нет тегов</p>
          <p className="text-sm mt-2">Создайте теги для классификации конференций</p>
        </div>
      )}
    </div>
  );
}
