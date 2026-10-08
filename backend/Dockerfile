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
RUN apk add --no-cache \
        git curl icu-dev libpng-dev libjpeg-turbo-dev freetype-dev \
        oniguruma-dev libxml2-dev libzip-dev zip unzip autoconf g++ make linux-headers \
        mariadb-client \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql mbstring exif pcntl bcmath gd zip opcache \
    && pecl install redis \
    && docker-php-ext-enable redis

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
    composer install --no-dev --prefer-dist --no-interaction --no-scripts; \
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

# ================= OPcache: быстрый и лёгкий PHP =================
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && { \
        echo 'opcache.enable=1'; \
        echo 'opcache.enable_cli=0'; \
        echo 'opcache.memory_consumption=96'; \
        echo 'opcache.interned_strings_buffer=16'; \
        echo 'opcache.max_accelerated_files=10000'; \
        echo 'opcache.validate_timestamps=0'; \
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
RUN { \
        echo '[www]'; \
        echo 'listen = 0.0.0.0:9000'; \
        echo 'clear_env = no'; \
    } > /usr/local/etc/php-fpm.d/zz-listen.conf

EXPOSE 9000
CMD ["php-fpm"]

# ================= fallback: гарантированный TCP-listen 9000 =================
# Если образ не пересобран (--no-cache не применён) или шаг zz-listen.conf
# потерян, entrypoint ниже при старте сам допишет listen = 0.0.0.0:9000.
# Это страхует от 502 "connect() failed (111: Connection refused)".
