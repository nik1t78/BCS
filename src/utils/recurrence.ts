// Разворачивание повторяющихся конференций (recurring) в конкретные даты.
// В БЭке хранится одна запись встречи с полем recurring ('daily' | 'weekly' |
// 'monthly') и опциональной датой окончания repeatUntil. Календарь и ICS-экспорт
// показывают встречу во всех подходящих днях, а не только в день создания.

import { Meeting } from '../types';

const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const MEETING_OCCURRENCES_LIMIT_DAYS = 92; // ~3 месяца вперёд

/**
 * Возвращает true, если встреча «происходит» в указанный день
 * (с учётом повтора daily/weekly/monthly и repeatUntil).
 */
export function occursOn(meeting: Meeting, date: Date): boolean {
  const dayKey = toDateKey(date);
  if (meeting.date === dayKey) return true;

  if (!meeting.recurring || meeting.recurring === 'none') return false;
  if (meeting.status === 'cancelled') return false;
  if (meeting.repeatUntil && dayKey > meeting.repeatUntil) return false;
  if (dayKey <= meeting.date) return false;

  // Ограничиваем горизонт развёртывания, чтобы не перебирать вечность
  const horizon = new Date(date);
  horizon.setDate(horizon.getDate() - MEETING_OCCURRENCES_LIMIT_DAYS);
  if (new Date(meeting.date) < horizon) return false;

  const base = new Date(`${meeting.date}T00:00:00`);
  switch (meeting.recurring) {
    case 'daily':
      return true;
    case 'weekly':
      return base.getDay() === date.getDay();
    case 'monthly':
      return base.getDate() === date.getDate();
    default:
      return false;
  }
}

/**
 * Помечает occurrence-копию: меняет id (чтобы React не ругался на дубли key)
 * и подставляет фактическую дату. Оригинальные объекты не мутируются.
 */
export function withDate(meeting: Meeting, date: Date): Meeting {
  return { ...meeting, date: toDateKey(date), _occurrenceOf: meeting.id } as Meeting;
}

/**
 * Для списка встреч возвращает «развёрнутый» список occurrences в диапазоне
 * [fromDate, toDate] включительно. Неповторяющиеся встречи проходят как есть,
 * если их дата попадает в диапазон.
 */
export function expandOccurrences(meetings: Meeting[], fromDate: Date, toDate: Date): Meeting[] {
  const result: Meeting[] = [];
  const fromKey = toDateKey(fromDate);
  const toKey = toDateKey(toDate);

  for (const m of meetings) {
    if (!m.recurring || m.recurring === 'none') {
      if (m.date >= fromKey && m.date <= toKey) result.push(m);
      continue;
    }
    for (let i = 0; i <= MEETING_OCCURRENCES_LIMIT_DAYS; i++) {
      const d = new Date(fromDate);
      d.setDate(d.getDate() + i);
      const key = toDateKey(d);
      if (key > toKey) break;
      if (occursOn(m, d)) result.push(withDate(m, d));
    }
  }

  return result.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}
