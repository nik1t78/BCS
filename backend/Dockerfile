# syntax=docker/dockerfile:1
FROM php:8.4-fpm-alpine as base

# Системные зависимости (alpine — образ в ~3 раза меньше debian-варианта)
RUN apk add --no-cache \
        git curl icu-dev libpng-dev libjpeg-turbo-dev freetype-dev \
        oniguruma-dev libxml2-dev libzip-dev zip unzip autoconf g++ make linux-headers \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql mbstring exif pcntl bcmath gd zip opcache

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
    composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction --no-scripts; \
    mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions \
             storage/framework/testing storage/framework/views storage/logs bootstrap/cache; \
    chown -R www-data:www-data vendor storage bootstrap/cache; \
    chmod -R 775 storage bootstrap/cache

# Затем код приложения
COPY . .

# Минимальный .env для сборки: без него `php artisan package:discover` падает.
# Секретов здесь нет — рантайм-значения приходят из compose `environment:`.
RUN cp .env.dev.example .env \
    && composer dump-autoload --optimize --no-dev --classmap-authoritative \
    && php artisan package:discover --ansi || true \
    && rm -f .env \
    && mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions \
                storage/framework/testing storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

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

EXPOSE 9000
CMD ["php-fpm"]
