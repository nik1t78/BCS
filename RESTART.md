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
  docker compose exec -T mysql mysql -uroot -p"$(grep DB_ROOT_PASSWORD .env | cut -d= -f2)" vks_schedule
```

## Полезные команды

| Задача | Команда |
|---|---|
| Посмотреть статус | `docker compose ps` |
| Логи всех сервисов | `docker compose logs -f` |
| Логи одного сервиса | `docker compose logs -f backend` (или nginx, mysql, queue) |
| Перезапустить сервис | `docker compose restart backend` |
| Зайти в бэкенд | `docker exec -it vks-backend sh` |
| Консоль MySQL | `docker compose exec mysql mysql -u"${DB_USERNAME}" -p"${DB_PASSWORD}" "${DB_DATABASE}" (пароли — из вашего .env)` |
