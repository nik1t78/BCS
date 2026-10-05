import { Meeting } from "../types";

// Экспорт конференции в формат .ics (RFC 5545) — для импорта в Outlook / Google Calendar

const pad = (n: number) => String(n).padStart(2, "0");

// Локальное время встречи переводим в UTC-строку формата YYYYMMDDTHHMMSSZ
const toIcsUtc = (dateStr: string, timeStr: string): string => {
  const [y, mo, d] = dateStr.slice(0, 10).split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").slice(0, 5).split(":").map(Number);
  const dt = new Date(y, (mo || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  return (
    `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}` +
    `T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}Z`
  );
};

// Экранирование символов по RFC 5545 (\ , ; и переносы строк)
const esc = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Разбиение длинных строк на строки не длиннее 75 октетов (склейка через CRLF + пробел)
const fold = (line: string): string => {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length > 0) {
    parts.push(" " + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  return parts.join("\r\n");
};

export function exportMeetingToIcs(meeting: Meeting): void {
  const uid = `vks-meeting-${meeting.id}@vks.local`;
  const stamp = toIcsUtc(new Date().toISOString().slice(0, 10), new Date().toTimeString().slice(0, 5));

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VKS Schedule//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsUtc(meeting.date, meeting.startTime)}`,
    `DTEND:${toIcsUtc(meeting.date, meeting.endTime)}`,
    `SUMMARY:${esc(meeting.title)}`,
  ];

  if (meeting.description) lines.push(`DESCRIPTION:${esc(meeting.description)}`);
  if (meeting.room) lines.push(`LOCATION:${esc(meeting.room)}`);
  if (meeting.link) {
    lines.push(`URL:${esc(meeting.link)}`);
    lines.push(
      `DESCRIPTION:${esc((meeting.description ? meeting.description + "\n\n" : "") + "Ссылка ВКС: " + meeting.link)}`
    );
  }

  // Напоминание за reminderMinutes минут до начала
  const rem = Number(meeting.reminderMinutes) || 15;
  lines.push(
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc("Напоминание: " + meeting.title)}`,
    `TRIGGER:-PT${rem}M`,
    "END:VALARM"
  );

  lines.push("END:VEVENT", "END:VCALENDAR");

  const content = lines.map(fold).join("\r\n") + "\r\n";
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${
    (meeting.title || "meeting")
      .replace(/[^\wа-яА-ЯёЁ\- ]/g, "")
      .trim()
      .replace(/\s+/g, "_") || "meeting"
  }.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
