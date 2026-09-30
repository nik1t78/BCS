# 🚀 ИНСТРУКЦИЯ: запуск проекта «ВКС Расписание» и настройка уведомлений в Telegram

Один документ, который отвечает на два вопроса: **как запустить проект** и **как добавить уведомления в Telegram**.

---

## Часть 1. ЗАПУСК ПРОЕКТА

### Вариант А — продакшен на сервере (Docker Compose) ⭐ рекомендуемый

Требования: Linux-сервер с Docker + docker-compose, публичный IP/домен, порт 80 (и 443 для HTTPS).

```bash
# 1. Клонируем репозиторий и заходим в него
git clone <URL_репозитория> vks && cd vks

# 2. Поднимаем все контейнеры (nginx, php-fpm, mysql, redis, queue-worker, scheduler)
docker-compose up -d --build

# 3. Настройка бэкенда (выполняется внутри контейнера vks-backend)
docker exec vks-backend cp .env.example .env
docker exec vks-backend php artisan key:generate
docker exec vks-backend php artisan migrate --force
docker exec vks-backend php artisan db:seed --class=VksDatabaseSeeder --force
```

После этого приложение доступно на `http://<IP-сервера>/`.
Подробности по nginx/HTTPS/бэкапам — в [DEPLOYMENT.md](DEPLOYMENT.md), перезапуск и типовые проблемы — в [RESTART.md](RESTART.md).

**Что должно работать сразу после запуска:** вход (демо-доступы ниже), расписание, встречи, протоколы/задачи, RSVP, комнаты, корзина, in-app уведомления и toast'ы, глобальный поиск `Ctrl+F`, печать протокола в PDF (кнопка «Печать/PDF»), экспорт `.ics`, PWA (установка приложения со рабочего стола — манифест и service worker собираются вместе с фронтом).

**Демо-доступы (после сидинга):**

| Роль          | Логин       | Пароль         |
| ------------- | ----------- | -------------- |
| Администратор | `admin`     | `admin123`     |
| Модератор     | `moderator` | `moderator123` |
| Пользователь  | `user`      | `user123`      |

⚠️ В продакшене смените пароли (Админка → пользователи) и включите политику смены пароля при первом входе.

### Вариант Б — режим разработки локально (без Docker)

```bash
# Терминал 1 — бэкенд на :8000 (нужны PHP 8.2+, Composer, MySQL или sqlite)
cd backend
composer install
cp .env.example .env
php artisan key:generate
# при необходимости настройте DB_* в .env (можно оставить sqlite)
php artisan migrate
php artisan serve

# Терминал 2 — фронтенд на :5173 (proxy /api → :8000 уже настроен в vite.config.js)
npm install
npm run dev
```

Полезные команды проверки (должны быть зелёными перед каждым push):

```bash
npm run typecheck   # tsc --noEmit — 0 ошибок
npm run lint        # ESLint — 0 ошибок
npm run format      # Prettier --write
npm run build       # production-сборка в dist/ (+ sw.js/manifest.json для PWA)
```

CI GitHub Actions (`.github/workflows/ci.yml`) прогоняет то же самое автоматически: lint → format check → typecheck → build (+ тесты бэкенда).

### Обновление кода на сервере (после push в ветку)

```bash
cd vks
git pull
docker-compose up -d --build          # пересборка фронта+образа
docker exec vks-backend php artisan migrate --force   # новые миграции (rooms.department_id и т.п.)
```

---

## Часть 2. УВЕДОМЛЕНИЯ В TELEGRAM — ПОШАГОВО

Как это устроено: любое событие (создание/перенос/отмена встречи, RSVP, задача, комментарий) создаёт запись `Notification` → она **мгновенно видна в приложении** (toast + колокольчик). Дополнительно, если настроен бот, то же сообщение дублируется пользователю в Telegram (`MessengerNotifier` → Bot API `sendMessage`). Дублирование неблокирующее: без бота всё работает, ошибки бота логируются и не ломают приложение.

### Шаг 1. Создать бота у @BotFather

1. В Telegram откройте чат **@BotFather** → `/newbot`.
2. Имя: `ВКС Расписание`; username: `Kolekt_bot` (уже создан — тогда этот шаг пропускаем).
3. BotFather выдаст **токен** вида `8041712972:AAH...` — сохраните его.
4. Там же в @BotFather задайте (или используйте готовое): описание `/setdescription`, аватар `/setprofilephoto`, команды `/setcommands` → `/start - Привязать аккаунт / продолжить`, `/help - Помощь`.

### Шаг 2. Прописать бота в .env сервера

```bash
docker exec -it vks-backend sh
vi .env
```

