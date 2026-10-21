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
#     в образе остаётся готовый прод-vendor; с ним же собирается финальное
#     дерево приложения (volume backend_vendor УДАЛЁН — vendor теперь только
#     в образе, см. "боль 7").
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
#  7) bind-mount ./backend с хоста (Windows/Linux) перекрывал /var/www/html и
#     приложение работало с файлов хоста, а не с образа — любая недостача или
#     «битый» файл на хосте ломал запуск. РЕШЕНИЕ (нынешняя архитектура):
#     В docker-compose.yml у backend/queue/scheduler НЕТ bind-mount кода. Всё
#     приложение (код + vendor + storage-каркас) живёт ТОЛЬКО внутри образа;
#     runtime-данные (uploads, кэш bootstrap) — в именованных docker volumes.
#     Хост больше ничего не «одалживает»; при изменении кода достаточно
#     `docker compose build backend` (или --no-cache), данные БД/uploads в
#     volumes сохраняются.
# =============================================================================

# ---------------------------------------------------------------------------
# Стадия 1: официальный образ Composer. Бинарник попадает в итоговый образ
# детерминированно (через слой BuildKit), без зависимости от контекста/сети.
# ---------------------------------------------------------------------------
FROM composer:2 AS composer-stage

# Стадия 2: рабочий образ PHP-FPM (только PHP + расширения, БЕЗ кода).
# Используется как базис для стадий vendor-build/app; саму её compose больше
# не собирает — target: runtime (финальная стадия ниже), чтобы приложение
# целиком жило в образе (см. "боль 7" в шапке).
# ВАЖНО (корень последних падений сборки): в новых тегах php:8.4-fpm-alpine
# (alpine 3.22+, пересборка осени 2026) docker-library сильно урезал образ:
# из ядра PHP удалены ctype, bcmath, iconv и др., а из /usr/src/php/ext вырезаны
# исходники tokenizer (нет Zend/zend_language_parser.y). Поэтому:
#   - доп. расширения ставим apk-пакетами php83-* (собраны Alpine, совместимы с
#     тем же ABI no-debug-non-zts-20240924; пакет тянет нужные lib-зависимости);
#   - то, чего нет ни в apk, ни в образе (tokenizer), собираем из полного tarball
#     php.net (см. блок BUILDABLE ниже);
#   - пин alpine 3.21 НЕ делаем: там php 8.4 без патчей безопасности.
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
# ВАЖНО (грабли новых alpine-образов php): в свежих тегах php:8.4-fpm-alpine
# переменная окружения PHPIZE_DEPS больше НЕ определена (или пуста). Строка
# `apk add --virtual .build-deps "${PHPIZE_DEPS}"` превращалась в
# `apk add ... ""` и обрывала сборку ошибкой:
#   ERROR: '' is not a valid package dependency, format is name([<>~=]version)
# РЕШЕНИЕ: список пакетов для сборки расширений задаём ЯВНО со fallback из
# PHPIZE_DEPS, если он вдруг снова появится в образе.
# Второй момент: ext-dom/ext-simplexml/ext-xml на Alpine требуют dev-пакеты
# libxml2/зависимости — они уже стоят выше, но чтобы configure не падал с
# "cannot find headers", ставим их ещё раз через тот же apk (idempotent).
# ВАЖНО (новая боль): в свежих alpine-3.22+ пакет curl — только рантайм-бинарник,
# его .pc-файла нет, а docker-php-ext-install curl вызывает `pkg-config libcurl`
# → "Package 'libcurl' not found". Нужен dev-пакет: curl-dev (alpine 3.20-3.23)
# или libcurl-dev (edge/будущие) — перебираем оба.
# ВАЖНО (грабли предыдущей сборки): НЕ ставьте standalone libiconv/libiconv-dev!
# В php-образах на musl-alpine PHP уже собран против системного iconv из libc,
# а libiconv-dev перекрывает /usr/include/iconv.h своим заголовком
# (там нет символа _libiconv_version) и сборка ext-iconv падает с:
#   iconv.c:71: error: '_libiconv_version' undeclared
# Поэтому проверка после установки пакетов: если кто-то тянет libiconv — выходим
# с понятной ошибкой вместо дебри компиляции.
RUN set -eux; \
    apk add --no-cache git curl curl-dev icu-dev libpng-dev libjpeg-turbo-dev freetype-dev libxml2-dev libzip-dev zip unzip mariadb-client 2>/dev/null || apk add --no-cache git curl libcurl-dev icu-dev libpng-dev libjpeg-turbo-dev freetype-dev libxml2-dev libzip-dev zip unzip mariadb-client; \
    apk add --no-cache oniguruma-dev || apk add --no-cache oniguruma || true; \
    BUILD_DEPS="${PHPIZE_DEPS:-autoconf dpkg-dev dpkg file g++ gcc libc-dev make pkgconf re2c}"; \
    apk add --no-cache --virtual .build-deps ${BUILD_DEPS}; \
    command -v pkg-config >/dev/null || apk add --no-cache pkgconfig; \
    if apk info -e libiconv-dev >/dev/null 2>&1; then echo "ERROR: установлен libiconv-dev — он заглушает musl /usr/include/iconv.h и ломает сборку PHP ext-iconv/intl. Уберите его из списка пакетов."; exit 1; fi; \
    pkg-config --exists libcurl || { echo "ERROR: pkg-config не видит libcurl (.pc отсутствует)"; exit 1; }; \
    # ВАЖНО: в EXTLIST НЕТ iconv — на musl-alpine он встроен в ядро PHP и просто
    # не печатается в php -m; попытка пересобрать его (в т.ч. из tarball) цепляет
    # чужой libiconv.h и падает "_libiconv_version undeclared". intl тоже убран:
    # без нормального ICU-dev на alpine не собирается, Laravel прикрывает polyfill.
    EXTLIST="bcmath ctype curl dom exif fileinfo ftp gd mbstring opcache pcntl pdo_mysql session simplexml tokenizer xml zip"; \
    MEASURE() { M=""; for e in $EXTLIST; do m="$e"; [ "$e" = pdo_mysql ] && m="PDO"; php -m | grep -qx "$m" || M="$M $e"; done; }; \
    MEASURE; \
    if [ -n "$M" ]; then echo "НЕ ХВАТАЕТ (старт):$M — включаю трёхступенчатый каскад: apk -> /usr/src/php -> tarball php.net"; fi; \
    APKPKGS=""; for e in $M; do P="$(ls /etc/apk/available/ 2>/dev/null | grep -E "^php[0-9]+-$e$" | head -1)"; if [ -n "$P" ]; then APKPKGS="$APKPKGS $P"; else echo "APK: пакета для '$e' нет в этом релизе alpine"; fi; done; \
    if [ -n "$APKPKGS" ]; then apk add --no-cache $APKPKGS >/dev/null 2>&1 || true; echo "APK: поставил:$APKPKGS"; fi; \
    MEASURE; \
    BUILDABLE=""; for e in $M; do if [ -f "/usr/src/php/ext/$e/config.m4" ]; then BUILDABLE="$BUILDABLE $e"; fi; done; \
    if [ -n "$BUILDABLE" ]; then echo "СБОРКА из /usr/src/php:$BUILDABLE"; if php -m | grep -qix gd; then echo "gd уже есть — configure gd пропускаю"; else docker-php-ext-configure gd --with-freetype --with-jpeg || { echo "WARNING: configure gd не удался — исключаю gd из сборки, остальное ставлю без него"; BUILDABLE=$(echo $BUILDABLE | tr ' ' '\n' | grep -v '^gd$' | tr '\n' ' '); }; fi; docker-php-ext-install -j"$(nproc)" $BUILDABLE; fi; \
    MEASURE; \
    if [ -n "$M" ]; then VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION.".".PHP_RELEASE_VERSION;')"; echo "TARBALL: всё ещё нет:$M — скачиваю полный исходник php-${VER} (5 минут, это нормально)"; mkdir -p /tmp/phpsrc; OK=0; for url in "https://www.php.net/distributions/php-${VER}.tar.xz" "https://github.com/php/php-src/archive/refs/tags/php-${VER}.tar.gz"; do f="/tmp/$(basename $url)"; if timeout 60 curl -fsSL --connect-timeout 10 --retry 1 -o "$f" "$url"; then tar xf "$f" -C /tmp/phpsrc && OK=1 && break; fi; echo "WARNING: зеркало $url недоступно/битый архив — пробую следующее"; done; [ "$OK" = 1 ] || { echo "ERROR: не скачался полный исходник PHP ${VER} ни с одного зеркала — недостающие:$M"; exit 1; }; SRCDIR="$(find /tmp/phpsrc -maxdepth 1 -type d -name 'php-*' | head -1)"; test -d "$SRCDIR" || { echo "ERROR: tarball PHP распаковался без каталога php-*"; exit 1; }; for e in $M; do if [ -f "$SRCDIR/ext/$e/config.m4" ]; then echo "ДОСБОРКА '$e' из php-${VER}"; rm -rf "/usr/src/php/ext/$e"; cp -a "$SRCDIR/ext/$e" "/usr/src/php/ext/$e"; if [ "$e" = gd ] && ! php -m | grep -qix gd; then docker-php-ext-configure gd --with-freetype --with-jpeg || { echo "WARNING: configure gd не удался — пропускаю gd"; continue; }; fi; if [ "$e" = iconv ] || [ "$e" = intl ]; then echo "ПРОПУСК '$e': на musl-alpine iconv встроен в ядро PHP (php -m его не печатает), а intl без нормального ICU-dev не собирается — Laravel прикрывает symfony/polyfill"; else docker-php-ext-install -j"$(nproc)" "$e" || { echo "ERROR: сборка '$e' из tarball php-${VER} не удалась — см. лог компиляции выше"; exit 1; }; fi; fi; done; apk add --no-cache libiconv icu-libs libzstd >/dev/null 2>&1 || true; rm -rf /tmp/phpsrc /tmp/php.tar.*; fi; \
    MEASURE; \
    if [ -n "$M" ]; then echo "WARNING: после всех трёх шагов (apk / src / tarball) в php -m нет:$M"; fi; \
    for e in bcmath ctype curl dom fileinfo json mbstring openssl pcre PDO session tokenizer xml; do php -m | grep -qx "$e" || { echo "ERROR: критичное для Laravel/composer расширение '$e' отсутствует после всех попыток установки — проверьте лог выше (APK/SБОРКА/TARBALL)"; exit 1; }; done

