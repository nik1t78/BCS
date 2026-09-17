import React, { useState } from 'react';
import { login, register } from '../store';

interface AuthPageProps {
  onLogin: () => void;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    setTimeout(() => {
      const result = login(loginValue, password);
      if (result.success) {
        onLogin();
      } else {
        setError(result.error || 'Ошибка входа');
      }
      setLoading(false);
    }, 500);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name || !loginValue || !password) {
      setError('Заполните все обязательные поля');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const result = register(name, loginValue, password, phone, department);
      if (result.success) {
        onLogin();
      } else {
        setError(result.error || 'Ошибка регистрации');
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
            <i className="fas fa-video text-white text-3xl"></i>
          </div>
          <h1 className="text-3xl font-bold text-white">ВКС Расписание</h1>
          <p className="text-blue-100 mt-2">Система управления видеоконференциями</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
                mode === 'login' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
              }`}
            >
              Вход
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
                mode === 'register' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
              }`}
            >
              Регистрация
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <i className="fas fa-exclamation-circle mr-2"></i>
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Логин</label>
                <input
                  type="text"
                  required
                  value={loginValue}
                  onChange={(e) => setLoginValue(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="Введите логин"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Вход...' : 'Войти'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ФИО *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="Иванов Иван Иванович"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Логин *</label>
                <input
                  type="text"
                  required
                  value={loginValue}
                  onChange={(e) => setLoginValue(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="ivanov"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Пароль *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="Минимум 6 символов"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="+7 (999) 123-45-67"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Отдел</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="Разработка"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>
            </form>
          )}

          {/* Информация для первого входа */}
          {mode === 'login' && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                <i className="fas fa-info-circle mr-1"></i>
                Тестовые аккаунты для демонстрации
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <div className="bg-white p-2 rounded border border-blue-300">
                  <p className="text-xs font-semibold text-blue-700 mb-1">👑 Администратор:</p>
                  <code className="text-sm font-mono text-blue-900">
                    Логин: <strong>admin</strong> | Пароль: <strong>admin123</strong>
                  </code>
                </div>
                <div className="bg-white p-2 rounded border border-purple-300">
                  <p className="text-xs font-semibold text-purple-700 mb-1">🔧 Модератор:</p>
                  <code className="text-sm font-mono text-purple-900">
                    Логин: <strong>moderator</strong> | Пароль: <strong>mod123</strong>
                  </code>
                </div>
                <div className="bg-white p-2 rounded border border-green-300">
                  <p className="text-xs font-semibold text-green-700 mb-1">👤 Пользователи (пароль: user123):</p>
                  <div className="text-xs font-mono text-green-900 space-y-1">
                    <div>• <strong>ivanov</strong> - Frontend Developer (Разработка)</div>
                    <div>• <strong>petrova</strong> - Backend Developer (Разработка)</div>
                    <div>• <strong>sidorov</strong> - UI/UX Designer (Дизайн)</div>
                    <div>• <strong>kozlova</strong> - Project Manager (Менеджмент)</div>
                    <div>• <strong>nikolaev</strong> - Marketing Specialist (Маркетинг)</div>
                    <div>• <strong>fedorova</strong> - HR Manager (HR)</div>
                    <div>• <strong>morozov</strong> - Financial Analyst (Финансы)</div>
                    <div>• <strong>volkova</strong> - Sales Manager (Продажи)</div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-blue-800 mt-2">
                <i className="fas fa-lightbulb mr-1"></i>
                Если не работает, очистите localStorage в консоли браузера (F12)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
