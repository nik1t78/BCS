# Проверка релиза BCS на Windows

Проверка должна выполняться на компьютере, где установлен Docker Desktop и находятся реальные `.env` и данные проекта. В этой среде нельзя подтвердить работу Docker/MySQL, отправку уведомлений или создание комнаты SaluteJazz: для этого нужны запущенный Docker, действующие токены и доступ к сети.

## Безопасная диагностика

Из PowerShell в папке проекта выполните одной строкой:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\ops\windows\Test-BCS-Release.ps1
```

Для проверки доступности контейнера бота (скрипт запустит опциональный профиль `bot`):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\ops\windows\Test-BCS-Release.ps1 -IncludeBot
```

Для другого адреса сайта:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\ops\windows\Test-BCS-Release.ps1 -BaseUrl http://10.48.4.235
```

Скрипт проверяет конфигурацию Compose, состояние Docker, MySQL, Redis, статус миграций Laravel, HTTP главной страницы и API, наличие настроенных секретов (не выводя их значения), а по флагу `-IncludeBot` — health endpoint VKS-бота. Он не удаляет тома, не очищает базу и не выполняет миграции.

## Что нужно для настоящего end-to-end теста

- `.env` с уникальными `APP_KEY`, паролями MySQL/Redis и `BOT_TOKENS`.
- Действующий MAX Bot API token и `max_chat_id` тестового пользователя, если проверяется MAX.
- `VKSBOT_EXPECTED=true`, `VKSBOT_AUTO=true` и одинаковый `BOT_TOKENS` в Laravel и `vks-bot`.
- Доступ к `salutejazz.ru` из контейнера Chromium/Playwright.
- Отдельная тестовая база и тестовый пользователь.

Проверка `/health` подтверждает только доступность сервиса, но не создание комнаты. Полный тест SaluteJazz должен создать реальную тестовую комнату и проверить ссылку в браузере. Полный тест MAX должен отправить тестовое сообщение в привязанный чат и подтвердить его получение. Не публикуйте `.env`, токены и пароли в диагностическом отчёте.
