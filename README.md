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
  - `app/Console/Commands/` — `db:backup` (ежедневный бэкап БД в 02:30),
    `meetings:send-notifications`, `meetings:send-reminders`,
    `notifications:cleanup`, `analytics:daily`;
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

Полная пошаговая инструкция — в [LAUNCH.md](LAUNCH.md).

### Продакшен (Docker) — подробности в [DEPLOYMENT.md](DEPLOYMENT.md)

`backend/composer.lock` обязан быть в репозитории: без него `composer install`
в образе обращается к packagist за последними версиями и при нестабильной сети
падает с `curl error 28 ... Connection timed out`.

```bash
cp .env.example .env      # задать DB_PASSWORD, DB_ROOT_PASSWORD, REDIS_PASSWORD, APP_KEY
docker compose up -d --build
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan storage:link   # картинки/вложения
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder --force
docker compose exec backend php artisan optimize       # config/route/view cache
```

Приложение доступно на `http://localhost` и, так как Nginx слушает `0.0.0.0`,
для пользователей локальной сети — на `http://<IP этой машины>/` без порта в адресе
(например `http://10.48.4.235/`). Наружный порт Nginx зафиксирован в docker-compose.yml = 80
(стандартный HTTP), поэтому адрес всегда открывается без порта; `listen_ip=127.0.0.1`
в `.env` вернёт доступ только с самой машины.
Для доступа из сети разрешите входящий TCP-порт 80 в брандмауэре Windows:
`New-NetFirewallRule -DisplayName 'VKS web' -Direction Inbound -Protocol TCP -LocalPort 80`.
Если порт 80 на машине занят другим веб-сервером (IIS/Apache) — остановите его
или освободите 80-й порт.
Наружу (в интернет) публикуется через ваш reverse-proxy с HTTPS.

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
| Администратор | `admin`     | `vks_2026`     |
| Модератор     | `moderator` | `vks_2026` |
| Пользователь  | `user`      | `vks_2026`      |

## Полезные команды

```bash
npm run dev            # dev-сервер Vite
npm run build          # production-сборка в dist/
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint по src/
npm run format         # Prettier --write по src/

# Бэкенд
php artisan db:backup --keep=14        # резервная копия БД (в backend/storage/app/backups, ротация 14 копий)
php artisan schedule:run               # ручной запуск планировщика (напоминания, бэкап)
php artisan migrate                    # применить миграции (включая новые таблицы)
```

## Переменные окружения (backend/.env)

- `DB_*`, `REDIS_*`, `QUEUE_CONNECTION=redis`, `CACHE_STORE=redis`;
- **Мессенджер-уведомления** (`App\Services\MessengerNotifier`):
  - `MESSENGER=max | none` — активный канал (по умолчанию max);
  - MAX: `MAX_ENABLED=true`, `MAX_BOT_TOKEN`, `MAX_API_URL=https://maxapi.ru/v1`, `MAX_BOT_LINK=https://max.ru/<bot>`;
  - Пользователь привязывает аккаунт в Профиле: блок «Мессенджер MAX» → «Написать боту в MAX» → ввести chat_id → «Привязать».
    Без настроек дублирование уведомлений просто пропускается (in-app работает всегда).
- `SANCTUM_TOKEN_EXPIRATION` / срок refresh-токенов — настройка жизни сессий.

## CI

GitHub Actions (`.github/workflows/ci.yml`):
frontend — `npm ci → eslint → prettier --check → tsc --noEmit → vite build (+ artifact dist)`;
backend — `composer install → php artisan test`.

## Документация

- [START_HERE.md](START_HERE.md) — быстрая инструкция: как запустить проект (Docker/dev) и пошаговая настройка уведомлений в мессенджер MAX (бот → .env → привязка аккаунта);
- [DEPLOYMENT.md](DEPLOYMENT.md) — пошаговая установка на сервер;
- [RESTART.md](RESTART.md) — перезапуск сервисов и типовые проблемы;
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — сайт не открывается по IP: диагностика (брандмауэр, занятый порт 80, listen_ip).
