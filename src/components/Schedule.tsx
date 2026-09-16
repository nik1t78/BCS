import React, { useState, useEffect } from 'react';
import { User, Meeting } from '../types';
import { getMeetings, getUsers } from '../store';
import JoinMeetingModal from './JoinMeetingModal';

interface ScheduleProps {
  user: User;
  onNavigate: (page: string) => void;
}

export default function Schedule({ user, onNavigate }: ScheduleProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filter, setFilter] = useState<'all' | 'my' | 'today' | 'upcoming'>('all');
  const [joiningMeeting, setJoiningMeeting] = useState<Meeting | null>(null);
  const allUsers = getUsers();

  useEffect(() => { setMeetings(getMeetings()); }, []);

  const getWeekDates = (date: Date): Date[] => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  };

  const getMonthDates = (date: Date): Date[] => {
    const year = date.getFullYear(); const month = date.getMonth();
    const firstDay = new Date(year, month, 1); const lastDay = new Date(year, month + 1, 0);
    const dates: Date[] = [];
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) dates.push(new Date(d));
    return dates;
  };

  const visibleMeetings = meetings.filter(m => {
    // Non-private meetings visible to all, private only to participants/organizer
    if (m.isPrivate && !m.participants.includes(user.id) && m.organizerId !== user.id) return false;
    if (filter === 'my') return m.participants.includes(user.id) || m.organizerId === user.id;
    if (filter === 'today') return m.date === new Date().toISOString().split('T')[0];
    if (filter === 'upcoming') return m.date >= new Date().toISOString().split('T')[0] && m.status !== 'completed' && m.status !== 'cancelled';
    return true;
  });

  const getMeetingsForDate = (date: Date) => visibleMeetings.filter(m => m.date === date.toISOString().split('T')[0]);
  const getPriorityColor = (priority: string) => priority === 'high' ? 'border-l-red-500' : priority === 'medium' ? 'border-l-yellow-500' : 'border-l-green-500';
  const getUserName = (id: string) => allUsers.find(u => u.id === id)?.name?.split(' ').slice(0, 2).join(' ') || '—';
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - (view === 'week' ? 7 : view === 'month' ? 30 : 1)); setSelectedDate(d); }}
              className="p-2 hover:bg-gray-100 rounded-lg"><i className="fas fa-chevron-left text-gray-600"></i></button>
            <button onClick={() => setSelectedDate(new Date())} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">Сегодня</button>
            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + (view === 'week' ? 7 : view === 'month' ? 30 : 1)); setSelectedDate(d); }}
              className="p-2 hover:bg-gray-100 rounded-lg"><i className="fas fa-chevron-right text-gray-600"></i></button>
            <span className="text-lg font-semibold text-gray-700 ml-2">
              {view === 'month' ? `${months[selectedDate.getMonth()]} ${selectedDate.getFullYear()}` :
               view === 'week' ? `Неделя от ${selectedDate.toLocaleDateString('ru-RU')}` :
               selectedDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['day', 'week', 'month'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${view === v ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-600'}`}>
                  {v === 'day' ? 'День' : v === 'week' ? 'Неделя' : 'Месяц'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          {(['all', 'my', 'today', 'upcoming'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f === 'all' ? 'Все' : f === 'my' ? 'Мои' : f === 'today' ? 'Сегодня' : 'Ближайшие'}
            </button>
          ))}
        </div>
      </div>

      {view === 'day' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="space-y-3">
            {getMeetingsForDate(selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(meeting => (
              <div key={meeting.id} className={`border-l-4 ${getPriorityColor(meeting.priority)} bg-gray-50 rounded-r-lg p-4`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{meeting.title}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      <i className="far fa-clock mr-1"></i>{meeting.startTime} - {meeting.endTime}
                      {meeting.room && <span className="ml-3"><i className="fas fa-map-marker-alt mr-1"></i>{meeting.room}</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Организатор: {getUserName(meeting.organizerId)}</p>
                  </div>
                  {meeting.link && (
                    <button
                      onClick={() => setJoiningMeeting(meeting)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                      <i className="fas fa-video mr-1"></i>Подключиться
                    </button>
                  )}
                </div>
              </div>
            ))}
            {getMeetingsForDate(selectedDate).length === 0 && <p className="text-center text-gray-400 py-8">Нет конференций</p>}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200">
            {weekDays.map((day, i) => (
              <div key={i} className="p-3 text-center border-r border-gray-100 last:border-r-0">
                <p className="text-xs text-gray-500 uppercase">{day}</p>
                <p className={`text-lg font-bold ${getWeekDates(selectedDate)[i].toISOString().split('T')[0] === new Date().toISOString().split('T')[0] ? 'text-blue-600' : 'text-gray-800'}`}>
                  {getWeekDates(selectedDate)[i].getDate()}
                </p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {getWeekDates(selectedDate).map((date, i) => {
              const dayMeetings = getMeetingsForDate(date);
              return (
                <div key={i} className="min-h-[180px] p-2 border-r border-gray-100 last:border-r-0 border-b border-gray-100">
                  {dayMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(meeting => (
                    <div key={meeting.id} className={`border-l-2 ${getPriorityColor(meeting.priority)} bg-gray-50 rounded p-1.5 mb-1 text-xs`}>
                      <p className="font-medium text-gray-800 truncate">{meeting.title}</p>
                      <p className="text-gray-500">{meeting.startTime}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'month' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200">
            {weekDays.map((day, i) => <div key={i} className="p-2 text-center text-xs text-gray-500 uppercase font-medium">{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {getMonthDates(selectedDate).map((date, i) => {
              const dayMeetings = getMeetingsForDate(date);
              const isToday = date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
              return (
                <div key={i} className={`min-h-[90px] p-1.5 border-r border-gray-100 last:border-r-0 border-b border-gray-100 ${isToday ? 'bg-blue-50' : ''}`}>
                  <p className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{date.getDate()}</p>
                  {dayMeetings.slice(0, 3).map(meeting => (
                    <div key={meeting.id} className={`border-l-2 ${getPriorityColor(meeting.priority)} bg-gray-50 rounded px-1 py-0.5 mb-0.5 text-xs`}>
                      <p className="truncate text-gray-700">{meeting.startTime} {meeting.title}</p>
                    </div>
                  ))}
                  {dayMeetings.length > 3 && <p className="text-xs text-gray-400">+{dayMeetings.length - 3}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Join Meeting Modal */}
      {joiningMeeting && (
        <JoinMeetingModal
          meeting={joiningMeeting}
          onClose={() => setJoiningMeeting(null)}
        />
      )}
    </div>
  );
}
