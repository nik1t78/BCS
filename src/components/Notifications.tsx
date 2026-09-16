import React, { useState, useEffect } from 'react';
import { Notification } from '../types';
import { getNotifications, saveNotifications } from '../store';

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    setNotifications(getNotifications());
  }, []);

  const markAsRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    saveNotifications(updated);
    setNotifications(updated);
  };

  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    saveNotifications(updated);
    setNotifications(updated);
  };

  const clearAll = () => {
    if (confirm('Очистить все уведомления?')) {
      saveNotifications([]);
      setNotifications([]);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'reminder': return { icon: 'fa-bell', color: 'text-yellow-500', bg: 'bg-yellow-50' };
      case 'starting': return { icon: 'fa-video', color: 'text-blue-500', bg: 'bg-blue-50' };
      case 'info': return { icon: 'fa-info-circle', color: 'text-green-500', bg: 'bg-green-50' };
      case 'warning': return { icon: 'fa-exclamation-triangle', color: 'text-red-500', bg: 'bg-red-50' };
      default: return { icon: 'fa-bell', color: 'text-gray-500', bg: 'bg-gray-50' };
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <i className="fas fa-bell text-orange-500"></i>
              Уведомления
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-sm px-2 py-0.5 rounded-full">{unreadCount}</span>
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Управление уведомлениями о конференциях</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={markAllAsRead}
              className="px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
              <i className="fas fa-check-double mr-1"></i>Прочитать все
            </button>
            <button onClick={clearAll}
              className="px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
              <i className="fas fa-trash mr-1"></i>Очистить
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-4">
          {(['all', 'unread', 'read'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f === 'all' ? 'Все' : f === 'unread' ? 'Непрочитанные' : 'Прочитанные'}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <i className="fas fa-bell-slash text-5xl mb-4"></i>
            <p className="text-lg">Нет уведомлений</p>
            <p className="text-sm mt-1">Уведомления о конференциях будут появляться здесь</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNotifications.map(notification => {
              const typeInfo = getTypeIcon(notification.type);
              return (
                <div key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${!notification.read ? 'bg-blue-50/30' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div className={`${typeInfo.bg} rounded-lg p-2.5 flex-shrink-0`}>
                      <i className={`fas ${typeInfo.icon} ${typeInfo.color}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-medium ${!notification.read ? 'text-gray-800' : 'text-gray-600'}`}>
                          {notification.message}
                        </p>
                        {!notification.read && (
                          <button onClick={() => markAsRead(notification.id)}
                            className="text-blue-500 hover:text-blue-700 text-sm whitespace-nowrap">
                            Прочитано
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        {new Date(notification.timestamp).toLocaleString('ru-RU')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100 p-6">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-2">
          <i className="fas fa-lightbulb text-yellow-500"></i>
          Как работают уведомления
        </h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Система автоматически проверяет расписание каждую минуту</li>
          <li>• За {getSettings().defaultReminderMinutes} минут до конференции приходит напоминание</li>
          <li>• При начале конференции приходит уведомление "Конференция начинается"</li>
          <li>• Браузерные уведомления работают даже когда вкладка не активна</li>
          <li>• Звуковое уведомление привлекает внимание к важным событиям</li>
        </ul>
      </div>
    </div>
  );
}

function getSettings() {
  const data = localStorage.getItem('vks_settings');
  return data ? JSON.parse(data) : { defaultReminderMinutes: 15 };
}
