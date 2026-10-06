# 🚀 ИНСТРУКЦИЯ: запуск проекта «ВКС Расписание» и настройка уведомлений в мессенджер MAX

Один документ, который отвечает на два вопроса: **как запустить проект** и **как добавить уведомления в мессенджер MAX**.

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
| Администратор | `admin`     | `vks_2026`     |
| Модератор     | `moderator` | `vks_2026` |
| Пользователь  | `user`      | `vks_2026`      |

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

## Часть 2. УВЕДОМЛЕНИЯ В МЕССЕНДЖЕР MAX — ПОШАГОВО

Как это устроено: любое событие (создание/перенос/отмена встречи, RSVP, задача, комментарий) создаёт запись `Notification` → она **мгновенно видна в приложении** (toast + колокольчик). Дополнительно, если настроен бот MAX, то же сообщение дублируется пользователю в чат бота (`MessengerNotifier` → `MaxMessengerService` → Bot API `sendmessage`). Дублирование неблокирующее: без бота всё работает, ошибки логируются и не ломают приложение.

### Шаг 1. Создать бота в MAX

Зарегистрируйте бота через @masterbot в мессенджере MAX (max.ru) и получите **токен** вида `Bearer ...`. Сохраните ссылку на чат бота (вида `https://max.ru/id0000000000_bot`).

### Шаг 2. Прописать бота в .env сервера

```bash
docker exec -it vks-backend sh
vi .env
```

```ini
MESSENGER=max
MAX_ENABLED=true
MAX_BOT_TOKEN=<токен бота MAX>
MAX_API_URL=https://maxapi.ru/v1
MAX_BOT_LINK=https://max.ru/id0000000000_bot
```

Перезагрузите конфиг и очередь:

```bash
docker exec vks-backend php artisan config:clear
docker restart vks-queue-worker vks-scheduler
```

### Шаг 3. Привязать свой аккаунт (делает каждый пользователь)

1. В приложении: **Профиль → блок «Мессенджер MAX»** → нажмите «Написать боту в MAX» и узнайте у бота свой chat_id.
2. Введите этот chat_id в поле «ID чата из бота» и нажмите «Привязать».
3. Статус изменится на «Привязан чат: …» — уведомления будут приходить в этот чат.

Отвязать: там же кнопка «Отвязать».

### Шаг 4. Проверка (сквозной тест)

1. Создайте встречу с другим участником (который привязал MAX) → тот должен получить push «📅 Новая встреча …» в течение нескольких секунд.
2. Перенесите/отмените встречу → участники получат уведомление об изменении.
3. Ответьте RSVP «приду» → организатор получит «RSVP: … ✅ придёт».
4. Поставьте задачу → ответственный получит «📌 Вам поставлена задача …».

Если push не пришёл:

```bash
docker exec vks-backend tail -20 storage/logs/laravel.log      # ошибки Bot API
docker exec vks-backend php artisan queue:work --once          # если доставка в очереди
```

### Напоминания по расписанию

Контейнер `vks-scheduler` каждые минуты вызывает `schedule:run`: команда `reminders:send` шлёт напоминания о ближайших встречах (по `reminder_minutes`) — in-app + в MAX тем, кто привязан. Резервная копия БД (`db:backup --keep=14`) выполняется ежедневно автоматически, файлы в `storage/app/backups/`.

`MESSENGER=none` полностью выключает внешний канал (in-app остаётся).

---

## Шпаргалка: что где лежит

| Что                  | Где                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Запуск/развёртывание | эта инструкция + DEPLOYMENT.md + RESTART.md                                                                                                 |
| Контейнеры           | docker-compose.yml, Dockerfile, docker/                                                                                                     |
| Фронтенд             | src/ (компоненты, api/client.ts, store-api.ts, utils)                                                                                       |
| Бэкенд               | backend/ (routes/api.php, app/, database/migrations)                                                                                        |
| Сервис MAX            | backend/app/Services/MessengerNotifier.php, MaxMessengerService.php                                                                        |
| RRULE на сервере     | backend/app/Services/RecurrenceService.php                                                                                                  |
| MAX-эндпоинты        | привязка: /api/max/status, /api/max/link (PUT/DELETE) — маршруты в backend/routes/api.php                                                  |
| CI                   | .github/workflows/ci.yml                                                                                                                    |
