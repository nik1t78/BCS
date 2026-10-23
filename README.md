# ВКС Расписание — система управления видеоконференциями

> ## ⚠️ АВТОРСКИЕ ПРАВА / ALL RIGHTS RESERVED
>
> **© 2026 Автор проекта BCS. Все права защищены.**
>
> Копирование, распространение, модификация, публичное размещение, декомпиляция
> и любое иное использование данного проекта (исходный код, документация,
> дизайн) **без письменного разрешения правообладателя ЗАПРЕЩЕНО** — см. файл
> [LICENSE](LICENSE). Нарушение влечёт ответственность по ст. 146 УК РФ и
> ст. 1301 ГК РФ. Доступ к репозиторию — только авторизованным сотрудникам
> на условиях конфиденциальности.

Веб-приложение для планирования и управления видеоконференциями (ВКС) в организации:
расписание, протоколы встреч, задачи (action items), RSVP, переговорные комнаты,
уведомления (in-app + мессенджер MAX), админ-панель с аудит-логом и аналитикой.

## Стек

| Слой           | Технологии                                                                         |
| -------------- | ---------------------------------------------------------------------------------- |
| Frontend       | React 18 + TypeScript, Vite 6, Tailwind CSS 4 (PWA; ExcelJS — ленивая загрузка)    |
| Backend        | PHP 8.2 / Laravel, Sanctum (Bearer-токены + refresh), MySQL 8, Redis (queue/cache) |
| VKS-бот        | Python 3.12 + Selenium (headless Chromium) — автосоздание ссылок на salutejazz.ru   |
| Инфраструктура | Docker Compose: nginx, php-fpm, mysql, redis, queue-worker, scheduler, vks-bot      |
| Языки проекта  | **TypeScript** (фронт), **PHP** (бэк), **Python** (vks-bot), YAML/shell (конфиги). Других языков нет. |
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

**Вся документация проекта объединена в один файл — [DOCS.md](DOCS.md)**
(запуск Windows/Linux, демо-доступы, настройка MAX, безопасность, эксплуатация,
диагностика по IP, развёртывание на Linux-сервере).

### Продакшен (Docker) — кратко

`backend/composer.lock` обязан быть в репозитории: без него `composer install`
в образе обращается к packagist за последними версиями и при нестабильной сети
падает с `curl error 28 ... Connection timed out`.

```bash
cp .env.example .env      # задать DB_PASSWORD, DB_ROOT_PASSWORD, REDIS_PASSWORD; APP_KEY — по желанию
# backend/.env создавать НЕ нужно: при первом `docker compose up` контейнер
# сам создаст его из backend/.env.example и сгенерирует настоящий APP_KEY.
# ВАЖНО: весь бэкенд (код + vendor composer) живёт ВНУТРИ docker-образа —
# bind-mount ./backend в docker-compose.yml удалён. Правки кода на хосте
# применяются после `docker compose up -d --build backend queue scheduler`.
docker compose up -d --build
# Статика backend/public/ для nginx извлекается из ОБРАЗА в volume
# backend_public (bind с хоста больше не используется):
docker compose run --rm --no-deps backend-assets
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan storage:link   # картинки/вложения
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder --force
docker compose exec backend php artisan optimize       # config/route/view cache
```

Приложение доступно на `http://localhost` и, так как Nginx слушает `0.0.0.0`,
для пользователей локальной сети — на `http://<IP этой машины>/` без порта в адресе
(например `http://10.48.4.235/`). Наружный порт Nginx зафиксирован в docker-compose.yml = 80
(стандартный HTTP), поэтому адрес всегда открывается без порта; `LISTEN_IP=127.0.0.1`
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
| Администратор | `admin`     | `admin123`   |
| Модератор     | `sidorov`   | `sidorov123` |
| Пользователь  | `ivanov`    | `ivanov123`  |

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

## Типичные ошибки Windows/PowerShell при деплое

**1. `failed to read .env: unexpected character "\x00" in variable name "V\x00I\x00T..."`**

