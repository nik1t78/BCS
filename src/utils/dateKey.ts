/** Ключ даты в формате YYYY-MM-DD (локальное время) — общий для календарей */
export const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
