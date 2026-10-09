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
 * Проверка и «починка» ссылки до канонического вида платформы.
 * Если пользователь ввёл ссылку вручную без пароля (например, просто открыл
 * страницу комнаты на salutejazz.ru), добавляем ?psw=<случайный пароль>,
 * чтобы встреча всегда создавалась с защищённым доступом.
 */
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
