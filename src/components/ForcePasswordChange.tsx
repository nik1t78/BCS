import React, { useState } from "react";
import { changePassword, logout } from "../store-api";

interface Props {
  userName: string;
  onChanged: () => void; // успешная смена — снимаем требование
  onLogout: () => void; // выйти и сменить пароль позже нельзя, но даём выход
}

// Форс-модалка: показывается при user.mustChangePassword === true
// (после регистрации админом или сброса пароля). Не закрывается без смены пароля.
export default function ForcePasswordChange({ userName, onChanged, onLogout }: Props) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (next.length < 6) {
      setError("Новый пароль должен быть не короче 6 символов");
      return;
    }
    if (next !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    if (next === current) {
      setError("Новый пароль должен отличаться от текущего");
      return;
    }
    setSaving(true);
    const ok = await changePassword(current, next);
    setSaving(false);
    if (ok) onChanged();
    else setError("Не удалось сменить пароль. Проверьте текущий пароль и подключение к серверу.");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <i className="fas fa-key text-amber-600 dark:text-amber-400"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Требуется смена пароля</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Здравствуйте, {userName}! Вы вошли по временному паролю.
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          В целях безопасности установите собственный пароль. До этого момента работа с системой недоступна.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Текущий (временный) пароль
            </label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Новый пароль (мин. 6 символов)
            </label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Повторите новый пароль
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Выйти
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-medium"
            >
              {saving ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>Сохранение...
                </>
              ) : (
                "Сменить пароль"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
