import React from 'react';
import { getTheme, setTheme } from '../store';

export default function ThemeToggle() {
  const [theme, setCurrentTheme] = React.useState<'light' | 'dark'>(getTheme());

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    setCurrentTheme(newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      title={theme === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему'}
    >
      {theme === 'light' ? (
        <i className="fas fa-moon text-gray-600 dark:text-gray-300"></i>
      ) : (
        <i className="fas fa-sun text-yellow-500"></i>
      )}
    </button>
  );
}
