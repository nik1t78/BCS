import React, { useState, useEffect } from 'react';
import { User, Meeting } from '../types';
import { getMeetings, getUsers } from '../store';

interface DashboardProps {
  user: User;
  onNavigate: (page: string) => void;
}

export default function Dashboard({ user, onNavigate }: DashboardProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const loadData = () => {
      setMeetings(getMeetings());
      setUsers(getUsers());
    };
    loadData();
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const dataTimer = setInterval(loadData, 30000); // Обновляем каждые 30 секунд
    
    return () => {
      clearInterval(timer);
      clearInterval(dataTimer);
    };
  }, []);

  const visibleMeetings = (user.role === 'admin' || user.role === 'moderator') 
    ? meetings 
    : meetings.filter(m => m.participants.includes(user.id) || m.organizerId === user.id);

  useEffect(() => {
    const today = currentTime.toISOString().split('T')[0];
    const now = currentTime.toTimeString().slice(0, 5);
    
    const upcoming = visibleMeetings
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
  }, [currentTime, visibleMeetings]);

  const todayMeetings = visibleMeetings.filter(m => m.date === currentTime.toISOString().split('T')[0]);
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
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold">Добро пожаловать, {user.name.split(' ')[0]}!</h2>
        <p className="text-blue-100 mt-1">
          {currentTime.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">Сегодня</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{todayMeetings.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">Всего</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{visibleMeetings.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">Организовано</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{visibleMeetings.filter(m => m.organizerId === user.id).length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">Высокий приоритет</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{visibleMeetings.filter(m => m.priority === 'high').length}</p>
        </div>
      </div>

      {/* Next Meeting */}
      {nextMeeting && (() => {
        const canSeeDetails = user.role === 'admin' || user.role === 'moderator' || 
                             nextMeeting.organizerId === user.id || 
                             nextMeeting.participants.includes(user.id);
        
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-blue-200 dark:border-blue-800 p-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              <i className="fas fa-arrow-right text-blue-500 mr-2"></i>
              Следующая конференция
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Название</p>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-1">
                  {canSeeDetails ? nextMeeting.title : 'Конференция'}
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Дата и время</p>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-1">
                  {new Date(nextMeeting.date).toLocaleDateString('ru-RU')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{nextMeeting.startTime} - {nextMeeting.endTime}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">До начала</p>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-1">{countdown}</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Место</p>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-1">
                  {canSeeDetails ? (nextMeeting.room || 'Онлайн') : 'Скрыто'}
                </p>
              </div>
            </div>

            {canSeeDetails && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Организатор</p>
                    <p className="text-gray-800 dark:text-gray-100">{getUserName(nextMeeting.organizerId)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Участники</p>
                    <p className="text-gray-800 dark:text-gray-100">{nextMeeting.participants.length} чел.</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Кабинет</p>
                    <p className="text-gray-800 dark:text-gray-100 font-semibold">
                      {nextMeeting.room ? `📍 ${nextMeeting.room}` : '🌐 Онлайн'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => alert('Функция подключения к конференции')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <i className="fas fa-video mr-2"></i>
              Подключиться к конференции
            </button>
          </div>
        );
      })()}

      {/* Today's Schedule */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          <i className="fas fa-calendar-day text-purple-500 mr-2"></i>
          Сегодня ({todayMeetings.length})
        </h2>
        {todayMeetings.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Нет конференций на сегодня</p>
        ) : (
          <div className="space-y-3">
            {todayMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(meeting => {
              const canSeeDetails = user.role === 'admin' || user.role === 'moderator' || 
                                   meeting.organizerId === user.id || 
                                   meeting.participants.includes(user.id);
              
              return (
                <div key={meeting.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-gray-100">
                        {canSeeDetails ? meeting.title : 'Конференция'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {meeting.startTime} - {meeting.endTime}
                        {canSeeDetails && meeting.room && <> • {meeting.room}</>}
                        {!canSeeDetails && <> • Место скрыто</>}
                      </p>
                      {canSeeDetails && (
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                          Организатор: {getUserName(meeting.organizerId)}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(meeting.priority)}`}>
                      {meeting.priority === 'high' ? 'Высокий' : meeting.priority === 'medium' ? 'Средний' : 'Низкий'}
                    </span>
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
