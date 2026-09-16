import React, { useState } from 'react';

export default function ResetData() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [reset, setReset] = useState(false);

  const handleReset = () => {
    localStorage.clear();
    setReset(true);
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  if (reset) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 text-center">
          <i className="fas fa-check-circle text-green-500 text-5xl mb-4"></i>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Данные очищены!</h2>
          <p className="text-gray-600">Перезагрузка страницы...</p>
        </div>
      </div>
    );
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-red-600 transition-colors z-40"
        title="Сбросить все данные"
      >
        <i className="fas fa-trash mr-2"></i>
        Сброс данных
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="text-center mb-6">
          <i className="fas fa-exclamation-triangle text-yellow-500 text-5xl mb-4"></i>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Сбросить все данные?</h2>
          <p className="text-gray-600 text-sm">
            Это действие удалит все данные из localStorage:
          </p>
          <ul className="text-left text-sm text-gray-600 mt-3 space-y-1">
            <li>• Пользователей</li>
            <li>• Конференции</li>
            <li>• Уведомления</li>
            <li>• Настройки</li>
            <li>• Шаблоны</li>
            <li>• Теги</li>
          </ul>
          <p className="text-sm text-gray-500 mt-3">
            После сброса демо-данные загрузятся заново
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowConfirm(false)}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            <i className="fas fa-trash mr-2"></i>
            Сбросить
          </button>
        </div>
      </div>
    </div>
  );
}
