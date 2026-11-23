# Phase 39 — корректная проверка Redis

## Что обнаружено

Docker Compose запускает Redis как отдельный сервис, а Laravel использует `CACHE_STORE=file` намеренно. В `MonitorSystem::checkRedis()` проверка была привязана к `config('cache.default')`: при файловом cache метод возвращал OK, не отправляя Redis-команду. Поэтому остановленный Redis мог оставаться незамеченным в системном мониторинге.

Дополнительно параметры `SYSTEM_MONITOR_ENABLED` и `SYSTEM_MONITOR_BASE_URL` не передавались из корневого Compose `.env` в PHP-контейнеры, поэтому оператор не мог надёжно включить эту проверку одной настройкой корневого файла.

## Исправления

- Redis проверяется прямым `PING` через выделенное соединение `redis.default`, независимо от cache driver.
- Docker Compose передаёт `SYSTEM_MONITOR_ENABLED`, `SYSTEM_MONITOR_BASE_URL` и `QUEUE_HEARTBEAT_MAX_AGE` в backend, queue и scheduler.
- В корневой `.env.example` добавлены настройки мониторинга. Мониторинг остаётся выключенным по умолчанию, чтобы не рассылать неожиданные аварийные сообщения до настройки MAX.
- Добавлен smoke test, проверяющий связь Compose → Laravel и независимость Redis health-check от cache driver.

## Включение

В корневом `.env` рядом с `docker-compose.yml` после настройки MAX укажите:

```dotenv
SYSTEM_MONITOR_ENABLED=true
SYSTEM_MONITOR_BASE_URL=http://nginx
QUEUE_HEARTBEAT_MAX_AGE=180
```

Затем примените переменные окружения:

```powershell
docker compose up -d --force-recreate backend queue scheduler
```

Проверить вручную:

```powershell
docker compose exec backend php artisan system:monitor
docker compose logs --tail=100 scheduler
```

Мониторинг проверяет MySQL, Redis, Nginx и heartbeat очереди. При переходе сервиса в DOWN и восстановлении используется существующий механизм оповещения администратора. Для получения сообщений в MAX должны быть корректно настроены `MAX_ENABLED` и `MAX_BOT_TOKEN`.

## Проверки и ограничения

- Smoke test запускается в GitHub Actions.
- Этап не добавляет миграций и не меняет данные, пользовательские записи, пароли, Docker volumes или секреты.
- Ветка не развёртывается автоматически.
- После обновления требуется проверить остановку/восстановление Redis в отдельной тестовой Docker-среде и убедиться, что администратор получает соответствующие сообщения. GitHub CI не заменяет такую runtime-проверку.
