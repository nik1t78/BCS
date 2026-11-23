import { Meeting } from "../types";
import { expandOccurrences } from "./recurrence";

// Длительность в минутах
const durationMinutes = (m: Meeting): number => {
  const [sh, sm] = m.startTime.split(":").map(Number);
  const [eh, em] = m.endTime.split(":").map(Number);
  return Math.max(5, eh * 60 + em - (sh * 60 + sm));
};

const recurringLabel = (m: Meeting): string => {
  switch (m.recurring) {
    case "daily":
      return "Ежедневно";
    case "weekly":
      return "Еженедельно";
    case "monthly":
      return "Ежемесячно";
    default:
      return "Без повтора";
  }
};

const statusLabel = (s: Meeting["status"]): string => {
  switch (s) {
    case "scheduled":
      return "Запланирована";
    case "completed":
      return "Завершена";
    case "cancelled":
      return "Отменена";
    default:
      return s;
  }
};

const priorityLabel = (p: Meeting["priority"]): string => {
  switch (p) {
    case "low":
      return "Низкий";
    case "medium":
      return "Средний";
    case "high":
      return "Высокий";
    default:
      return p;
  }
};

const saveBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Экспорт расписания в файл Excel (.xlsx): одна строка на каждый день встречи,
// повторяющиеся встречи разворачиваются на 3 месяца вперёд.
// ExcelJS (~1 МБ) грузится динамически — библиотека не попадает в стартовый
// бандл страницы «Админка», а подгружается только при нажатии «Скачать Excel».
export async function exportToExcel(meetings: Meeting[], username: string): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ВКС Расписание";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Расписание", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Название", key: "title", width: 36 },
    { header: "Дата", key: "date", width: 12 },
    { header: "Начало", key: "startTime", width: 9 },
    { header: "Конец", key: "endTime", width: 9 },
    { header: "Длительность, мин", key: "duration", width: 15 },
    { header: "Комната / место", key: "room", width: 20 },
    { header: "Организатор", key: "organizer", width: 20 },
    { header: "Участники", key: "participants", width: 32 },
    { header: "Статус", key: "status", width: 15 },
    { header: "Приоритет", key: "priority", width: 12 },
    { header: "Повтор", key: "recurring", width: 14 },
    { header: "Повтор до", key: "repeatUntil", width: 12 },
    { header: "Ссылка", key: "link", width: 40 },
    { header: "Описание", key: "description", width: 44 },
  ];

  // Стиль шапки
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  // Разворачываем повторы на 3 месяца вперёд, чтобы в таблице были все ближайшие дни
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 92);
  const occurrences = expandOccurrences(meetings, from, to);

  occurrences
    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
    .forEach((m) => {
      const row = sheet.addRow({
        title: m.title,
        date: m.date,
        startTime: m.startTime,
        endTime: m.endTime,
        duration: durationMinutes(m),
        room: m.room || "Онлайн",
        organizer: (m as any).organizerName || username,
        participants: (m.participants || []).join(", "),
        status: statusLabel(m.status),
        priority: priorityLabel(m.priority),
        recurring: recurringLabel(m),
        repeatUntil: m.repeatUntil || "",
        link: m.link || "",
        description: m.description || "",
      });
      if (m.status === "cancelled") {
        row.font = { italic: true, color: { argb: "FF9CA3AF" } };
      }
      if (m.link) {
        const cell = row.getCell("link");
        cell.value = { text: m.link, hyperlink: m.link };
        cell.font = { color: { argb: "FF2563EB" }, underline: true };
      }
    });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `vks-raspisanie-${username}.xlsx`
  );
}


export interface AnalyticsReportData {
  generatedAt: string;
  totals: { total: number; scheduled: number; inProgress: number; completed: number; cancelled: number; thisWeek: number; highPriority: number; organized: number; participating: number };
  daily: { label: string; value: number }[];
  weekly: { label: string; value: number }[];
  rooms: { label: string; count: number }[];
  organizers: { label: string; count: number }[];
}

/** Экспорт сводного отчёта по аналитике в отдельную книгу Excel. */
export async function exportAnalyticsReport(data: AnalyticsReportData, username: string): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ВКС Расписание";
  workbook.created = new Date(data.generatedAt);

  const overview = workbook.addWorksheet("Показатели");
  overview.columns = [
    { header: "Показатель", key: "label", width: 32 },
    { header: "Значение", key: "value", width: 18 },
  ];
  overview.addRows([
    { label: "Всего конференций", value: data.totals.total },
    { label: "Запланированные", value: data.totals.scheduled },
    { label: "В процессе", value: data.totals.inProgress },
    { label: "Завершённые", value: data.totals.completed },
    { label: "Отменённые", value: data.totals.cancelled },
    { label: "На этой неделе", value: data.totals.thisWeek },
    { label: "Высокий приоритет", value: data.totals.highPriority },
    { label: "Организовано мной", value: data.totals.organized },
    { label: "Участвую в", value: data.totals.participating },
    { label: "Сформирован", value: data.generatedAt },
  ]);

  const dynamics = workbook.addWorksheet("Динамика");
  dynamics.columns = [
    { header: "Период", key: "period", width: 24 },
    { header: "Тип периода", key: "type", width: 18 },
    { header: "Количество конференций", key: "count", width: 28 },
  ];
  data.daily.forEach((item) => dynamics.addRow({ period: item.label, type: "День", count: item.value }));
  data.weekly.forEach((item) => dynamics.addRow({ period: item.label, type: "Неделя", count: item.value }));

  const rooms = workbook.addWorksheet("Залы");
  rooms.columns = [
    { header: "Переговорная", key: "label", width: 36 },
    { header: "Количество конференций", key: "count", width: 28 },
  ];
  data.rooms.forEach((item) => rooms.addRow(item));

  const organizers = workbook.addWorksheet("Организаторы");
  organizers.columns = [
    { header: "Организатор", key: "label", width: 36 },
    { header: "Количество конференций", key: "count", width: 28 },
  ];
  data.organizers.forEach((item) => organizers.addRow(item));

  workbook.worksheets.forEach((sheet) => {
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    header.alignment = { vertical: "middle", horizontal: "center" };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columnCount },
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `vks-analytics-${username}.xlsx`
  );
}
