# 🚀 Как запустить проект (ВКС Расписание)

## Вариант 1 — Docker (рекомендуется, сервер/прод)

> **Обязательно:** `backend/composer.lock` должен быть в репозитории. Без него
> `composer install` в образе идёт на packagist за «latest» и при плохой сети
> падает с `curl error 28 ... Connection timed out`. Если lock'а нет —
> сгенерируйте его локально (`cd backend && composer update --lock`) и закоммитьте.

```bash
# 1. Клонировать репозиторий
git clone <адрес-репозитория> && cd BCS

# 2. Создать файл секретов .env (НИКОГДА не коммитить!)
cp .env.example .env
# сгенерировать пароли:
openssl rand -hex 16   # → DB_PASSWORD
openssl rand -hex 16   # → DB_ROOT_PASSWORD
openssl rand -hex 16   # → REDIS_PASSWORD
# вписать их в .env, включая APP_KEY — иначе compose прерывается со строкой
# "required variable APP_KEY is missing a value" (пустое значение APP_KEY=
# тоже считается отсутствующим):
docker compose run --rm backend php artisan key:generate --show
# → скопировать вывод (base64:...) в APP_KEY=... в .env
# Windows PowerShell: Copy-Item .env.example .env; Get-Content .env

# 3. Собрать и запустить всё (frontend, backend, nginx, mysql, redis, queue, scheduler)
docker compose up -d --build

# 4. Инициализация базы (только при ПЕРВОМ запуске)
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan storage:link        # для картинок/вложений
docker compose exec backend php artisan config:cache
docker compose exec backend php artisan route:cache

# 5. Открыть в браузере
#    http://localhost:8080   (порт проброшен только на 127.0.0.1 — наружу не торчит)
```

Обновление кода в проде:
```bash
git pull
docker compose build frontend backend
docker compose up -d          # пересоздать контейнеры из новых образов
# vendor живёт в volume backend_vendor — после git pull обновляем зависимости
# внутри контейнера (один раз, виден всем: backend / queue / scheduler):
docker compose exec backend composer install --no-dev --prefer-dist --optimize-autoloader
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan optimize:clear && docker compose exec backend php artisan optimize
docker compose restart queue scheduler    # worker'ы перечитают новый код
```

## Вариант 2 — локальная разработка без Docker

```bash
# Фронтенд (http://localhost:5173, проксирует /api → localhost:8000)
npm install
npm run dev

# Бэкенд (в другом терминале, нужен PHP 8.4+ и Composer)
cd backend
composer install
cp .env.example .env && php artisan key:generate
php artisan serve --port=8000
php artisan migrate
```

## Уведомления MAX
1. Создайте бота через @masterbot в мессенджере MAX, получите токен.
2. В `.env`: `MAX_BOT_TOKEN=...`, `MESSENGER=max`.
3. Пользователь привязывает chat_id в разделе «Профиль» приложения.

## Что защищено / оптимизировано
- Секретов в git нет: `.env` в .gitignore; compose требует пароли из `.env` (`:?`).
- MySQL и Redis недоступны снаружи (нет published-портов), только внутренняя сеть.
- Nginx: CSP, X-Frame-Options, nosniff, Referrer-Policy, лимиты запросов (rate-limit), запрет скрытых файлов.
- Laravel: throttle на вход/API, httpOnly/SameSite cookies, токены Sanctum живут 24 ч, APP_DEBUG=false.
- Лёгкость: alpine-образы, OPcache, gzip, immutable-кеш статики, лимиты памяти контейнеров (512M–1G), ротация логов (3×10 МБ).
