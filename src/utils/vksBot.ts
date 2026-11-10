// Клиентский вызов бота намеренно отключён: секрет BOT_TOKENS хранится
// только на Laravel backend. Создание реальной комнаты выполняется
// серверной очередью CreateVksLinkJob после сохранения конференции.
export interface BotCreateResult {
  link: string;
  real: boolean;
  skipped?: boolean;
  error?: string;
}

export async function createVksViaBot(): Promise<BotCreateResult> {
  throw new Error("Создание ВКС выполняется серверной очередью после сохранения конференции.");
}

/** Открывает официальный интерфейс SaluteJazz для ручного создания комнаты.
 *  Секреты бота в браузер не передаются; автоматическое создание выполняет backend.
 */
export function openVksCreatePage(): void {
  window.open("https://salutejazz.ru/calls", "_blank", "noopener,noreferrer");
}
