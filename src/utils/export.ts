import { Meeting } from '../types';

export function exportToICS(meetings: Meeting[], username: string): void {
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ВКС Расписание//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:ВКС Расписание',
    `X-WR-TIMEZONE:Europe/Moscow`,
  ];

  meetings.forEach(meeting => {
    const startDate = meeting.date.replace(/-/g, '') + 'T' + meeting.startTime.replace(':', '') + '00';
    const endDate = meeting.date.replace(/-/g, '') + 'T' + meeting.endTime.replace(':', '') + '00';
    const created = new Date(meeting.createdAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    icsContent.push(
      'BEGIN:VEVENT',
      `UID:${meeting.id}@vks.local`,
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:${meeting.title}`,
      `DESCRIPTION:${meeting.description || 'Видеоконференция'}`,
      `LOCATION:${meeting.room || 'Онлайн'}`,
      `URL:${meeting.link || ''}`,
      `DTSTAMP:${created}`,
      `CREATED:${created}`,
      'END:VEVENT'
    );
  });

  icsContent.push('END:VCALENDAR');

  const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vks-schedule-${username}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToJSON(meetings: Meeting[], filename: string): void {
  const json = JSON.stringify(meetings, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToCSV(meetings: Meeting[], filename: string): void {
  const headers = ['Название', 'Дата', 'Начало', 'Конец', 'Комната', 'Статус', 'Приоритет', 'Ссылка'];
  const rows = meetings.map(m => [
    `"${m.title}"`,
    m.date,
    m.startTime,
    m.endTime,
    `"${m.room || 'Онлайн'}"`,
    m.status,
    m.priority,
    m.link || '',
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
