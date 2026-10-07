# 📚 ВКС Расписание — единая документация

Этот файл объединяет **всю** документацию проекта в один документ.
Быстрый старт с нуля: раздел [Запуск](#3-запуск--как-запустить-для-всех-пользователей).

| Раздел | Содержание |
|---|---|
| 1 | О проекте, стек, архитектура |
| 2 | Возможности (функционал) |
| 3 | Запуск (Windows/Linux, Docker, архив без git, dev-режим) |
| 4 | Демо-доступы и тестовые данные |
| 5 | Уведомления в мессенджер MAX |
| 6 | Безопасность и секреты |
| 7 | Эксплуатация: рестарт, обновление, бэкапы |
| 8 | Диагностика: не открывается по IP |
| 9 | Развёртывание на Linux-сервере |
| 10 | Структура проекта и полезные команды |
| 11 | История исправлений |

---

## 1. О проекте, стек, архитектура

**ВКС Расписание** — веб-приложение для планирования и управления видеоконференциями
в организации: расписание, протоколы встреч, задачи (action items), RSVP, переговорные
комнаты, уведомления (in-app + мессенджер MAX), админ-панель с аудит-логом и аналитикой.

### Стек

| Слой           | Технологии                                                                         |
| -------------- | ---------------------------------------------------------------------------------- |
| Frontend       | React 18 + TypeScript, Vite 6, Tailwind CSS 4, dnd-kit, Recharts, Framer Motion    |
| Backend        | PHP 8.2 / Laravel, Sanctum (Bearer-токены + refresh), MySQL 8, Redis (queue/cache) |
| Инфраструктура | Docker Compose: nginx, php-fpm, mysql, redis, queue-worker, scheduler              |
| Качество       | ESLint + Prettier, `tsc --noEmit`, GitHub Actions CI                               |

### Архитектура

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

Nginx слушает порт **80** на `0.0.0.0` — сайт доступен и локально (`http://localhost/`),
и для пользователей сети (`http://10.48.4.235/`) **без порта в адресе**. API идёт через
тот же origin (`/api`), поэтому CORS не нужен. MySQL и Redis наружу не публикуются.

---

## 2. Возможности (функционал)

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
  мобильная адаптивность (off-canvas сайдбар), PWA (установка со рабочего стола),
  печать протокола в PDF, экспорт `.ics`.

Реализовано более 59 функций; полный список — в разделах выше и в коде (`src/components/`,
`backend/app/Http/Controllers/Api/`).

---

## 3. Запуск — как запустить для всех пользователей

### Что нужно установить (один раз)

| Программа | Версия | Для чего | Скачать |
|-----------|--------|----------|---------|
| **Docker Desktop** (Windows/macOS) или docker + compose (Linux) | 20.10+ | запуск контейнеров — **обязательно** | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Git | 2.30+ | клонирование проекта | [git-scm.com](https://git-scm.com/downloads) |
| Node.js | 20+ | только для разработки фронтенда | [nodejs.org](https://nodejs.org/) |
| Composer / PHP | 2.5+ / 8.2+ | только для разработки бэкенда без Docker | [getcomposer.org](https://getcomposer.org/download/) |

Для запуска через Docker отдельные PHP/Composer/Node на машине **не нужны** — всё внутри контейнеров.

### Вариант 0 — скачал архив без git (Windows, самый быстрый путь)

Распакуйте архив в `D:\server\BCS` и выполните ОДИН раз подготовку — она восстановит
каркас Laravel (`backend/config`, `backend/storage`, `backend/bootstrap/cache`), создаст
`.env`-файлы и сгенерирует `APP_KEY`:

```powershell
cd D:\server\BCS
powershell -ExecutionPolicy Bypass -File .\setup-project.ps1
docker compose up -d --build
```

Linux/macOS/WSL — то же самое скриптом `bash ./setup-project.sh`.

Проверьте, что в `backend/` есть `composer.json`, `composer.lock`, `artisan`,
`bootstrap/app.php`, а также файлы `docker/skeleton/laravel12/**` — без них скрипт
остановится с понятным сообщением. Если чего-то из этого нет, архив неполный:
перекачайте его (или используйте `git clone`).

Дальше — шаги миграции из Варианта 1.

> ℹ️ Если PowerShell прерывает скрипт строкой вида `docker : redis Pulling` с
> `NativeCommandError` — это особенность старых версий скрипта (stderr Docker
> воспринимался как ошибка). Обновите код (`git pull`) — в текущей версии исправлено.

### Вариант 1 — Docker (рекомендуется, сервер/прод)

> **Обязательно:** `backend/composer.lock` должен быть в репозитории. Без него
> `composer install` в образе идёт на packagist за «latest» и при плохой сети
> падает с `curl error 28 ... Connection timed out`.

```bash
# 1. Клонировать репозиторий
git clone https://github.com/nik1t78/BCS.git && cd BCS

# 2. Создать файл секретов .env (НИКОГДА не коммитить!)
cp .env.example .env
# сгенерировать пароли:
openssl rand -hex 16   # → DB_PASSWORD
openssl rand -hex 16   # → DB_ROOT_PASSWORD
openssl rand -hex 16   # → REDIS_PASSWORD
# вписать их в .env, включая APP_KEY. Пустое значение APP_KEY= docker compose
# считает отсутствующим и прерывается со строкой
# "required variable APP_KEY is missing a value":
docker compose run --rm backend php artisan key:generate --show
# → скопировать вывод (base64:...) в APP_KEY=... в .env И в backend/.env
# Windows PowerShell: Copy-Item .env.example .env; Get-Content .env
# Проще: запустить setup-project.ps1 / setup-project.sh — он сделает это сам.

# 3. Собрать и запустить всё (frontend, backend, nginx, mysql, redis, queue, scheduler)
docker compose up -d --build

# 4. Инициализация базы (только при ПЕРВОМ запуске)
docker compose exec backend php artisan migrate --force
# вложения отдаются nginx напрямую из storage/app/public (storage:link не обязателен)
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder --force
docker compose exec backend php artisan config:cache
docker compose exec backend php artisan route:cache

# 5. Открыть в браузере
#    http://localhost                  — с этой машины
#    http://<IP этой машины>/          — для пользователей локальной сети
#    (например http://10.48.4.235/)
```

Если по IP не открывается — разрешите TCP-порт 80 в брандмауэре:

- Windows: `New-NetFirewallRule -DisplayName 'VKS web' -Direction Inbound -Protocol TCP -LocalPort 80`
- Ubuntu: `sudo ufw allow 80/tcp`

Полная диагностика — раздел [8](#8-диагностика-не-открывается-по-ip).

### Вариант 2 — режим разработки без Docker

```bash
# Терминал 1 — бэкенд на :8000 (нужны PHP 8.2+, Composer, MySQL или sqlite)
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve

# Терминал 2 — фронтенд на :5173 (proxy /api → :8000 настроен в vite.config.js)
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

CI GitHub Actions (`.github/workflows/ci.yml`) прогоняет то же самое автоматически:
lint → format check → typecheck → build (+ тесты бэкенда).

---

## 4. Демо-доступы и тестовые данные

Сид `backend/database/seeders/VksDatabaseSeeder.php` идемпотентен (повторный запуск
обновляет записи, а не падает) и создаёт 4 пользователей и несколько демонстрационных
конференций (стендап, планёрка, ретроспектива и др.):

| Роль          | Логин       | Пароль       | Отдел | Должность |
| ------------- | ----------- | ------------ | ----- | --------- |
| 👑 Администратор | `admin`     | `admin123`   | IT | Системный администратор |
| 🔧 Модератор  | `sidorov`   | `sidorov123` | HR | HR Manager |
| 👤 Пользователь | `ivanov`    | `ivanov123`  | Разработка | Frontend Developer |
| 👤 Пользователь | `petrova`   | `petrova123` | Менеджмент | Project Manager |

⚠️ **Важно:** актуальные доступы — только из таблицы выше (пароль = логин + `123`).
Старые схемы (`vks_2026`, демо-аккаунты вида `admin@vks.local`, `user123`, `mod123`)
из устаревших инструкций **больше не действуют**. Если при входе получаете 422
«Неверный логин или пароль» — выполните заново сидирование (п.7 инструкции раздела 8):
`docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder --force`
— оно перезапишет корректные bcrypt-хэши.

В продакшене смените пароли (Админка → пользователи) и включите политику смены
пароля при первом входе (`must_change_password`). Регистрация новых сотрудников —
через приложение или Админ-панель.

**Как начать работу после чистого запуска:** откройте `http://IP-сервера/`, войдите
под `admin`, создайте первую встречу (Календарь → «Создать»), пригласите участников,
проверьте in-app уведомление; при необходимости добавьте пользователей в Админ-панели.

---

## 5. Уведомления в мессенджер MAX

Как это устроено: любое событие (создание/перенос/отмена встречи, RSVP, задача,
комментарий) создаёт запись `Notification` → она **мгновенно видна в приложении**
(toast + колокольчик). Дополнительно, если настроен бот MAX, то же сообщение
дублируется пользователю в чат бота (`MessengerNotifier` → `MaxMessengerService` →
Bot API `sendmessage`). Дублирование неблокирующее: без бота всё работает, ошибки
логируются и не ломают приложение.

### Шаг 1. Создать бота в MAX

Зарегистрируйте бота через @masterbot в мессенджере MAX (команда `/newbot` или
«Создать бота») и получите **токен** вида `xxxxxxxx:ABC...`. Сохраните ссылку на чат
бота (вида `https://max.ru/id0000000000_bot`).

### Шаг 2. Прописать бота в .env сервера

В `backend/.env` (файл рядом с `docker-compose.yml` требует тех же значений):

```ini
MESSENGER=max
MAX_ENABLED=true
MAX_BOT_TOKEN=<токен бота MAX>
MAX_API_URL=https://max.ru
MAX_BOT_LINK=https://max.ru/<ваш_бот>
```

Перезагрузите конфиг и очередь:

```bash
docker compose exec backend php artisan config:clear
docker compose restart queue scheduler
```

### Шаг 3. Привязать свой аккаунт (делает каждый пользователь)

1. В приложении: **Профиль → блок «Мессенджер MAX»** → нажмите «Написать боту в MAX»,
   отправьте боту `/start` и узнайте свой chat_id.
2. Введите этот chat_id в поле «ID чата из бота» и нажмите «Привязать»
   (API: `PUT /api/max/link`, статус: `GET /api/max/status`).
3. Статус изменится на «Привязан чат: …» — уведомления будут приходить в этот чат.

Отвязать: там же кнопка «Отвязать» (`DELETE /api/max/link`).

### Шаг 4. Проверка (сквозной тест)

1. Создайте встречу с другим участником (который привязал MAX) → тот должен получить
   push «📅 Новая встреча …» в течение нескольких секунд.
2. Перенесите/отмените встречу → участники получат уведомление об изменении.
3. Ответьте RSVP «приду» → организатор получит «RSVP: … ✅ придёт».
4. Поставьте задачу → ответственный получит «📌 Вам поставлена задача …».

Ручная проверка отправки из консоли:

```bash
docker compose exec backend php artisan tinker
>>> app(\App\Services\MaxMessengerService::class)->sendChat('<CHAT_ID>', 'test');
```

Если push не пришёл:

```bash
docker compose exec backend tail -20 storage/logs/laravel.log      # ошибки Bot API
docker compose exec backend php artisan queue:work --once          # если доставка в очереди
```

### Напоминания по расписанию

Контейнер `scheduler` каждую минуту вызывает `schedule:run`: команды
`meetings:send-reminders` / `meetings:send-notifications` шлют напоминания о ближайших
встречах (по `reminder_minutes`) — in-app + в MAX тем, кто привязан.
`notifications:cleanup` чистит старые, `analytics:daily` считает статистику.

Вебхук для ответов боту (опционально):

```bash
curl -X POST "$MAX_API_URL/setWebhook?access_token=$MAX_BOT_TOKEN" \
  -d '{"url":"https://<домен>/api/max/webhook"}'
```

`MESSENGER=none` полностью выключает внешний канал (in-app остаётся).

---

## 6. Безопасность и секреты

### Где менять пароли и секреты

**Все секреты хранятся только в файле `.env` в корне рядом с `docker-compose.yml`
(он в .gitignore, в git не попадает):**

| Переменная | Что это | Как сгенерировать |
|---|---|---|
| `DB_PASSWORD` | пароль MySQL для приложения | `openssl rand -base64 24` |
| `DB_ROOT_PASSWORD` | root-пароль MySQL | `openssl rand -base64 24` |
| `REDIS_PASSWORD` | пароль Redis | `openssl rand -base64 24` |
| `APP_KEY` | ключ шифрования Laravel | `docker compose exec backend php artisan key:generate --show` |
| `MAX_BOT_TOKEN` | токен бота MAX | выдать у @masterbot |

### Что уже сделано

- Секретов нет в коде и git (проверено grep); docker-compose требует их из `.env` (`${VAR:?}`).
- MySQL и Redis **не публикуют порты наружу** — доступны только внутри сети контейнеров.
- Nginx: CSP, X-Frame-Options SAMEORIGIN, nosniff, Referrer-Policy, server_tokens off,
  запрет /.env и скрытых файлов, rate-limit на /api.
- Laravel Sanctum: токены с истечением, одноразовый refresh (sha256 в БД),
  throttle:login + троттлинг API, audit-лог входов (таблица `auth_audit_log`),
  блокировка неактивных аккаунтов.
- Хэширование паролей bcrypt (cost 12), колонки password/token в `$hidden` модели.
- Загрузка файлов: whitelist расширений/MIME, ограничение размера 20 MB,
  хранение вне webroot-доступа исполнения.
- Логи с ротацией (3×10 МБ), ежедневный бэкап БД командой `php artisan db:backup`
  (см. раздел 7).
- Лёгкость/оптимизация: alpine-образы, OPcache, gzip, immutable-кеш статики,
  лимиты памяти контейнеров (512M–1G).

### Рекомендации

1. Никогда не оставляйте дефолтные пароли сидера (`login123`) в продакшене — смените
   через Админ-панель; первый вход с политикой `must_change_password`.
2. Регулярно: `docker compose pull` + пересборка (патчи PHP/nginx).
3. HTTPS обязателен при публикации наружу (Let's Encrypt через reverse-proxy/certbot).
4. Раз в 90 дней менять DB/Redis пароли: обновить `.env` → `docker compose up -d`.
5. Мониторинг failed login: таблица `auth_audit_log` (Админка → аудит-лог).

---

## 7. Эксплуатация: рестарт, обновление, бэкапы

### Запуск после выключения света / перезагрузки сервера

Данные базы хранятся на диске в папке `./docker/mysql/data` (bind-mount), поэтому
после неожиданного выключения питания ничего не теряется:

```bash
cd /path/to/BCS        # папка проекта
docker compose up -d   # поднять все контейнеры
```

Готово — сайт будет доступен по адресу `http://IP-сервера/`.

Контейнеры с `restart: unless-stopped` Docker сам поднимает при старте системы, если
демон включён: `sudo systemctl enable docker` (Linux) или автозапуск Docker Desktop
(Windows).

### Проверка, что всё работает

```bash
docker compose ps                       # все контейнеры должны быть Up
curl -I http://localhost/               # 200 OK от nginx
docker compose logs --tail=50 backend   # ошибки бэкенда, если есть
```

### Обновление кода (после git pull)

```bash
git pull
docker compose build frontend backend
docker compose up -d                    # пересоздать контейнеры из новых образов
# vendor живёт в volume backend_vendor — после git pull обновляем зависимости
# внутри контейнера (один раз, виден всем: backend / queue / scheduler):
docker compose exec backend composer install --no-dev --prefer-dist --optimize-autoloader
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan optimize:clear
docker compose exec backend php artisan optimize
docker compose restart queue scheduler  # worker'ы перечитают новый код
```

Фронтенд собирается контейнером-билдером в общий volume `frontend_build`, откуда
nginx отдаёт статику — отдельно собирать `npm run build` на хосте не нужно.

### Остановка и удаление

```bash
docker compose stop       # остановить (данные сохраняются)
docker compose down       # удалить контейнеры (данные БД в ./docker/mysql/data остаются)
docker compose down -v    # + удалить volumes: frontend_build, backend_vendor, bootstrap_cache
# ⚠️ НИКОГДА не удаляйте вручную папку ./docker/mysql/data — в ней база данных.
```

### Автоматический бэкап базы данных

Каждый день в **02:30** планировщик (контейнер `scheduler`) выполняет
`php artisan db:backup --keep=14`: дамп сохраняется в
`backend/storage/app/backups/backup-ГГГГ-ММ-ДД_ЧЧ-ММ-СС.sql.gz`, хранится последних
**14 копий** (старые удаляются автоматически). Файлы лежат в bind-папке `./backend/storage`,
поэтому не теряются при пересборке контейнеров.

```bash
docker compose exec backend php artisan db:backup --keep=14   # сделать бэкап сейчас
ls -lh backend/storage/app/backups/                           # посмотреть копии на хосте
```

Восстановление из бэкапа:

```bash
docker compose up -d mysql
gunzip -c backend/storage/app/backups/backup-ДАТА.sql.gz | \
  docker compose exec -T mysql mysql -uroot -p"$DB_ROOT_PASSWORD" vks_schedule
```

### Управление сервисами

| Задача | Команда |
|---|---|
| Посмотреть статус | `docker compose ps` |
| Логи всех сервисов | `docker compose logs -f` |
| Логи одного сервиса | `docker compose logs -f backend` (или nginx, mysql, queue) |
| Перезапустить сервис | `docker compose restart backend` |
| Зайти в бэкенд | `docker compose exec backend sh` |
| Консоль MySQL | `docker compose exec mysql mysql -u"$DB_USERNAME" -p"$DB_PASSWORD" "$DB_DATABASE"` |

---

## 8. Диагностика типовых ошибок

### Полная пошаговая инструкция «с нуля» (Windows, PowerShell) — делайте строго по порядку

```powershell
# 1. Свежий код (настраиваем ветку main один раз):
cd D:\server\BCS-main
git fetch origin main
git branch --set-upstream-to=origin/main main   # убирает "There is no tracking information"
git reset --hard origin/main                    # локальная main = актуальный GitHub
git pull                                        # теперь просто git pull работает сам

# 2. Удалить битый симлинк, если он остался на диске (ломает docker build:
#    "failed to solve: invalid file request public/storage"):
Remove-Item -Force -Recurse backend\public\storage -ErrorAction SilentlyContinue

# 3. ОСТАНОВИТЬ контейнеры БЕЗ флага -v !!! (-v удаляет базу данных MySQL!)
docker compose down

# 4. Настройка проекта (конфиги Laravel, .env, APP_KEY):
powershell -ExecutionPolicy Bypass -File .\setup-project.ps1

# 5. Сборка и запуск всех сервисов:
docker compose up -d --build

# 6. Дождаться запуска mysql (STATUS = healthy), проверить:
docker compose ps

# 7. Миграции + демо-данные (пароли login+123):
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder --force

# 8. Кэши конфигурации и маршрутов (команду storage:link НЕ выполнять — не нужна):
docker compose exec backend php artisan config:cache
docker compose exec backend php artisan route:cache

# 9. Открыть в браузере http://10.48.4.235/ или http://localhost/
#    Если фронт «не догрузился» / старые шрифты — Ctrl+F5 (жёсткая перезагрузка).
```

Если доступ из сети не работает — разрешите порт 80 в брандмауэре Windows:
```powershell
New-NetFirewallRule -DisplayName 'VKS web' -Direction Inbound -Protocol TCP -LocalPort 80
```

### Ошибка сборки: `failed to solve: invalid file request public/storage`

Причина: в git был закоммичен файл-симлинк `backend/public/storage`, который на Windows
распаковывается как обычный файл и ломает сборку Docker-образа backend. Исправлено
(коммит `8bbff146`): симлинк удалён из репозитория, nginx отдаёт вложения напрямую из
`storage/app/public`. Что делать: обновить код (`git pull`) и удалить остаток с диска
(`Remove-Item backend\public\storage`). Команду `php artisan storage:link` больше
запускать не нужно.

### Ошибка миграции: `Base table or view already exists: 1050 Table 'users' already exists`

Причина: база была создана старой версией миграций (в ней дублировалось создание
таблицы `users`). В текущем коде дубль убран. Если ошибка появилась на вашей машине:

```powershell
# вариант А — данные не нужны, пересоздать базу с нуля (самый чистый):
docker compose down -v          # удалит том mysql_data и все контейнеры
docker compose up -d --build
# дождаться "healthy" mysql (docker compose ps), затем:
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder --force

# вариант Б — сохранить данные: удалить только запись о зависшей миграции и продолжить
docker compose exec backend php artisan migrate:status
docker compose exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" vks_schedule \
  -e "delete from migrations where migration='2024_01_01_000000_create_vks_tables';"
docker compose exec backend php artisan migrate --force
```

После `git pull` повторите `docker compose build` (образы содержат старые миграции)
или используйте `docker compose up -d --build`.

### PowerShell: «NativeCommandError» при запуске setup-project.ps1

Старая версия скрипта прерывалась, когда docker писал в stderr (`redis Pulling`,
`Container ... Running`). Это НЕ ошибка проекта — обновите скрипт (`git pull`) и
запустите заново; в текущей версии stderr игнорируется намеренно.

### `Target class [Database\Seeders\VksDemoSeeder] does not exist`

Такого сидера нет — правильное имя класса `VksDatabaseSeeder`:

```bash
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder --force
# или просто (он вызывается из DatabaseSeeder по умолчанию):
docker compose exec backend php artisan db:seed --force
```

### nginx: `[emerg] unknown log format "buffer=32k"` (контейнер vks-nginx в цикле Restarting)

Причина: в `docker/nginx/default.conf` директива `access_log ... buffer=32k flush=5s;`
использовалась без объявления именованного формата (`log_format`) — nginx считает
«buffer=32k» именем формата, не находит его и падает при старте.

Исправление (в текущем коде на GitHub): добавлен `log_format vks_combined` на уровне http,
`access_log` использует его. Обновите конфиг одним из способов:

```powershell
# способ 1 — через git:
git pull
docker compose up -d --force-recreate nginx

# способ 2 — если git недоступен, вручную отредактируйте docker/nginx/default.conf:
#   в начало файла (после строк limit_req_zone/limit_conn_zone) добавьте:
#     log_format vks_combined '$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"';
#   а строку access_log внутри server{} замените на:
#     access_log /var/log/nginx/access.log vks_combined;
docker compose restart nginx
```

Проверка: `docker compose logs nginx` — должно быть «Configuration complete; ready for start up»
без [emerg], статус контейнера — Up.

### Не открывается по IP

Сайт доступен по адресу **`http://IP-сервера/` без порта** (nginx слушает 80).
Если по `http://10.48.4.235/` ничего не открывается, пройдите чек-лист сверху вниз.

### Шаг 1. Убедитесь, что код на сервере АКТУАЛЕН (самое частое!)

Если логи nginx показывают ошибку:

```
"limit_req_zone" directive is not allowed here in /etc/nginx/conf.d/default.conf:23
```

значит на сервере лежит **старая версия** `docker/nginx/default.conf` (из неё
директивы `limit_req_zone` не перенесены на уровень `http`). Обновите код и
перезапустите контейнер — файл монтируется с диска, пересборка образа не нужна:

```bash
git pull                          # или скопируйте свежий docker/nginx/default.conf
docker compose restart nginx      # nginx должен остаться Up
docker compose logs nginx --tail=20
```

Проверка конфига перед рестартом (опционально):

```bash
docker run --rm -v "${PWD}/docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t
```

Другие типичные симптомы устаревшего кода:
- `Method Illuminate\Database\MySqlConnection::select_one does not exist` при
  `php artisan migrate` → старая миграция `fix_audit_logs_user_fk`; после обновления
  кода выполните миграцию ещё раз (незавершённая откатится автоматически).
- `Access denied for user 'vks_user' ... using password: NO` → пароли в
  `docker-compose.yml` и `.env` не совпадают; синхронизируйте `DB_PASSWORD` и
  пересоздайте БД при первом запуске (`docker compose down && docker compose up -d`).

### Шаг 2. Убедитесь, что контейнеры запущены

```bash
cd /path/to/BCS          # папка проекта на СЕРВЕРЕ 10.48.4.235
docker compose ps        # nginx, backend, mysql, redis, queue, scheduler — все Up
```

Типичная причина падения nginx: **порт 80 занят** другим веб-сервером (apache2, IIS,
системный nginx):

```bash
sudo ss -tlnp | grep ':80 '                                    # Linux
sudo systemctl stop apache2 && sudo systemctl disable apache2  # если мешает apache
```

### Шаг 3. Проверьте, что сервер отдаёт сайт ЛОКАЛЬНО

```bash
curl -I http://localhost/    # 200 OK → nginx работает, проблема в сети (Шаг 4)
```

### Шаг 4. Брандмауэр на сервере — самое частое решение

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 80/tcp && sudo ufw reload
# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-service=http && sudo firewall-cmd --reload
# Windows (PowerShell от администратора)
New-NetFirewallRule -DisplayName 'VKS web' -Direction Inbound -Protocol TCP -LocalPort 80
```

### Шаг 5. Проверьте доступность с рабочего ПК

```bash
ping 10.48.4.235                          # вообще ли виден сервер
Test-NetConnection 10.48.4.235 -Port 80   # PowerShell Windows: открыт ли порт
```

- Ping есть, порт 80 закрыт → брандмауэр (Шаг 4) или nginx слушает только `127.0.0.1` (Шаг 6).
- Ping нет → ПК и сервер в разных сетях/VLAN — обратитесь к сетевому администратору
  (адрес `10.48.x.x` — корпоративная подсеть).

### Шаг 6. Переменная listen_ip в .env

По умолчанию должно быть `listen_ip=0.0.0.0` (доступ со всех интерфейсов).
Если стоит `127.0.0.1` — сайт доступен только с самого сервера; исправьте и выполните
`docker compose up -d nginx`.

### Шаг 7. Проверяйте именно HTTP, а не HTTPS

Вводите адрес полностью: `http://10.48.4.235/` (именно `http://`, без порта).
Браузер может сам «дописывать» https → ошибка. Попробуйте инкогнито/другой браузер/
телефон по тому же Wi-Fi — чтобы исключить кэш DNS/браузера.

### Шаг 8. Сайт открывается, но страница пустая / ошибки в консоли

```bash
docker compose logs backend --tail=50
docker compose exec backend php artisan migrate --force   # если база не инициализирована
docker compose run --rm frontend                          # пересобрать статику фронта
```

### Итоговый быстрый набор команд на сервере

```bash
cd /path/to/BCS
docker compose down
docker compose up -d --build
sudo ufw allow 80/tcp            # или firewall-cmd / New-NetFirewallRule
curl -I http://localhost/        # должно быть 200
```

Если `curl -I http://localhost/` возвращает 200, а с вашего ПК порт 80 недоступен —
проблема на 100% в брандмауэре сервера или маршрутизации сети.

### Частые ошибки

| Ошибка | Причина | Решение |
|---|---|---|
| nginx: `"limit_req_zone" directive is not allowed here` | устаревшая версия конфига | обновите код (`git pull`), затем `docker compose up -d --force-recreate nginx` |
| MySQL `Access denied for user 'vks_user' ... (using password: NO)` | пароли в `.env` не совпадают с БД ИЛИ нет `.env` | скопируйте `.env.example` → `.env`; если пароль менялся — пересоздайте пользователя или удалите `docker/mysql/data` и выполните полный запуск заново (данные будут потеряны!) |
| `Connection refused (Host: mysql)` | контейнер mysql ещё не поднялся | подождите 20–40 с, проверьте `docker compose ps`, при `Restarting` — `docker compose logs mysql` |
| `vks-queue` в статусе Restarting | следствие ошибок БД/redis выше | после исправления паролей: `docker compose restart queue scheduler` |
| composer `curl error 28 ... Connection timed out` | нет `backend/composer.lock` | убедитесь, что lock в репозитории; иначе `cd backend && composer update --lock` и закоммитьте |
| PowerShell: `docker : redis Pulling ... NativeCommandError` | stderr Docker при `ErrorActionPreference=Stop` | обновите `setup-project.ps1` (`git pull`) — исправлено |

---

## 9. Развёртывание на Linux-сервере (Ubuntu/Debian)

### Требования

Минимальные: Ubuntu 22.04 LTS / Debian 12, 2 vCPU, 2 GB RAM, 20 GB SSD, открытые
порты 22/80/443. Рекомендуемые: 4 vCPU, 4 GB RAM, 40 GB SSD, статический IP/домен.

### Подготовка сервера

```bash
ssh root@your_server_ip
sudo apt update && sudo apt upgrade -y
adduser deploy && usermod -aG sudo deploy && su - deploy   # не работайте под root

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER && newgrp docker
```

### Установка проекта

```bash
git clone https://github.com/nik1t78/BCS.git vks && cd vks
bash ./setup-project.sh                # каркас Laravel + .env + APP_KEY
docker compose up -d --build
docker compose exec backend php artisan migrate --force
# вложения отдаются nginx напрямую из storage/app/public (storage:link не обязателен)
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder --force
docker compose exec backend php artisan optimize
sudo systemctl enable docker           # автозапуск после перезагрузки
sudo ufw allow 22,80,443/tcp
```

Приложение доступно на `http://<IP-сервера>/`.

### HTTPS (рекомендуется для продакшена)

Наружу проект публикуется через ваш reverse-proxy с HTTPS (certbot / nginx-proxy /
Traefik): терминируйте TLS на нём и проксируйте на контейнер nginx (порт 80).

### Firewall-варианты

```bash
# ufw (Ubuntu)
sudo ufw allow 80/tcp && sudo ufw reload
# firewalld (RHEL/CentOS)
sudo firewall-cmd --permanent --add-service=http && sudo firewall-cmd --reload
```

Дальнейшая эксплуатация (рестарт/обновление/бэкапы) — как в разделе 7, диагностика —
раздел 8.

---

## 10. Структура проекта и полезные команды

```
BCS/
├── src/                     # фронтенд (Vite + React + TS)
│   ├── api/client.ts        # HTTP-клиент (Sanctum Bearer, авто-refresh токена)
│   ├── store-api.ts         # функции работы с API + маппинг snake_case ↔ camelCase
│   ├── components/          # страницы и виджеты (Schedule, UserPanel, AdminPanel,
│   │                        #   MeetingMinutes, MeetingRsvp, RoomsManager, Dashboard,
│   │                        #   Notifications, Templates, TagsManager, Stats, Profile…)
│   ├── utils/               # recurrence (RRULE), favorites, meetingSort, export
│   └── types.ts             # общие типы предметной области
├── backend/                 # Laravel-приложение
│   ├── app/Http/Controllers/Api/   # REST-контроллеры
│   ├── app/Models/                 # Eloquent-модели (Meeting, MeetingMinute, MeetingTask,
│   │                               #   TaskComment, MeetingRsvp, Room, Notification, User…)
│   ├── app/Services/               # MessengerNotifier, MaxMessengerService, RecurrenceService
│   ├── app/Console/Commands/       # db:backup, meetings:send-notifications,
│   │                               #   meetings:send-reminders, notifications:cleanup, analytics:daily
│   ├── database/migrations|seeders # схема БД, VksDatabaseSeeder
│   └── routes/api.php              # все маршруты (throttle:api, роли, can:admin)
├── docker/                  # конфиги nginx, скелет laravel12, данные
├── docker-compose.yml       # nginx, php-fpm, mysql, redis, queue, scheduler, frontend-build
├── setup-project.ps1|.sh    # подготовка каркаса Laravel + .env + APP_KEY
├── .github/workflows/ci.yml # CI: lint → format → typecheck → build (+ backend tests)
└── DOCS.md                  # эта документация
```

### Полезные команды

```bash
# Фронтенд
npm run dev            # dev-сервер Vite (:5173)
npm run build          # production-сборка в dist/
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint по src/
npm run format         # Prettier --write по src/

# Бэкенд (внутри контейнера: docker compose exec backend ...)
php artisan db:backup --keep=14        # резервная копия БД (ротация 14 копий)
php artisan schedule:run               # ручной запуск планировщика (напоминания, бэкап)
php artisan migrate                    # применить миграции
php artisan optimize / optimize:clear  # кеш config/route/view
```

---

## 11. История исправлений (архив)

Хронология ключевых починков проекта — сохранена для истории, всё уже применено в коде:

- **Админ-панель, раздел «Конференции»**: кнопки «Создать»/«Редактировать» не открывали
  форму — добавлено модальное окно формы создания/редактирования конференции; кнопки
  работают, валидация обязательных полей на месте.
- **Удаление демо-аккаунтов**: из UI убраны блок демо-аккаунтов на странице входа
  (`AuthPage.tsx`), вызов `initializeDemoData()` (`main.tsx`) и упоминания в README;
  логин-страница чистая, данные создаются только серверным сидером (раздел 4).
- **store.ts**: устранены дублирующие объявления после слияния веток main+BCS —
  фронтенд собирается (`npm run build` OK).
- **nginx**: директивы `limit_req_zone` вынесены из `server {}` на уровень `http`
  (исправлен пуск контейнера vks-nginx); MIME-типы и CSP настроены корректно.
- **docker-compose**: исправлены конфигурации сервисов, наружный порт nginx зафиксирован = 80.
- **setup-скрипты**: PowerShell больше не прерывается на stderr Docker («redis Pulling»).
- **Финальная проверка проекта**: структура (17 компонентов React, TS-типы, утилиты
  экспорта), бэкенд (контроллеры/модели/миграции), безопасность (секретов в git нет) —
  проверено и подтверждено.

---

## 11. Идеи новых функций (Roadmap)

1. Экспорт протоколов встреч в PDF и отправка в MAX *(печатный PDF уже есть)*.
2. Календарь-синхронизация (ICS-подписка) + напоминание в MAX за 15 мин *(экспорт .ics уже есть)*.
3. Запись/транскрибация встреч (WebRTC SFU + Whisper).
4. Опросы и голосования во время встречи.
5. Общие ссылки-приглашения для внешних участников (guest tokens с TTL).
6. Дашборд админа: качество соединения (WebRTC stats), активные комнаты.
7. PWA-push через MAX.
8. Ролевая модель тоньше: модератор комнаты, наблюдатель.
9. Шифрование E2E для чата встречи.
10. Интеграция календаря предприятия (CalDAV).
