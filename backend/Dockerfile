# syntax=docker/dockerfile:1.4
# =============================================================================
# BCS backend (Laravel 12) — php-fpm 8.4, Alpine. КРАТКАЯ ВЕРСИЯ.
#
# Почему раньше не собиралось (кратко): в Dockerfile накопился ~500-строчный
# «самодельный» PHP — каскады apk->исходники->тарболы php.net, подбор серий
# пакетов по /etc/phpNN и т.п. Он зависел от того, что именно очередная
# пересборка базового образа вырезала/добавила, и падал с невнятным exit 1.
# Плюс базис symfony/php8.4-cli-alpine на Docker Hub ОТСУТСТВУЕТ (404) —
# образ не мог даже начаться.
#
# Теперь: базис — официальный php:8.4-fpm-alpine. В нём PHP собран из исходников
# docker-library; недостающие расширения ставятся ШТАТНЫМИ скриптами образа
# (docker-php-ext-install сам распаковывает /usr/src/php.tar.xz и сам тянет
# -dev зависимости через apk). Никакой ручной компиляции, никаких каскадов.
# Если расширение недоступно — сборка падает СРАЗУ с его именем, а не через
# 5 минут на странной ошибке.
#
# Приложение живёт ТОЛЬКО внутри образа (bind-mount ./backend в compose нет);
# runtime-данные — в named volumes backend_storage / backend_bootstrap_cache.
# Каркас config/*.php берётся из корня репо (docker/skeleton/laravel12/config)
# через именованный контекст `repo` (см. docker-compose.yml).
# =============================================================================

# Composer берём из официального образа — без COPY бинарников из контекста.
FROM composer:2 AS composer-stage

# Стадия сборки PHP (расширения, composer vendor) — называется `runtime`,
# чтобы `docker compose build` (в compose.yml указано target: runtime для
# backend/queue/scheduler/backend-assets) не падал с "base name 'runtime'
# not found". Финальная стадия — она же.
FROM php:8.4-fpm-alpine AS runtime

# --- системные утилиты -------------------------------------------------------
RUN apk add --no-cache git unzip mariadb-client tzdata \
 && cp -f /usr/share/zoneinfo/Europe/Moscow /etc/localtime \
 && echo Europe/Moscow > /etc/timezone

# --- расширения PHP ----------------------------------------------------------
# iconv НЕ собираем: в php:8.4-fpm-alpine он уже встроен в ядро PHP.
# intl требует ICU той же версии, что собирала docker-library (icu-dev), —
# ставим вместе с остальными -dev пакетами одним слоем.
# redis — единственный PECL-модуль (CACHE_STORE/QUEUE_CONNECTION=redis в .env,
# predis в composer.json нет); ставится pecl c прямым указанием extension-dir
# и ini-файла, чтобы не зависеть от состояния /usr/local/etc/php/conf.d.
RUN set -eux; \
    apk add --no-cache --virtual .build-deps $PHPIZE_DEPS icu-dev oniguruma-dev libzip-dev libpng-dev libjpeg-turbo-dev freetype-dev linux-headers; \
    docker-php-ext-install bcmath ctype exif fileinfo ftp gd intl mbstring opcache pcntl pdo_mysql sockets tokenizer xml zip; \
    docker-php-ext-enable opcache; \
    pecl channel-update pecl.php.net || true; \
    EXTDIR="$(php -i | sed -n 's/^extension_dir => //p' | tail -1)"; \
    pecl install -D -q redis && printf 'extension=%s\n' "redis.so" > "$PHP_INI_DIR/conf.d/docker-php-ext-redis.ini"; \
    test -f "$EXTDIR/redis.so" || { echo "ERROR: redis.so не установлен в $EXTDIR"; exit 1; }; \
    apk del .build-deps

# --- проверка критичных расширений -------------------------------------------
# Отсутствие любого модуля из списка роняет сборку ЗДЕСЬ с именем модуля.
# json/hash/pcre/session/libxml — часть ядра PHP; php -m печатает их стабильно.
RUN set -eux; \
    for e in bcmath ctype curl dom exif fileinfo filter ftp gd hash intl json mbstring openssl pcntl PDO pdo_mysql posix redis session SimpleXML sockets sodium tokenizer xml xmlreader xmlwriter zip zlib; do \
        php -m | grep -qx "$e" || { echo "!!! КРИТИЧНОЕ PHP-расширение '$e' НЕ установлено"; exit 1; }; \
    done; \
    php -v | head -1