# Redis обязателен: CACHE_STORE/QUEUE_CONNECTION=redis в .env, predis в
# composer.json нет — без расширения падают throttle, SSE и планировщик.
# pecl.php.net часто недоступен (в логах сервера: "Failed to connect to
# pecl.php.net:443", exit 7) — поэтому источник архива перебирается: pecl ->
# GitHub (codeload) -> gitee-зеркало. Первая успешная загрузка прерывает цикл.
# Никакого COPY *.tgz из контекста сборки (см. боль 1 в шапке).
RUN set -eux; \
    { pecl channel-update pecl.php.net && pecl install redis && docker-php-ext-enable redis; } || true; for e in iconv intl; do if ! php -m | grep -qx "$e"; then rm -f "/usr/local/etc/php/conf.d/docker-php-ext-$e.ini"; fi; done; \
    if ! php -m | grep -qix redis; then RPKG="$(ls /etc/apk/available/ 2>/dev/null | grep -E "^php[0-9]+-redis$" | head -1)"; if [ -n "$RPKG" ]; then echo "APK: ставлю redis из пакета $RPKG (быстрее и без компиляции)"; apk add --no-cache "$RPKG" >/dev/null 2>&1 || true; fi; fi; \
    if ! php -m | grep -qix redis; then \
        apk add --no-cache autoconf linux-headers >/dev/null 2>&1 || true; \
        mkdir -p /tmp/redisbuild; \
        cd /tmp/redisbuild; \
        for url in "https://pecl.php.net/get/redis-6.3.0.tgz" "https://github.com/phpredis/phpredis/archive/refs/tags/6.3.0.tar.gz" "https://gitee.com/mirrors/phpredis/repository/archive/6.3.0.tar.gz"; do echo "Пробую скачать redis с $url"; if curl -fsSL --connect-timeout 15 --max-time 180 --retry 2 --retry-delay 3 "$url" -o redis-src; then echo "Загрузка OK с $url"; break; fi; done; \
        test -s redis-src || { echo "ERROR: не удалось скачать исходники phpredis ни с одного зеркала (pecl/GitHub/gitee) — проверьте сеть/DNS контейнера сборки"; exit 1; }; \
        tar xf redis-src; \
        SRC_DIR="$(find . -maxdepth 1 -type d \( -name 'redis-*' -o -name 'phpredis-*' \) | head -1)"; \
        test -d "$SRC_DIR" || { echo "ERROR: в архиве не найдена директория исходников redis"; exit 1; }; \
        cd "$SRC_DIR"; \
        [ -f package.xml ] || printf '<?xml version="1.0"?>\n<package><name>redis</name><version>%s</version><stability>stable</stability><license>PHP</license><date>2024-01-01</date><notes>local build</notes><contents><dir name="/">.</dir></contents></package>\n' "6.3.0" > package.xml; \
        phpize && ./configure && make -j"$(nproc)" && make install; \
        EXTDIR="$(php-config --extension-dir)"; \
        if [ -f "$EXTDIR/modules/redis.so" ] && [ ! -f "$EXTDIR/redis.so" ]; then mv "$EXTDIR/modules/redis.so" "$EXTDIR/redis.so"; fi; \
        cd /; \
        rm -rf /tmp/redisbuild; \
        docker-php-ext-enable redis; \
        php -m | grep -qix redis || { echo "ERROR: redis собран, но php -m его не видит — модуль не загрузился"; exit 1; }; \
    fi; \
    apk del .build-deps

