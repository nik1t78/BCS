# Как запустить проект после выключения света / перезагрузки сервера

Все сервисы проекта подняты в Docker Compose, данные базы хранятся в volume
`mysql_data`, поэтому после неожиданного выключения питания ничего не теряется —
проект нужно просто заново запустить.

## Быстрый запуск (после выключения света)

```bash
cd /path/to/vks-schedule        # перейти в папку проекта
docker-compose up -d            # поднять все контейнеры
```

Готово. Сайт будет доступен по адресу `http://IP-сервера/`.

Контейнеры с `restart: unless-stopped` (backend, nginx, mysql, redis, queue,
scheduler) Docker сам поднимет при старте системы, если Docker-демон включён
и их не останавливали вручную (`docker-compose stop`). Если этого не произошло —
выполните `docker-compose up -d`.

Чтобы Docker запускался вместе с ОС (рекомендуется):

```bash
sudo systemctl enable docker
```

## Проверка, что всё работает

```bash
docker-compose ps                       # все контейнеры должны быть Up
curl -I http://localhost/               # 200 OK от nginx
docker-compose logs --tail=50 backend   # ошибки бэкенда, если есть
```

Если сайт не открывается или API отвечает ошибкой:

```bash
docker-compose down          # остановить всё корректно
docker-compose up -d         # поднять заново
```

## Если после запуска пустая админка / календарь (пропали миграции)

Такое бывает, если volume БД создан заново (например, был `docker-compose down -v`).
Выполните инициализацию один раз:

```bash
docker exec vks-backend cp -n .env.example .env
docker exec vks-backend php artisan key:generate
docker exec vks-backend php artisan migrate --force
docker exec vks-backend php artisan db:seed --class=VksDatabaseSeeder --force
```

Примечание: `.env` лежит в bind-монтируемой папке `./backend`, поэтому после
первого развертывания он сохраняется между перезагрузками — повторно эти команды
обычно не нужны. Достаточно `docker-compose up -d`.

## Обновление кода (после git pull)

```bash
docker-compose up -d --build    # пересобрать образы frontend/backend
docker exec vks-backend php artisan migrate --force
docker exec vks-backend php artisan config:clear
```

Фронтенд собирается контейнером `vks-frontend-builder` в общий volume
`frontend_build`, откуда nginx отдаёт статику — отдельно собирать `npm run build`
на хосте не нужно.

## Полная остановка

```bash
docker-compose stop       # остановить (данные сохраняются)
docker-compose down       # удалить контейнеры (volume с БД остаётся)
docker-compose down -v    # ОСТОРОЖНО: удалит и базу данных (volume mysql_data)
```

## Полезные команды

| Задача | Команда |
|---|---|
| Посмотреть статус | `docker-compose ps` |
| Логи всех сервисов | `docker-compose logs -f` |
| Логи одного сервиса | `docker-compose logs -f backend` (или nginx, mysql, queue) |
| Перезапустить сервис | `docker-compose restart backend` |
| Зайти в бэкенд | `docker exec -it vks-backend sh` |
| Консоль MySQL | `docker exec -it vks-mysql mysql -uvks_user -pvks_password_2024 vks_schedule` |
