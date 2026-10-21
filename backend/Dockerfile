# syntax=docker/dockerfile:1
# =============================================================================
# BCS backend (Laravel) — php-fpm 8.4, Alpine. ПЕРЕПИСАН ЦЕЛИКОМ.
#
# ИСТОРИЯ БОЛЕЙ ЭТОГО ФАЙЛА (чтобы не возвращать старые грабли):
#  1) "COPY phpredis-6.3.0.tar.gz ... failed to compute cache key ... not found"
#     и "COPY composer.phar /usr/bin/composer -> ... /composer.phar: not found".
#     Причина одна: COPY бинарных артефактов из контекста сборки на
#     Windows/Docker Desktop нестабилен (file sharing, .gitignore, случайное
#     удаление файла). РЕШЕНИЕ: в этом файле НЕТ ни одного COPY локального
#     бинарника — всё необходимое берётся из официальных образов через
#     multi-stage (composer) или скачивается/ставится внутри RUN с retry.
#  2) PowerShell/редакторы портили heredoc-блоки (RUN <<EOF), съедая $(...) и
#     кавычки -> "/bin/sh: not: not found". РЕШЕНИЕ: никакого heredoc, только
#     классические RUN с переносами через && \ ; каждая строка — валидный sh.
#  3) "Unable to unlock vendor/composer/installed.json" / "The process ... has
#     been terminated unexpectedly" при composer install в bind-mount'd каталоге
#     на Windows — lock-файлы flock() на drvfs работают неверно. РЕШЕНИЕ: сборка
#     зависимостей идёт в отдельном каталоге /opt/build (не смонтирован с хоста),
#     в образе остаётся готовый прод-vendor; рантайм подхватывает его через
#     volume backend_vendor (см. docker-compose.yml).
#  4) "Your requirements could not be resolved to an installable set of packages
#     ... ext-curl required" — раньше ставился только набор из composer.json без
#     расширений, нужных самим кодом (curl для Guzzle, intl, dom/libxml, fileinfo
#     для Flysystem, tokenizer/session/hash для Laravel). Теперь все расширения
#     проверяются ЯВНО через php -m: если чего-то нет — сборка падает сразу, а не
#     через 5 минут на странных рантайм-ошибках.
#  5) 502 Bad Gateway от nginx: базовый php-fpm-alpine слушает UNIX-сокет, а
#     docker/nginx/default.conf стучится на backend:9000. РЕШЕНИЕ: конфиг с
#     listen = 0.0.0.0:9000 создаётся здесь же (именно zz-listen.conf — его ждёт
#     самопроверка entrypoint в docker-compose.yml), а не только в entrypoint.
#  6) "composer.lock is not up to date with composer.json" из-за флага
#     --ignore-platform-req=php+ (он меняет expectations lock-файла). РЕШЕНИЕ:
#     никаких ignore-platform-req: образ собран ровно на PHP 8.4 и со ВСЕМИ
#     расширениями из lock, поэтому проверка платформ не нужна и вредна.
# =============================================================================

# ---------------------------------------------------------------------------
# Стадия 1: официальный образ Composer. Бинарник попадает в итоговый образ
# детерминированно (через слой BuildKit), без зависимости от контекста/сети.
# ---------------------------------------------------------------------------
FROM composer:2 AS composer-stage

# Стадия 2: рабочий образ PHP-FPM.
# Имя стадии ВАЖНО: docker-compose.yml собирает backend/queue/scheduler из одной
# папки (context: ./backend), и target: base гарантирует, что билд остановится
# на этой стадии и НЕ будет тащить composer-стадию в финальный образ.
FROM php:8.4-fpm-alpine AS base

