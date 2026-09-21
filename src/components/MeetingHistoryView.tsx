import React, { useState, useEffect } from 'react';
import { MeetingHistory } from '../types';
import { getMeetingHistory } from '../store-api';

interface MeetingHistoryProps {
  meetingId: string;
}

export default function MeetingHistoryView({ meetingId }: MeetingHistoryProps) {
  const [history, setHistory] = useState<MeetingHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [meetingId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await getMeetingHistory(meetingId);
      setHistory(data);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string): string => {
    switch (action) {
      case 'created': return 'Создана';
      case 'updated': return 'Обновлена';
      case 'status_changed': return 'Статус изменён';
      case 'deleted': return 'Удалена';
      default: return action;
    }
  };

  const getActionIcon = (action: string): string => {
    switch (action) {
      case 'created': return 'fa-plus-circle text-green-500';
      case 'updated': return 'fa-edit text-blue-500';
      case 'status_changed': return 'fa-exchange-alt text-purple-500';
      case 'deleted': return 'fa-trash text-red-500';
      default: return 'fa-circle text-gray-500';
    }
  };

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'created': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'updated': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'status_changed': return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
      case 'deleted': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      default: return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
            <p className="text-gray-600 dark:text-gray-400">Загрузка истории...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
        <i className="fas fa-history mr-2 text-orange-500"></i>
        История изменений
      </h3>

      {history.length > 0 ? (
        <div className="space-y-3">
          {history.map(entry => (
            <div
              key={entry.id}
              className={`rounded-lg border p-4 ${getActionColor(entry.action)}`}
            >
              <div className="flex items-start gap-3">
                <div className="text-xl mt-1">
                  <i className={`fas ${getActionIcon(entry.action)}`}></i>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-800 dark:text-gray-100">
                      {getActionLabel(entry.action)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(entry.createdAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  
                  {entry.oldValues && entry.newValues && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {Object.keys(entry.newValues).map(key => {
                        const oldValue = entry.oldValues[key];
                        const newValue = entry.newValues[key];
                        if (oldValue !== newValue) {
                          return (
                            <div key={key}>
                              <span className="font-medium">{key}:</span>{' '}
                              <span className="text-red-500 line-through">{oldValue || '—'}</span>
                              {' → '}
                              <span className="text-green-500">{newValue || '—'}</span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}

                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <i className="fas fa-globe mr-1"></i>
                    {entry.ipAddress}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
          <i className="fas fa-history text-4xl mb-3"></i>
          <p>Нет истории изменений</p>
        </div>
      )}
    </div>
  );
}
