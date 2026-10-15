// Автогенерация ссылки на внутреннюю ВКС-платформу (источник — salutejazz.ru).
// Формат (по эталону реальной платформы):
//   https://salutejazz.ru/calls/<код>?psw=<пароль>
// где <код> — 8 строчных букв/цифр, <пароль> — 16 заглавных букв/цифр.
const CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const PWD_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const VKS_LINK_BASE = "https://salutejazz.ru/calls/";

function randomString(alphabet: string, length: number): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Сгенерировать случайный код комнаты, напр. "4dtjrrnb" (строчные a-z0-9) */
export function randomVksRoomCode(length = 8): string {
  return randomString(CODE_ALPHABET, length);
}

/** Сгенерировать пароль конференции, напр. "OEEPFQENBhwdUQgD" (заглавные A-Z0-9) */
export function randomVksPassword(length = 16): string {
  return randomString(PWD_ALPHABET, length);
}

/** Полная ссылка на ВКС: https://salutejazz.ru/calls/<код>?psw=<пароль> */
export function generateVksLink(): string {
  return `${VKS_LINK_BASE}${randomVksRoomCode()}?psw=${randomVksPassword()}`;
}

/**
 * Привести ссылку к каноническому виду перед отправкой на сервер.
 * ВАЖНО (фикс «не работает» при ручной вставке): ссылка может быть
 * вставлена/сохранена без протокола («salutejazz.ru/calls/xxx?psw=yyy»)
 * или с лишними пробелами/кириллицей/крайним нул-символом, скопированным
 * из чата. Laravel-валидатор `url` принимает только полные адреса со схемой,
 * поэтому такая ссылка отклонялась (422) и встреча не сохранялась.
 * Здесь: обрезаем мусор, при необходимости добавляем https:// и
 * пересобираем адрес через URL (проценты в пароле остаются целыми).
 */
