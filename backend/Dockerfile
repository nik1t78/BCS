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
# Шаг 1. НИЧЕГО не доустанавливаем и НЕ компилируем.
# Проект переведён на драйверы без Redis/bcmath:
#   QUEUE_CONNECTION=sync, CACHE_STORE=file, SESSION_DRIVER=file,
#   realtime-SSE деградирует в поллинг (SafeCache/RealtimeNotifier это умеют).
# Требуемые composer.lock модули (ctype filter hash json mbstring openssl
# pcre PDO session tokenizer xml ...) — все статически вкомпилированы в базис.
# Проверяем их наличие один раз; при отсутствии любой из них сборка падает
# сразу с именем модуля (значит базис изменился — тогда читаем комментарий
# про php84-* пакеты выше и возвращаем нужную строку установки).
# -----------------------------------------------------------------------------
RUN set -eux; \
    php -m; \
    for e in ctype date dom fileinfo filter hash json libxml mbstring \
             openssl PDO pcre Phar session SimpleXML SPL tokenizer uri \
             xml xmlreader xmlwriter zlib Zend OPcache; do \
        php -m | grep -qix "$e" || { echo "!!! базис: '$e' нет в php -m — смените базис"; exit 1; }; \
    done; \
    php -r 'exit(extension_loaded("curl")?0:1);'; \
    php -r 'exit(extension_loaded("pdo_mysql")?0:1);'; \
    php -r 'exit(extension_loaded("zip")?0:1);'; \
    php -r 'exit(extension_loaded("mbstring")?0:1);'

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
