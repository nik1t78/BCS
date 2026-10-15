// Интеграция с VKS-ботом (Selenium), который реально заходит на
// https://salutejazz.ru/calls/create, вводит название встречи и имя — и
// возвращает живую ссылку. Бот поднимается как отдельный сервис (vks-bot/).
//
// URL бота: VITE_VKS_BOT_URL. По умолчанию — относительный путь /vks-bot,
// который nginx проксирует на Selenium-сервис (тот же origin => нет CORS/CSP).
import { generateVksLink } from "./vksLink";

const BOT_URL = (import.meta.env.VITE_VKS_BOT_URL as string) || "/vks-bot";

/**
 * Автосоздание ВКС через Selenium-бота ВЫКЛЮЧЕНО по умолчанию
 * (VITE_VKS_AUTOBOT=1 включает обратно). Причина: контейнер vks-bot
 * запускает Chromium и «съедает» ~0,8–1 ГБ RAM на время каждого создания
 * ссылки. Ссылка в эталонном формате https://salutejazz.ru/calls/<код>?psw=<пароль>
 * генерируется локально мгновенно и бесплатно (см. vksLink.ts), а комната на
 * платформе создаётся автоматически при первом входе организатора по ссылке.
 * Кнопка «Создать вручную» (открытие salutejazz.ru/calls/create во вкладке)
 * работает независимо от этого флага.
 */
const AUTOBOT_ENABLED = import.meta.env.VITE_VKS_AUTOBOT === "1";

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
  if (!AUTOBOT_ENABLED) {
    // Бот выключен (экономия RAM контейнера vks-bot) — мгновенная
    // локальная генерация ссылки в эталонном формате платформы.
    return { link: generateVksLink(), real: false };
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    // Секрет бота (заголовок X-Bot-Token) — то же значение, что BOT_TOKENS в .env.
    // Без него сервер бота отвечает 401, если BOT_TOKENS настроены.
    const botToken = (import.meta.env.VITE_VKS_BOT_TOKEN as string) || "";
    const resp = await fetch(`${BOT_URL.replace(/\/$/, "")}/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(botToken ? { "X-Bot-Token": botToken } : {}),
      },
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
 * Открыть страницу https://salutejazz.ru/calls/create в НОВОЙ ВКЛАДКЕ,
 * чтобы пользователь мог создать комнату вручную и вставить ссылку в форму.
 *
 * ВАЖНО: раньше использовался window.open(..., "_blank") без явного
 * размера окна — браузеры (Chrome/Edge/Firefox) трактуют это как попытку
 * открыть popup-окно и блокируют его без явного разрешения пользователя
 * («Браузер заблокировал всплывающее окно»). window.open с параметром
 * width/height НЕ считается popup'ом при клике по кнопке и открывается
 * как обычная вкладка. Фолбэк — установка location.href, если всё же
 * не получилось (пользователь удерживает Ctrl и т.п.).
 *
 * Возвращает true, если вкладка открылась штатно; false — сработал
 * фолбэк (текущая страница заменена на salutejazz.ru) либо ничего не
 * удалось.
 */
export function openVksCreatePage(): boolean {
  try {
    // ВАЖНО: параметры окна (width/height) убраны намеренно. window.open
    // с feature-строкой браузеры трактуют как попытку открыть popup и
    // блокируют его («Браузер заблокировал создание всплывающего окна»).
    // Обычный вызов window.open(url, "_blank") в обработчике клика по
    // кнопке считается пользовательским жестом и открывается как вкладка.
    // Фикс «не работает»: раньше открывался /calls/create, которого на
    // платформе нет (страница не загружалась). Правильный путь —
    // https://salutejazz.ru/calls → кнопка «Создать видео встречу».
    const w = window.open("https://salutejazz.ru/calls", "_blank");
    if (w) return true;
  } catch {
    /* noop — переходим к фолбэку */
  }
  // Браузер всё равно заблокировал новую вкладку — ругаться alert'ом
  // бессмысленно: открываем страницу в текущей вкладке. Форма создания
  // встречи при этом НЕ теряется — приложение хранит черновик в
  // localStorage, а ссылка из salutejazz.ru вставляется после возврата.
  try {
    window.location.href = "https://salutejazz.ru/calls";
  } catch {
    return false;
  }
  return false;
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
