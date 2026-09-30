# ВКС Расписание — система управления видеоконференциями

Веб-приложение для планирования и управления видеоконференциями (ВКС) в организации:
расписание, протоколы встреч, задачи (action items), RSVP, переговорные комнаты,
уведомления (in-app + мессенджер MAX), админ-панель с аудит-логом и аналитикой.

## Стек

| Слой           | Технологии                                                                         |
| -------------- | ---------------------------------------------------------------------------------- |
| Frontend       | React 18 + TypeScript, Vite 6, Tailwind CSS 4, dnd-kit, Recharts, Framer Motion    |
| Backend        | PHP 8.2 / Laravel, Sanctum (Bearer-токены + refresh), MySQL 8, Redis (queue/cache) |
| Инфраструктура | Docker Compose: nginx, php-fpm, mysql, redis, queue-worker, scheduler              |
| Качество       | ESLint + Prettier, `tsc --noEmit`, GitHub Actions CI                               |

## Архитектура

```
┌───────────────┐        ┌────────────────────────────────────────┐
│  SPA (React)  │ /api → │ Laravel API                            │
│  src/         │        │  AuthController (login/refresh/logout) │
│  api/client.ts│        │  MeetingController (+cancel/reschedule)│
│  store-api.ts │        │  MeetingMinuteController (протокол/задачи)│
│  components/  │        │  MeetingRsvpController (приду/не приду)│
└───────────────┘        │  RoomController (переговорные)          │
                         │  AnalyticsController (heatmap/стат.)    │
                         │  AdminController (users/audit/reset pw) │
                         │  TrashController (soft deletes)         │
                         │  Services: MaxMessengerService          │
                         └───────┬───────────────┬────────────────┘
                                 │               │
                          ┌──────▼─────┐  ┌──────▼──────┐
                          │   MySQL    │  │ Redis + Queue│
                          └────────────┘  └──────────────┘
```

### Структура репозитория

- `src/` — фронтенд (Vite + React):
  - `api/client.ts` — HTTP-клиент (Sanctum Bearer, автоматический refresh токена);
  - `store-api.ts` — функции работы с API + маппинг snake_case ↔ camelCase;
  - `components/` — страницы и виджеты (Schedule, UserPanel, AdminPanel,
    MeetingMinutes, MeetingRsvp, RoomsManager, Dashboard, Notifications и т.д.);
  - `utils/` — recurrence (RRULE), favorites, meetingSort, export;
  - `types.ts` — общие типы предметной области.
- `backend/` — Laravel-приложение:
  - `app/Http/Controllers/Api/` — REST-контроллеры;
  - `app/Models/` — Eloquent-модели (Meeting, MeetingMinute, MeetingTask,
    TaskComment, MeetingRsvp, Room, Notification, User…);
  - `app/Services/MaxMessengerService.php` — отправка уведомлений в MAX Bot API;
  - `app/Console/Commands/` — `backup:database`, `notifications:send`,
    `reminders:send`, `notifications:cleanup`;
  - `routes/api.php` — все маршруты (`throttle:api`, роли, can:admin).
- `docker/`, `Dockerfile`, `docker-compose.yml` — контейнеризация;
- `.github/workflows/ci.yml` — CI: lint → format check → typecheck → build (+ backend tests).

## Основные возможности

- **Встречи**: создание/редактирование, приоритеты, теги, приватность, шаблоны,
  повторы (простые + RRULE «последняя пятница месяца»), вложения, история изменений.
- **Протокол и задачи**: discussion/decisions/responsible; action items с дедлайном,
  множественными ответственными и комментариями; статусы К выполнению → В работе → Выполнено.
- **RSVP**: «приду / не приду / под вопросом», сводка организатору.
- **Расписание**: день/неделя/месяц, drag-and-drop перенос с проверкой конфликтов,
  отмена встречи с уведомлением участников, компактный режим.
