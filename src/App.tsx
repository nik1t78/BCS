import React, { useState, useEffect } from 'react';
import { User } from './types';
import { getCurrentUser, logout } from './store-api';
import { getTheme } from './store';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import Schedule from './components/Schedule';
import UserPanel from './components/UserPanel';
import AdminPanel from './components/AdminPanel';
import Notifications from './components/Notifications';
import Profile from './components/Profile';
import Stats from './components/Stats';
import Templates from './components/Templates';
import TagsManager from './components/TagsManager';
import ThemeToggle from './components/ThemeToggle';
import ResetData from './components/ResetData';

type Page = 'dashboard' | 'schedule' | 'meetings' | 'templates' | 'tags' | 'stats' | 'notifications' | 'profile' | 'admin';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const theme = getTheme();
    document.documentElement.classList.toggle('dark', theme === 'dark');
    
    // Загружаем текущего пользователя из API
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    loadUser();

    // При 401 от API (истёкший токен) store-api чистит localStorage и
    // генерирует это событие — сбрасываем состояние, покажем экран входа.
    const onUnauthorized = () => setUser(null);
    window.addEventListener('vks-unauthorized', onUnauthorized);
    return () => window.removeEventListener('vks-unauthorized', onUnauthorized);
  }, []);

  const handleLogin = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  if (!user) {
    return <AuthPage onLogin={handleLogin} />;
  }

  const isAdmin = user.role === 'admin';
  const isModerator = user.role === 'moderator';

  const navItems = [
    { id: 'dashboard', label: 'Главная', icon: 'fa-home', roles: ['admin', 'user', 'moderator'] },
    { id: 'schedule', label: 'Расписание', icon: 'fa-calendar-alt', roles: ['admin', 'user', 'moderator'] },
    { id: 'meetings', label: 'Мои конференции', icon: 'fa-video', roles: ['admin', 'user', 'moderator'] },
    { id: 'templates', label: 'Шаблоны', icon: 'fa-copy', roles: ['admin', 'moderator'] },
    { id: 'tags', label: 'Теги', icon: 'fa-tags', roles: ['admin', 'user', 'moderator'] },
    { id: 'stats', label: 'Статистика', icon: 'fa-chart-bar', roles: ['admin', 'moderator'] },
    { id: 'notifications', label: 'Уведомления', icon: 'fa-bell', roles: ['admin', 'user', 'moderator'] },
    { id: 'profile', label: 'Профиль', icon: 'fa-user', roles: ['admin', 'user', 'moderator'] },
    { id: 'admin', label: 'Админ-панель', icon: 'fa-shield-alt', roles: ['admin', 'moderator'] },
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300`}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-2 flex-shrink-0">
              <i className="fas fa-video text-white text-lg"></i>
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-gray-800 dark:text-gray-100 text-lg">ВКС</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Расписание</p>
              </div>
            )}
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {visibleNavItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id as Page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                currentPage === item.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <i className={`fas ${item.icon} w-5 text-center`}></i>
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
          >
            <i className={`fas ${sidebarOpen ? 'fa-chevron-left' : 'fa-chevron-right'}`}></i>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {visibleNavItems.find(n => n.id === currentPage)?.label}
          </h2>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">{user.name.charAt(0)}</span>
              </div>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{user.name.split(' ')[0]}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Выйти"
            >
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {currentPage === 'dashboard' && <Dashboard user={user} onNavigate={(page: string) => setCurrentPage(page as Page)} />}
          {currentPage === 'schedule' && <Schedule user={user} onNavigate={(page: string) => setCurrentPage(page as Page)} />}
          {currentPage === 'meetings' && <UserPanel user={user} onNavigate={(page: string) => setCurrentPage(page as Page)} />}
          {currentPage === 'templates' && <Templates userId={user.id} />}
          {currentPage === 'tags' && <TagsManager userId={user.id} />}
          {currentPage === 'stats' && <Stats user={user} />}
          {currentPage === 'notifications' && <Notifications user={user} />}
          {currentPage === 'profile' && <Profile user={user} onUpdate={() => setUser(getCurrentUser())} />}
          {currentPage === 'admin' && (isAdmin || isModerator) && <AdminPanel user={user} />}
        </div>
      </main>

      {isAdmin && <ResetData />}
    </div>
  );
}

export default App;
