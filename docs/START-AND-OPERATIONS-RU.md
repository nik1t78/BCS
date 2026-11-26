# BCS — подробная инструкция по запуску и эксплуатации

> Актуально для ветки `vks/phase36-dashboard-performance`. Эта ветка содержит изменения этапа 36 поверх этапа 35 и пока оформлена отдельным PR. Она не является автоматически установленной версией production.

## 1. Что потребуется

Для запуска рекомендуемый вариант — Docker Compose.

- Windows 10/11: Docker Desktop с включённым Linux engine и Docker Compose v2.
- Git for Windows — чтобы получить нужную ветку.
- Не требуется устанавливать на Windows PHP, Composer, MySQL, Redis, Node.js или Python: они запускаются в контейнерах.
- Для разработки фронтенда отдельно понадобится Node.js 20+; для разработки backend без Docker — PHP 8.4 и Composer.

Перед запуском убедитесь, что Docker Desktop запущен и команда `docker compose version` работает.

## 2. Получить именно эту версию проекта

### Новая папка

Откройте PowerShell:

```powershell
cd D:\server
git clone --branch vks/phase36-dashboard-performance --single-branch https://github.com/nik1t78/BCS.git BCS
cd D:\server\BCS
```

Если GitHub попросит авторизацию, используйте разрешённый для этого репозитория способ входа. Не вставляйте токены в команды и не сохраняйте их в документации.

### Проект уже находится в D:\server\BCS

Сначала проверьте локальные изменения:

```powershell
cd D:\server\BCS
git status --short
```

Если команда что-либо вывела, не переключайте ветку и не выполняйте `reset`, `clean` или принудительный checkout: сначала сохраните свои изменения. Если вывод пустой:

```powershell
git fetch origin
git switch --track -c vks/phase36-dashboard-performance origin/vks/phase36-dashboard-performance
```

Если ветка уже существует локально:

```powershell
git switch vks/phase36-dashboard-performance
git pull --ff-only origin vks/phase36-dashboard-performance
```

## 3. Первый запуск на чистой локальной машине

В корне проекта выполните:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\START-BCS-WINDOWS.ps1
```

Скрипт:
1. Создаёт корневой `.env`, только если его ещё нет.
2. Генерирует уникальные `APP_KEY`, пароль БД, root-пароль MySQL и пароль Redis.
3. Проверяет Docker Engine и Compose.
4. Собирает и запускает контейнеры.
5. Копирует публичные файлы Laravel в volume для Nginx.
6. Выполняет `php artisan migrate --force` и создаёт storage-ссылку.
7. Запускает VKS-бот только если он явно включён в конфигурации и задан токен.

Первый запуск занимает больше времени, потому что Docker скачивает базовые образы и собирает приложение.

### Создать первого администратора на пустой тестовой БД

Скрипт запуска не добавляет демонстрационных пользователей. Если это совершенно новая локальная/тестовая база и в ней ещё нет пользователей, выполните сидер:

```powershell
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder --force
```

Для локальной демонстрационной установки сидер создаёт тестовые учётные записи. Их список приведён в [DOCS.md, раздел 4](../DOCS.md#4-демо-доступы-и-тестовые-данные). Сразу после входа смените все демонстрационные пароли. **Не запускайте этот сидер на действующей базе:** он предназначен для наполнения чистой тестовой установки и может изменить тестовые учётные записи.

**Важно:** скрипт выполняет миграции. Используйте его для новой локальной/тестовой установки. Не запускайте его впервые на действующем сервере или рядом с важной БД, пока не сделана проверенная резервная копия и не согласовано применение миграций. Существующий корневой `.env` скрипт не перезаписывает.

## 4. Настроить адрес сайта

Откройте корневой файл `.env` в редакторе. Это файл рядом с `docker-compose.yml`, а не `backend/.env`.

Главные параметры:

| Переменная | Назначение |
|---|---|
| `SITE_IP` | IP компьютера/сервера, по которому пользователи открывают сайт; влияет на `APP_URL` |
| `LISTEN_IP` | `0.0.0.0` — доступ из сети; `127.0.0.1` — только локально |
| `APP_KEY` | Ключ Laravel; должен быть заполнен и иметь формат `base64:...` |
| `DB_PASSWORD` | Пароль пользователя MySQL |
| `DB_ROOT_PASSWORD` | Отдельный пароль root MySQL |
| `REDIS_PASSWORD` | Отдельный пароль Redis |
| `TZ`, `APP_TIMEZONE` | Часовой пояс; стандарт проекта — `Europe/Moscow` |
| `BOT_TOKENS` | Токены учётных записей VKS-бота; секрет, не публиковать |
| `VKSBOT_EXPECTED` | Включает ожидание отдельного контейнера VKS-бота |
| `MESSENGER`, `MAX_ENABLED`, `MAX_BOT_TOKEN` | Настройки внешних уведомлений MAX |

Чтобы узнать IPv4-адрес Windows, выполните `ipconfig` и найдите IPv4-адрес активного Ethernet/Wi-Fi адаптера. Запишите его в `SITE_IP`. Для локального доступа с самого компьютера можно использовать `localhost`; для коллег в локальной сети укажите LAN IP компьютера.

Не отправляйте никому содержимое `.env`. Не коммитьте его в Git.

После изменения адреса или параметров окружения проверьте конфигурацию и пересоздайте сервисы:

```powershell
docker compose config --quiet
docker compose up -d
```

Если менялись параметры сборки или исходный код, используйте процедуру обновления ниже с `--build`.

## 5. Открыть сайт

- На компьютере, где запущен Docker: [http://localhost/](http://localhost/)
- С другого компьютера в локальной сети: `http://IP-АДРЕС-СЕРВЕРА/`, например `http://10.0.0.25/`.

