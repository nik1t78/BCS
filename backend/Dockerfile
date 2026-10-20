# syntax=docker/dockerfile:1
# =============================================================================
# BCS backend (Laravel) — php-fpm 8.4, Alpine.
#
# ИСТОРИЯ БОЛЕЙ ЭТОГО ФАЙЛА (чтобы не повторять):
#  1) "COPY phpredis-6.3.0.tar.gz /tmp/phpredis.tar.gz -> failed to compute
#     cache key ... not found" — COPY бинарного файла из контекста сборки на
#     Windows/Docker Desktop с файловым шарингом нестабилен: файл то виден,
#     то нет. РЕШЕНИЕ: никаких COPY зависимостей от tar.gz больше нет, архив
#     redis скачивается напрямую с pecl.php.net внутри RUN (с retry).
#  2) PowerShell/редакторы портили многострочные heredoc-блоки (RUN <<EOF),
#     съедая конструкции $(...) и кавычки -> "/bin/sh: not: not found".
#     РЕШЕНИЕ: никакого heredoc, только классические RUN с && \ переносами.
#  3) Критично: каждая строка ниже должна оставаться валидным sh-кодом без
#     переменных вида ${VAR} вне кавычек — правьте аккуратно.
# =============================================================================

FROM php:8.4-fpm-alpine AS base

# Системные зависимости + PHP-расширения ОДНИМ слоем.
# mariadb-client (mysqldump) обязателен для `php artisan db:backup`.
# Расширение redis обязательно: QUEUE_CONNECTION/CACHE_STORE=redis в .env,
# predis в composer.json нет — без него падают throttle, SSE и планировщик.
# oniguruma/tidy живут только в community-репозитории части релизов alpine —
# ставим через || true, чтобы отсутствие пакета не ломало сборку.
RUN set -eux; \
    echo "http://dl-cdn.alpinelinux.org/alpine/v$(cat /etc/alpine-release | cut -d. -f1,2)/community" >> /etc/apk/repositories; \
    apk add --no-cache --virtual .build-deps $PHPIZE_DEPS git curl icu-dev libpng-dev libjpeg-turbo-dev freetype-dev libxml2-dev libzip-dev zip unzip mariadb-client; \
    apk add --no-cache oniguruma-dev || apk add --no-cache oniguruma || true; \
    apk add --no-cache tidy-dev || true; \
    docker-php-ext-configure gd --with-freetype --with-jpeg; \
    docker-php-ext-install -j"$(nproc)" pdo_mysql mbstring exif pcntl bcmath gd zip opcache; \
    pecl install redis || true; \
    EXTDIR="$(php -i | awk '/^extension_dir =>/ {print $NF}' | tr -d '"')"; \
    if [ ! -f "$EXTDIR/redis.so" ]; then \
        echo "redis.so нет после pecl — собираю вручную из pecl.php.net"; \
        mkdir -p /tmp/redisbuild && cd /tmp/redisbuild; \
        curl -fsSL --retry 5 --retry-delay 3 https://pecl.php.net/get/redis-6.3.0.tgz -o redis.tgz; \
        tar xf redis.tgz; \
        cd redis-*/; \
        phpize && ./configure && make -j"$(nproc)" && make install; \
        cd /; rm -rf /tmp/redisbuild; \
    fi; \
    docker-php-ext-enable redis; \
    php -m | grep -qi redis; \
    echo ">>> Все расширения установлены успешно."

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Зависимости ПО ЛОК-ФАЙЛУ (детерминированно, без packagist "latest").
# Кеш пакетов переживает пересборки. Права: bind-mount ./backend поверх
# /var/www/html оставил бы контейнеру только чтение без chown/chmod ниже.
COPY composer.json composer.lock ./
RUN --mount=type=cache,target=/var/www/.composer \
    set -eux; \
    composer install --no-dev --prefer-dist --no-interaction --no-scripts --ignore-platform-req=php+; \
    mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/testing storage/framework/views storage/logs bootstrap/cache; \
    chown -R www-data:www-data vendor storage bootstrap/cache; \
    chmod -R 775 storage bootstrap/cache

# Код приложения
COPY . .

# dump-autoload без --no-scripts: post-autoload-dump зовёт artisan package:discover,
# а наfullном коде artisan может не быть ("Could not open input file: artisan").
RUN --mount=type=cache,target=/var/www/.composer \
    set -eux; \
    composer dump-autoload --optimize --no-dev --classmap-authoritative --no-scripts

# Список автопровайдеров генерируем ПОСЛЕ COPY . . отдельным шагом:
# bind-mount ./backend затирает bootstrap/cache из образа, поэтому packages.php
# должен уметь пересоздаваться и на хосте (см. entrypoint в docker-compose.yml).
# Скрипт лежит в backend/ — контекст сборки = ./backend, путь docker/... упал бы
# с "failed to compute cache key ... not found".
COPY docker-package-discovery.php /tmp/package-discovery.php
RUN set -eux; \
    mkdir -p storage/app/public storage/app/tmp storage/app/backups storage/framework/cache/data storage/framework/sessions storage/framework/testing storage/framework/views storage/logs bootstrap/cache; \
    if [ -f artisan ] && php artisan package:discover --ansi; then :; else php /tmp/package-discovery.php; fi; \
    rm -f /tmp/package-discovery.php; \
    chown -R www-data:www-data storage bootstrap/cache; \
    chmod -R 777 storage bootstrap/cache

# OPcache: validate_timestamps=1 ОБЯЗАТЕЛЬНО — код монтируется с хоста,
# при =0 правки PHP «не применялись» (жалоба «докер не работает»).
RUN set -eux; \
    cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"; \
    printf '%s\n' \
      'opcache.enable=1' \
      'opcache.memory_consumption=96' \
      'opcache.interned_strings_buffer=16' \
      'opcache.max_accelerated_files=20000' \
      'opcache.validate_timestamps=1' \
      'opcache.revalidate_freq=2' \
      'expose_php=Off' \
      'memory_limit=192M' \
      'upload_max_filesize=20M' \
      'post_max_size=21M' \
      'session.cookie_httponly=1' \
      'session.cookie_samesite=Lax' \
      > /usr/local/etc/php/conf.d/zz-app.ini

# php-fpm слушает TCP 0.0.0.0:9000 (иначе nginx даёт 502 Connection refused).
# pm=static — фиксированные процессы, предсказуемая латентность под лимитом RAM.
RUN set -eux; \
    printf '%s\n' '[www]' 'listen = 0.0.0.0:9000' 'clear_env = no' 'pm = static' 'pm.max_children = 6' 'pm.max_requests = 500' \
      > /usr/local/etc/php-fpm.d/zz-listen.conf

EXPOSE 9000
CMD ["php-fpm"]
