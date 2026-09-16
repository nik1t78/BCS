import React, { useState } from 'react';
import { User } from '../types';
import { updateProfile, getSettings, saveSettings } from '../store';

interface ProfileProps {
  user: User;
  onUpdate: () => void;
}

export default function Profile({ user, onUpdate }: ProfileProps) {
  const [formData, setFormData] = useState(user);
  const [settings, setSettings] = useState(getSettings());
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'settings' | 'security'>('profile');

  const handleSaveProfile = () => {
    updateProfile(formData);
    onUpdate();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveSettings = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-32"></div>
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-12">
            <div className="w-24 h-24 bg-white rounded-xl shadow-lg flex items-center justify-center border-4 border-white">
              <span className="text-3xl font-bold text-blue-600">{user.name.charAt(0)}</span>
            </div>
            <div className="pb-2">
              <h2 className="text-xl font-bold text-gray-800">{user.name}</h2>
              <p className="text-gray-500 capitalize">
                {user.role === 'admin' ? '🛡️ Администратор' : user.role === 'moderator' ? '🔧 Модератор' : '👤 Пользователь'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
        <div className="flex gap-1">
          {[
            { id: 'profile', label: 'Профиль', icon: 'fa-user' },
            { id: 'settings', label: 'Настройки', icon: 'fa-cog' },
            { id: 'security', label: 'Безопасность', icon: 'fa-shield-alt' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              <i className={`fas ${tab.icon}`}></i>{tab.label}
            </button>
          ))}
        </div>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 flex items-center gap-2">
          <i className="fas fa-check-circle"></i>Сохранено успешно!
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Личные данные</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">ФИО</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Логин</label>
              <input type="text" value={formData.login} onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
              <input type="tel" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Отдел</label>
              <input type="text" value={formData.department || ''} onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Должность</label>
              <input type="text" value={formData.position || ''} onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="mt-6">
            <button onClick={handleSaveProfile} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              <i className="fas fa-save mr-2"></i>Сохранить
            </button>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Настройки уведомлений</h3>
          <div className="space-y-4 max-w-lg">
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-800">Звуковые уведомления</p>
                <p className="text-sm text-gray-500">Звук при напоминании</p>
              </div>
              <input type="checkbox" checked={settings.soundEnabled}
                onChange={(e) => setSettings({ ...settings, soundEnabled: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded" />
            </label>
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-800">Браузерные уведомления</p>
                <p className="text-sm text-gray-500">Системные уведомления</p>
              </div>
              <input type="checkbox" checked={settings.browserNotifications}
                onChange={(e) => setSettings({ ...settings, browserNotifications: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded" />
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Напоминание по умолчанию</label>
              <select value={settings.defaultReminderMinutes}
                onChange={(e) => setSettings({ ...settings, defaultReminderMinutes: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500">
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Конец рабочего дня</label>
                <input type="time" value={settings.workHoursEnd}
                  onChange={(e) => setSettings({ ...settings, workHoursEnd: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <button onClick={handleSaveSettings} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              <i className="fas fa-save mr-2"></i>Сохранить
            </button>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Безопасность</h3>
          <div className="space-y-4 max-w-lg">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                <i className="fas fa-info-circle mr-1"></i>
                В production-версии с Laravel API смена пароля происходит через защищённый endpoint с подтверждением текущего пароля.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Текущий пароль</label>
              <input type="password" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Новый пароль</label>
              <input type="password" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Подтвердите пароль</label>
              <input type="password" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" placeholder="••••••••" />
            </div>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              <i className="fas fa-key mr-2"></i>Изменить пароль
            </button>

            <div className="pt-6 border-t mt-6">
              <h4 className="font-medium text-gray-800 mb-3">Активные сессии</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-desktop text-gray-400"></i>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Текущий браузер</p>
                      <p className="text-xs text-gray-500">Активна сейчас</p>
                    </div>
                  </div>
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Активна</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Информация об аккаунте</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">Дата регистрации</p>
            <p className="text-sm font-medium text-gray-800">{new Date(user.createdAt).toLocaleDateString('ru-RU')}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">Последний вход</p>
            <p className="text-sm font-medium text-gray-800">{user.lastLogin ? new Date(user.lastLogin).toLocaleString('ru-RU') : '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">Роль</p>
            <p className="text-sm font-medium text-gray-800 capitalize">{user.role === 'admin' ? 'Администратор' : user.role === 'moderator' ? 'Модератор' : 'Пользователь'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">Статус</p>
            <p className="text-sm font-medium text-green-600">● Активен</p>
          </div>
        </div>
      </div>
    </div>
  );
}
