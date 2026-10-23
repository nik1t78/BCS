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

FROM composer:2 AS composer-stage

# Базис: обычный плавающий тег php:8.5-fpm-alpine (PHP 8.5.x, как на хосте).
# Digest'ами НЕ закрепляем: при изменении содержимого тега докер просто
# перекачает свежий образ. Образ содержит /usr/src/php.tar.xz —
# docker-php-ext-install сам распакует исходники.
FROM php:8.5-fpm-alpine AS runtime

# Часовой пояс + утилиты (mysql-клиент нужен для healthcheck/artisan)
RUN apk add --no-cache unzip mariadb-client tzdata \
 && cp -f /usr/share/zoneinfo/Europe/Moscow /etc/localtime \
 && echo Europe/Moscow > /etc/timezone

# =============================================================================
# РАСШИРЕНИЯ PHP — финальная схема (основана на официальном Dockerfile образа
# php:8.5-fpm-alpine, github.com/docker-library/php, 8.5/alpine3.24/fpm):
#
#   * Базовый образ PHP 8.5-alpine собирается со ВСЕМИ основными расширениями
#     СТАТИЧЕСКИ (curl, dom, fileinfo, mbstring, openssl, PDO/mysqlnd, session,
#     tokenizer, xml, ctype, json ...) и сам делает `docker-php-source delete`,
#     т.е. дерева /usr/src/php в нём НЕТ, но есть tarball /usr/src/php.tar.xz.
#   * docker-php-ext-install САМ распаковывает исходники (docker-php-source
#     extract) и САМ ставит/удаляет $PHPIZE_DEPS — вручную их добавлять НЕ нужно.
#   * Все прошлые падения были из-за ручного управления зависимостями/компиляцией:
#     gd/opcache в 8.5-alpine не собираются как shared (.so отсутствует →
#     "cp: can't stat modules/*"); project их не использует (grep по app/ +
#     composer.lock: только suggest) — НЕ ставим;
#     sockets падал на linux/sock_diag.h, ftp/bcmath-gmp не нужны — НЕ ставим.
#   * Проверяем результат ТОЛЬКО штатным способом: php -m сразу после установки.
#     Никаких проверок до/после apk del и т.п. самодеятельности.
# =============================================================================
RUN set -eux; \
    test -f /usr/src/php.tar.xz \
      || { echo "!!! В базовом образе нет /usr/src/php.tar.xz — расширений не собрать"; exit 1; }; \
    apk add --no-cache libzip-dev icu-dev; \
    docker-php-ext-install -j"$(nproc)" bcmath intl pdo_mysql zip; \
    pecl install redis; \
    docker-php-ext-enable redis; \
    php -m; \
    for e in bcmath ctype curl dom fileinfo intl json mbstring openssl \
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