# --- vendor (прод-зависимости, отдельным кеш-слоем) --------------------------
WORKDIR /var/www/html
COPY --from=composer-stage /usr/bin/composer /usr/bin/composer
COPY composer.json composer.lock ./
# --no-scripts: artisan сюда ещё не скопирован, а post-autoload-dump зовёт
# `php artisan package:discover`. Автозагрузчик собираем явным dump-autoload.
RUN set -eux; \
    composer install --no-dev --prefer-dist --no-interaction --no-scripts --no-progress --optimize-autoloader; \
    composer dump-autoload --optimize --no-dev --no-scripts; \
    test -f vendor/autoload.php

# --- код приложения -----------------------------------------------------------
COPY . .

# Каркас config/*.php из корня репо (контекст `repo`). При сборке без compose
# (`docker build ./backend`) контекста нет — стадия пуста, это не ошибка:
# недостающие конфиги создаются ниже только если их реально нет.
COPY --from=repo docker/skeleton/laravel12/config/ /tmp/skeleton/
RUN set -eux; \
    mkdir -p config; \
    if [ -d /tmp/skeleton ]; then for f in /tmp/skeleton/*.php; do [ -e "$f" ] || continue; t="config/$(basename "$f")"; [ -f "$t" ] || cp -a "$f" "$t"; done; rm -rf /tmp/skeleton; fi; \
    # минимальный app.php, если каркаса нет вообще (сборка вне compose)
    if [ ! -f config/app.php ]; then printf '%s\n' '<?php return [' \
      '    "name" => env("APP_NAME", "BCS"),' \
      '    "env" => env("APP_ENV", "production"),' \
      '    "debug" => (bool) env("APP_DEBUG", false),' \
      '    "url" => env("APP_URL", "http://localhost"),' \
      '    "timezone" => env("APP_TIMEZONE", "Europe/Moscow"),' \
      '    "locale" => "en",' \
      '    "fallback_locale" => "en",' \
      '    "faker_locale" => "en_US",' \
      '    "cipher" => "AES-256-CBC",' \
      '    "key" => env("APP_KEY"),' \
      '    "previous_keys" => [],' \
      '    "maintenance" => [ storage_path("framework/maintenance.php") ],' \
      '    "providers" => [\n      Illuminate\\Foundation\\Providers\\ServiceProvider::class,' \
      '    ],' \
      '    "aliases" => [],' \
      '];' > config/app.php; fi; \
    for F in config/*.php; do php -l "$F" >/dev/null || { echo "!!! синтаксис $F"; php -l "$F"; exit 1; }; done

# Права, discovery провайдеров, финальная самопроверка образа.
RUN set -eux; \
    mkdir -p storage/app/public storage/app/private storage/framework/cache/data \
             storage/framework/sessions storage/framework/testing storage/framework/views \
             storage/logs bootstrap/cache; \
    chown -R www-data:www-data storage bootstrap/cache; \
    chmod -R ug+rw storage bootstrap/cache; \
    php artisan package:discover --ansi; \
    test -f public/index.php; \
    php artisan --version >/dev/null; \
    echo ">>> Образ backend готов: код + vendor + config внутри образа."

# --- php-fpm слушает TCP 0.0.0.0:9000 -----------------------------------------
# Иначе nginx даёт 502: docker/nginx/default.conf использует fastcgi_pass
# backend:9000, а штатный пул alpine-образа слушает unix-сокет.
RUN set -eux; \
    printf '%s\n' \
      '[www]' \
      'user = www-data' \
      'group = www-data' \
      'listen = 0.0.0.0:9000' \
      'pm = dynamic' \
      'pm.max_children = 12' \
      'pm.start_servers = 4' \
      'pm.min_spare_servers = 3' \
      'pm.max_spare_servers = 6' \
      'pm.max_requests = 500' \
      'request_terminate_timeout = 120s' \
      'clear_env = no' \
      > /usr/local/etc/php-fpm.d/zz-listen.conf

# --- настройки PHP ------------------------------------------------------------
RUN set -eux; \
    printf '%s\n' \
      'opcache.enable=1' \
      'opcache.memory_consumption=128' \
      'opcache.interned_strings_buffer=16' \
      'opcache.max_accelerated_files=20000' \
      'opcache.validate_timestamps=1' \
      'opcache.revalidate_freq=2' \
      'expose_php=Off' \
      'memory_limit=256M' \
      'upload_max_filesize=20M' \
      'post_max_size=21M' \
      'date.timezone=Europe/Moscow' \
      > "$PHP_INI_DIR/conf.d/zz-app.ini"

EXPOSE 9000
CMD ["php-fpm"]
