// Лёгкий локальный store: только тема оформления и полный сброс данных.
// Все бизнес-данные (пользователи, конференции, уведомления) работают через
// Laravel API (см. src/store-api.ts). Раньше здесь хранились копии всех
// данных в localStorage — из-за этого браузеры пользователей «подвисали»:
// каждый запуск дописывал в localStorage демо-пользователей и конференции,
// они копились месяцами, забивали квоту и замедляли приложение.

export function getTheme(): "light" | "dark" {
  return (localStorage.getItem("vks_theme") as "light" | "dark") || "light";
}

export function setTheme(theme: "light" | "dark"): void {
  localStorage.setItem("vks_theme", theme);
}

// Полный сброс локальных данных браузера (только локальные настройки;
// серверные данные не затрагиваются). Используется кнопкой администратора.
export function forceReset(): void {
  const theme = getTheme();
  localStorage.clear();
  setTheme(theme);
}
