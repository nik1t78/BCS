import React from 'react';

export default function Templates({ userId }: { userId: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Шаблоны конференций</h2>
      <p className="text-gray-600 dark:text-gray-400">Управление шаблонами</p>
    </div>
  );
}
