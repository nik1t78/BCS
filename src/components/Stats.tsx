import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getMeetings } from '../store';
import Tooltip from './Tooltip';

interface StatsProps {
  user: User;
}

export default function Stats({ user }: StatsProps) {
  const [stats, setStats] = useState({
    totalMeetings: 0,
    scheduled: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    thisWeek: 0,
    thisMonth: 0,
    highPriority: 0,
    avgDuration: 0,
    mostActiveDay: '',
  });

  useEffect(() => {
    const meetings = getMeetings().filter(m => 
      m.participants.includes(user.id) || m.organizerId === user.id
    );

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const dayCounts: { [key: string]: number } = {};
    let totalDuration = 0;

    meetings.forEach(m => {
      const mDate = new Date(m.date);
      const dayName = mDate.toLocaleDateString('ru-RU', { weekday: 'long' });
      dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;

      const [startH, startM] = m.startTime.split(':').map(Number);
      const [endH, endM] = m.endTime.split(':').map(Number);
      const duration = (endH * 60 + endM) - (startH * 60 + startM);
      totalDuration += duration;
    });

    const mostActiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    setStats({
      totalMeetings: meetings.length,
      scheduled: meetings.filter(m => m.status === 'scheduled').length,
      inProgress: meetings.filter(m => m.status === 'in-progress').length,
      completed: meetings.filter(m => m.status === 'completed').length,
      cancelled: meetings.filter(m => m.status === 'cancelled').length,
      thisWeek: meetings.filter(m => {
        const mDate = new Date(m.date);
        return mDate >= weekStart && mDate <= weekEnd;
      }).length,
      thisMonth: meetings.filter(m => {
        const mDate = new Date(m.date);
        return mDate >= monthStart && mDate <= monthEnd;
      }).length,
      highPriority: meetings.filter(m => m.priority === 'high').length,
      avgDuration: meetings.length > 0 ? Math.round(totalDuration / meetings.length) : 0,
      mostActiveDay,
    });
  }, [user]);

  const statCards = [
    { label: 'Всего конференций', value: stats.totalMeetings, icon: 'fa-video', color: 'from-blue-500 to-blue-600' },
    { label: 'На этой неделе', value: stats.thisWeek, icon: 'fa-calendar-week', color: 'from-purple-500 to-purple-600' },
    { label: 'В этом месяце', value: stats.thisMonth, icon: 'fa-calendar-alt', color: 'from-indigo-500 to-indigo-600' },
    { label: 'Высокий приоритет', value: stats.highPriority, icon: 'fa-exclamation-circle', color: 'from-red-500 to-red-600' },
  ];

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
          <Tooltip key={i} content={card.label}>
            <div className={`bg-gradient-to-br ${card.color} rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow`}>
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
          </Tooltip>
        ))}
      </div>

      {/* Status Breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
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
              <span className="text-sm text-gray-600 w-40">{item.label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden relative">
                <div 
                  className={`h-full ${item.color} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                  style={{ width: stats.totalMeetings > 0 ? `${(item.count / stats.totalMeetings) * 100}%` : '0%' }}
                >
                  {item.count > 0 && <span className="text-white text-xs font-bold">{item.count}</span>}
                </div>
              </div>
              <span className="text-sm font-medium text-gray-800 w-12 text-right">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fas fa-clock text-purple-500"></i>
            Средняя длительность
          </h3>
          <div className="text-center">
            <p className="text-4xl font-bold text-purple-600">{stats.avgDuration}</p>
            <p className="text-gray-500 mt-2">минут</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fas fa-calendar-day text-emerald-500"></i>
            Самый активный день
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-emerald-600 capitalize">{stats.mostActiveDay}</p>
            <p className="text-gray-500 mt-2">больше всего конференций</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-bolt text-yellow-500"></i>
          Быстрые действия
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-left hover:bg-blue-100 transition-colors">
            <p className="font-medium text-blue-700">Создать конференцию</p>
            <p className="text-sm text-blue-500 mt-1">Запланировать новую встречу</p>
          </button>
          <button className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-left hover:bg-purple-100 transition-colors">
            <p className="font-medium text-purple-700">Экспорт расписания</p>
            <p className="text-sm text-purple-500 mt-1">Скачать в ICS/JSON/CSV</p>
          </button>
          <button className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-left hover:bg-emerald-100 transition-colors">
            <p className="font-medium text-emerald-700">Настройки уведомлений</p>
            <p className="text-sm text-emerald-500 mt-1">Управлять напоминаниями</p>
          </button>
        </div>
      </div>
    </div>
  );
}
