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

/** Проверка и «починка» ссылки до канонического вида платформы. */
export function normalizeVksLink(link: string): string {
  if (!isVksLink(link)) return link;
  const url = new URL(link);
  if (!url.searchParams.get("psw")) {
    url.searchParams.set("psw", randomVksPassword());
  }
  return url.toString();
}

/** Проверка: ссылка ли это на нашу ВКС-платформу */
export function isVksLink(link?: string | null): boolean {
  return !!link && link.startsWith("https://salutejazz.ru/calls/");
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
