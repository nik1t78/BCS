# Как запустить проект после выключения света / перезагрузки сервера

Все сервисы проекта подняты в Docker Compose, данные базы хранятся на диске в
папке `./docker/mysql/data` (bind-mount), поэтому после неожиданного выключения
питания ничего не теряется — проект нужно просто заново запустить.

## Быстрый запуск (после выключения света)

```bash
cd /path/to/vks-schedule        # перейти в папку проекта
docker compose up -d            # поднять все контейнеры
```

Готово. Сайт будет доступен по адресу `http://IP-сервера/`.

Контейнеры с `restart: unless-stopped` (backend, nginx, mysql, redis, queue,
scheduler) Docker сам поднимет при старте системы, если Docker-демон включён
и их не останавливали вручную (`docker compose stop`). Если этого не произошло —
выполните `docker compose up -d`.

Чтобы Docker запускался вместе с ОС (рекомендуется):

```bash
sudo systemctl enable docker
```

## Проверка, что всё работает

```bash
docker compose ps                       # все контейнеры должны быть Up
curl -I http://localhost/               # 200 OK от nginx
docker compose logs --tail=50 backend   # ошибки бэкенда, если есть
```

Если сайт не открывается или API отвечает ошибкой:

```bash
docker compose down          # остановить всё корректно
docker compose up -d         # поднять заново
```

## Сайт НЕ открывается по IP (например http://10.48.4.235/)

Полная пошаговая диагностика — в **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**.
Кратко, в 90% случаев причина одна из трёх:

1. **Брандмауэр на сервере закрыт порт 80** — открыть:
   `sudo ufw allow 80/tcp` (Ubuntu) или
   `sudo firewall-cmd --permanent --add-service=http && sudo firewall-cmd --reload` (RHEL).
2. **Порт 80 занят** другим веб-сервером (apache2/nginx на хосте):
   `sudo ss -tlnp | grep ':80 '` → остановить мешающий сервис.
3. **Контейнеры не подняты** после перезагрузки:
   `docker compose ps` → если нет `vks-nginx`, выполнить `docker compose up -d`.

Быстрая проверка на самом сервере: `curl -I http://localhost/` — если отвечает
`200 OK`, значит nginx работает и проблема в сети/брандмауэре, а не в проекте.

## Если после запуска пустая админка / календарь (пропали миграции)

Такое бывает, если папка с данными БД `./docker/mysql/data` была удалена или
пуста. Выполните инициализацию один раз:

```bash
docker exec vks-backend sh -c '[ -f .env ] || cp .env.dev.example .env'
docker exec vks-backend php artisan key:generate
docker exec vks-backend php artisan migrate --force
docker exec vks-backend php artisan db:seed --class=VksDatabaseSeeder --force
```

Примечание: `.env` лежит в bind-монтируемой папке `./backend`, поэтому после
первого развертывания он сохраняется между перезагрузками — повторно эти команды
обычно не нужны. Достаточно `docker compose up -d`.

## Обновление кода (после git pull)

```bash
docker compose up -d --build    # пересобрать образы frontend/backend
# vendor смонтирован из volume backend_vendor и НЕ пересобирается вместе с
# образом — зависимости обновляются внутри контейнера:
docker exec vks-backend composer install --no-dev --prefer-dist --optimize-autoloader
docker exec vks-backend php artisan migrate --force
docker exec vks-backend php artisan config:clear
docker restart vks-queue vks-scheduler   # worker'ы перечитают новый код
```

Фронтенд собирается контейнером `vks-frontend-builder` в общий volume
`frontend_build`, откуда nginx отдаёт статику — отдельно собирать `npm run build`
на хосте не нужно.

## Полная остановка

```bash
docker compose stop       # остановить (данные сохраняются)
docker compose down       # удалить контейнеры (данные БД в ./docker/mysql/data остаются)
# ВНИМАНИЕ: сами НЕ удаляйте папку ./docker/mysql/data — в ней лежит база данных.
```

## Автоматический бэкап базы данных

Каждый день в **02:30** планировщик Laravel (контейнер `vks-scheduler`) выполняет
команду `php artisan db:backup`: дамп БД сохраняется в
`backend/storage/app/backups/backup-ГГГГ-ММ-ДД_ЧЧ-ММ-СС.sql.gz`, хранится
последних **14 копий** (старые удаляются автоматически). Файлы лежат в bind-папке
`./backend/storage`, поэтому тоже не теряются при пересборке контейнеров.

Ручной запуск и проверка:

```bash
docker exec vks-backend php artisan db:backup --keep=14   # сделать бэкап сейчас
ls -lh backend/storage/app/backups/                       # посмотреть копии на хосте
```

Восстановление из бэкапа (если что-то случилось с базой):

```bash
docker compose up -d mysql                                # поднять MySQL
gunzip -c backend/storage/app/backups/backup-ДАТА.sql.gz | \
  docker compose exec -T mysql mysql -uroot -p"$(grep DB_ROOT_PASSWORD .env 2>/dev/null | cut -d= -f2 || grep MYSQL_ROOT_PASSWORD backend/.env | cut -d= -f2)" vks_schedule
```

## Частые ошибки и решения

| Ошибка | Причина | Решение |
|---|---|---|
| nginx: `"limit_req_zone" directive is not allowed here` | устаревшая версия конфига в образе/монтировании | обновите код (`git pull`) — директивы вынесены из `server {}`; затем `docker compose up -d --force-recreate nginx` |
| MySQL `Access denied for user 'vks_user' ... (using password: NO)` | пароли в `.env` не совпадают с уже созданной БД ИЛИ нет `.env` | 1) скопируйте `.env.example` → `.env`; 2) если пароль менялся — пересоздайте пользователя или удалите `docker/mysql/data` и выполните полный запуск заново (данные будут потеряны!) |
| `Connection refused (Host: mysql)` | контейнер mysql ещё не поднялся | подождите 20–40 с, проверьте `docker compose ps`, при `Restarting` смотрите `docker compose logs mysql` |
| `vks-queue` в статусе Restarting | обычно следствие ошибок БД/redis выше | после исправления паролей: `docker compose restart queue scheduler` |

## Полезные команды

| Задача | Команда |
|---|---|
| Посмотреть статус | `docker compose ps` |
| Логи всех сервисов | `docker compose logs -f` |
| Логи одного сервиса | `docker compose logs -f backend` (или nginx, mysql, queue) |
| Перезапустить сервис | `docker compose restart backend` |
| Зайти в бэкенд | `docker exec -it vks-backend sh` |
| Консоль MySQL | `docker compose exec mysql mysql -u"${DB_USERNAME}" -p"${DB_PASSWORD}" "${DB_DATABASE}" (пароли — из вашего .env)` |
