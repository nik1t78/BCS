/** Ключ даты в формате YYYY-MM-DD (локальное время) — общий для календарей */
export const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Ключ даты YYYY-MM-DD из значения встречи (ISO-строка или Date) БЕЗ учёта
 *  часового пояса: new Date("2026-10-29") трактуется как UTC-полночь и в
 *  западных TZ даёт «28.10» — поэтому берём первые 10 символов строки как есть. */
export const dateKeyOf = (v: string | Date): string => {
  if (typeof v === "string") return v.slice(0, 10);
  return toDateKey(v);
};

/** Дата «2026-10-29» -> «29.10.2026» БЕЗ часовых поясов (парсим компоненты
 *  строки, а не new Date(string): новый Date("2026-10-29") = UTC-полночь, и в
 *  таймзонах западнее UTC toLocaleDateString() показывает «28.10.2026». */
export const formatRuDate = (v: string | Date): string => {
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  }
  const d = typeof v === "string" ? new Date(v) : v;
  return toDateKey(d).split("-").reverse().join(".");
};

/** Прибавить минуты к строке HH:mm с переносом через полночь («23:50»+30 → «00:20»).
 *  Раньше везде складывали минуты напрямую: Math.floor(total/60) без % 24 давал
 *  невалидные «24:00», которые input[type=time] отклоняет, а сервер — правилом
 *  regex H:i (422). Это и было причиной «выбрал 12:58, записало/не создало». */
export const addMinToHm = (hm: string, addMinutes: number): string => {
  const m = hm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hm;
  let total = Number(m[1]) * 60 + Number(m[2]) + addMinutes;
  if (total < 0) total = 0;
  if (total >= 24 * 60) total = 24 * 60 - 1; // 23:59 — за полночь встречи не планируем
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** Полночь ЛОКАЛЬНОГО дня для ключа даты YYYY-MM-DD или Date (для сравнений
 *  «в пределах недели» и т.п.) — без сдвига на UTC-полночь. */
export const startOfDayLocal = (v: string | Date): Date => {
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = typeof v === "string" ? new Date(v) : v;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
