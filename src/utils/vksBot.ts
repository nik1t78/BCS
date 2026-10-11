// Интеграция с VKS-ботом (Selenium), который реально заходит на
// https://salutejazz.ru/calls/create, вводит название встречи и имя — и
// возвращает живую ссылку. Бот поднимается как отдельный сервис (vks-bot/).
//
// URL бота: VITE_VKS_BOT_URL. По умолчанию — относительный путь /vks-bot,
// который nginx проксирует на Selenium-сервис (тот же origin => нет CORS/CSP).
import { generateVksLink } from "./vksLink";

const BOT_URL = (import.meta.env.VITE_VKS_BOT_URL as string) || "/vks-bot";

export interface BotCreateResult {
  link: string;
  room?: string;
  password?: string;
  /** true — ссылка получена от реального salutejazz.ru через бота */
  real: boolean;
}

/**
 * Создать ВКС через Selenium-бота. Если бот недоступен/не успел —
 * тихо возвращаем локально сгенерированную ссылку в том же формате,
 * чтобы создание конференции никогда не блокировалось.
 */
export async function createVksViaBot(
  title: string,
  name: string,
  timeoutMs = 75_000,
): Promise<BotCreateResult> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const resp = await fetch(`${BOT_URL.replace(/\/$/, "")}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, name }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`bot http ${resp.status}`);
    const data = await resp.json();
    const link: string | undefined =
      data?.ok && data?.link ? data.link : data?.fallback_link;
    if (link && link.startsWith("https://salutejazz.ru/calls/")) {
      return {
        link,
        room: data.room,
        password: data.password,
        real: !!(data.ok && data.link),
      };
    }
    throw new Error(data?.error || "бот не вернул ссылку");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[vksBot] бот недоступен, используется локальная генерация:", e);
    return { link: generateVksLink(), real: false };
  }
}

/**
 * Открыть страницу https://salutejazz.ru/calls/create в новой вкладке,
 * чтобы пользователь мог создать комнату вручную и вставить ссылку в форму.
 * Возвращает false, если браузер заблокировал popup — вызывающий код должен
 * показать ссылку для ручного перехода.
 */
export function openVksCreatePage(): boolean {
  const w = window.open("https://salutejazz.ru/calls/create", "_blank", "noopener");
  return !!w;
}

/** Быстрая проверка живости бота (для индикатора в форме создания). */
export async function vksBotAlive(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const resp = await fetch(`${BOT_URL.replace(/\/$/, "")}/health`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return resp.ok;
  } catch {
    return false;
  }
}