# Системные пакеты + PHP-расширения одним слоем.
#   mariadb-client (mysqldump) — нужен `php artisan db:backup`;
#   redis — обязателен: CACHE_STORE/QUEUE_CONNECTION=redis в .env, predis в
#   composer.json нет, без расширения падают throttle, SSE и планировщик.
# Список расширений ниже = union требований composer.lock (ext-curl, ext-intl,
# ext-dom, ext-libxml, ext-fileinfo, ext-tokenizer, ext-session, ext-ctype, ...)
# и кода приложения. Ставятся явно, а в конце слоя каждое проверяется через
# `php -m`: если чего-то нет — сборка падает СРАЗУ с именем расширения, а не
# позже на странных рантайм-ошибках ("Class 'IntlDateFormatter' not found").
# ВАЖНО: в списке расширений НЕТ standalone "libxml" и "xmlreader/xmlwriter" —
# это не отдельные модули: libxml встроен в ext-dom/ext-simplexml/ext-xml, а
# xmlreader/xmlwriter собираются вместе с ext-xml. Попытка поставить их
# отдельными аргументами обрывает сборку ("cannot find /usr/local/include/libxml"
# либо "The following extension require the following extensions: xml").
# То же касается проверочного цикла ниже (php -m никогда не печатает "libxml").
RUN set -eux; \
    apk add --no-cache git curl icu-dev libpng-dev libjpeg-turbo-dev \
        freetype-dev libxml2-dev libzip-dev zip unzip mariadb-client; \
    apk add --no-cache oniguruma-dev || apk add --no-cache oniguruma || true; \
    apk add --no-cache --virtual .build-deps "${PHPIZE_DEPS}"; \
    docker-php-ext-configure gd --with-freetype --with-jpeg; \
    docker-php-ext-install -j"$(nproc)" \
        bcmath ctype curl dom exif fileinfo ftp gd iconv intl \
        mbstring opcache openssl pcntl pdo_mysql session simplexml tokenizer \
        xml xmlreader xmlwriter zip

# Redis обязателен: CACHE_STORE/QUEUE_CONNECTION=redis в .env, predis в
# composer.json нет — без расширения падают throttle, SSE и планировщик.
# Сначала пробуем pecl; если он недоступен — ручная сборка: архив скачивается
# ВНУТРИ RUN (никакого COPY *.tgz из контекста сборки, см. боль 1 в шапке).
RUN set -eux; \
    { pecl channel-update pecl.php.net || true; pecl install redis; } || true; \
    docker-php-ext-enable redis || true; \
    if ! php -m | grep -qix redis; then \
        mkdir -p /tmp/redisbuild; \
        cd /tmp/redisbuild; \
        curl -fsSL --retry 5 --retry-delay 3 https://pecl.php.net/get/redis-6.3.0.tgz -o redis.tgz; \
        tar xf redis.tgz; \
        cd redis-*/; \
        phpize && ./configure && make -j"$(nproc)" && make install; \
        cd /; \
        rm -rf /tmp/redisbuild; \
        docker-php-ext-enable redis; \
    fi; \
    apk del .build-deps

# Финальная проверка: если какого-то расширения нет, сборка падает ЗДЕСЬ с
# именем расширения, а не через 5 минут на рантайм-ошибке вида
# "Class 'IntlDateFormatter' not found" или "Call to undefined function curl_init()".
RUN set -eux; \
    for ext in bcmath ctype curl dom exif fileinfo ftp gd iconv intl \
               json mbstring openssl pcntl pdo_mysql phar redis session \
               simplexml tokenizer xml xmlreader xmlwriter zip; do \
        php -m | grep -qix "$ext" \
            || { echo "!!! PHP-расширение '$ext' НЕ установлено"; exit 1; }; \
    done; \
    php -v | head -1; \
    echo ">>> Все необходимые расширения PHP на месте."

# Composer и его обязательные расширения (json, mbstring, openssl) должны быть
# ДО стадии vendor-build — иначе `composer install` падает с "Requires extension
# ... not installed". Стадия ниже наследует base (со ВСЕМИ расширениями), так что
# порядок слоёв здесь критичен: не переносите vendor-build выше этих RUN.

# Стадия 3: сборка production-зависимостей в чистом окружении.
# Вынесено в отдельную стадию по двум причинам:
#  (а) Docker выполняет независимые стадии параллельно — слой vendor строится
#      одновременно со слоем расширений, итоговая сборка быстрее;
#  (б) этот слой инвалидируется ТОЛЬКО при изменении composer.json/lock, а не
#      при каждой правке PHP-кода.
# Рабочий каталог /opt/build существует лишь внутри образа: bind-mount ./backend
# его не перекрывает, поэтому flock() на vendor/composer/installed.json работает
# штатно (см. боль 3 в шапке файла).
FROM base AS vendor-build
WORKDIR /opt/build
COPY --from=composer-stage /usr/bin/composer /usr/bin/composer
COPY composer.json composer.lock ./
# --no-scripts обязателен: artisan сюда ещё не скопирован, а composer-скрипт
# post-autoload-dump зовёт `php artisan package:discover` -> "Could not open
# input file: artisan". Автозагрузчик собираем явным dump-autoload ниже.
RUN set -eux; \
    chmod +x /usr/bin/composer; \
    composer --version; \
    composer install \
        --no-dev --prefer-dist --no-interaction --no-scripts --no-progress \
        --no-ansi --working-dir=/opt/build; \
    composer dump-autoload --optimize --classmap-authoritative --no-dev \
        --no-scripts --working-dir=/opt/build; \
    test -f /opt/build/vendor/autoload.php; \
    echo ">>> vendor собран, пакетов:" $(ls /opt/build/vendor | wc -l)

