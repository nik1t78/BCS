import React, { useState, useEffect } from 'react';
import { User, Meeting } from '../types';
import { getMeetings, getUsers } from '../store-api';

interface ScheduleProps {
  user: User;
  onNavigate: (page: string) => void;
}

const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Schedule({ user, onNavigate }: ScheduleProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filter, setFilter] = useState<'all' | 'my' | 'today' | 'upcoming'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  // API возвращает id числами, user.id — строка: сравниваем через Number
  const hasAccessTo = (m: Meeting) =>
    Number(m.organizerId) === Number(user.id) ||
    (m.participants ?? []).some((p) => Number(p) === Number(user.id));

  const loadData = async () => {
    setLoading(true);
    const [allMeetings, users] = await Promise.all([getMeetings(), getUsers()]);

    // Модераторы и админы видят все конференции, обычные пользователи - только свои
    const visibleMeetings = (user.role === 'admin' || user.role === 'moderator')
      ? allMeetings
      : allMeetings.filter(hasAccessTo);
    
    setMeetings(visibleMeetings);
    setAllUsers(users);
    setLoading(false);
  };

  const getWeekDates = (date: Date): Date[] => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const getMonthDates = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const dates: Date[] = [];
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  };

  const visibleMeetings = meetings.filter(m => {
    if (filter === 'my') return hasAccessTo(m);
    if (filter === 'today') return m.date === toDateKey(new Date());
    if (filter === 'upcoming') return m.date >= toDateKey(new Date()) && m.status !== 'completed' && m.status !== 'cancelled';
    return true;
  });

  const getMeetingsForDate = (date: Date) => {
    const dateStr = toDateKey(date);
    return visibleMeetings.filter(m => m.date === dateStr);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-300';
    }
  };

  const getUserName = (id: string) => allUsers.find(u => u.id === id)?.name || '—';

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
          <p className="text-gray-600 dark:text-gray-400">Загрузка расписания...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => {
              const d = new Date(selectedDate);
              if (view === 'week') d.setDate(d.getDate() - 7);
              else if (view === 'month') d.setMonth(d.getMonth() - 1);
              else d.setDate(d.getDate() - 1);
              setSelectedDate(d);
            }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <i className="fas fa-chevron-left text-gray-600 dark:text-gray-300"></i>
            </button>
            <button onClick={() => setSelectedDate(new Date())} className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800">
              Сегодня
            </button>
            <button onClick={() => {
              const d = new Date(selectedDate);
              if (view === 'week') d.setDate(d.getDate() + 7);
              else if (view === 'month') d.setMonth(d.getMonth() + 1);
              else d.setDate(d.getDate() + 1);
              setSelectedDate(d);
            }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <i className="fas fa-chevron-right text-gray-600 dark:text-gray-300"></i>
            </button>
            <span className="text-lg font-semibold text-gray-700 dark:text-gray-100 ml-2">
              {view === 'month' ? `${months[selectedDate.getMonth()]} ${selectedDate.getFullYear()}` :
               view === 'week' ? `Неделя ${selectedDate.toLocaleDateString('ru-RU')}` :
               selectedDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {(['day', 'week', 'month'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${view === v ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-300'}`}>
                  {v === 'day' ? 'День' : v === 'week' ? 'Неделя' : 'Месяц'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {(['all', 'my', 'today', 'upcoming'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {f === 'all' ? 'Все' : f === 'my' ? 'Мои' : f === 'today' ? 'Сегодня' : 'Ближайшие'}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule View */}
      {view === 'day' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
            {selectedDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          <div className="space-y-3">
            {getMeetingsForDate(selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(meeting => {
              const canSeeDetails = user.role === 'admin' || user.role === 'moderator' || 
                                   hasAccessTo(meeting);
              
              return (
                <div key={meeting.id} className={`border-l-4 ${getPriorityColor(meeting.priority)} bg-gray-50 dark:bg-gray-700 rounded-r-lg p-4`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-gray-100">
                        {canSeeDetails ? meeting.title : 'Конференция'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <i className="far fa-clock mr-1"></i>{meeting.startTime} - {meeting.endTime}
                        {canSeeDetails && meeting.room && <span className="ml-3"><i className="fas fa-map-marker-alt mr-1"></i>{meeting.room}</span>}
                      </p>
                      {canSeeDetails && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Организатор: {getUserName(meeting.organizerId)}</p>
                      )}
                    </div>
                    {meeting.link && (
                      <a href={meeting.link} target="_blank" rel="noopener noreferrer"
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"><i className="fas fa-video mr-1"></i>Войти</a>
                    )}
                  </div>
                </div>
              );
            })}
            {getMeetingsForDate(selectedDate).length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 py-8">Нет конференций</p>}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
            {weekDays.map((day, i) => (
              <div key={i} className="p-3 text-center border-r border-gray-100 dark:border-gray-700 last:border-r-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{day}</p>
                <p className={`text-lg font-bold ${toDateKey(getWeekDates(selectedDate)[i]) === toDateKey(new Date()) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-100'}`}>
                  {getWeekDates(selectedDate)[i].getDate()}
                </p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {getWeekDates(selectedDate).map((date, i) => {
              const dayMeetings = getMeetingsForDate(date);
              return (
                <div key={i} className="min-h-[180px] p-2 border-r border-gray-100 dark:border-gray-700 last:border-r-0 border-b border-gray-100 dark:border-gray-700">
                  {dayMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(meeting => {
                    const canSeeDetails = user.role === 'admin' || user.role === 'moderator' || 
                                         hasAccessTo(meeting);
                    
                    return (
                      <div key={meeting.id} className={`border-l-2 ${getPriorityColor(meeting.priority)} bg-gray-50 dark:bg-gray-700 rounded p-1.5 mb-1 text-xs`}>
                        <p className="font-medium text-gray-800 dark:text-gray-100 truncate">
                          {canSeeDetails ? meeting.title : 'Конференция'}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400">{meeting.startTime}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'month' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
            {weekDays.map((day, i) => <div key={i} className="p-2 text-center text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {getMonthDates(selectedDate).map((date, i) => {
              const dayMeetings = getMeetingsForDate(date);
              const isToday = toDateKey(date) === toDateKey(new Date());
              return (
                <div key={i} className={`min-h-[90px] p-1.5 border-r border-gray-100 dark:border-gray-700 last:border-r-0 border-b border-gray-100 dark:border-gray-700 ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                  <p className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>{date.getDate()}</p>
                  {dayMeetings.slice(0, 3).map(meeting => {
                    const canSeeDetails = user.role === 'admin' || user.role === 'moderator' || 
                                         hasAccessTo(meeting);
                    
                    return (
                      <div key={meeting.id} className={`border-l-2 ${getPriorityColor(meeting.priority)} bg-gray-50 dark:bg-gray-700 rounded px-1 py-0.5 mb-0.5 text-xs`}>
                        <p className="truncate text-gray-700 dark:text-gray-300">
                          {meeting.startTime} {canSeeDetails ? meeting.title : 'Конференция'}
                        </p>
                      </div>
                    );
                  })}
                  {dayMeetings.length > 3 && <p className="text-xs text-gray-400 dark:text-gray-500">+{dayMeetings.length - 3}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
