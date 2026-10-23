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

# Расширения PHP. ТОЛЬКО то, чего нет в базовом образе (базис уже несёт
# ctype curl dom fileinfo json mbstring openssl PDO phar session tokenizer
# xml xmlreader xmlwriter). Компиляция — в одном слое, .build-deps удаляются.
# ext-sockets и ext-ftp УДАЛЕНЫ из сборки: проект их не использует
# (require-only в composer.json нет), а компиляция sockets падала на
# linux/sock_diag.h. Если когда-нибудь понадобится raw-сокет — там же
# доступен встроенный stream_socket_client() без всякого расширения.
# ВАЖНО: opcache НЕ компилируется через docker-php-ext-install. В php:8.x-alpine
# он уже встроен в бинарник php-fpm, а отдельная сборка "shared" версии в PHP 8.5
# падает на `cp: can't stat 'modules/*'` (не остаётся .so для копирования) и
# роняла всю сборку backend/queue/scheduler. Включается ниже ini-файлом zz-app.ini.
# ВАЖНО про порядок self-проверки: раньше проверка php -m стояла ПОСЛЕ
# `apk del .build-deps`. В PHP 8.5-alpine многие расширения (ctype, curl, dom,
# fileinfo, json, mbstring, openssl, PDO, session, tokenizer, xml) собраны как
# общие .so, а для их загрузки нужен pkgconf из $PHPIZE_DEPS — его удаление
# делало вывод `php -m` неполным и сборка падала с ложным «gd НЕ установлено»
# (и упоминание gd в ошибке было просто первым элементом списка). Проверка
# теперь идёт ДО apk del.
RUN set -eux; \
    apk add --no-cache --virtual .build-deps $PHPIZE_DEPS libzip-dev icu-dev oniguruma-dev; \
    # gd НЕ компилируем: проект не использует imagecreate*/Intervention (проверено
    # grep'ом по коду и composer.lock — только suggest), а в PHP 8.5-alpine
    # shared-сборка gd роняла весь слой (`cp: can't stat 'modules/*'`).
    # docker-php-ext-configure gd --with-freetype --with-jpeg;
    # docker-php-ext-install -j"$(nproc)" gd;   ← включить, если понадобится
    # pcntl НЕ ставим: в коде нет pcntl_signal/pcntl_fork (проверено grep'ом),
    # а он нужен только для обработки сигналов контейнера.
    docker-php-ext-install -j"$(nproc)" \
        bcmath exif fileinfo intl pdo_mysql zip; \
    pecl install redis; \
    docker-php-ext-enable redis; \
    # opcache НЕ компилируем отдельно: в php:8.x-alpine он встроен в бинарники
    # php/php-fpm; отдельная shared-сборка в 8.5 падает на cp modules/*.
    # Включается ini-файлом zz-app.ini ниже.
    # самопроверка критичных модулей — ДО apk del (см. комментарий выше);
    # gd/exif — необязательные: при отсутствии только предупреждение,
    # Laravel от них не ломается
    CRIT="bcmath ctype curl dom fileinfo intl json mbstring openssl \
          PDO pdo_mysql redis session SimpleXML tokenizer xml zip"; \
    for e in $CRIT; do \
        php -m | grep -qix "$e" || { echo "!!! расширение '$e' НЕ установлено"; exit 1; }; \
    done; \
    for e in gd exif; do \
        php -m | grep -qix "$e" || echo "WARN: необязательное '$e' отсутствует"; \
    done; \
    apk del .build-deps

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
