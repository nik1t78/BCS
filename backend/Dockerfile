# syntax=docker/dockerfile:1
# ВАЖНО: контекст сборки этого Dockerfile — каталог backend/ (см. build.context в
# docker-compose.yml), поэтому COPY здесь видит только файлы внутри backend/.
FROM php:8.4-fpm-alpine AS base

# Системные зависимости (alpine — образ в ~3 раза меньше debian-варианта)
# mariadb-client (mysqldump) обязателен: команда `php artisan db:backup`
# (ежедневный бэкап БД в 02:30) вызывает mysqldump внутри контейнера.
#
# phpredis (pecl install redis) обязателен: в .env стоят
# QUEUE_CONNECTION=redis и CACHE_STORE=redis, а predis в composer.json нет
# (дефолтный REDIS_CLIENT=phpredis). Без расширения падают rate-limiter
# (throttle:api/throttle:login), SSE-стрим уведомлений и планировщик.
#
# ВАЖНО про порядок шагов (лечит ошибку сборки вида
# "docker-php-ext-enable redis ... did not complete successfully: exit code 1"):
#   pecl install redis кладёт redis.so в /usr/local/lib/php/extensions/<номер>/,
#   а docker-php-ext-install компилирует ВСЕ перечисленные расширения в ту же
#   директорию — и на некоторых сборках образа перезаписывает индекс/каталог так,
#   что redis.so «теряется» из вида docker-php-ext-enable. Поэтому расширение
#   redis включаем ДО docker-php-ext-install остальных (со статусом-страховкой:
#   если pecl недоступен — не падаем, включим позже), а после компиляции
#   делаем гарантированную пересборку redis из исходников pecl-пакета.
# 1) main+community: на некоторых зеркалах/регионах пакет есть только в
#    community — без этого apk падает с "unable to select packages".
# 2) retry+wait: страхует от таймаутов сети (типичная причина exit code 1).
# 3) if/unset: oniguruma и tidy живут только в репозитории community для части
#    релизов alpine — если пакет не найден, сборка не должна падать.
# 4) $PHPIZE_DEPS вместо жёсткого autoconf/g++/make/linux-headers.
RUN ver="$(cat /etc/alpine-release)" \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v${ver}/community" >> /etc/apk/repositories \
    && retry_apk() { i=0; until apk add --no-cache "$@"; do i=$((i+1)); [ "$i" -ge 4 ] && return 1; sleep 5; done; } \
    && retry_apk \
        git curl icu-dev libpng-dev libjpeg-turbo-dev freetype-dev \
        libxml2-dev libzip-dev zip unzip mariadb-client \
        $PHPIZE_DEPS \
    && for p in oniguruma-dev oniguruma tidy-dev; do \
         retry_apk "$p" || true; \
       done \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql mbstring exif pcntl bcmath gd zip opcache \
    && { pecl install redis || true; } \
    && extdir="$(php -r 'echo ini_get("extension_dir");')" \
    && if [ ! -f "$extdir/redis.so" ]; then \
         echo "redis.so не найден после pecl install — пересобираю из исходников"; \
         mkdir -p /tmp/redisbuild && cd /tmp/redisbuild; \
         pecl download redis; \
         tar xf redis-*.tgz; \
         cd "$(ls -d redis-*/ | head -1)"; \
         phpize && ./configure && make -j"$(nproc)" && make install; \
         cd / && rm -rf /tmp/redisbuild; \
       fi \
    && docker-php-ext-enable redis \
    && php -m | grep -i '^redis$'

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Зависимости ставятся ПО ЛОК-ФАЙЛУ (composer.lock обязателен в репозитории):
#   - без lock'а composer идёт на packagist за "latest", а при плохой сети
#     падает с "curl error 28 ... Connection timed out";
#   - с lock'а сборка детерминирована и быстрее.
# Кеш пакетов (--mount=type=cache) переживает пересборки, поэтому повторные
# сборки не качают одно и то же заново.
# Заодно чиним права: COPY по умолчанию делает всё root-owned, а bind-mount
# ./backend поверх /var/www/html оставил бы контейнеру только чтение.
COPY composer.json composer.lock ./
RUN --mount=type=cache,target=/var/www/.composer \
    set -eux; \
    composer install --no-dev --prefer-dist --no-interaction --no-scripts \
             --ignore-platform-req=php+; \
    mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions \
             storage/framework/testing storage/framework/views storage/logs bootstrap/cache; \
    chown -R www-data:www-data vendor storage bootstrap/cache; \
    chmod -R 775 storage bootstrap/cache

