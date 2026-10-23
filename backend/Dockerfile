# syntax=docker/dockerfile:1.4
# =============================================================================
# BCS backend (Laravel 12) — php-fpm, Alpine.
#
# Правила этой сборки (выведены из реального содержимого базового образа):
#   1. НИЧЕГО не компилируем: в базисе нет исходников PHP (/usr/src/php*),
#      поэтому docker-php-ext-install/pecl физически не работают. Не хватает
#      только bcmath и redis — берём их ГОТОВЫМИ .so из пакетов Alpine 3.21
#      (php84-bcmath, php84-pecl-redis).
#   2. НЕ пишем файлы в /usr/local/etc/php/conf.d — там уже лежат ini базиса,
#      лишние файлы с абсолютными путями конфликтовали с ними (двойная загрузка
#      модулей = фаталы). Вместо этого копируем .so в extension_dir базиса и
#      включаем штатной командой docker-php-ext-enable.
#   3. В конце — жёсткая самопроверка php -m: если чего-то нет, сборка падает
#      сразу с именем расширения.
#   4. intl/gd/exif/ftp/pcntl/sockets/iconv коду проекта не нужны (проверено
#      grep-ом по backend/app; mb_* покрыты symfony/polyfill-mbstring).
#   5. Хостовый PHP на Windows к сборке отношения не имеет — всё внутри образа.
# =============================================================================

FROM composer:2 AS composer-stage

FROM php:8.4-fpm-alpine3.21 AS runtime

ENV TZ=Europe/Moscow

RUN apk add --no-cache unzip mariadb-client tzdata \
 && cp -f /usr/share/zoneinfo/Europe/Moscow /etc/localtime \
 && echo Europe/Moscow > /etc/timezone

# -----------------------------------------------------------------------------
# Шаг 1. Готовые .so из Alpine + включение БЕЗ ручных ini.
# -----------------------------------------------------------------------------
RUN set -eux; \
    apk add --no-cache php84-bcmath php84-pecl-redis; \
    EXTDIR=$(php -i | sed -n 's/^extension_dir => //p' | tail -1); \
    for e in bcmath redis; do \
        src=""; \
        for cand in "/usr/lib/php84/${e}.so" "$(find /usr/lib -name "${e}.so" 2>/dev/null | head -1)"; do \
            [ -n "$cand" ] && [ -f "$cand" ] && src="$cand" && break; \
        done; \
        [ -n "$src" ] || { echo "!!! ${e}.so не найден (пакеты php84-*)"; exit 1; }; \
        cp "$src" "$EXTDIR/${e}.so"; \
    done; \
    docker-php-ext-enable bcmath redis; \
    php -m; \
    for e in bcmath ctype curl dom fileinfo json libxml mbstring openssl \
             PDO pdo_mysql session SimpleXML tokenizer xml zip redis; do \
        php -m | grep -qix "$e" || { echo "!!! расширение '$e' отсутствует — проверьте базис"; exit 1; }; \
    done

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
