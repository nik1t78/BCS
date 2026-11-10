import React, { useState } from "react";
import { login, register } from "../store-api";

interface AuthPageProps {
  onLogin: () => void;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Кнопка-«глазик» показа/скрытия пароля
  const EyeToggle = ({ shown, onToggle }: { shown: boolean; onToggle: () => void }) => (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      aria-label={shown ? "Скрыть пароль" : "Показать пароль"}
      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors"
    >
      <i className={`fas ${shown ? "fa-eye-slash" : "fa-eye"}`}></i>
    </button>
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login(loginValue, password);
      if (result.success) {
        onLogin();
      } else {
        setError(result.error || "Ошибка входа");
      }
    } catch (error: any) {
      setError(error.message || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name || !loginValue || !password) {
      setError("Заполните все обязательные поля");
      return;
    }
    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }
    // Проверка ФИО: только буквы, пробелы и дефисы (кириллица/латиница), минимум два слова
    const fio = name.trim().replace(/\s+/g, " ");
    if (!/^[А-Яа-яЁёA-Za-z]+(?:[ -][А-Яа-яЁёA-Za-z]+)+$/.test(fio)) {
      setError("Укажите ФИО полностью: фамилия и имя (только буквы, без цифр и символов)");
      return;
    }
    if (!/[A-Za-zА-Яа-яЁё]/.test(password) || !/[0-9]/.test(password)) {
      setError("Пароль должен содержать хотя бы одну букву и одну цифру");
      return;
    }
    if (password2 !== password) {
      setError("Пароли не совпадают — проверьте поле «Подтверждение пароля»");
      return;
    }
    if (phone && !/^\+?[\d\s()-]{7,18}$/.test(phone.trim())) {
      setError("Телефон указан неверно (пример: +7 (999) 123-45-67)");
      return;
    }
    if (!department.trim()) {
      setError("Укажите отдел — он нужен для корректного отображения в системе");
      return;
    }

    setLoading(true);

    try {
      const result = await register(name, loginValue, password, phone, department);
      if (result.success) {
        onLogin();
      } else {
        setError(result.error || "Ошибка регистрации");
      }
    } catch (error: any) {
      setError(error.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
            <i className="fas fa-video text-white text-3xl"></i>
          </div>
          <h1 className="text-3xl font-bold text-white">ВКС</h1>
          <p className="text-blue-100 mt-2">Система управления видеоконференциями</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
                mode === "login" ? "bg-white shadow text-blue-600" : "text-gray-500"
              }`}
            >
              Вход
            </button>
            <button
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
                mode === "register" ? "bg-white shadow text-blue-600" : "text-gray-500"
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

          {mode === "login" ? (
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
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="••••••••"
                  />
                  <EyeToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Вход..." : "Войти"}
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
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="Минимум 6 символов: буквы и цифры"
                  />
                  <EyeToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Подтверждение пароля *</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    className={`w-full px-3 py-2.5 pr-10 border rounded-lg focus:outline-none ${
                      password2 && password2 !== password
                        ? "border-red-300 focus:border-red-500"
                        : "border-gray-200 focus:border-blue-500"
                    }`}
                    placeholder="Повторите пароль"
                  />
                  <EyeToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
                </div>
                {password2 && password2 !== password && (
                  <p className="mt-1 text-xs text-red-600">Пароли не совпадают</p>
                )}
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
                {loading ? "Регистрация..." : "Зарегистрироваться"}
              </button>
            </form>
          )}

          {/* Подсказка по входу (демо-данные на экране авторизации скрыты) */}
        </div>
      </div>
    </div>
  );
}
