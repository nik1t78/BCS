import React from 'react';
import { User } from '../types';

export default function Stats({ user }: { user: User }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Статистика</h2>
      <p className="text-gray-600 dark:text-gray-400">Аналитика и отчёты</p>
    </div>
  );
}
