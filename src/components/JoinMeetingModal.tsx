import React, { useState } from 'react';
import { Meeting } from '../types';

interface JoinMeetingModalProps {
  meeting: Meeting;
  onClose: () => void;
}

export default function JoinMeetingModal({ meeting, onClose }: JoinMeetingModalProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    if (meeting.link) {
      navigator.clipboard.writeText(meeting.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const joinMeeting = () => {
    if (meeting.link) {
      // Открываем ссылку, которую предоставил пользователь
      window.open(meeting.link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <i className="fas fa-video text-blue-500"></i>
              Подключение к конференции
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          {/* Meeting Info */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white mb-6">
            <h3 className="text-xl font-bold mb-2">{meeting.title}</h3>
            {meeting.description && (
              <p className="text-blue-100 mb-4">{meeting.description}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <i className="far fa-calendar mr-2"></i>
                <span className="font-medium">{new Date(meeting.date).toLocaleDateString('ru-RU')}</span>
              </div>
              <div>
                <i className="far fa-clock mr-2"></i>
                <span className="font-medium">{meeting.startTime} - {meeting.endTime}</span>
              </div>
              {meeting.room && (
                <div>
                  <i className="fas fa-map-marker-alt mr-2"></i>
                  <span className="font-medium">{meeting.room}</span>
                </div>
              )}
            </div>
          </div>

          {/* Connection Options */}
          {meeting.link ? (
            <div className="space-y-4">
              {/* Join Button */}
              <button
                onClick={joinMeeting}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-3 shadow-lg"
              >
                <i className="fas fa-external-link-alt text-2xl"></i>
                <span>Открыть ссылку на конференцию</span>
              </button>

              {/* Link Info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ссылка для подключения
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={meeting.link}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
                  />
                  <button
                    onClick={copyLink}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      copied
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {copied ? (
                      <>
                        <i className="fas fa-check mr-1"></i>
                        Скопировано
                      </>
                    ) : (
                      <>
                        <i className="fas fa-copy mr-1"></i>
                        Копировать
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                  <i className="fas fa-info-circle"></i>
                  Как подключиться
                </h4>
                <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 list-decimal list-inside">
                  <li>Нажмите кнопку "Открыть ссылку на конференцию" выше</li>
                  <li>Откроется новая вкладка с конференцией</li>
                  <li>Разрешите доступ к камере и микрофону (если потребуется)</li>
                  <li>Дождитесь подключения к конференции</li>
                  <li>Если требуется, введите имя участника</li>
                </ol>
              </div>

              {/* Tips */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                <h4 className="font-bold text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
                  <i className="fas fa-lightbulb"></i>
                  Полезные советы
                </h4>
                <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
                  <li>• Убедитесь, что у вас стабильное интернет-соединение</li>
                  <li>• Проверьте настройки микрофона и камеры перед подключением</li>
                  <li>• Используйте наушники для лучшего качества звука</li>
                  <li>• Выберите тихое место для проведения конференции</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
              <i className="fas fa-exclamation-triangle text-red-500 text-4xl mb-3"></i>
              <h4 className="font-bold text-red-900 dark:text-red-100 mb-2">
                Ссылка на конференцию не указана
              </h4>
              <p className="text-red-700 dark:text-red-300 text-sm">
                Обратитесь к организатору для получения ссылки на подключение
              </p>
            </div>
          )}

          {/* Participants */}
          {meeting.participants.length > 0 && (
            <div className="mt-6 pt-6 border-t dark:border-gray-600">
              <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                <i className="fas fa-users text-purple-500"></i>
                Участники ({meeting.participants.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {meeting.participants.map((participantId, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-sm"
                  >
                    <i className="fas fa-user text-xs"></i>
                    Участник #{index + 1}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-6 border-t dark:border-gray-600 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Закрыть
            </button>
            {meeting.link && (
              <button
                onClick={joinMeeting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <i className="fas fa-external-link-alt"></i>
                Открыть ссылку
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
