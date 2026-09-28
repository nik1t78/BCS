import { Meeting } from '../types';

export type SortMode = 'smart' | 'soonest' | 'latest' | 'title' | 'newest';

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'smart', label: 'Умная сортировка (сначала сегодняшние)' },
  { value: 'soonest', label: 'Сначала ближайшие' },
  { value: 'latest', label: 'Сначала поздние' },
  { value: 'title', label: 'По названию (А–Я)' },
  { value: 'newest', label: 'По дате создания' },
];

const toDateTime = (m: Meeting) => `${m.date}T${m.startTime || '00:00'}:00`;

/** Группа встречи для «умной» сортировки */
export function getMeetingGroup(m: Meeting): { key: string; label: string } {
  if (m.status === 'completed' || m.status === 'cancelled') {
    return { key: 'past', label: 'Прошедшие и отменённые' };
  }
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
  const dt = toDateTime(m);
  const nowStr = new Date().toISOString().slice(0, 16);
  if (dt.slice(0, 10) === iso(today)) return { key: 'today', label: 'Сегодня' };
  if (dt.slice(0, 10) === iso(tomorrow)) return { key: 'tomorrow', label: 'Завтра' };
  if (dt.slice(0, 10) <= iso(weekEnd)) return { key: 'week', label: 'Ближайшая неделя' };
  if (dt < nowStr) return { key: 'overdue', label: 'Без точной даты' };
  return { key: 'later', label: 'Позже' };
}

const GROUP_ORDER = ['today', 'tomorrow', 'week', 'later', 'overdue', 'past'];

function compareBy(mode: SortMode, a: Meeting, b: Meeting): number {
  switch (mode) {
    case 'soonest':
      return toDateTime(a).localeCompare(toDateTime(b));
    case 'latest':
      return toDateTime(b).localeCompare(toDateTime(a));
    case 'title':
      return a.title.localeCompare(b.title, 'ru');
    case 'newest':
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    case 'smart':
    default: {
      const ga = GROUP_ORDER.indexOf(getMeetingGroup(a).key);
      const gb = GROUP_ORDER.indexOf(getMeetingGroup(b).key);
      if (ga !== gb) return ga - gb;
      // внутри группы — по времени; в прошедших — наоборот (сначала недавние)
      const da = toDateTime(a), db = toDateTime(b);
      return getMeetingGroup(a).key === 'past' ? db.localeCompare(da) : da.localeCompare(db);
    }
  }
}

export function sortMeetings(list: Meeting[], mode: SortMode): Meeting[] {
  return [...list].sort((a, b) => compareBy(mode, a, b));
}