```ini
MESSENGER=telegram
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=8041712972:AAHKGDvQi5Q2fIjMVbJLjXg8WO46Gfo9JZU
TELEGRAM_API_URL=https://api.telegram.org
TELEGRAM_BOT_LINK=https://t.me/Kolekt_bot
TELEGRAM_WEBHOOK_SECRET=3sBKB39sNEGyWJsFb0Avt4bmttA18zQw   # любая длинная случайная строка
```

Перезагрузите конфиг и очередь:

```bash
docker exec vks-backend php artisan config:clear
docker restart vks-queue-worker vks-scheduler
```

### Шаг 3. Установить webhook (Telegram сам пришлёт сообщения вашему серверу)

⚠️ Нужен **публичный HTTPS-адрес** приложения (Telegram не принимает http/IP без сертификата). Если домена ещё нет — получите сертификат через nginx + certbot (см. DEPLOYMENT.md) или временно используйте long-polling-обходимость ниже.

```bash
curl "https://api.telegram.org/bot8041712972:AAHKGDvQi5Q2fIjMVbJLjXg8WO46Gfo9JZU/setWebhook?url=https://ВАШ_ДОМЕН/api/telegram/webhook?secret=3sBKB39sNEGyWJsFb0Avt4bmttA18zQw"
# ожидаемый ответ: {"ok":true,"result":true,"description":"Webhook was set"}

# проверка:
curl "https://api.telegram.org/bot8041712972:AAHKGDvQi5Q2fIjMVbJLjXg8WO46Gfo9JZU/getWebhookInfo"
# url должен = https://ВАШ_ДОМЕН/api/telegram/webhook?secret=..., pending_update_count = 0
```

Секрет в URL обязан совпадать со значением `TELEGRAM_WEBHOOK_SECRET` в `.env` — контроллер проверяет его и отклоняет чужие запросы.

### Шаг 4. Привязать свой аккаунт (делает каждый пользователь)

1. В приложении: **Профиль → «Привязать Telegram»** → скопируйте одноразовый код и ссылку на бота.
2. В Telegram откройте `https://t.me/Kolekt_bot` → **START** → отправьте `/start <КОД>` (код из шага 1).
3. Бот ответит «Аккаунт привязан ✅» — ваш `chat_id` сохранён в `users.telegram_chat_id`. Статус можно проверить в профиле («Telegram привязан»).

Отвязать: там же кнопка «Отвязать».

### Шаг 5. Проверка (сквозной тест)

1. Создайте встречу с другим участником (который привязал Telegram) → тот должен получить push «📅 Новая встреча …» в течение нескольких секунд.
2. Перенесите/отмените встречу → участники получат уведомление об изменении.
3. Ответьте RSVP «приду» → организатор получит «RSVP: … ✅ придёт».
4. Поставьте задачу → ответственный получит «📌 Вам поставлена задача …».

Если push не пришёл:

```bash
docker exec vks-backend tail -20 storage/logs/laravel.log      # ошибки Bot API
docker exec vks-backend php artisan queue:work --once          # если доставка в очереди
```

### Напоминания по расписанию

Контейнер `vks-scheduler` каждые минуты вызывает `schedule:run`: команда `reminders:send` шлёт напоминания о ближайших встречах (по `reminder_minutes`) — in-app + в Telegram тем, кто привязан. Резервная копия БД (`db:backup --keep=14`) выполняется ежедневно автоматически, файлы в `storage/app/backups/`.

### Альтернативный канал — мессенджер MAX

Тот же Bot API-протокол: в `.env` поставьте `MESSENGER=max`, `MAX_ENABLED=true`, `MAX_BOT_TOKEN=...`, `MAX_API_URL=https://maxapi.ru/v1`; пользователи привязывают `max_chat_id` в профиле. `MESSENGER=none` полностью выключает внешний канал (in-app остаётся).

---

## Шпаргалка: что где лежит

| Что                  | Где                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Запуск/развёртывание | эта инструкция + DEPLOYMENT.md + RESTART.md                                                                                                 |
| Контейнеры           | docker-compose.yml, Dockerfile, docker/                                                                                                     |
| Фронтенд             | src/ (компоненты, api/client.ts, store-api.ts, utils)                                                                                       |
| Бэкенд               | backend/ (routes/api.php, app/, database/migrations)                                                                                        |
| Telegram/MAX сервисы | backend/app/Services/MessengerNotifier.php, MaxMessengerService.php                                                                         |
| RRULE на сервере     | backend/app/Services/RecurrenceService.php                                                                                                  |
| Telegram-эндпоинты   | webhook: NotificationController::telegramWebhook; привязка: UserController (telegramStatus/Link/Unlink) — маршруты в backend/routes/api.php |
| CI                   | .github/workflows/ci.yml                                                                                                                    |