Nginx публикует TCP-порт 80. Если он занят IIS, Apache или другим приложением, сначала выясните, кто его использует; не меняйте порт наугад.

Для доступа из локальной сети в Windows Firewall (PowerShell от имени администратора):

```powershell
New-NetFirewallRule -DisplayName "BCS web HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```

Для публикации в интернете настройте отдельный reverse proxy с HTTPS. Не выставляйте MySQL и Redis в интернет: в Compose они доступны только во внутренней Docker-сети.

## 6. Проверить, что всё запущено

```powershell
docker compose ps
docker compose logs --tail=100 nginx backend mysql redis queue scheduler
```

Проверка API:

```powershell
Invoke-RestMethod http://localhost/api/health
```

Ожидаемый ответ содержит `status: ok`.

Основные сервисы:

| Сервис | Назначение |
|---|---|
| `nginx` | Входная точка сайта, порт 80, раздача frontend и проксирование API |
| `frontend` | Одноразовая сборка React/Vite в volume; контейнер может завершиться с кодом 0 — это нормально |
| `backend` | Laravel API и PHP-FPM |
| `mysql` | Основная база данных; данные хранятся в `./docker/mysql/data` |
| `redis` | Внутренний Redis |
| `queue` | Фоновые задания, уведомления и создание ссылок |
| `scheduler` | Планировщик Laravel, запускает расписание задач раз в минуту |
| `vks-bot` | Необязательный браузерный бот, включается отдельным профилем |

## 7. Обновить уже работающую локальную копию

Перед обновлением убедитесь, что нет незакоммиченных пользовательских изменений:

```powershell
git status --short
```

Если рабочее дерево чистое и вы уже на нужной ветке:

```powershell
git fetch origin
git pull --ff-only origin vks/phase36-dashboard-performance
docker compose config --quiet
docker compose up -d --build
docker compose run --rm --no-deps backend-assets
docker compose ps
```

Для этапа 36 миграции БД не добавлялись. Поэтому для обновления именно этого этапа повторно запускать миграции не требуется. Если вы обновляетесь с другой, более старой версии проекта, сначала сверяйте историю миграций и делайте резервную копию.

После обновления браузер может показывать старые файлы из кеша: выполните жёсткое обновление страницы `Ctrl+F5`. Не очищайте Docker volumes и папку `docker/mysql/data`.

## 8. Остановить и снова запустить

Остановить контейнеры, сохранив данные:

```powershell
docker compose stop
```

Запустить снова:

```powershell
docker compose start
```

Перезапустить отдельный сервис:

```powershell
docker compose restart backend
docker compose restart queue scheduler
```

**Никогда не используйте `docker compose down -v` для обычной остановки или обновления.** Флаг `-v` удаляет именованные тома и может уничтожить данные приложения. Не удаляйте `docker/mysql/data`.

## 9. Резервная копия

Перед обновлениями и любыми изменениями БД создавайте резервную копию:

```powershell
docker compose exec backend php artisan db:backup --keep=14
```

