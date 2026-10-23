# syntax=docker/dockerfile:1.4
# =============================================================================
# BCS backend (Laravel 12) — php-fpm, Alpine. МИНИМАЛЬНАЯ ВЕРСИЯ (~60 строк).
#
# Все предыдущие провалы сборки были из-за самодельных каскадов компиляции PHP
# и ВЫДУМАННЫХ digest'ов базовых образов. Здесь этого нет:
#   * базис — обычный тег php:8.5-fpm-alpine (PHP 8.5.x, как на хосте);
#   * расширения ставятся штатными скриптами образа docker-php-ext-install /
#     pecl — они сами распаковывают исходники (/usr/src/php.tar.xz) и сами
#     тянут нужные -dev библиотеки; никаких ручных configure/make;
#   * готовый образ содержит код + vendor + config — в рантайме ничего не
#     скачивается, compose только разворачивает проект.
# =============================================================================

# digest сверен с Docker Hub API 2026-10-23 (тег composer:2, amd64)
FROM composer:2@sha256:66c00f4ea1c6a01364d75460bb2837886388e1d5b2b1b6e0f22c8788eb4e73ad AS composer-stage

# Базис закреплен digest'ом (сверен с Docker Hub API 2026-10-23): этот образ
# точно существует и содержит полные исходники PHP в /usr/src/php.tar.xz —
# docker-php-ext-install сам их распакует. Тег: php:8.5-fpm-alpine.
FROM php:8.5-fpm-alpine@sha256:e2ca465c4e914602d632e12a968263333355b4d1b26bf66d0994cb2ae5039d21 AS runtime

# Часовой пояс + утилиты (mysql-клиент нужен для healthcheck/artisan)
RUN apk add --no-cache unzip mariadb-client tzdata \
 && cp -f /usr/share/zoneinfo/Europe/Moscow /etc/localtime \
 && echo Europe/Moscow > /etc/timezone

# Расширения PHP. Компиляция — в одном слое, затем .build-deps удаляются.
RUN set -eux; \
    apk add --no-cache --virtual .build-deps $PHPIZE_DEPS libzip-dev icu-dev \
        libpng-dev libjpeg-turbo-dev freetype-dev oniguruma-dev linux-headers; \
    docker-php-ext-configure gd --with-freetype --with-jpeg; \
    docker-php-ext-install -j"$(nproc)" \
        bcmath exif fileinfo ftp gd intl pdo_mysql pcntl sockets zip; \
    pecl install redis; \
    docker-php-ext-enable opcache redis; \
    apk del .build-deps; \
    # самопроверка: критичные модули на месте (иначе сборка падает здесь, а
    # не через полчаса на невнятном exit 1)
    for e in bcmath ctype curl dom fileinfo gd intl json mbstring openssl \
             PDO pdo_mysql redis session SimpleXML tokenizer xml zip; do \
        php -m | grep -qix "$e" || { echo "!!! расширение '$e' НЕ установлено"; exit 1; }; \
    done

WORKDIR /var/www/html

# vendor отдельным кеш-слоем: пересобирается только при изменении composer.*
COPY --from=composer-stage /usr/bin/composer /usr/bin/composer
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --no-scripts \
        --no-progress --optimize-autoloader \
 && test -f vendor/autoload.php

# Код приложения + каркас конфигов Laravel (config/*.php лежат в репо в
# docker/skeleton/laravel12/config — в backend/config только services.php)
COPY backend/ ./
COPY docker/skeleton/laravel12/config/ config/
RUN set -eux; \
    mkdir -p storage/app/public storage/app/private storage/framework/cache/data \
             storage/framework/sessions storage/framework/views storage/logs \
             bootstrap/cache; \
    chown -R www-data:www-data storage bootstrap/cache; \
    php artisan package:discover --ansi

# php-fpm слушает TCP 0.0.0.0:9000 (nginx делает fastcgi_pass backend:9000;
# штатный пул alpine-образа слушает unix-сокет — отсюда были 502)
RUN printf '%s\n' \
      '[www]' \
      'user = www-data' \
      'group = www-data' \
      'listen = 0.0.0.0:9000' \
      'pm = dynamic' \
      'pm.max_children = 12' \
      'pm.start_servers = 4' \
      'pm.min_spare_servers = 3' \
      'pm.max_spare_servers = 6' \
      'clear_env = no' \
      > /usr/local/etc/php-fpm.d/zz-listen.conf

RUN printf '%s\n' \
      'opcache.enable=1' \
      'opcache.memory_consumption=128' \
      'expose_php=Off' \
      'memory_limit=256M' \
      'upload_max_filesize=20M' \
      'post_max_size=21M' \
      'date.timezone=Europe/Moscow' \
      > "$PHP_INI_DIR/conf.d/zz-app.ini"

EXPOSE 9000
CMD ["php-fpm"]