WORKDIR /var/www/html

# Готовый prod-vendor в путь рантайма. Именно он попадает в пустой volume
# backend_vendor при первом `docker compose up` (Docker копирует содержимое
# образа по точке монтирования volume), поэтому в рантайме не нужны ни сеть, ни
# composer install «на живую». Проверка autoload подтверждает, что слой цел.
COPY --from=vendor-build --chown=www-data:www-data /opt/build/vendor /var/www/html/vendor
RUN set -eux; \
    test -f /var/www/html/vendor/autoload.php; \
    php -r 'require "/var/www/html/vendor/autoload.php"; exit(class_exists("Illuminate\Foundation\Application") ? 0 : 1);' \
        || { echo "!!! autoload не загружает Laravel — слой vendor повреждён"; exit 1; }; \
    echo ">>> autoload OK: Illuminate\\Foundation\\Application загружается."

# Composer оставляем в образе только для пересборки зависимостей внутри
# контейнера (`docker compose exec backend composer update`). Никакого
# COPY composer.phar из контекста сборки (боль 1) — берём из официальной стадии.
COPY --from=composer-stage /usr/bin/composer /usr/bin/composer
RUN set -eux; \
    chmod +x /usr/bin/composer; \
    composer --version

# Код приложения.
# ВАЖНО про порядок слоёв: COPY . . идёт ПОСЛЕ vendor и специально не затирает
# его — vendor в образе нужен как источник для первоначального наполнения
# volume backend_vendor (docker копирует содержимое образа в пустой volume).
COPY . .

# Список автопровайдеров генерируем после COPY . . отдельным шагом: bind-mount
# ./backend затирает bootstrap/cache из образа, поэтому packages.php должен
# уметь пересоздаваться и на хосте (см. entrypoint в docker-compose.yml).
# Скрипт лежит в backend/, потому что контекст сборки = ./backend
# (COPY docker/... падал с "failed to compute cache key ... not found").
COPY docker-package-discovery.php /tmp/package-discovery.php
RUN set -eux; \
    mkdir -p storage/app/public storage/app/tmp storage/app/backups \
             storage/framework/cache/data storage/framework/sessions \
             storage/framework/testing storage/framework/views storage/logs \
             bootstrap/cache; \
    if [ -f artisan ] && php artisan package:discover --ansi; then :; \
    else php /tmp/package-discovery.php; fi; \
    rm -f /tmp/package-discovery.php; \
    chown -R www-data:www-data storage bootstrap/cache; \
    chmod -R 777 storage bootstrap/cache

# PHP-конфиг. OPcache: validate_timestamps=1 ОБЯЗАТЕЛЬНО — код монтируется с
# хоста, при =0 правки PHP «не применяются» (классическая жалоба «докер не
# работает»). JIT выключен: на alpine/musl он нестабилен, профита I/O-bound
# Laravel не даёт.
RUN set -eux; \
    cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"; \
    printf '%s\n' \
      'opcache.enable=1' \
      'opcache.enable_cli=0' \
      'opcache.memory_consumption=128' \
      'opcache.interned_strings_buffer=16' \
      'opcache.max_accelerated_files=20000' \
      'opcache.validate_timestamps=1' \
      'opcache.revalidate_freq=2' \
      'opcache.save_comments=1' \
      'expose_php=Off' \
      'memory_limit=256M' \
      'upload_max_filesize=20M' \
      'post_max_size=21M' \
      'date.timezone=Europe/Moscow' \
      'session.cookie_httponly=1' \
      'session.cookie_samesite=Lax' \
      > /usr/local/etc/php/conf.d/zz-app.ini

# php-fpm слушает TCP 0.0.0.0:9000 (иначе nginx даёт 502 Connection refused —
# docker/nginx/default.conf использует fastcgi_pass backend:9000).
# pm=static — фиксированные процессы, предсказуемая латентность под лимитом RAM.
RUN set -eux; \
    printf '%s\n' \
      '[www]' \
      'listen = 0.0.0.0:9000' \
      'clear_env = no' \
      'pm = static' \
      'pm.max_children = 6' \
      'pm.max_requests = 500' \
      'catch_workers_output = yes' \
      'decorate_worker_output = no' \
      'php_admin_value[memory_limit] = 128M' \
      > /usr/local/etc/php-fpm.d/zz-listen.conf

EXPOSE 9000

CMD ["php-fpm"]
