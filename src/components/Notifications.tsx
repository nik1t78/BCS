import React, { useState, useEffect } from 'react';
import { User, Notification } from '../types';
import { getUserNotifications, markNotificationRead, markAllNotificationsRead, saveNotifications, getNotifications } from '../store';

interface NotificationsProps {
  user: User;
}

export default function Notifications({ user }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    setNotifications(getUserNotifications(user.id));
  }, [user.id]);

  const handleMarkRead = (id: string) => {
    markNotificationRead(id);
    setNotifications(getUserNotifications(user.id));
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead(user.id);
    setNotifications(getUserNotifications(user.id));
  };

  const handleClearAll = () => {
    if (confirm('Очистить все уведомления?')) {
      const all = getNotifications().filter(n => n.userId !== user.id);
      saveNotifications(all);
      setNotifications([]);
    }
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'reminder': return { icon: 'fa-bell', color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' };
      case 'starting': return { icon: 'fa-video', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' };
      case 'info': return { icon: 'fa-info-circle', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' };
      case 'warning': return { icon: 'fa-exclamation-triangle', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' };
      case 'user-added': return { icon: 'fa-user-plus', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' };
      default: return { icon: 'fa-bell', color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800' };
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
              <i className="fas fa-bell text-orange-500"></i>
              Уведомления
              {unreadCount > 0 && <span className="bg-red-500 text-white text-sm px-2 py-0.5 rounded-full">{unreadCount}</span>}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleMarkAllRead} className="px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30">
              <i className="fas fa-check-double mr-1"></i>Прочитать все
            </button>
            <button onClick={handleClearAll} className="px-3 py-2 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30">
              <i className="fas fa-trash mr-1"></i>Очистить
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          {(['all', 'unread', 'read'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {f === 'all' ? 'Все' : f === 'unread' ? 'Непрочитанные' : 'Прочитанные'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <i className="fas fa-bell-slash text-5xl mb-4"></i>
            <p className="text-lg">Нет уведомлений</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map(notification => {
              const typeInfo = getTypeInfo(notification.type);
              return (
                <div key={notification.id} className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${!notification.read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div className={`${typeInfo.bg} rounded-lg p-2.5 flex-shrink-0`}>
                      <i className={`fas ${typeInfo.icon} ${typeInfo.color}`}></i>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-medium ${!notification.read ? 'text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>{notification.message}</p>
                        {!notification.read && (
                          <button onClick={() => handleMarkRead(notification.id)} className="text-blue-500 hover:text-blue-700 text-sm whitespace-nowrap">Прочитано</button>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{new Date(notification.timestamp).toLocaleString('ru-RU')}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