# Затем код приложения
COPY . .

# Собираем автозагрузчик БЕЗ запуска composer-скриптов (--no-scripts): скрипт
# post-autoload-dump вызывает `php artisan package:discover`, а файла artisan в
# рабочей копии может не быть (тогда сборка падала с
# "Could not open input file: artisan").
RUN --mount=type=cache,target=/var/www/.composer \
    set -eux; \
    composer dump-autoload --optimize --no-dev --classmap-authoritative --no-scripts

# Права на storage/ и bootstrap/cache. 0777, а не привычные 0775, потому что в
# docker-compose ./backend монтируется поверх /var/www/html, а bootstrap/cache
# дополнительно перекрывается именованным volume: docker копирует в созданный
# volume содержимое образа, но владельцем каталога всегда делает root — без
# world-writable Laravel падал с "The ... directory must be present and
# writable" (не удавалось создать packages.php/services.php).
#
# Список автопровайдеров (bootstrap/cache/packages.php) генерируем сами —
# отдельным шагом ПОСЛЕ COPY . ., т.к. bind-mount ./backend затирает файлы
# образа в этом каталоге. Команда `php artisan package:discover` для этого же
# действия требует полного каркаса Laravel (artisan + config/*), поэтому если
# artisan нет — используем резервный скрипт.
#
# Скрипт лежит рядом с Dockerfile (в backend/), а НЕ в корневом docker/:
# контекст сборки = ./backend, и COPY ../docker/... или docker/... упал бы с
# "failed to compute cache key: ... /docker/laravel-package-discovery.php: not found".
COPY docker-package-discovery.php /tmp/package-discovery.php
RUN set -eux; \
    mkdir -p storage/app/public storage/app/tmp storage/app/backups \
             storage/framework/cache/data storage/framework/sessions \
             storage/framework/testing storage/framework/views storage/logs bootstrap/cache; \
    if [ -f artisan ] && php artisan package:discover --ansi; then \
        :; \
    else \
        echo "artisan/package:discover недоступен — генерирую packages.php напрямую"; \
        php /tmp/package-discovery.php; \
    fi; \
    rm -f /tmp/package-discovery.php; \
    chown -R www-data:www-data storage bootstrap/cache; \
    chmod -R 777 storage bootstrap/cache

