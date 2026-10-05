# Безопасность ВКС-проекта

## Где менять пароли и секреты

**Все секреты хранятся только в файле `.env` в корне рядом с `docker-compose.yml` (он в .gitignore, в git не попадает):**

| Переменная | Что это | Как сгенерировать |
|---|---|---|
| `DB_PASSWORD` | пароль MySQL для приложения | `openssl rand -base64 24` |
| `DB_ROOT_PASSWORD` | root-пароль MySQL | `openssl rand -base64 24` |
| `REDIS_PASSWORD` | пароль Redis | `openssl rand -base64 24` |
| `APP_KEY` | ключ шифрования Laravel | `docker compose exec backend php artisan key:generate --show` |
| `MAX_BOT_TOKEN` | токен бота MAX | выдать у @masterbot |

Пароли **пользователей** задаются при регистрации; первый админ — в сидере `backend/database/seeders/VksDatabaseSeeder.php` (после первого запуска обязательна смена через `must_change_password`, флаг в БД). Никогда не оставляйте дефолтный пароль сидера в продакшене.

## Что уже сделано
- Секретов нет в коде и git (проверено grep); docker-compose требует их из .env (`${VAR:?}`).
- MySQL и Redis **не публикуют порты наружу** — доступны только внутри сети контейнеров.
- nginx: CSP, X-Frame-Options SAMEORIGIN, nosniff, Referrer-Policy, server_tokens off, запрет /.env, rate-limit на /api.
- Laravel Sanctum: токены с истечением, одноразовый refresh (sha256 в БД), throttle:login + троттлинг API, audit-лог входов, блокировка неактивных аккаунтов.
- Хэширование паролей bcrypt (cost 12), колонки password/token в $hidden модели.
- Загрузка файлов: whitelist расширений/MIME, ограничение размера 20m, хранение вне webroot-доступа исполнения.
- Логи с ротацией, бэкапы БД командой `php artisan vks:backup`.

## Рекомендации
1. Регулярно: `docker compose pull` + пересборка (патчи PHP/nginx).
2. HTTPS обязателен (Let's Encrypt через nginx-proxy или certbot).
3. Раз в 90 дней менять DB/Redis пароли: обновить .env → `docker compose up -d`.
4. Мониторинг failed login: таблица `auth_audit_log`.