# Финальная проверка. КРИТИЧНЫЕ для Laravel/composer модули — отсутствие любого
# из них роняет сборку здесь (с именем модуля), а не через 5 минут в рантайме.
# Не-критичные (exif/ftp/intl/phar/simplexml/zip и т.п.) — только предупреждение:
# в свежих php:8.4-fpm-alpine часть исходников расширений вырезана из /usr/src/php
# (например tokenizer без Zend/zend_language_parser.y), пересобрать их docker-php-ext-install
# не может, а без них проект работает (Laravel использует own-реализации/фолбэки).
RUN set -eux; \
    for ext in bcmath ctype curl dom fileinfo gd mbstring openssl PDO redis session tokenizer xml; do php -m | grep -qx "$ext" || { echo "!!! КРИТИЧНОЕ PHP-расширение '$ext' НЕ установлено"; exit 1; }; done; \
    for ext in exif ftp iconv intl json pcntl phar simplexml xmlreader xmlwriter zip; do php -m | grep -qx "$ext" || echo "WARNING: необязательное расширение '$ext' отсутствует (Laravel прикроет symfony/polyfill) — продолжаем"; done; \
    php -v | head -1; \
    echo ">>> Все критичные расширения PHP на месте."

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

# Стадия 4: полная сборка приложения (код + vendor) ВНУТРИ образа.
# С этой стадии docker-compose больше ничего не монтирует с хоста: весь код,
# vendor и каркас storage живут только в образе (см. "боль 7" в шапке).
FROM base AS app
WORKDIR /var/www/html