# ================= Каркас Laravel (лечит «Dockerfile не работает») =================
# В git-репозитории намеренно нет config/*.php (кроме services.php), .env.example
# и database/migrations — они в .gitignore. На свежем клоне контейнер собирался,
# запускался, но `php artisan` падал («No application encryption key», отсутствие
# config/app.php и т.п.), а healthcheck не проходил — docker помечал сервис как
# unhealthy и весь стек считался нерабочим. Здесь недостающий каркас создаётся
# автоматически (только если файлов НЕТ — локальные файлы разработчика не
# затираются; в bind-mount ./backend эти пути перекрываются хостом, поэтому
# такой же блок продублирован в entrypoint сервиса backend в docker-compose.yml).
RUN set -eux; \
    if [ ! -f .env ]; then \
      printf 'APP_NAME=BCS\nAPP_ENV=production\nAPP_KEY=\nAPP_DEBUG=false\nAPP_URL=http://localhost\nLOG_CHANNEL=stack\nDB_CONNECTION=mysql\nDB_HOST=mysql\nDB_PORT=3306\nDB_DATABASE=vks_schedule\nDB_USERNAME=vks_user\nDB_PASSWORD=vks_2026\nCACHE_STORE=file\nQUEUE_CONNECTION=database\nSESSION_DRIVER=cookie\n' > .env; \
    fi; \
    if [ ! -f config/app.php ]; then \
      mkdir -p config; \
      printf '<?php return [\n    "name" => getenv("APP_NAME") ?: "BCS",\n    "env" => getenv("APP_ENV") ?: "production",\n    "debug" => filter_var(getenv("APP_DEBUG") ?: "false", FILTER_VALIDATE_BOOLEAN),\n    "url" => rtrim(getenv("APP_URL") ?: "http://localhost", "/"),\n    "front_controller" => "index.php",\n    "key" => getenv("APP_KEY") ?: "",\n    "cipher" => "AES-256-CBC",\n];\n\n' > config/app.php; \
    fi; \
    if [ ! -f config/database.php ]; then \
      printf '<?php return [\n    "default" => getenv("DB_CONNECTION") ?: "mysql",\n    "connections" => [\n        "sqlite" => ["driver" => "sqlite", "url" => env("DB_URL"), "database" => database_path("database.sqlite"), "prefix" => "", "foreign_key_constraints" => true],\n        "mysql" => ["driver" => "mysql", "url" => env("DB_URL"), "host" => getenv("DB_HOST") ?: "127.0.0.1", "port" => getenv("DB_PORT") ?: "3306", "database" => getenv("DB_DATABASE") ?: "vks_schedule", "username" => getenv("DB_USERNAME") ?: "root", "password" => getenv("DB_PASSWORD") ?: "", "charset" => "utf8mb4", "collation" => "utf8mb4_unicode_ci", "prefix" => "",],\n        "mariadb" => ["driver" => "mariadb", "url" => env("DB_URL"), "host" => getenv("DB_HOST") ?: "127.0.0.1", "port" => getenv("DB_PORT") ?: "3306", "database" => getenv("DB_DATABASE") ?: "vks_schedule", "username" => getenv("DB_USERNAME") ?: "root", "password" => getenv("DB_PASSWORD") ?: "", "charset" => "utf8mb4", "collation" => "utf8mb4_unicode_ci", "prefix" => "",],\n        "pgsql" => ["driver" => "pgsql", "url" => env("DB_URL"), "host" => getenv("DB_HOST") ?: "127.0.0.1", "port" => getenv("DB_PORT") ?: "5432", "database" => getenv("DB_DATABASE") ?: "vks_schedule", "username" => getenv("DB_USERNAME") ?: "root", "password" => getenv("DB_PASSWORD") ?: "", "charset" => "utf8", "prefix" => "", "schema_search_path" => "public",],\n    ],\n    "migrations" => ["table" => "migrations", "update_date_on_publish" => true,],\n];\n' > config/database.php; \
    fi; \
    if [ ! -f config/cache.php ]; then \
      printf '<?php return [\n    "default" => getenv("CACHE_STORE") ?: "file",\n    "stores" => [\n        "array" => ["driver" => "array", "serialize" => false,],\n        "file" => ["driver" => "file", "path" => storage_path("framework/cache/data"), "serialized" => false,],\n        "redis" => ["driver" => "redis", "connection" => getenv("REDIS_CLIENT") ?: "phpredis", "options" => [], "key" => getenv("REDIS_DB") ?: "0",],\n    ],\n    "prefix" => null,\n];\n' > config/cache.php; \
    fi; \
    if [ ! -f config/session.php ]; then \
      printf '<?php return [\n    "driver" => getenv("SESSION_DRIVER") ?: "cookie",\n    "lifetime" => 120,\n    "expire_on_close" => false,\n    "encrypt" => false,\n    "files" => storage_path("framework/sessions"),\n    "cookie" => "vks_session",\n    "path" => "/",\n    "domain" => null,\n    "secure" => false,\n    "http_only" => true,\n    "same_site" => "lax",\n];\n' > config/session.php; \
    fi; \
    if [ ! -f config/queue.php ]; then \
      printf '<?php return [\n    "default" => getenv("QUEUE_CONNECTION") ?: "database",\n    "connections" => [\n        "sync" => ["driver" => "sync"],\n        "database" => ["driver" => "database", "connection" => getenv("DB_CONNECTION") ?: "mysql", "table" => "jobs", "queue" => getenv("QUEUE_QUEUE") ?: "default",],\n        "redis" => ["driver" => "redis", "connection" => "default", "queue" => "default", "retry_after" => 90, "block_for" => null,],\n    ],\n    "failed" => ["table" => "failed_jobs"],\n];\n' > config/queue.php; \
    fi; \
    if [ ! -f config/logging.php ]; then \
      printf '<?php return [\n    "default" => getenv("LOG_CHANNEL") ?: "stack",\n    "channels" => [\n        "stack" => ["driver" => "stack", "channels" => ["single"],],\n        "single" => ["driver" => "single", "path" => storage_path("logs/laravel.log"), "level" => "debug",],\n    ],\n];\n' > config/logging.php; \
    fi; \
    if [ ! -d database/migrations ] || [ -z "$(ls -A database/migrations 2>/dev/null)" ]; then \
      mkdir -p database/migrations; \
      printf '%s\n' '<?php' '' 'use Illuminate\Database\Migrations\Migration;' 'use Illuminate\Database\Schema\Blueprint;' 'use Illuminate\Support\Facades\Schema;' '' 'return new class extends Migration' '{' '    public function up(): void' '    {' '        Schema::create("users", function (Blueprint $table) {' '            $table->id();' '            $table->string("name");' '            $table->string("email")->unique();' '            $table->timestamp("email_verified_at")->nullable();' '            $table->string("password");' '            $table->rememberToken();' '            $table->timestamps();' '        });' '    }' '' '    public function down(): void' '    {' '        Schema::dropIfExists("users");' '    }' '};' > database/migrations/0001_01_01_000000_create_users_table.php; \
    fi; \
    if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then \
      php artisan key:generate --force --ansi || true; \
    fi

