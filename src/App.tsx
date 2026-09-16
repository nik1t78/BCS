import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import Schedule from './components/Schedule';
import AdminPanel from './components/AdminPanel';
import Notifications from './components/Notifications';
import { Meeting, Notification as VKSNotification } from './types';
import { getMeetings, getNotifications, saveNotifications, addNotification, getSettings } from './store';

type Page = 'dashboard' | 'schedule' | 'admin' | 'notifications';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Notification system
  const checkNotifications = useCallback(() => {
    const meetings = getMeetings();
    const existingNotifications = getNotifications();
    const settings = getSettings();
    const now = new Date();
    const nowStr = now.toISOString().split('T')[0];
    const nowTime = now.toTimeString().slice(0, 5);

    meetings.forEach(meeting => {
      if (meeting.status === 'cancelled' || meeting.status === 'completed') return;

      // Check if meeting is starting now
      if (meeting.date === nowStr && meeting.startTime === nowTime) {
        const alreadyNotified = existingNotifications.some(
          n => n.meetingId === meeting.id && n.type === 'starting' &&
          n.timestamp.startsWith(nowStr)
        );
        if (!alreadyNotified) {
          const notification: VKSNotification = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            meetingId: meeting.id,
            message: `🔴 Конференция "${meeting.title}" начинается сейчас!`,
            type: 'starting',
            timestamp: new Date().toISOString(),
            read: false,
          };
          addNotification(notification);
          triggerBrowserNotification(`Конференция начинается: ${meeting.title}`, `Комната: ${meeting.room || 'Онлайн'}`);
          if (settings.soundEnabled) playNotificationSound();
        }
      }

      // Check reminder
      if (meeting.date === nowStr) {
        const [startH, startM] = meeting.startTime.split(':').map(Number);
        const reminderTime = new Date(now);
        reminderTime.setHours(startH, startM - meeting.reminderMinutes, 0, 0);
        
        const diff = now.getTime() - reminderTime.getTime();
        // Within 1 minute window
        if (diff >= 0 && diff < 60000) {
          const alreadyReminded = existingNotifications.some(
            n => n.meetingId === meeting.id && n.type === 'reminder' &&
            n.timestamp.startsWith(nowStr)
          );
          if (!alreadyReminded) {
            const notification: VKSNotification = {
              id: Date.now().toString(36) + Math.random().toString(36).substr(2),
              meetingId: meeting.id,
              message: `⏰ Напоминание: через ${meeting.reminderMinutes} мин. начнётся "${meeting.title}"`,
              type: 'reminder',
              timestamp: new Date().toISOString(),
              read: false,
            };
            addNotification(notification);
            triggerBrowserNotification(`Напоминание: ${meeting.title}`, `Через ${meeting.reminderMinutes} минут`);
            if (settings.soundEnabled) playNotificationSound();
          }
        }
      }
    });

    // Update unread count
    const notifications = getNotifications();
    setUnreadCount(notifications.filter(n => !n.read).length);
  }, []);

  useEffect(() => {
    checkNotifications();
    const interval = setInterval(checkNotifications, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [checkNotifications]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const triggerBrowserNotification = (title: string, body: string) => {
    const settings = getSettings();
    if (settings.browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '📹',
        tag: 'vks-reminder',
      });
    }
  };

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      oscillator.start();
      setTimeout(() => {
        oscillator.frequency.value = 600;
        setTimeout(() => {
          oscillator.frequency.value = 800;
          setTimeout(() => {
            oscillator.stop();
            audioContext.close();
          }, 200);
        }, 200);
      }, 200);
    } catch (e) {
      // Audio not supported
    }
  };

  const navigateTo = (page: string) => {
    setCurrentPage(page as Page);
    setMobileMenuOpen(false);
  };

  const navItems = [
    { id: 'dashboard', label: 'Главная', icon: 'fa-home' },
    { id: 'schedule', label: 'Расписание', icon: 'fa-calendar-alt' },
    { id: 'admin', label: 'Админ-панель', icon: 'fa-cogs' },
    { id: 'notifications', label: 'Уведомления', icon: 'fa-bell', badge: unreadCount },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col ${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 shadow-sm transition-all duration-300`}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-2 flex-shrink-0">
              <i className="fas fa-video text-white text-lg"></i>
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-gray-800 text-lg leading-tight">ВКС</h1>
                <p className="text-xs text-gray-500">Расписание</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => navigateTo(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                currentPage === item.id
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              }`}>
              <i className={`fas ${item.icon} w-5 text-center ${currentPage === item.id ? 'text-blue-600' : 'text-gray-400'}`}></i>
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  {item.badge ? (
                    <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{item.badge}</span>
                  ) : null}
                </>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <i className={`fas ${sidebarOpen ? 'fa-chevron-left' : 'fa-chevron-right'}`}></i>
            {sidebarOpen && <span className="text-sm">Свернуть</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)}></div>
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-2">
                  <i className="fas fa-video text-white text-lg"></i>
                </div>
                <div>
                  <h1 className="font-bold text-gray-800 text-lg">ВКС Расписание</h1>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {navItems.map(item => (
                <button key={item.id} onClick={() => navigateTo(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${
                    currentPage === item.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}>
                  <i className={`fas ${item.icon} w-5 text-center`}></i>
                  <span className="flex-1 font-medium">{item.label}</span>
                  {item.badge ? (
                    <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{item.badge}</span>
                  ) : null}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-gray-600 hover:text-gray-800">
              <i className="fas fa-bars text-xl"></i>
            </button>
            <h2 className="text-lg font-bold text-gray-800">
              {navItems.find(n => n.id === currentPage)?.label || 'Главная'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigateTo('notifications')}
              className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <i className="fas fa-bell text-lg"></i>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Система активна</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {currentPage === 'dashboard' && <Dashboard onNavigate={navigateTo} />}
          {currentPage === 'schedule' && <Schedule onNavigate={navigateTo} />}
          {currentPage === 'admin' && <AdminPanel />}
          {currentPage === 'notifications' && <Notifications />}
        </div>
      </main>
    </div>
  );
}

export default App;
