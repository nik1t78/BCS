import React, { useState } from 'react';
import { User } from '../types';
import { updateUser } from '../store';

export default function Profile({ user, onUpdate }: { user: User; onUpdate: () => void }) {
  const [formData, setFormData] = useState({
    name: user.name,
    phone: user.phone || '',
    department: user.department || '',
    position: user.position || '',
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const updatedUser = {
      ...user,
      name: formData.name,
      phone: formData.phone,
      department: formData.department,
      position: formData.position,
    };
    updateUser(updatedUser);
    onUpdate();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Профиль</h2>
      
      {saved && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400">
          <i className="fas fa-check-circle mr-2"></i>
          Профиль успешно сохранен!
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ФИО</label>
          <input 
            type="text" 
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Логин</label>
          <input type="text" value={user.login} readOnly
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg opacity-60" />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Логин нельзя изменить</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Роль</label>
          <input type="text" value={user.role === 'admin' ? 'Администратор' : user.role === 'moderator' ? 'Модератор' : 'Пользователь'} readOnly
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg opacity-60" />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Роль назначается администратором</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Телефон</label>
          <input 
            type="tel" 
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
            placeholder="+7 (999) 123-45-67"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Отдел</label>
          <input 
            type="text" 
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
            placeholder="Например: Разработка"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Должность</label>
          <input 
            type="text" 
            value={formData.position}
            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
            placeholder="Например: Разработчик"
          />
        </div>

        <div className="pt-4">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <i className="fas fa-save mr-2"></i>
            Сохранить изменения
          </button>
        </div>
      </div>
    </div>
  );
}