Бэкапы проекта сохраняются в storage приложения и отдельном Docker volume для резервных копий. Проверьте наличие созданного файла и периодически копируйте резервные копии за пределы компьютера/сервера. Резервная копия, хранящаяся только на том же диске, не защищает от отказа диска.

## 10. Необязательный VKS-бот

По умолчанию бот не запускается. Для автоматического создания реальных ссылок SaluteJazz нужны действующие токены и согласованная конфигурация. Заполните `BOT_TOKENS` в корневом `.env`, установите `VKSBOT_EXPECTED=true`, затем:

```powershell
docker compose --profile bot up -d --build vks-bot
docker compose ps vks-bot
docker compose logs --tail=100 vks-bot
```

Без действующих токенов бот не сможет создавать комнаты. Не вставляйте токены в сообщения, тикеты или Git.

## 11. MAX-уведомления

В корневом `.env` настройте `MESSENGER=max`, `MAX_ENABLED=true`, `MAX_API_URL=https://platform-api2.max.ru`, `MAX_BOT_TOKEN` и `MAX_BOT_LINK` согласно настройкам вашего MAX-бота. Важно: актуальный Bot API использует `POST /messages?chat_id=...` и заголовок `Authorization: <токен>` без `Bearer`. Если в уже существующем `.env` остался старый адрес `https://maxapi.ru/v1` или `https://platform-api.max.ru`, замените его на `https://platform-api2.max.ru`. После изменения:

```powershell
docker compose restart backend queue scheduler
```

Каждый сотрудник должен самостоятельно привязать чат с ботом в профиле приложения. Без MAX in-app уведомления продолжают работать.

## 12. Режим разработки без Docker (для разработчиков)

Это отдельный режим, не рекомендуемый для обычного запуска на сервере.

Frontend, терминал 1 (Node.js 20+):

```powershell
npm ci
npm run dev
```

Откройте второй терминал. Backend требует PHP 8.4, Composer, настроенную MySQL и Redis/queue либо корректно выбранные локальные драйверы. В `backend/.env` должны быть заданы параметры локальной БД (например, `DB_HOST=127.0.0.1`), а не Docker-имя `mysql`.

```powershell
cd backend
composer install
Copy-Item .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve --host=127.0.0.1 --port=8000
```

Vite проксирует запросы `/api` на `http://localhost:8000`. Фронтенд будет доступен по адресу `http://localhost:5173`. Не используйте эту конфигурацию для production.

Проверки frontend:

```powershell
npm run lint
npm run typecheck
npm run build
```

## 13. Частые ошибки

### Docker Engine недоступен
Запустите Docker Desktop, дождитесь состояния Engine running, затем повторите команду.

### Порт 80 уже занят
Проверьте:

```powershell
Get-NetTCPConnection -LocalPort 80 -State Listen
```

Остановите конфликтующий веб-сервер только если понимаете последствия. Не останавливайте системные службы вслепую.

### Сайт не открывается по IP
Проверьте `SITE_IP`, `LISTEN_IP=0.0.0.0`, правило Firewall, `docker compose ps` и логи Nginx.

### API возвращает HTTP 500
Посмотрите логи:

```powershell
docker compose logs --tail=200 backend
docker compose exec backend php artisan about
docker compose exec backend php artisan optimize:clear
```

Проверьте, что `APP_KEY` в корневом `.env` не пустой и начинается с `base64:`, а пароли БД/Redis совпадают с конфигурацией. Не публикуйте значения секретов в логах или сообщениях.

### Форма или стили выглядят старыми после обновления
Убедитесь, что сборка frontend завершилась, затем обновите страницу через `Ctrl+F5`. Проверьте:

```powershell
docker compose logs --tail=100 frontend nginx
docker compose run --rm --no-deps backend-assets
```

### Ошибки очереди или уведомлений

```powershell
docker compose logs --tail=200 queue scheduler
docker compose exec backend php artisan queue:failed
```

Не очищайте очередь и не удаляйте failed jobs массово, пока не выяснили причину.

## 14. Важные ограничения текущей ветки

- Ветка `vks/phase36-dashboard-performance` — отдельная ветка разработки, PR №139; не считать её автоматически установленной на production.
- Этап 36 меняет загрузку формы создания ВКС: форма загружается динамически при открытии. Измерения CPU/LCP/INP на вашем сервере ещё нужно провести отдельно.
- CI проверяет код и сборку, но не заменяет проверку реальных Docker-контейнеров, браузера, MAX и SaluteJazz.
- Не сливайте ветку и не обновляйте production до проверки PR и согласования.