export function sanitizeVksLink(link?: string | null): string {
  if (!link) return "";
  let s = String(link)
    .trim()
    // управляющие символы, которые приходят при копировании из мессенджеров
    .replace(/[\u0000-\u001F\u007F\u200B\uFEFF]/g, "")
    // неразрывные пробелы внутри ссылки (заменяем на обычный, затем чистим)
  .replace(/\u00A0/g, " ");
  // «Пригласить участников» копируют иногда целиком («Ссылка: https://... Пароль: ...») —
  // вырываем адрес встречи из произвольного текста; если его нет, берём первое слово
  const extracted = s.match(/(?:https?:\/\/)?(?:www\.)?salutejazz\.ru\/calls\/[^\s"'<>]+|(?:https?:\/\/)[^\s"'<>]*salutejazz\.ru\/calls\/[^\s"'<>]+/i);
  s = (extracted ? extracted[0] : s.split(/\s+/)[0]) || "";
  if (!s) return "";
  // «salutejazz.ru/...» / «www....» / «//host/...» — дописываем схему
  if (/^(www\.|salutejazz\.ru\/|\/\/)/i.test(s)) s = "https://" + s.replace(/^\/\//, "");
  try {
    let u: URL;
    try {
      u = new URL(s);
    } catch {
      // вставлен не-URL (например, скопирован текст приглашения целиком) —
      // вырываем ссылку salutejazz.ru/calls из текста и чистим её от хвоста
      const m = s.match(/(?:https?:\/\/)?(?:www\.)?salutejazz\.ru\/calls\/[A-Za-z0-9_-]+(?:\?psw=[A-Za-z0-9_-]+)?/i);
      if (!m) return s;
      u = new URL(m[0].startsWith("http") ? m[0] : "https://" + m[0].replace(/^\/\//, ""));
    }
    // http -> https для нашего хоста
    if (u.hostname === "salutejazz.ru" && u.protocol === "http:") u.protocol = "https:";
    // Платформа SaluteJazz принимает и короткие коды комнат («09pa0i», 6 символов),
    // не только эталонные 8-значные — никогда не отбрасываем их как «мусор».
    const shortCode = s.match(/\/calls\/([A-Za-z0-9_-]{4,})/);
    if (shortCode) {
      u.pathname = "/calls/" + shortCode[1];
      const pswMatch = s.match(/[?&]psw=([A-Za-z0-9_-]+)/i);
      if (pswMatch) u.search = "?psw=" + pswMatch[1];
      else if (!u.searchParams.get("psw")) u.search = "";
    }
    // вырванную из текста ссылку («...?psw=XXXПароль:YYY») чиним: код комнаты —
    // ровно один сегмент /calls/<код>, пароль — валидный psw или остаток query
    if (u.hostname === "salutejazz.ru" && /^\/calls\/[^/]+$/.test(u.pathname) === false) {
      const m = s.match(/\/calls\/([A-Za-z0-9_-]+)(?:[?&]psw=([A-Za-z0-9_-]+))?/i);
      if (m) {
        u.pathname = "/calls/" + m[1];
        u.search = m[2] ? "?psw=" + m[2] : "";
      }
    } else if (u.hostname === "salutejazz.ru") {
      const psw = u.searchParams.get("psw");
      if (psw && !/^[A-Za-z0-9_-]+$/.test(psw)) {
        const m = psw.match(/^([A-Za-z0-9_-]+)/);
        if (m) u.searchParams.set("psw", m[1]);
        else u.searchParams.delete("psw");
      }
    }
    return u.toString();
  } catch {
    return s;
  }
}

/** Проверка и «починка» ссылки до канонического вида платформы. */
export function normalizeVksLink(link: string): string {
  const clean = sanitizeVksLink(link);
  if (!isVksLink(clean)) return clean || link;
  // ВАЖНО: код комнаты и пароль НЕ меняем. Раньше сюда мог попасть
  // случайный psw при сохранении ссылки без пароля — из-за этого ссылка в
  // календаре «не совпадала» с живой комнатой на salutejazz.ru. Пароль
  // нужен только для новых автогенерируемых ссылок (generateVksLink).
  return clean;
}

/** Проверка: ссылка ли это на нашу ВКС-платформу */
export function isVksLink(link?: string | null): boolean {
  if (!link) return false;
  // принимаем и канонический вид, и «грязную» вставку из приглашения
  // («Ссылка: salutejazz.ru/calls/... Пароль: ... Войти») — sanitizeVksLink/
  // normalizeVksLink доведут её до полного адреса при сохранении
  const s = sanitizeVksLink(link);
  return /^https:\/\/(www\.)?salutejazz\.ru\/calls\//i.test(s);
}

/**
 * Собрать «правильную» ссылку для перехода в конференцию.
 * Платформа SaluteJazz принимает вход только по полному адресу:
 *   https://salutejazz.ru/calls/<код>?psw=<пароль>
 * Порядок поиска пароля: ?psw= в самой ссылке → поле meetingPassword карточки
 * встречи → любой фрагмент вида «...?psw=XXXX» внутри текстовых полей встречи
 * (описание, примечания). Если нигде не найден — возвращаем ссылку как есть,
 * и платформа покажет экран ввода пароля (так задумано для встреч с вручную
 * созданными комнатами).
 */
export function buildJoinUrl(
  link?: string | null,
  meetingPassword?: string | null,
  extra?: { description?: string | null; note?: string | null } | null
): string {
  if (!link) return "";
  // ссылка могла быть сохранена без протокола / с мусором после копирования —
  // чиним её, иначе «Войти в конференцию» ведёт в никуда
  const clean = sanitizeVksLink(link);
  try {
    const url = new URL(clean);
    if (url.hostname === "salutejazz.ru" && !url.searchParams.get("psw")) {
      let psw = (meetingPassword || "").trim() || extractPswFromAny(link);
      if (!psw) {
        // пароль могли сохранить в описании/примечании встречи (вставка ссылки целиком)
        psw =
          extractPswFromAny(extra?.description ?? "") ||
          extractPswFromAny(extra?.note ?? "") ||
          "";
      }
      if (psw) url.searchParams.set("psw", psw);
    }
    return url.toString();
  } catch {
    return link;
  }
}

/** Пароль конференции из поля формы (если пользователь задаёт его отдельно) */
export function extractPswFromAny(value?: string | null): string | null {
  if (!value) return null;
  const m = /[?&]psw=([^&\s]+)/.exec(value);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Код комнаты из готовой ссылки (для отображения в интерфейсе) */
export function vksRoomCodeFromLink(link?: string | null): string | null {
  if (!isVksLink(link)) return null;
  try {
    const path = new URL(link as string).pathname; // /calls/<код>
    const code = path.split("/").filter(Boolean).pop();
    return code || null;
  } catch {
    return null;
  }
}

/** Пароль (?psw=...) из готовой ссылки */
export function vksPasswordFromLink(link?: string | null): string | null {
  if (!isVksLink(link)) return null;
  try {
    return new URL(link as string).searchParams.get("psw");
  } catch {
    return null;
  }
}

/**
 * Попытка создать комнату через API платформы SaluteJazz.
 * ВАЖНО: публичного API создания комнат у SaluteJazz нет (проверено: страница
 * SPA, эндпоинты скрыты за авторизацией SSO). Если организация получит
 * корпоративный токен, здесь подключается реальный вызов. Пока возвращаем
 * null — ссылка генерируется локально по формату платформы, комната
 * создаётся автоматически при первом входе организатора по ссылке.
 */
export async function createRoomViaPlatformApi(
  _token?: string,
): Promise<{ link: string } | null> {
  void _token;
  return null;
}