- **Комнаты**: каталог переговорных, проверка занятости (availability), бронирование вместе со встречей.
- **Корзина**: soft deletes встреч, восстановление/удаление навсегда (админ).
- **Уведомления**: in-app toast на любом экране (polling unread-count) + дубль в MAX;
  напоминания по расписанию (Laravel Scheduler).
- **Админ-панель**: пользователи (временные пароли + политика смены при первом входе),
  все конференции, аудит-лог с экспортом CSV, статистика и тепловая карта загрузки,
  активные сессии (User-Agent/IP) с завершением.
- **Безопасность**: роли admin/moderator/user, rate limiting, refresh-токены Sanctum,
  logout со всех устройств.
- **UX**: тёмная тема (prefers-color-scheme + сохранение), глобальный поиск Ctrl+K,
  мобильная адаптивность (off-canvas сайдбар).

## Запуск

### Продакшен (Docker) — подробности в [DEPLOYMENT.md](DEPLOYMENT.md)

```bash
docker-compose up -d --build
docker exec vks-backend cp .env.example .env
docker exec vks-backend php artisan key:generate
docker exec vks-backend php artisan migrate --force
docker exec vks-backend php artisan db:seed --class=VksDatabaseSeeder --force
```

Приложение доступно на `http://<IP>/`.

### Режим разработки

```bash
# Терминал 1 — бэкенд (:8000)
cd backend
composer install
cp .env.example .env && php artisan key:generate
php artisan migrate
php artisan serve

# Терминал 2 — фронтенд (:5173, proxy /api настроен в vite.config.js)
npm install
npm run dev
```

### Демо-доступы (после сидинга)

| Роль          | Логин       | Пароль         |
| ------------- | ----------- | -------------- |
| Администратор | `admin`     | `admin123`     |
| Модератор     | `moderator` | `moderator123` |
| Пользователь  | `user`      | `user123`      |

## Полезные команды

```bash
npm run dev            # dev-сервер Vite
npm run build          # production-сборка в dist/
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint по src/
npm run format         # Prettier --write по src/

# Бэкенд
php artisan backup:database            # резервная копия БД (в storage/app/backups)
php artisan schedule:run               # ручной запуск планировщика (напоминания, бэкап)
php artisan migrate                    # применить миграции (включая новые таблицы)
```

## Переменные окружения (backend/.env)

- `DB_*`, `REDIS_*`, `QUEUE_CONNECTION=redis`, `CACHE_STORE=redis`;
- **Мессенджер-уведомления** (`App\Services\MessengerNotifier`):
  - `MESSENGER=telegram | max | none` — активный канал (по умолчанию telegram);
  - Telegram: `TELEGRAM_ENABLED=true`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_API_URL=https://api.telegram.org`, `TELEGRAM_BOT_LINK=https://t.me/<bot>`, `TELEGRAM_WEBHOOK_SECRET`;
  - MAX: `MAX_ENABLED=true`, `MAX_BOT_TOKEN`, `MAX_API_URL=https://maxapi.ru/v1`;
  - Настройка webhook бота: `curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<ваш-домен>/api/telegram/webhook?secret=<SECRET>"`;
  - Пользователь привязывает аккаунт в Профиле: «Привязать Telegram» → код → `/start <код>` в чате бота.
    Без настроек дублирование уведомлений просто пропускается (in-app работает всегда).
- `SANCTUM_TOKEN_EXPIRATION` / срок refresh-токенов — настройка жизни сессий.

## CI

GitHub Actions (`.github/workflows/ci.yml`):
frontend — `npm ci → eslint → prettier --check → tsc --noEmit → vite build (+ artifact dist)`;
backend — `composer install → php artisan test`.

## Документация

- [START_HERE.md](START_HERE.md) — быстрая инструкция: как запустить проект (Docker/dev) и пошаговая настройка уведомлений в Telegram (@BotFather → .env → webhook → привязка аккаунта);
- [DEPLOYMENT.md](DEPLOYMENT.md) — пошаговая установка на сервер;
- [RESTART.md](RESTART.md) — перезапуск сервисов и типовые проблемы.
