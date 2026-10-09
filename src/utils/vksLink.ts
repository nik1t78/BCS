// Автогенерация ссылки на внутреннюю ВКС-платформу (источник — salutejazz.ru).
// Формат: https://vc.salutejazz.ru/r/<уникальный код>, где код — 9 случайных
// символов [a-z0-9] (как в ссылках Google Meet/Яндекс Телемост).
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export const VKS_LINK_BASE = "https://vc.salutejazz.ru/r/";

/** Сгенерировать случайный путь для комнаты ВКС, напр. "k3f9d2xq1" */
export function randomVksRoomCode(length = 9): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Полная ссылка на ВКС: https://vc.salutejazz.ru/r/<код> */
export function generateVksLink(): string {
  return VKS_LINK_BASE + randomVksRoomCode();
}