Причина: в PowerShell 5.1 конструкция `echo "текст" >> .env` дописывает в файл
кусок в кодировке **UTF-16LE** (каждый символ с нулевым байтом), а docker compose
умеет читать `.env` только как UTF-8. Лечится перекодировкой всего файла — в репозитории
есть готовый скрипт:

```powershell
# (скрипт fix-env удалён из репо) чините .env вручную: UTF-8 без BOM, окончания строк LF
```

На будущее — не используйте `>>` и `Add-Content` для `.env`. Безопасные способы:

```powershell
Add-Content -Path .env -Value 'VITE_VKS_AUTOBOT=1' -Encoding UTF8   # PS 7+
# либо через редактор (notepad++ / VS Code: сохранить как UTF-8 без BOM, LF)
# либо одной командой:
"VITE_VKS_AUTOBOT=1" | Out-File .env -Append -Encoding ascii        # только ASCII-значения!
```

**2. `Лексема "&&" не является допустимым разделителем операторов` (PowerShell 5.1)**

Связка `cmd1 && cmd2` работает только в PowerShell 7+. В Windows PowerShell 5.1
выполняйте команды по очереди или используйте `;`:

```powershell
docker compose build frontend
docker compose up -d frontend
# или одной строкой (без проверки кода возврата):
docker compose build frontend ; docker compose up -d frontend
```

**3. `WARN The "s"/"e"/"m" variable is not set. Defaulting to a blank string`**

Docker compose интерполирует `$s`, `$e`, `$m` внутри entrypoint-скрипта сервиса
`backend` (это PHP-переменные в `php -r '$s=@fsockopen(...)'`). В compose-файле они
экранированы как `$$s/$$e/$$m` — если предупреждения появились снова, проверьте, что
в `docker-compose.yml` все «голые» `$` в shell/PHP-коде удвоены.

**САМОЕ ВАЖНОЕ: эти WARN означают, что вы запускаете compose из СТАРОЙ копии кода.**
Фикс экранирования был в коммитах `865a2cb1`/`55f6f33d`, а они ещё НЕ смержены в `main`
на GitHub (вы скачали свежий репозиторий в BCS-new — там старый docker-compose.yml).
Проверьте: `findstr /C:"fsockopen" docker-compose.yml` — если видите одинарные `$s`, а не
`$$s`, файл старый. Заберите исправленный файл (см. раздел «Чеклист переустановки»:
клонировать branch `fix/compose-warnings`) и перезапустите — предупреждения исчезнут.

Также с 2026-10-20 в репозитории исправлены ещё два источника подобных WARN:
сырой `$listen_ip` заменён на `${LISTEN_IP:-0.0.0.0}` (в `.env` пишите `LISTEN_IP=...`),
а комментарий про интерполяцию больше не содержит последовательностей `$s`, `$e`, `$m`.

**4. `laravel.log could not be opened in append mode: Permission denied` на шаге `views`**

Каталог `backend/storage` смонтирован с хоста bind-маунтом; если на сервере он
принадлежит root, php-fpm (www-data) не может писать лог. Entrypoint контейнера
`backend` теперь сам чинит права при каждом старте; вручную (однократно):

```bash
docker compose exec backend sh -c "chown -R www-data:www-data storage bootstrap/cache"
docker compose up -d backend   # пересоздаст laravel.log от имени www-data
```

## Оптимизация Docker: память и диск

Все контейнеры ограничены по RAM/CPU прямо в `docker-compose.yml`
(`deploy.resources.limits` + лимит логов json-file 3×10 МБ + `no-new-privileges`).
Суммарный потолок ≈ 2.4 ГБ RAM; при нехватке контейнер будет остановлен (OOM),
а не выжмет весь компьютер. Дополнительно:

- **MySQL** ужат: `innodb-buffer-pool-size=64M`, `performance-schema=OFF`,
  `max-connections=80`, tmp/heap-таблицы 8–16 МБ, `shm_size: 64mb`;
