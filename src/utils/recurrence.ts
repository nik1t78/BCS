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
    case 'custom':
      return matchesRrule(meeting.rrule ?? '', base, date);
    default:
      return false;
  }
}

// ==================== Упрощённый RRULE (RFC 5545 subset) ====================
// Поддерживается: FREQ=DAILY|WEEKLY|MONTHLY;INTERVAL=n;BYDAY=MO,TU,...;
// BYSETPOS=-1 (например «последняя пятница месяца»: FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1);
// COUNT=n. UNTIL обрабатывается через repeatUntil в основной модели.

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export interface ParsedRRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  byDay: number[];   // 0=Sun..6=Sat, пусто = день базовой даты
  bySetPos: number | null; // -1 = последний, 1 = первый и т.д.
  count: number | null;
}

export function parseRRule(rrule: string): ParsedRRule | null {
  if (!rrule) return null;
  const parts = Object.fromEntries(
    rrule.replace(/^RRULE:/i, '').split(';').filter(Boolean).map((kv) => {
      const [k, v] = kv.split('=');
      return [(k ?? '').trim().toUpperCase(), (v ?? '').trim().toUpperCase()];
    })
  );
  const freqRaw = parts.FREQ as string;
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(freqRaw)) return null;
  const byDay = (parts.BYDAY ?? '')
    .split(',')
    .map((d) => DAY_CODES.indexOf(d.replace(/^[+-]?\d+/, '')))
    .filter((d) => d >= 0);
  return {
    freq: freqRaw as ParsedRRule['freq'],
    interval: Math.max(1, parseInt(parts.INTERVAL ?? '1', 10) || 1),
    byDay,
    bySetPos: parts.BYSETPOS != null ? parseInt(parts.BYSETPOS, 10) || null : null,
    count: parts.COUNT != null ? parseInt(parts.COUNT, 10) || null : null,
  };
}

/** Человекочитаемое описание простого RRULE для UI */
export function describeRRule(rrule: string): string {
  const r = parseRRule(rrule);
  if (!r) return rrule || '';
  const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const every = r.interval > 1 ? `каждые ${r.interval} ` : 'кажд.';
  if (r.freq === 'DAILY') return `${every}${r.interval > 1 ? 'дн.' : 'день'}`;
  if (r.freq === 'WEEKLY')
    return `${every}нед.${r.byDay.length ? ' ' + r.byDay.map((d) => days[d]).join(', ') : ''}`;
  if (r.bySetPos != null && r.byDay.length) {
    const posLabel = r.bySetPos === -1 ? 'последн.' : `#${r.bySetPos}`;
    return `кажд. мес., ${posLabel} ${r.byDay.map((d) => days[d]).join(', ')}`;
  }
  return `${every}мес.`;
}

function matchesRrule(rrule: string, base: Date, date: Date): boolean {
  const r = parseRRule(rrule);
  if (!r) return false;

  const dayDiff = Math.round((date.getTime() - base.getTime()) / 86400000);
  if (dayDiff <= 0) return false;

  // COUNT: ограничиваем номер occurrence — считаем сколько совпадений было до date
  if (r.count != null) {
    let occurrences = 0;
    const cursor = new Date(base);
    for (let i = 0; i < 400; i++) {
      if (cursor > date) break;
      if (matchesRruleNoCount(r, base, cursor)) occurrences++;
      if (occurrences > r.count) return false;
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return matchesRruleNoCount(r, base, date);
}

function matchesRruleNoCount(r: ParsedRRule, base: Date, date: Date): boolean {
  const dayDiff = Math.round((date.getTime() - base.getTime()) / 86400000);
  if (dayDiff <= 0) return false;

  if (r.freq === 'DAILY') {
    return dayDiff % r.interval === 0 && (r.byDay.length === 0 || r.byDay.includes(date.getDay()));
  }

  if (r.freq === 'WEEKLY') {
    const baseWeek = Math.floor(dayDiff / 7);
    if (baseWeek % r.interval !== 0) return false;
    const targetDays = r.byDay.length ? r.byDay : [base.getDay()];
    return targetDays.includes(date.getDay());
  }

  // MONTHLY
  const monthsDiff = (date.getFullYear() - base.getFullYear()) * 12 + (date.getMonth() - base.getMonth());
  if (monthsDiff < 0 || monthsDiff % r.interval !== 0) return false;

  const targetDays = r.byDay.length ? r.byDay : [base.getDay()];

  if (r.bySetPos != null) {
    // «N-й (или последний) указанный день месяца»
    const all = daysOfMonthMatching(date.getFullYear(), date.getMonth(), targetDays);
    const idx = r.bySetPos === -1 ? all.length - 1 : r.bySetPos - 1;
    return idx >= 0 && all[idx] === date.getDate();
  }

  if (r.byDay.length) {
    // BYDAY без BYSETPOS: все указанные дни недели в месяце
    return targetDays.includes(date.getDay());
  }
  // по дате месяца (как monthly), с учётом интервала
  return date.getDate() === base.getDate();
}

function daysOfMonthMatching(year: number, month: number, weekdays: number[]): number[] {
  const result: number[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    if (weekdays.includes(new Date(year, month, d).getDay())) result.push(d);
  }
  return result;
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