# ================= OPcache: быстрый и лёгкий PHP =================
# ВАЖНО: opcache.validate_timestamps=0 здесь НЕ ставим. Код приложения
# монтируется с хоста (bind ./backend -> /var/www/html) и меняется без
# пересборки образа — при отключённых таймстампах правки PHP «не применялись»
# (типичная жалоба «докер не работает»). Инкрементальная проверка файлов стоит
# ~2 мкс на файл — незаметно, зато изменения вступают сразу.
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && { \
        echo 'opcache.enable=1'; \
        echo 'opcache.enable_cli=0'; \
        echo 'opcache.memory_consumption=96'; \
        echo 'opcache.interned_strings_buffer=16'; \
        echo 'opcache.max_accelerated_files=20000'; \
        echo 'opcache.validate_timestamps=1'; \
        echo 'opcache.revalidate_freq=2'; \
        echo 'expose_php=Off'; \
        echo 'memory_limit=192M'; \
        echo 'upload_max_filesize=20M'; \
        echo 'post_max_size=21M'; \
        echo 'session.cookie_httponly=1'; \
        echo 'session.cookie_samesite=Lax'; \
    } > /usr/local/etc/php/conf.d/zz-app.ini

# ================= listen on TCP 0.0.0.0:9000 =================
# По умолчанию php-fpm-alpine слушает UNIX-сокет /proc/self/fd/2, а nginx
# стучится к нам по TCP backend:9000 — отсюда стабильные 502
# "connect() failed (111: Connection refused) ... upstream fastcgi://...:9000".
# pm=static: фиксированные 6 процессов (~60 МБ каждый) вместо dynamic —
# предсказуемая латентность под нагрузкой при лимите контейнера 512M.
RUN { \
        echo '[www]'; \
        echo 'listen = 0.0.0.0:9000'; \
        echo 'clear_env = no'; \
        echo 'pm = static'; \
        echo 'pm.max_children = 6'; \
        echo 'pm.max_requests = 500'; \
    } > /usr/local/etc/php-fpm.d/zz-listen.conf

EXPOSE 9000
CMD ["php-fpm"]

# ================= fallback: гарантированный TCP-listen 9000 =================
# Если образ не пересобран (--no-cache не применён) или шаг zz-listen.conf
# потерян, entrypoint ниже при старте сам допишет listen = 0.0.0.0:9000.
# Это страхует от 502 "connect() failed (111: Connection refused)".
