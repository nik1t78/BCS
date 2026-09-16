import React, { useState, useEffect, useCallback } from 'react';
import AuthPage from './components/AuthPage';
import Tour from './components/Tour';
import Tooltip from './components/Tooltip';
import Dashboard from './components/Dashboard';
import Schedule from './components/Schedule';
import UserPanel from './components/UserPanel';
import AdminPanel from './components/AdminPanel';
import Notifications from './components/Notifications';
import Profile from './components/Profile';
import Stats from './components/Stats';
import ThemeToggle from './components/ThemeToggle';
import Templates from './components/Templates';
import TagsManager from './components/TagsManager';
import { User, Notification as VKSNotification } from './types';
import { getCurrentUser, logout, getUserNotifications, addNotification, getMeetings, getSettings, getNotifications, getTheme } from './store';

type Page = 'dashboard' | 'schedule' | 'admin' | 'notifications' | 'profile' | 'meetings' | 'stats' | 'templates' | 'tags';

function App() {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showTour, setShowTour] = useState(false);

  // Initialize theme
  useEffect(() => {
    const theme = getTheme();
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  const handleLogin = () => {
    const loggedUser = getCurrentUser();
    setUser(loggedUser);
    // Show tour for first-time users
    const hasSeenTour = localStorage.getItem('vks_tour_seen');
    if (!hasSeenTour) {
      setShowTour(true);
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  const handleTourComplete = () => {
    setShowTour(false);
    localStorage.setItem('vks_tour_seen', 'true');
  };

  // Notification checker
  const checkNotifications = useCallback(() => {
    if (!user) return;
    const meetings = getMeetings();
    const existingNotifications = getNotifications();
    const settings = getSettings();
    const now = new Date();
    const nowStr = now.toISOString().split('T')[0];
    const nowTime = now.toTimeString().slice(0, 5);

    meetings.forEach(meeting => {
      if (meeting.status === 'cancelled' || meeting.status === 'completed') return;
      if (!meeting.participants.includes(user.id) && meeting.organizerId !== user.id) return;

      if (meeting.date === nowStr && meeting.startTime === nowTime) {
        const alreadyNotified = existingNotifications.some(
          n => n.userId === user.id && n.meetingId === meeting.id && n.type === 'starting' && n.timestamp.startsWith(nowStr)
        );
        if (!alreadyNotified) {
          const notification: VKSNotification = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            userId: user.id,
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

      if (meeting.date === nowStr) {
        const [startH, startM] = meeting.startTime.split(':').map(Number);
        const reminderTime = new Date(now);
        reminderTime.setHours(startH, startM - meeting.reminderMinutes, 0, 0);
        const diff = now.getTime() - reminderTime.getTime();
        if (diff >= 0 && diff < 60000) {
          const alreadyReminded = existingNotifications.some(
            n => n.userId === user.id && n.meetingId === meeting.id && n.type === 'reminder' && n.timestamp.startsWith(nowStr)
          );
          if (!alreadyReminded) {
            const notification: VKSNotification = {
              id: Date.now().toString(36) + Math.random().toString(36).substr(2),
              userId: user.id,
              meetingId: meeting.id,
              message: `⏰ Напоминание: через ${meeting.reminderMinutes} мин. — "${meeting.title}"`,
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

    const userNotifs = getUserNotifications(user.id);
    setUnreadCount(userNotifs.filter(n => !n.read).length);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    checkNotifications();
    const interval = setInterval(checkNotifications, 30000);
    return () => clearInterval(interval);
  }, [checkNotifications, user]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const triggerBrowserNotification = (title: string, body: string) => {
    const settings = getSettings();
    if (settings.browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, tag: 'vks-reminder' });
    }
  };

  const playNotificationSound = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.start();
      setTimeout(() => { osc.frequency.value = 600; setTimeout(() => { osc.frequency.value = 800; setTimeout(() => { osc.stop(); ctx.close(); }, 200); }, 200); }, 200);
    } catch (e) {}
  };

  const navigateTo = (page: string) => {
    setCurrentPage(page as Page);
    setMobileMenuOpen(false);
  };

  if (!user) {
    return <AuthPage onLogin={handleLogin} />;
  }

  const isAdmin = user.role === 'admin';
  const isModerator = user.role === 'moderator';

  const navItems = [
    { id: 'dashboard', label: 'Главная', icon: 'fa-home', tooltip: 'Обзор конференций и статистика', roles: ['admin', 'user', 'moderator'] },
    { id: 'schedule', label: 'Расписание', icon: 'fa-calendar-alt', tooltip: 'Просмотр расписания по дням', roles: ['admin', 'user', 'moderator'] },
    { id: 'meetings', label: 'Мои конференции', icon: 'fa-video', tooltip: 'Управление вашими встречами', roles: ['admin', 'user', 'moderator'] },
    { id: 'templates', label: 'Шаблоны', icon: 'fa-copy', tooltip: 'Шаблоны конференций', roles: ['admin', 'user', 'moderator'] },
    { id: 'tags', label: 'Теги', icon: 'fa-tags', tooltip: 'Управление тегами', roles: ['admin', 'user', 'moderator'] },
    { id: 'stats', label: 'Статистика', icon: 'fa-chart-bar', tooltip: 'Аналитика и отчёты', roles: ['admin', 'user', 'moderator'] },
    { id: 'notifications', label: 'Уведомления', icon: 'fa-bell', tooltip: 'Напоминания о конференциях', roles: ['admin', 'user', 'moderator'], badge: unreadCount },
    { id: 'profile', label: 'Профиль', icon: 'fa-user', tooltip: 'Настройки аккаунта', roles: ['admin', 'user', 'moderator'] },
    { id: 'admin', label: 'Админ-панель', icon: 'fa-shield-alt', tooltip: 'Управление системой', roles: ['admin', 'moderator'] },
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Tour */}
      {showTour && <Tour onComplete={handleTourComplete} />}

      {/* Sidebar Desktop */}
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
          {visibleNavItems.map(item => (
            <Tooltip key={item.id} content={item.tooltip} position="right">
              <button onClick={() => navigateTo(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  currentPage === item.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }`}>
                <i className={`fas ${item.icon} w-5 text-center ${currentPage === item.id ? 'text-blue-600' : 'text-gray-400'}`}></i>
                {sidebarOpen && (
                  <>
                    <span className="flex-1 text-sm font-medium">{item.label}</span>
                    {item.badge ? <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{item.badge}</span> : null}
                  </>
                )}
              </button>
            </Tooltip>
          ))}
        </nav>

        {sidebarOpen && (
          <div className="p-3 border-t border-gray-100">
            <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold text-sm">{user.name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{user.name.split(' ')[0]}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role === 'admin' ? 'Администратор' : user.role === 'moderator' ? 'Модератор' : 'Пользователь'}</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-3 border-t border-gray-100">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <i className={`fas ${sidebarOpen ? 'fa-chevron-left' : 'fa-chevron-right'}`}></i>
            {sidebarOpen && <span className="text-sm">Свернуть</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Menu */}
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
                  <h1 className="font-bold text-gray-800">ВКС Расписание</h1>
                  <p className="text-xs text-gray-500">{user.name.split(' ')[0]}</p>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {visibleNavItems.map(item => (
                <button key={item.id} onClick={() => navigateTo(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${
                    currentPage === item.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
                  }`}>
                  <i className={`fas ${item.icon} w-5 text-center`}></i>
                  <span className="flex-1 font-medium">{item.label}</span>
                  {item.badge ? <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{item.badge}</span> : null}
                </button>
              ))}
              <div className="pt-3 mt-3 border-t border-gray-100">
                <button onClick={() => { setShowTour(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left text-purple-600 hover:bg-purple-50 transition-colors">
                  <i className="fas fa-question-circle w-5 text-center"></i>
                  <span className="font-medium">Помощь</span>
                </button>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left text-red-600 hover:bg-red-50 transition-colors">
                  <i className="fas fa-sign-out-alt w-5 text-center"></i>
                  <span className="font-medium">Выйти</span>
                </button>
              </div>
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-gray-600 hover:text-gray-800">
              <i className="fas fa-bars text-xl"></i>
            </button>
            <h2 className="text-lg font-bold text-gray-800">
              {visibleNavItems.find(n => n.id === currentPage)?.label || 'Главная'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Tooltip content="Помощь и подсказки">
              <button onClick={() => setShowTour(true)}
                className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                <i className="fas fa-question-circle text-lg"></i>
              </button>
            </Tooltip>
            <Tooltip content={`Уведомления (${unreadCount} непрочитанных)`}>
              <button onClick={() => navigateTo('notifications')}
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <i className="fas fa-bell text-lg"></i>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </Tooltip>
            <Tooltip content={user.name}>
              <div className="hidden sm:flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
                onClick={() => navigateTo('profile')}>
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">{user.name.charAt(0)}</span>
                </div>
                <div className="hidden lg:block">
                  <p className="text-sm font-medium text-gray-800">{user.name.split(' ')[0]}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.role === 'admin' ? 'Админ' : user.role === 'moderator' ? 'Модератор' : 'Пользователь'}</p>
                </div>
              </div>
            </Tooltip>
            <Tooltip content="Выйти из аккаунта">
              <button onClick={handleLogout}
                className="hidden sm:flex items-center gap-1 text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded">
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </Tooltip>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {currentPage === 'dashboard' && <Dashboard user={user} onNavigate={navigateTo} />}
          {currentPage === 'schedule' && <Schedule user={user} onNavigate={navigateTo} />}
          {currentPage === 'meetings' && <UserPanel user={user} onNavigate={navigateTo} />}
          {currentPage === 'templates' && <Templates userId={user.id} />}
          {currentPage === 'tags' && <TagsManager userId={user.id} />}
          {currentPage === 'stats' && <Stats user={user} />}
          {currentPage === 'admin' && (isAdmin || isModerator) && <AdminPanel user={user} />}
          {currentPage === 'notifications' && <Notifications user={user} />}
          {currentPage === 'profile' && <Profile user={user} onUpdate={() => setUser(getCurrentUser())} />}
        </div>
      </main>
    </div>
  );
}

export default App;
