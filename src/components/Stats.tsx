import React, { useState, useEffect } from 'react';
import { User, Meeting } from '../types';
import { getMeetings, getUsers } from '../store-api';

interface StatsProps {
  user: User;
}

export default function Stats({ user }: StatsProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allMeetings, allUsers] = await Promise.all([
        getMeetings(),
        getUsers()
      ]);
      
      // Модераторы и админы видят все конференции, обычные пользователи - только свои
      const visibleMeetings = (user.role === 'admin' || user.role === 'moderator')
        ? allMeetings
        : allMeetings.filter(m => m.participants.includes(user.id) || m.organizerId === user.id);
      
      setMeetings(visibleMeetings);
      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: meetings.length,
    scheduled: meetings.filter(m => m.status === 'scheduled').length,
    inProgress: meetings.filter(m => m.status === 'in-progress').length,
    completed: meetings.filter(m => m.status === 'completed').length,
    cancelled: meetings.filter(m => m.status === 'cancelled').length,
    thisWeek: meetings.filter(m => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const mDate = new Date(m.date);
      return mDate >= weekStart && mDate <= weekEnd;
    }).length,
    highPriority: meetings.filter(m => m.priority === 'high').length,
    organized: meetings.filter(m => m.organizerId === user.id).length,
    participating: meetings.filter(m => m.participants.includes(user.id)).length,
  };

  const statCards = [
    { label: 'Всего конференций', value: stats.total, icon: 'fa-video', color: 'from-blue-500 to-blue-600' },
    { label: 'На этой неделе', value: stats.thisWeek, icon: 'fa-calendar-week', color: 'from-purple-500 to-purple-600' },
    { label: 'Высокий приоритет', value: stats.highPriority, icon: 'fa-exclamation-circle', color: 'from-red-500 to-red-600' },
    { label: 'Организовано мной', value: stats.organized, icon: 'fa-user-edit', color: 'from-green-500 to-green-600' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
          <p className="text-gray-600 dark:text-gray-400">Загрузка статистики...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <i className="fas fa-chart-line"></i>
          Статистика и аналитика
        </h2>
        <p className="text-blue-100 mt-1">Обзор вашей активности</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className={`bg-gradient-to-br ${card.color} rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">{card.label}</p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
              </div>
              <div className="bg-white/20 rounded-lg p-3">
                <i className={`fas ${card.icon} text-2xl`}></i>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
          <i className="fas fa-chart-pie text-blue-500"></i>
          Распределение по статусам
        </h3>
        <div className="space-y-3">
          {[
            { label: 'Запланированные', count: stats.scheduled, color: 'bg-gray-400', icon: 'fa-clock' },
            { label: 'В процессе', count: stats.inProgress, color: 'bg-blue-500', icon: 'fa-play' },
            { label: 'Завершённые', count: stats.completed, color: 'bg-green-500', icon: 'fa-check' },
            { label: 'Отменённые', count: stats.cancelled, color: 'bg-red-500', icon: 'fa-times' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <i className={`fas ${item.icon} text-gray-400 w-5`}></i>
              <span className="text-sm text-gray-600 dark:text-gray-300 w-40">{item.label}</span>
              <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-6 overflow-hidden relative">
                <div 
                  className={`h-full ${item.color} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                  style={{ width: stats.total > 0 ? `${(item.count / stats.total) * 100}%` : '0%' }}
                >
                  {item.count > 0 && <span className="text-white text-xs font-bold">{item.count}</span>}
                </div>
              </div>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100 w-12 text-right">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <i className="fas fa-users text-purple-500"></i>
            Участие
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Организовано мной</span>
              <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.organized}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Участвую в</span>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.participating}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <i className="fas fa-info-circle text-emerald-500"></i>
            Информация
          </h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <p><i className="fas fa-check-circle text-green-500 mr-2"></i>Всего пользователей: {users.length}</p>
            <p><i className="fas fa-check-circle text-green-500 mr-2"></i>Активных пользователей: {users.filter(u => u.isActive).length}</p>
            <p><i className="fas fa-check-circle text-green-500 mr-2"></i>Ваша роль: {user.role === 'admin' ? 'Администратор' : user.role === 'moderator' ? 'Модератор' : 'Пользователь'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
