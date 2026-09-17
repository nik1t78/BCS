import React, { useState, useEffect } from 'react';
import { login, register, getAdminTempPassword, mustChangePassword, setPasswordChanged, getCurrentUser, updateUser } from '../store';

interface AuthPageProps {
  onLogin: () => void;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'changePassword'>('login');
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    // Получаем временный пароль администратора если он есть
    const temp = getAdminTempPassword();
    if (temp) {
      setTempPassword(temp);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    setTimeout(() => {
      const result = login(loginValue, password);
      if (result.success) {
        // Проверяем нужно ли сменить пароль
        const user = getCurrentUser();
        if (user && mustChangePassword(user.id)) {
          setMode('changePassword');
        } else {
          onLogin();
        }
      } else {
        setError(result.error || 'Ошибка входа');
      }
      setLoading(false);
    }, 500);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const user = getCurrentUser();
      if (user) {
        // Обновляем пароль пользователя
        const updatedUser = { ...user, password: newPassword };
        updateUser(updatedUser);
        
        // Убираем флаг обязательной смены пароля
        setPasswordChanged(user.id);
        
        // Очищаем временный пароль если это был админ
        if (user.role === 'admin') {
          localStorage.removeItem('vks_admin_temp_password');
        }
        
        onLogin();
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
          {/* Форма смены пароля */}
          {mode === 'changePassword' ? (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 text-center">Смена пароля</h2>
                <p className="text-sm text-gray-600 text-center mt-2">
                  Необходимо установить новый пароль
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <i className="fas fa-exclamation-circle mr-2"></i>
                  {error}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Новый пароль *</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="Минимум 6 символов"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Подтвердите пароль *</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="Повторите пароль"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Сохранение...' : 'Сохранить пароль'}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Табы Вход/Регистрация */}
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

              {/* Форма входа */}
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
                /* Форма регистрации */
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

              {/* Информация о временном пароле администратора */}
              {tempPassword && mode === 'login' && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-semibold text-yellow-900 mb-2">
                    <i className="fas fa-key mr-1"></i>
                    Первый вход в систему
                  </p>
                  <p className="text-xs text-yellow-800 mb-2">
                    Временный пароль администратора:
                  </p>
                  <div className="bg-white p-2 rounded border border-yellow-300">
                    <code className="text-sm font-mono text-yellow-900 break-all">
                      Логин: <strong>admin</strong><br/>
                      Пароль: <strong>{tempPassword}</strong>
                    </code>
                  </div>
                  <p className="text-xs text-yellow-800 mt-2">
                    <i className="fas fa-info-circle mr-1"></i>
                    После входа необходимо сменить пароль
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