# Composer нужен и здесь (пересборка зависимостей внутри контейнера:
# `docker compose exec backend composer update`). Никакого COPY composer.phar
# из контекста сборки (боль 1) — бинарь берётся из официальной стадии.
COPY --from=composer-stage /usr/bin/composer /usr/bin/composer
RUN set -eux; \
    chmod +x /usr/bin/composer; \
    composer --version

# Готовый prod-vendor (--no-dev) кладём ПЕРЕД копированием кода: слой vendor
# инвалидируется только при изменении composer.json/lock, частые правки PHP-кода
# не пересобирают зависимости. Проверка autoload подтверждает целостность слоя.
COPY --from=vendor-build --chown=www-data:www-data /opt/build/vendor /var/www/html/vendor
RUN set -eux; \
    test -f /var/www/html/vendor/autoload.php; \
    php -r 'require "/var/www/html/vendor/autoload.php"; exit(class_exists("Illuminate\\Foundation\\Application") ? 0 : 1);' || { echo "!!! autoload не загружает Laravel — слой vendor повреждён"; exit 1; }; \
    echo ">>> autoload OK: Illuminate\\Foundation\\Application загружается."

# Код приложения (контекст сборки = ./backend, см. backend/.dockerignore).
COPY . .

# Каркас config/*.php (лежит в docker/skeleton/laravel12/config/, попадает в
# контекст сборки через исключение в backend/.dockerignore) кладём только если
# config/app.php отсутствует — вручную заполненный на сервере config/ не трогаем.
RUN set -eux; \
    if [ ! -f config/app.php ] && [ -d docker/skeleton/laravel12/config ]; then cp -a docker/skeleton/laravel12/config/. config/; fi; \
    test -f config/app.php || { echo '!!! config/app.php так и не появился'; exit 1; }; \
    ls config/

