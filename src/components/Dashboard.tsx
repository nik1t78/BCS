import React, { useState, useEffect } from 'react';
import { User, Meeting } from '../types';
import { getMeetings, getUsers } from '../store';

interface DashboardProps {
  user: User;
  onNavigate: (page: string) => void;
}

export default function Dashboard({ user, onNavigate }: DashboardProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    setMeetings(getMeetings());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const today = currentTime.toISOString().split('T')[0];
    const now = currentTime.toTimeString().slice(0, 5);
    const myMeetings = meetings.filter(m => m.participants.includes(user.id) || m.organizerId === user.id);
    
    const upcoming = myMeetings
      .filter(m => {
        if (m.status === 'cancelled' || m.status === 'completed') return false;
        if (m.date > today) return true;
        if (m.date === today && m.startTime > now) return true;
        return false;
      })
      .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime));

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
  }, [currentTime, meetings, user]);

  const myMeetings = meetings.filter(m => m.participants.includes(user.id) || m.organizerId === user.id);
  const todayMeetings = myMeetings.filter(m => m.date === currentTime.toISOString().split('T')[0]);
  const users = getUsers();
  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'Неизвестный';

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
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Добро пожаловать, {user.name.split(' ')[0]}!</h2>
            <p className="text-blue-100 mt-1">
              {currentTime.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-3xl font-bold">{currentTime.toLocaleTimeString('ru-RU')}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Сегодня</p>
              <p className="text-2xl font-bold text-gray-800">{todayMeetings.length}</p>
            </div>
            <div className="bg-blue-100 rounded-lg p-3"><i className="fas fa-video text-blue-600 text-xl"></i></div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Мои конференции</p>
              <p className="text-2xl font-bold text-gray-800">{myMeetings.length}</p>
            </div>
            <div className="bg-purple-100 rounded-lg p-3"><i className="fas fa-calendar text-purple-600 text-xl"></i></div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Организовано</p>
              <p className="text-2xl font-bold text-gray-800">{myMeetings.filter(m => m.organizerId === user.id).length}</p>
            </div>
            <div className="bg-emerald-100 rounded-lg p-3"><i className="fas fa-users text-emerald-600 text-xl"></i></div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Высокий приоритет</p>
              <p className="text-2xl font-bold text-gray-800">{myMeetings.filter(m => m.priority === 'high').length}</p>
            </div>
            <div className="bg-red-100 rounded-lg p-3"><i className="fas fa-exclamation text-red-600 text-xl"></i></div>
          </div>
        </div>
      </div>

      {/* Next Meeting */}
      {nextMeeting && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
            <i className="fas fa-arrow-right text-blue-500"></i>Следующая конференция
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 font-medium">Название</p>
              <p className="text-lg font-bold text-gray-800 mt-1">{nextMeeting.title}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-purple-600 font-medium">Дата и время</p>
              <p className="text-lg font-bold text-gray-800 mt-1">
                {new Date(nextMeeting.date).toLocaleDateString('ru-RU')} • {nextMeeting.startTime}
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
                <i className="fas fa-external-link-alt"></i>Подключиться
              </a>
            </div>
          )}
        </div>
      )}

      {/* Today's Schedule */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-calendar-day text-purple-500"></i>Сегодня
        </h2>
        {todayMeetings.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <i className="fas fa-calendar-check text-4xl mb-3"></i>
            <p>На сегодня нет конференций</p>
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
                  <p className="text-sm text-gray-500">{meeting.room} • Организовал: {getUserName(meeting.organizerId)}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(meeting.priority)}`}>
                  {meeting.priority === 'high' ? 'Высокий' : meeting.priority === 'medium' ? 'Средний' : 'Низкий'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
