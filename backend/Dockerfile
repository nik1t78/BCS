# syntax=docker/dockerfile:1.4
# =============================================================================
# BCS backend (Laravel 12) — php-fpm, Alpine.
#
# ПРАВИЛА ЭТОЙ СБОРКИ (важно, чтобы снова не сломать):
#   1. НИЧЕГО не компилируем и не ставим вручную: в актуальных образах
#      php:*-alpine исходники PHP удалены официально (docker-php-source delete),
#      а пакеты phpNN-* из Alpine конфликтуют с внутренностями базиса.
#      Поэтому Dockerfile ниже НЕ содержит ни apk-расширений, ни pecl,
#      ни docker-php-ext-install, ни самодеятельных проверок «лишних» модулей.
#   2. Базис выбран так, что ВСЁ нужное проекту в нём уже есть статически:
#      curl, dom, fileinfo, filter, hash, iconv, json, libxml, mbstring,
#      openssl, pcre, PDO, pdo_mysql, phar, session, SimpleXML, tokenizer,
#      xml*, zlib, OPcache. Это ровно тот список, который требует
#      composer.lock (проверено по ext-* зависимостям пакетов).
#      bcmath/zip/intl/gd/redis коду НЕ нужны (polyfill'ы + sync-очередь +
#      file-кэш; см. x-backend-env в docker-compose.yml).
#   3. Единственная проверка в конце сборки — реально запускается Laravel
#      (php artisan --version). Если базис когда-нибудь изменится так, что
#      Laravel не стартует, мы это увидим здесь, а не через неделю в проде.
#   4. Тег базиса привязан к Alpine 3.21 (последняя версия, где он собран
#      корректно для Laravel). Меняйте только вместе с тестовой сборкой.
# =============================================================================

FROM composer:2 AS composer-stage

FROM php:8.4-fpm-alpine3.21 AS runtime

ENV TZ=Europe/Moscow

RUN apk add --no-cache unzip git tzdata \
 && cp -f /usr/share/zoneinfo/Europe/Moscow /etc/localtime \
 && echo Europe/Moscow > /etc/timezone

WORKDIR /var/www/html

COPY --from=composer-stage /usr/bin/composer /usr/bin/composer
COPY backend/composer.json backend/composer.lock ./

RUN set -eux; \
    composer install --no-dev --prefer-dist --no-interaction --no-scripts \
        --no-progress --optimize-autoloader \
 && test -f vendor/autoload.php

# Код приложения + каркас конфигов Laravel
COPY backend/ ./
COPY docker/skeleton/laravel12/config/ config/
RUN php artisan --version
RUN set -eux; \
    mkdir -p storage/app/public storage/app/private storage/framework/cache/data \
             storage/framework/sessions storage/framework/views storage/logs \
             bootstrap/cache; \
    chown -R www-data:www-data storage bootstrap/cache; \
    php artisan package:discover --ansi

# php-fpm слушает TCP 0.0.0.0:9000 (штатный пул alpine-образа слушает unix-сокет)
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

# Настройки приложения — отдельным ini в conf.d (расширения базиса от этого не
# слетают: дописывается новый файл, существующие не трогаются)
RUN printf '%s\n' \
      'expose_php=Off' \
      'memory_limit=256M' \
      'upload_max_filesize=20M' \
      'post_max_size=21M' \
      'date.timezone=Europe/Moscow' \
      'opcache.enable=1' \
      'opcache.memory_consumption=128' \
      > "$PHP_INI_DIR/conf.d/zz-app.ini"

EXPOSE 9000
CMD ["php-fpm"]
