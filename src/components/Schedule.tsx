import React, { useState, useEffect } from 'react';
import { Meeting } from '../types';
import { getMeetings } from '../store';

interface ScheduleProps {
  onNavigate: (page: string) => void;
}

export default function Schedule({ onNavigate }: ScheduleProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'completed'>('all');

  useEffect(() => {
    setMeetings(getMeetings());
  }, []);

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

  const filteredMeetings = meetings.filter(m => {
    if (filter === 'today') return m.date === new Date().toISOString().split('T')[0];
    if (filter === 'upcoming') return m.date >= new Date().toISOString().split('T')[0] && m.status !== 'completed' && m.status !== 'cancelled';
    if (filter === 'completed') return m.status === 'completed';
    return true;
  }).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  const getMeetingsForDate = (date: Date): Meeting[] => {
    const dateStr = date.toISOString().split('T')[0];
    return meetings.filter(m => m.date === dateStr);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-300';
    }
  };

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => {
              const d = new Date(selectedDate);
              if (view === 'week') d.setDate(d.getDate() - 7);
              else if (view === 'month') d.setMonth(d.getMonth() - 1);
              else d.setDate(d.getDate() - 1);
              setSelectedDate(d);
            }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <i className="fas fa-chevron-left text-gray-600"></i>
            </button>
            <button onClick={() => setSelectedDate(new Date())} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors">
              Сегодня
            </button>
            <button onClick={() => {
              const d = new Date(selectedDate);
              if (view === 'week') d.setDate(d.getDate() + 7);
              else if (view === 'month') d.setMonth(d.getMonth() + 1);
              else d.setDate(d.getDate() + 1);
              setSelectedDate(d);
            }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <i className="fas fa-chevron-right text-gray-600"></i>
            </button>
            <span className="text-lg font-semibold text-gray-700 ml-2">
              {view === 'month' ? `${months[selectedDate.getMonth()]} ${selectedDate.getFullYear()}` :
               view === 'week' ? `Неделя ${selectedDate.toLocaleDateString('ru-RU')}` :
               selectedDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['day', 'week', 'month'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${view === v ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-800'}`}>
                  {v === 'day' ? 'День' : v === 'week' ? 'Неделя' : 'Месяц'}
                </button>
              ))}
            </div>
            <button onClick={() => onNavigate('admin')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
              <i className="fas fa-plus"></i>
              <span className="hidden sm:inline">Новая ВКС</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {(['all', 'today', 'upcoming', 'completed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f === 'all' ? 'Все' : f === 'today' ? 'Сегодня' : f === 'upcoming' ? 'Ближайшие' : 'Завершённые'}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule View */}
      {view === 'day' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            {selectedDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          <div className="space-y-3">
            {getMeetingsForDate(selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(meeting => (
              <div key={meeting.id} className={`border-l-4 ${getPriorityColor(meeting.priority)} bg-gray-50 rounded-r-lg p-4 hover:bg-gray-100 transition-colors`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{meeting.title}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      <i className="far fa-clock mr-1"></i>{meeting.startTime} - {meeting.endTime}
                      {meeting.room && <span className="ml-3"><i className="fas fa-map-marker-alt mr-1"></i>{meeting.room}</span>}
                    </p>
                    {meeting.description && <p className="text-sm text-gray-600 mt-2">{meeting.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      meeting.status === 'completed' ? 'bg-green-100 text-green-700' :
                      meeting.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                      meeting.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {meeting.status === 'completed' ? '✓' : meeting.status === 'in-progress' ? '●' : meeting.status === 'cancelled' ? '✕' : '○'}
                    </span>
                    {meeting.link && (
                      <a href={meeting.link} target="_blank" rel="noopener noreferrer"
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors">
                        <i className="fas fa-video mr-1"></i>Войти
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {getMeetingsForDate(selectedDate).length === 0 && (
              <p className="text-center text-gray-400 py-8">Нет конференций на этот день</p>
            )}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200">
            {weekDays.map((day, i) => (
              <div key={i} className="p-3 text-center border-r border-gray-100 last:border-r-0">
                <p className="text-xs text-gray-500 uppercase">{day}</p>
                <p className={`text-lg font-bold ${
                  getWeekDates(selectedDate)[i].toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
                    ? 'text-blue-600' : 'text-gray-800'
                }`}>
                  {getWeekDates(selectedDate)[i].getDate()}
                </p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {getWeekDates(selectedDate).map((date, i) => {
              const dayMeetings = getMeetingsForDate(date);
              return (
                <div key={i} className="min-h-[200px] p-2 border-r border-gray-100 last:border-r-0 border-b border-gray-100">
                  {dayMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(meeting => (
                    <div key={meeting.id} className={`border-l-2 ${getPriorityColor(meeting.priority)} bg-gray-50 rounded p-1.5 mb-1 text-xs hover:bg-gray-100 cursor-pointer transition-colors`}>
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
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200">
            {weekDays.map((day, i) => (
              <div key={i} className="p-2 text-center text-xs text-gray-500 uppercase font-medium">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {getMonthDates(selectedDate).map((date, i) => {
              const dayMeetings = getMeetingsForDate(date);
              const isToday = date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
              return (
                <div key={i} className={`min-h-[100px] p-1.5 border-r border-gray-100 last:border-r-0 border-b border-gray-100 ${isToday ? 'bg-blue-50' : ''}`}>
                  <p className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                    {date.getDate()}
                  </p>
                  {dayMeetings.slice(0, 3).map(meeting => (
                    <div key={meeting.id} className={`border-l-2 ${getPriorityColor(meeting.priority)} bg-gray-50 rounded px-1 py-0.5 mb-0.5 text-xs`}>
                      <p className="truncate text-gray-700">{meeting.startTime} {meeting.title}</p>
                    </div>
                  ))}
                  {dayMeetings.length > 3 && (
                    <p className="text-xs text-gray-400">+{dayMeetings.length - 3} ещё</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List of all filtered meetings */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          Все конференции ({filteredMeetings.length})
        </h3>
        <div className="space-y-3">
          {filteredMeetings.slice(0, 20).map(meeting => (
            <div key={meeting.id} className={`border-l-4 ${getPriorityColor(meeting.priority)} bg-gray-50 rounded-r-lg p-4 hover:bg-gray-100 transition-colors`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-800">{meeting.title}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    <i className="far fa-calendar mr-1"></i>{new Date(meeting.date).toLocaleDateString('ru-RU')}
                    <span className="ml-3"><i className="far fa-clock mr-1"></i>{meeting.startTime} - {meeting.endTime}</span>
                    {meeting.room && <span className="ml-3"><i className="fas fa-map-marker-alt mr-1"></i>{meeting.room}</span>}
                    {meeting.recurring !== 'none' && (
                      <span className="ml-3"><i className="fas fa-sync mr-1"></i>
                        {meeting.recurring === 'daily' ? 'Ежедневно' : meeting.recurring === 'weekly' ? 'Еженедельно' : 'Ежемесячно'}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
              </div>
            </div>
          ))}
          {filteredMeetings.length === 0 && (
            <p className="text-center text-gray-400 py-8">Нет конференций по выбранным фильтрам</p>
          )}
        </div>
      </div>
    </div>
  );
}