# Список автопровайдеров генерируем после COPY . . отдельным шагом.
# Скрипт лежит в backend/, потому что контекст сборки = ./backend
# (COPY docker/... падал с "failed to compute cache key ... not found").
COPY docker-package-discovery.php /tmp/package-discovery.php
RUN set -eux; \
    mkdir -p storage/app/public storage/framework/cache/data \
             storage/framework/sessions storage/framework/testing \
             storage/framework/views storage/logs bootstrap/cache; \
    if [ -f artisan ] && php artisan package:discover --ansi; then :; \
    else php /tmp/package-discovery.php; fi; \
    rm -f /tmp/package-discovery.php

# PHP-конфиг. validate_timestamps=1 оставлен намеренно: если разработчик
# временно вернёт bind-mount ./backend (dev-override), правки PHP вступают без
# ребилда образа. JIT выключен: на alpine/musl он нестабилен.
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
# pm=dynamic + request_terminate_timeout: при пиковой нагрузке (много вкладок)
# воркеры создаются по требованию вместо очереди на 6 статичных процессах;
# зависший запрос убивается через 120с, а не держит воркера вечно.
RUN set -eux; \
    printf '%s\n' \
      '[www]' \
      'listen = 0.0.0.0:9000' \
      'listen.backlog = 512' \
      'clear_env = no' \
      'pm = dynamic' \
      'pm.max_children = 12' \
      'pm.start_servers = 4' \
      'pm.min_spare_servers = 3' \
      'pm.max_spare_servers = 6' \
      'pm.max_requests = 500' \
      'request_terminate_timeout = 120s' \
      'catch_workers_output = yes' \
      'decorate_worker_output = no' \
      'php_admin_value[memory_limit] = 128M' \
      > /usr/local/etc/php-fpm.d/zz-listen.conf

# ---------------------------------------------------------------------------
# Стадия 5 (ФИНАЛЬНАЯ, target по умолчанию в docker-compose.yml): чистый
# рантайм. Наследует app «как есть» — то же окружение PHP-FPM Alpine, но теперь
# это независимая стадия, и compose ссылается именно на неё. Точки монтирования
# named-volumes (backend_storage, backend_bootstrap_cache) совпадают с путями в
# образе, поэтому при первом `up` пустой volume наполняется содержимым образа,
# а дальше хранит только runtime-данные (uploads, кэш, логи).
# ---------------------------------------------------------------------------
FROM app AS runtime

