// Избранные конференции — хранятся локально в браузере (по id пользователя),
// т.к. на бэкенде нет таблицы избранных. Ключ: vks_favorites_<userId>

const key = (userId: string | number) => `vks_favorites_${userId}`;

export function getFavoriteIds(userId: string | number): Set<string> {
  try {
    const raw = localStorage.getItem(key(userId));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set((Array.isArray(arr) ? arr : []).map(String));
  } catch {
    return new Set();
  }
}

// Массовое добавление в избранное (для массовых действий в списке)
export function addFavorites(userId: string | number, meetingIds: (string | number)[]): Set<string> {
  const ids = getFavoriteIds(userId);
  meetingIds.forEach((id) => ids.add(String(id)));
  localStorage.setItem(key(userId), JSON.stringify([...ids]));
  return ids;
}

export function toggleFavorite(userId: string | number, meetingId: string | number): Set<string> {
  const ids = getFavoriteIds(userId);
  const id = String(meetingId);
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  localStorage.setItem(key(userId), JSON.stringify([...ids]));
  return ids;
}
