import React, { useState, useEffect } from 'react';
import { Meeting, Notification } from '../types';
import { getMeetings, getNotifications } from '../store';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    setMeetings(getMeetings());
    setNotifications(getNotifications());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const today = currentTime.toISOString().split('T')[0];
    const now = currentTime.toTimeString().slice(0, 5);
    
    const upcoming = meetings
      .filter(m => {
        if (m.status === 'cancelled' || m.status === 'completed') return false;
        if (m.date > today) return true;
        if (m.date === today && m.startTime > now) return true;
        return false;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
      });

    setNextMeeting(upcoming[0] || null);

    if (upcoming[0]) {
      const targetDate = new Date(`${upcoming[0].date}T${upcoming[0].startTime}`);
      const diff = targetDate.getTime() - currentTime.getTime();
      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown(`${hours}ч ${minutes}м ${seconds}с`);
      }
    }
  }, [currentTime, meetings]);

  const todayMeetings = meetings.filter(m => m.date === currentTime.toISOString().split('T')[0]);
  const unreadNotifications = notifications.filter(n => !n.read).length;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Сегодня</p>
              <p className="text-3xl font-bold">{todayMeetings.length}</p>
              <p className="text-blue-100 text-xs mt-1">конференций</p>
            </div>
            <div className="bg-white/20 rounded-lg p-3">
              <i className="fas fa-video text-2xl"></i>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Всего</p>
              <p className="text-3xl font-bold">{meetings.length}</p>
              <p className="text-purple-100 text-xs mt-1">запланировано</p>
            </div>
            <div className="bg-white/20 rounded-lg p-3">
              <i className="fas fa-calendar text-2xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Уведомления</p>
              <p className="text-3xl font-bold">{unreadNotifications}</p>
              <p className="text-orange-100 text-xs mt-1">непрочитанных</p>
            </div>
            <div className="bg-white/20 rounded-lg p-3">
              <i className="fas fa-bell text-2xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">Время</p>
              <p className="text-2xl font-bold">{currentTime.toLocaleTimeString('ru-RU')}</p>
              <p className="text-emerald-100 text-xs mt-1">{currentTime.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
            <div className="bg-white/20 rounded-lg p-3">
              <i className="fas fa-clock text-2xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Next Meeting */}
      {nextMeeting && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <i className="fas fa-arrow-right text-blue-500"></i>
              Следующая конференция
            </h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(nextMeeting.priority)}`}>
              {nextMeeting.priority === 'high' ? 'Высокий' : nextMeeting.priority === 'medium' ? 'Средний' : 'Низкий'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 font-medium">Название</p>
              <p className="text-lg font-bold text-gray-800 mt-1">{nextMeeting.title}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-purple-600 font-medium">Дата и время</p>
              <p className="text-lg font-bold text-gray-800 mt-1">
                {new Date(nextMeeting.date).toLocaleDateString('ru-RU')} • {nextMeeting.startTime} - {nextMeeting.endTime}
              </p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4">
              <p className="text-sm text-emerald-600 font-medium">До начала</p>
              <p className="text-lg font-bold text-gray-800 mt-1">{countdown}</p>
            </div>
          </div>
          {nextMeeting.link && (
            <div className="mt-4">
              <a href={nextMeeting.link} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <i className="fas fa-external-link-alt"></i>
                Подключиться к конференции
              </a>
            </div>
          )}
        </div>
      )}

      {/* Today's Schedule */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-calendar-day text-purple-500"></i>
          Расписание на сегодня
        </h2>
        {todayMeetings.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <i className="fas fa-calendar-check text-4xl mb-3"></i>
            <p>На сегодня нет запланированных конференций</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(meeting => (
              <div key={meeting.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors">
                <div className="text-center min-w-[60px]">
                  <p className="text-lg font-bold text-blue-600">{meeting.startTime}</p>
                  <p className="text-xs text-gray-500">{meeting.endTime}</p>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{meeting.title}</p>
                  <p className="text-sm text-gray-500">{meeting.room} • {meeting.participants.length} участников</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  meeting.status === 'completed' ? 'bg-green-100 text-green-700' :
                  meeting.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                  meeting.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {meeting.status === 'completed' ? 'Завершена' :
                   meeting.status === 'in-progress' ? 'Идёт' :
                   meeting.status === 'cancelled' ? 'Отменена' : 'Запланирована'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={() => onNavigate('admin')}
          className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:border-blue-300 transition-all hover:shadow-xl text-left group">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 rounded-lg p-3 group-hover:bg-blue-200 transition-colors">
              <i className="fas fa-plus text-blue-600 text-xl"></i>
            </div>
            <div>
              <p className="font-bold text-gray-800">Создать конференцию</p>
              <p className="text-sm text-gray-500">Запланировать новую ВКС</p>
            </div>
          </div>
        </button>
        
        <button onClick={() => onNavigate('notifications')}
          className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:border-orange-300 transition-all hover:shadow-xl text-left group">
          <div className="flex items-center gap-4">
            <div className="bg-orange-100 rounded-lg p-3 group-hover:bg-orange-200 transition-colors">
              <i className="fas fa-bell text-orange-600 text-xl"></i>
            </div>
            <div>
              <p className="font-bold text-gray-800">Уведомления</p>
              <p className="text-sm text-gray-500">Просмотреть все уведомления</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