- **Redis**: жёсткий `--maxmemory 96mb --maxmemory-policy allkeys-lru`,
  RDB/AOF отключены (`--save "" --appendonly no`) — redis используется только
  как кэш/очередь, данные не теряются (источник истины — MySQL);
- **PHP-FPM**: динамический пул `pm.max_children=6`, memory_limit 128M —
  backend физически не разрастётся выше своего лимита;
- **frontend-builder** одноразовый: собрал `dist` → смонтировал в volume → завершился,
  оперативку после сборки не держит;
- **vks-bot** (Chromium) — до 768 МБ только на время создания ссылки. По
  умолчанию НЕ запускается (compose-profile `bot`; включается командой
  `docker compose --profile bot up -d vks-bot` + `VITE_VKS_AUTOBOT=1` при
  сборке фронта). Без бота ссылка ВКС генерируется локально мгновенно в том
  же формате платформы, поэтому контейнер с Chromium не тратит RAM впустую.

### Автоматическая чистка места на диске

Пересборки образов копят старые слои и кеш builder. Раз в неделю (или cron) запускайте:

```bash
docker system prune -f   # мягкая чистка: stopped-контейнеры, <none>-образы, сети, кеш builder
docker system prune -a --volumes   # полная «похуделка»: все неиспользуемые образы (+тома — осторожно!)
                            # (включая тяжёлый chromium из vks-bot), весь кеш сборки и контейнер бота.
                            # Данные MySQL (bind-монтирование) и volume frontend_build НЕ трогаются.
```

После `docker-lean.sh` потребление диска обычно падает с десятков гигабайт до 2–4 ГБ — остаются только
рабочие образы nginx/php-fpm/mysql/redis. Значения «Disk: 24 GB» в панели — это накопленные слои старых
пересборок и образ Chromium; скрипт убирает их за один запуск.

Пример cron (Linux): `0 4 * * 0 cd /opt/BCS-main && docker system prune -f >> /var/log/vks-prune.log 2>&1`
Windows (планировщик задач): действие `powershell -Command "docker system prune -f"` раз в неделю.

Жёсткие лимиты под конкретный сервер можно переопределить без правки основного файла:
`cp docker-compose.override.example.yml docker-compose.override.yml` и отредактировать —
Docker Compose автоматически применит его поверх `docker-compose.yml`.

Мониторинг потребления: `docker stats --no-stream` и `docker system df`.

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

Вся документация — в одном файле **[DOCS.md](DOCS.md)**: запуск (Windows/Linux/Docker/dev),
демо-доступы, уведомления MAX, безопасность, рестарт/обновление/бэкапы, диагностика
«не открывается по IP», развёртывание на Linux-сервере, история исправлений, roadmap.

### Чеклист: полная переустановка проекта с нуля (клонирование с GitHub)

Перед удалением старой папки **сохраните данные** — они не лежат в гите:

```powershell
# 1. Бэкап (на сервере Linux; на Windows PowerShell — те же команды без sudo)
cp .env .env.backup                      # секреты/пароли корневой конфигурации
cp backend/.env backend/.env.backup      # если создавали вручную
docker compose exec -T mysql mysqldump -uvks_user -p"$DB_PASSWORD" vks_schedule > backup.sql
tar czf storage-backup.tgz backend/storage   # загруженные картинки/вложения

# 2. Удалить старую копию и клонировать заново
git clone https://github.com/nik1t78/BCS.git BCS && cd BCS

# 3. Вернуть своё
copy .env.backup .env                    # PowerShell: Copy-Item
unzip/restore: docker compose up -d mysql ; docker compose exec -T mysql sh -c 'mysql -uvks_user -p"$MYSQL_PASSWORD" vks_schedule' < ../backup.sql
tar xzf storage-backup.tgz               # каркас backend/storage теперь есть в гите (.gitkeep)

# 4. Запуск (контейнер backend сам создаст backend/.env + APP_KEY при их отсутствии)
docker compose up -d --build
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan optimize
```

Проверка чистоты перед `up`: `docker compose config --quiet` — если команда
молчит, compose-файл и `.env` в порядке (ни WARN, ни `\x00`).