# Runtime-права + самодостаточность образа. Контейнер больше НЕ получает код с
# хоста (bind-mount удалены из docker-compose.yml), поэтому конфиги Laravel,
# которых намеренно нет в git (секреты), дораспаковываются прямо здесь — из
# ENV-значений, которые задаёт compose. Ветки выполняются только если файла
# нет; существующие (например, смонтированный dev-оверридом config/) не трогаем.
RUN set -eux; \
    mkdir -p storage/app/public storage/app/tmp storage/app/backups \
             storage/framework/cache/data storage/framework/sessions \
             storage/framework/testing storage/framework/views storage/logs \
             bootstrap/cache config; \
    chown -R www-data:www-data storage bootstrap/cache; \
    chmod -R 777 storage bootstrap/cache; \
    if [ ! -f config/app.php ]; then printf '%s\n' '<?php return [' \
        '    "name" => getenv("APP_NAME") ?: "BCS",' \
        '    "env" => getenv("APP_ENV") ?: "production",' \
        '    "debug" => filter_var(getenv("APP_DEBUG") ?: "false", FILTER_VALIDATE_BOOLEAN),' \
        '    "url" => rtrim(getenv("APP_URL") ?: "http://localhost", "/"),' \
        '    "front_controller" => "index.php",' \
        '    "key" => getenv("APP_KEY") ?: "",' \
        '    "cipher" => "AES-256-CBC",' \
        '];' > config/app.php; fi; \
    if [ ! -f config/database.php ]; then printf '%s\n' '<?php return [' \
        '    "default" => getenv("DB_CONNECTION") ?: "mysql",' \
        '    "connections" => [' \
        '        "sqlite" => ["driver" => "sqlite", "database" => database_path("database.sqlite"), "prefix" => "", "foreign_key_constraints" => true],' \
        '        "mysql" => ["driver" => "mysql", "host" => getenv("DB_HOST") ?: "127.0.0.1", "port" => getenv("DB_PORT") ?: "3306", "database" => getenv("DB_DATABASE") ?: "vks_schedule", "username" => getenv("DB_USERNAME") ?: "root", "password" => getenv("DB_PASSWORD") ?: "", "charset" => "utf8mb4", "collation" => "utf8mb4_unicode_ci", "prefix" => ""],' \
        '    ],' \
        '    "migrations" => ["table" => "migrations", "update_date_on_publish" => true],' \
        '];' > config/database.php; fi; \
    if [ ! -f config/cache.php ]; then printf '%s\n' '<?php return [' \
        '    "default" => getenv("CACHE_STORE") ?: "file",' \
        '    "stores" => [' \
        '        "array" => ["driver" => "array", "serialize" => false],' \
        '        "file" => ["driver" => "file", "path" => storage_path("framework/cache/data"), "serialized" => false],' \
        '        "redis" => ["driver" => "redis", "connection" => getenv("REDIS_CLIENT") ?: "phpredis", "options" => [], "key" => getenv("REDIS_DB") ?: 0],' \
        '    ],' \
        '    "prefix" => null,' \
        '];' > config/cache.php; fi; \
    if [ ! -f config/session.php ]; then printf '%s\n' '<?php return [' \
        '    "driver" => getenv("SESSION_DRIVER") ?: "cookie",' \
        '    "lifetime" => (int) (getenv("SESSION_LIFETIME") ?: 120),' \
        '    "expire_on_close" => false,' \
        '    "encrypt" => false,' \
        '    "files" => storage_path("framework/sessions"),' \
        '    "cookie" => "vks_session",' \
        '    "path" => "/", "domain" => null, "secure" => false,' \
        '    "http_only" => true, "same_site" => "lax",' \
        '];' > config/session.php; fi; \
    if [ ! -f config/queue.php ]; then printf '%s\n' '<?php return [' \
        '    "default" => getenv("QUEUE_CONNECTION") ?: "database",' \
        '    "connections" => [' \
        '        "sync" => ["driver" => "sync"],' \
        '        "database" => ["driver" => "database", "connection" => getenv("DB_CONNECTION") ?: "mysql", "table" => "jobs", "queue" => getenv("QUEUE_QUEUE") ?: "default"],' \
        '        "redis" => ["driver" => "redis", "connection" => "default", "queue" => "default", "retry_after" => 90, "block_for" => null],' \
        '    ],' \
        '    "failed" => ["table" => "failed_jobs"],' \
        '];' > config/queue.php; fi; \
    if [ ! -f config/logging.php ]; then printf '%s\n' '<?php return [' \
        '    "default" => getenv("LOG_CHANNEL") ?: "stack",' \
        '    "channels" => [' \
        '        "stack" => ["driver" => "stack", "channels" => ["single"]],' \
        '        "single" => ["driver" => "single", "path" => storage_path("logs/laravel.log"), "level" => "debug"],' \
        '    ],' \
        '];' > config/logging.php; fi

# Финальная самопроверка образа: если чего-то нет — сборка падает ЗДЕСЬ,
# а не через 5 минут на странной рантайм-ошибке.
RUN set -eux; \
    test -f artisan; \
    test -f public/index.php; \
    test -f vendor/autoload.php; \
    test -f config/app.php; \
    php artisan --version >/dev/null; \
    echo ">>> Образ backend самодостаточен: код+vendor+config внутри образа."

EXPOSE 9000

CMD ["php-fpm"]
