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
#  8) ПАДЕНИЕ ПОСЛЕДНЕЙ СБОРКИ (из-за него слой расширений переписан):
#     предыдущая версия доставала недостающие расширения каскадом
#     apk -> /usr/src/php -> tarball php.net прямо поверх php:8.4-fpm-alpine.
#     В свежих тегах этого образа (alpine 3.22+, пересборка осени 2026)
#     docker-library сильно урезал поставку: из /usr/src/php/ext вырезаны
#     исходники части расширений (tokenizer — без Zend/zend_language_parser.y,
#     bcmath, ctype, ftp, opcache, pcntl, pdo_mysql...), а часть модулей удалена
#     из самой сборки PHP. Каскад падал НЕ на имени расширения, а на общих
#     строках ("Usage: apk", "ERROR: Unable to find phpize"), и единственный
#     exit 1 в конце слоя не объяснял причину. Чинить компиляцию на месте
#     бессмысленно — она зависит от того, что именно очередная пересборка
#     официального образа вырезала.
#     РЕШЕНИЕ: никакой компиляции типовых расширений в Dockerfile больше нет.
#     Базис — официальный LTS-образ Symfony (Symfony Runtime поддерживает его
#     до 2029 года): symfony/php8.4-cli-alpine содержит PHP 8.4, в сборку
#     которого УЖЕ включены все типовые расширения (bcmath ctype curl dom exif
#     fileinfo ftp gd iconv intl mbstring opcache openssl pcntl PDO pdo_mysql
#     session simplexml sodium tokenizer xml xmlreader xmlwriter zip), и они
#     стабильно печатаются в php -m. Дополнительно из тех же apk-репозиториев
#     Alpine ставятся php-dev (phpize/php-config — нужны только для redis) и
#     php-fpm — демон использует ТОТ ЖЕ набор расширений, что и CLI.
#     Единственный модуль без аналога «из коробки» — redis: он ставится
#     отдельным слоем с перебором источников (apk -> pecl -> tarball) и жёсткой
#     проверкой. Если тег symfony/* когда-нибудь станет недоступен — править
#     нужно только строку FROM base ниже.
# =============================================================================

# ---------------------------------------------------------------------------
# Стадия 1: официальный образ Composer. Бинарник попадает в итоговый образ
# детерминированно (через слой BuildKit), без зависимости от контекста/сети.
# ---------------------------------------------------------------------------
FROM composer:2 AS composer-stage

# Стадия 2: базис — PHP 8.4 (Alpine) с полным набором расширений из коробки.
# Используется как основа для стадий vendor-build/app; саму её compose больше
# не собирает — target: runtime (финальная стадия ниже), чтобы приложение
# целиком жило в образе (см. "боль 7" в шапке).
# ВАЖНО: расширения берутся ИМЕННО отсюда; в php:8.4-fpm-alpine (осень 2026)
# их вырезали, и компиляция на месте оказалась недетерминированной (см. "боль 8").
FROM symfony/php8.4-cli-alpine AS base

# Системные пакеты + php-dev + php-fpm одним слоем. Компиляции расширений здесь
# НЕТ (см. "боль 8"): типовые модули уже включены в PHP базиса, а php-fpm и
# php-dev ставятся apk-пакетами Alpine той же серии, что и сам интерпретатор.
#   mariadb-client (mysqldump) — нужен `php artisan db:backup`;
#   redis — обязателен: CACHE_STORE/QUEUE_CONNECTION=redis в .env, predis в
#   composer.json нет, без расширения падают throttle, SSE и планировщик
#   (ставится следующим слоем).
# Список проверяемых модулей ниже = union требований composer.lock (ext-curl,
# ext-intl, ext-dom, ext-libxml, ext-fileinfo, ext-tokenizer, ext-session,
# ext-ctype, ext-bcmath, ext-mbstring, ext-openssl, ext-zip, ext-gd ...) и кода
# приложения. Каждое расширение проверяется явно через php -m: если чего-то нет
# — сборка падает СРАЗУ с именем расширения.
# ВАЖНО: в списке НЕТ standalone "libxml" и "iconv" — это не отдельные модули:
# libxml встроен в ext-dom/ext-simplexml/ext-xml, xmlreader/xmlwriter собираются
# вместе с ext-xml, а на musl-alpine iconv встроен в ядро PHP и php -m его не
# печатает. Попытка ставить/собирать их отдельными аргументами раньше обрывала
# сборку ("cannot find /usr/local/include/libxml" / "_libiconv_version
# undeclared"). То же касается проверочного цикла: php -m никогда не печатает
# "libxml".
# ВАЖНО (грабли предыдущих сборок): НЕ ставьте standalone libiconv/libiconv-dev!
# В php-образах на musl-alpine PHP уже собран против системного iconv из libc,
# а libiconv-dev перекрывает /usr/include/iconv.h своим заголовком и сборка
# ext-iconv/intl падает с "'_libiconv_version' undeclared". Здесь их и нет.
RUN set -eux; \
    apk add --no-cache git unzip tzdata mariadb-client; \
    cp -f /usr/share/zoneinfo/Europe/Moscow /etc/localtime; \
    echo Europe/Moscow > /etc/timezone; \
    # Определяем РЕАЛЬНУЮ apk-серию пакетов PHP базиса: это та серия, чей meta-
    # пакет установлен (в symfony/php8.4-cli-alpine это php85-*, т.к. в Alpine
    # 3.22/edge PHP 8.4 собирается из пакетов php85). Перебираем каталоги
    # /etc/phpNN и берём тот, где лежит php.conf работающего интерпретатора.
    SERIES=""; \
    for d in $(ls -d /etc/php[0-9][0-9] 2>/dev/null | sort -r); do S2="$(basename "$d" | sed 's/php//')"; if [ -f "/etc/php$S2/conf.d/php.conf" ] || ls /etc/apk/available/ 2>/dev/null | grep -qx "php$S2"; then SERIES="$S2"; break; fi; done; \
    test -n "$SERIES" || { echo "ERROR: не определена apk-серия PHP базиса (каталога /etc/phpNN нет) — проверьте FROM base"; exit 1; }; \
    echo ">>> Apk-серия PHP базиса: php$SERIES ($(php -v | head -1))"; \
    # Совпадение ABI гарантируем ПРОВЕРКОЙ, а не угадыванием: после установки
    # пакета расширяния должен грузиться текущим интерпретатором. Если не
    # грузится (другая серия пакетов) — пакет снимаем и полагаемся на то, что
    # модуль уже встроен в PHP базиса (в symfony/*-alpine он встроен).
    EXT_PKGS_OK=""; \
    for e in bcmath ctype curl dom exif fileinfo ftp gd intl mbstring opcache openssl pcntl pdo pdo_mysql session simplexml sodium tokenizer xml zip; do \
        P="php$SERIES-$e"; \
        if ls /etc/apk/available/ 2>/dev/null | grep -qx "$P"; then \
            if apk add --no-cache "$P" >/dev/null 2>&1 && php -d extension="$e" -m >/dev/null 2>&1; then \
                EXT_PKGS_OK="$EXT_PKGS_OK $P"; \
            else \
                echo "APK: $P не подошёл по ABI или не поставился — оставляю встроенный в базис модуль"; \
                apk fix >/dev/null 2>&1 || true; \
            fi; \
        else echo "APK: пакета $P нет в репозитории — полагаемся на встроенный модуль"; fi; \
    done; \
    echo ">>> Пакеты расширений, подошедшие по ABI:$EXT_PKGS_OK"; \
    apk add --no-cache "php$SERIES-dev" "php$SERIES-fpm"; \
    command -v php-fpm >/dev/null 2>&1 || { F="$(find /usr/sbin /usr/bin -name "php-fpm*" 2>/dev/null | head -1)"; test -n "$F" || { echo "ERROR: php-fpm не найден после установки php$SERIES-fpm"; exit 1; }; ln -sf "$F" /usr/local/bin/php-fpm; }; \
    command -v php-fpm >/dev/null || { echo "ERROR: нет команды php-fpm"; exit 1; }; \
    php -v | head -1; \
    echo ">>> Базис готов: PHP + полный набор расширений, php-fpm на месте."

# Redis обязателен: CACHE_STORE/QUEUE_CONNECTION=redis в .env, predis в
# composer.json нет — без расширения падают throttle, SSE и планировщик.
# pecl.php.net часто недоступен (в логах сервера: "Failed to connect to
# pecl.php.net:443", exit 7) — поэтому источник перебирается: apk-пакет ->
# pecl -> GitHub (codeload) -> gitee-зеркало. Первая успешная установка
# прерывает цикл; в конце — жёсткая проверка php -m. Никакого COPY *.tgz из
# контекста сборки (см. боль 1 в шапке).
RUN set -eux; \
    if php -m | grep -qix redis; then echo "redis уже есть в базисе"; exit 0; fi; \
    PV="$(php -r 'echo PHP_MAJOR_VERSION.PHP_MINOR_VERSION;')"; \
    RPKG=""; for s in "$PV" 84 83; do P="$(ls /etc/apk/available/ 2>/dev/null | grep -x "php$s-redis" | head -1)"; [ -n "$P" ] && RPKG="$P" && break; done; \
    if [ -n "$RPKG" ]; then echo "APK: ставлю redis из пакета $RPKG (быстрее и без компиляции)"; apk add --no-cache "$RPKG" || true; fi; \
    if ! php -m | grep -qix redis; then \
        { pecl channel-update pecl.php.net && pecl install redis; } || true; \
    fi; \
    if ! php -m | grep -qix redis; then \
        mkdir -p /tmp/redisbuild; cd /tmp/redisbuild; \
        for url in "https://pecl.php.net/get/redis-6.3.0.tgz" "https://github.com/phpredis/phpredis/archive/refs/tags/6.3.0.tar.gz" "https://gitee.com/mirrors/phpredis/repository/archive/6.3.0.tar.gz"; do \
            echo "Пробую скачать redis с $url"; \
            if timeout 180 curl -fsSL --connect-timeout 15 --retry 2 --retry-delay 3 "$url" -o redis-src; then echo "Загрузка OK с $url"; break; fi; \
        done; \
        test -s redis-src || { echo "ERROR: не удалось скачать исходники phpredis ни с одного зеркала (apk/pecl/GitHub/gitee) — проверьте сеть/DNS контейнера сборки"; exit 1; }; \
        tar xf redis-src 2>/dev/null || { mv redis-src redis-src.tgz; tar xf redis-src.tgz; }; \
        SRC_DIR="$(find . -maxdepth 1 -type d \( -name 'redis-*' -o -name 'phpredis-*' \) | head -1)"; \
        test -d "$SRC_DIR" || { echo "ERROR: в архиве не найдена директория исходников redis"; exit 1; }; \
        cd "$SRC_DIR"; \
        phpize && ./configure && make -j"$(nproc)" && make install; \
        INIDIR=""; for d in /usr/local/etc/php/conf.d /etc/php*/conf.d; do [ -d "$d" ] && INIDIR="$d" && break; done; \
        printf '%s\n' 'extension=redis.so' > "${INIDIR:-/usr/local/etc/php/conf.d}/docker-ext-redis.ini"; \
        cd /; rm -rf /tmp/redisbuild; \
    fi; \
    php -m | grep -qix redis || { echo "ERROR: redis не установлен ни apk-пакетом, ни pecl, ни из tarball — проверьте лог выше"; exit 1; }

# Финальная проверка базы. КРИТИЧНЫЕ для Laravel/composer модули — отсутствие
# любого из них роняет сборку здесь (с именем модуля), а не через 5 минут в
# рантайме. Не-критичные (exif/ftp/phar/simplexml и т.п.) — только
# предупреждение: проект работает и без них (Laravel прикрывает polyfill/
# own-реализациями).
RUN set -eux; \
    # iconv не проверяем даже warning'ом: на musl-alpine он встроен в ядро PHP
    # и php -m его никогда не печатает — отсутствие в списке модулей норма.
    for ext in bcmath ctype curl dom fileinfo gd intl mbstring openssl PDO pdo_mysql redis session tokenizer xml zip; do php -m | grep -qx "$ext" || { echo "!!! КРИТИЧНОЕ PHP-расширение '$ext' НЕ установлено"; exit 1; }; done; \
    for ext in exif ftp json opcache pcntl phar simplexml sodium xmlreader xmlwriter; do php -m | grep -qx "$ext" || echo "WARNING: необязательное расширение '$ext' отсутствует (Laravel прикроет symfony/polyfill) — продолжаем"; done; \
    php -v | head -1; \
    echo ">>> Все критичные расширения PHP на месте."

RUN set -eux; \
    id www-data >/dev/null 2>&1 || adduser -D -u 82 www-data 2>/dev/null || adduser -D www-data; \
    getent group www-data >/dev/null 2>&1 || addgroup -S www-data 2>/dev/null || true

# Composer и его обязательные расширения (json, mbstring, openssl) должны быть
# ДО стадии vendor-build — иначе `composer install` падает с "Requires extension
# ... not installed". Стадия ниже наследует base (со ВСЕМИ расширениями), так что
# порядок слоёв здесь критичен: не переносите vendor-build выше этих RUN.

# Стадия 2b: каркас config/ из КОРНЯ репозитория (docker/skeleton/laravel12).
# Контекст сборки backend = ./backend, а выходить из контекста вверх Docker не
# умеет — поэтому compose (build.additional_contexts) передаёт корень репо
# именованным контекстом `repo`, и эта стадия забирает оттуда каркас.
# ВАЖНО про .dockerignore в КОРНЕ репо: он фильтрует контекст `repo` и уже
# содержит точечные инверсии `!docker/skeleton/laravel12/config/*.php` (иначе
# COPY молча копирует НОЛЬ файлов и сборка падает на проверке config/app.php).
# Копится ДИРЕКТОРИЯ целиком (а не поимённый список файлов): при glob-источнике
# Docker не требует наличия каждого файла, поэтому отсутствие отдельного конфига
# в скелетоне НЕ ломает сборку (раньше поимённый COPY logging.php падал с
# "failed to compute cache key ... not found", если файл не был скачан/залит).
# Недостающие конфиги app-стадия догенерирует из ENV (см. блок
# "Каркас config/*.php" в стадии app).
# Если кто-то запускает `docker build` без compose (именованного контекста нет),
# стадия остаётся пустой — app-стадия это терпит. Легальный способ собрать
# стадии base/vendor-build/app напрямую:
#   docker build --target app -t vks-backend-app ./backend
FROM scratch AS skeleton-stage
COPY --from=repo docker/skeleton/laravel12/config/ /skeleton/

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
    # Сеть на сервере сборки нестабильна (в логах: "Failed to connect to
    # pecl.php.net", таймауты зеркала GitHub) — composer гоняем с ретраями и
    # запасным зеркалом packagist, если основной недоступен.
    ok=""; \
    for i in 1 2 3; do \
        if COMPOSER_MAX_PARALLEL_HTTP=4 composer install \
            --no-dev --prefer-dist --no-interaction --no-scripts --no-progress \
            --no-ansi --working-dir=/opt/build; then ok=1; break; fi; \
        echo "WARNING: composer install, попытка $i не удалась — повторяю через 10с"; sleep 10; \
    done; \
    if [ -z "$ok" ]; then \
        composer config -g repos.packagist composer https://mirrors.aliyun.com/composer/ || true; \
        composer install \
            --no-dev --prefer-dist --no-interaction --no-scripts --no-progress \
            --no-ansi --working-dir=/opt/build; \
    fi; \
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

# Каркас config/*.php. В git намеренно нет backend/config/* (секреты), а каркас
# лежит в КОРНЕ репозитория docker/skeleton/laravel12/config/ — но контекст
# сборки = ./backend, и Docker НЕ умеет выходить из контекста вверх
# (`COPY ../docker/...` -> "failed to prepare extraction layer ... path ...
# is outside the build context"). Поэтому каркас копится ПОСЛЕДОВАТЕЛЬНО из
# трёх источников: (1) docker/skeleton внутри контекста (для тех, кто положил
# его в backend/ руками или скриптом), (2) /tmp/skeleton-stage — отдельная
# стадия skeleton-build, ей контекстом указан корень репо (см.
# docker-compose.yml: build.additional_contexts + --from=skeleton-stage),
# (3) если файлов нет вообще (сборка `docker build` без compose) — генерируем
# минимальный набор конфигов из ENV прямо здесь (тот же код, что в стадии
# runtime). Существующие config/*.php НЕ перезаписываем — вручную заполненный
# на сервере config/ не трогаем.
# Отсутствие каркаса (например, `docker build` без compose) не ломает сборку:
# если /tmp/skeleton-stage пуст, недостающие конфиги генерируются из ENV
# ветками "if [ ! -f config/... ]" в этом же RUN ниже.
COPY --from=skeleton-stage /skeleton/ /tmp/skeleton-stage/
RUN set -eux; \
    mkdir -p config; \
    for SRC in "docker/skeleton/laravel12/config" "/tmp/skeleton-stage"; do \
        if [ -d "$SRC" ]; then \
            for f in "$SRC"/*.php; do \
                [ -e "$f" ] || continue; \
                T="config/$(basename "$f")"; \
                [ -f "$T" ] || cp -a "$f" "$T"; \
            done; \
        fi; \
    done; \
    rm -rf /tmp/skeleton-stage docker/skeleton; \
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
        '        "mysql" => ["driver" => "mysql", "host" => getenv("DB_HOST") ?: "127.0.0.1", "port" => getenv("DB_PORT") ?: "3306", "database" => getenv("DB_DATABASE") ?: "vks_schedule", "username" => getenv("DB_USERNAME") ?: "root", "password" => getenv("DB_PASSWORD") ?: "", "charset" => "utf8mb4", "collation" => "utf8mb4_unicode_ci", "prefix" => ""]' \
        '    ],' \
        '    "migrations" => ["table" => "migrations", "update_date_on_publish" => true],' \
        '];' > config/database.php; fi; \
    if [ ! -f config/cache.php ]; then printf '%s\n' '<?php return [' \
        '    "default" => getenv("CACHE_STORE") ?: "file",' \
        '    "stores" => [' \
        '        "array" => ["driver" => "array", "serialize" => false],' \
        '        "file" => ["driver" => "file", "path" => storage_path("framework/cache/data"), "serialized" => false],' \
        '        "redis" => ["driver" => "redis", "connection" => getenv("REDIS_CLIENT") ?: "phpredis", "options" => [], "key" => getenv("REDIS_DB") ?: 0]' \
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
        '        "redis" => ["driver" => "redis", "connection" => "default", "queue" => "default", "retry_after" => 90, "block_for" => null]' \
        '    ],' \
        '    "failed" => ["table" => "failed_jobs"],' \
        '];' > config/queue.php; fi; \
    if [ ! -f config/logging.php ]; then printf '%s\n' '<?php return [' \
        '    "default" => getenv("LOG_CHANNEL") ?: "stack",' \
        '    "channels" => [' \
        '        "stack" => ["driver" => "stack", "channels" => ["single"]],' \
        '        "single" => ["driver" => "single", "path" => storage_path("logs/laravel.log"), "level" => "debug"],' \
        '    ],' \
        '];' > config/logging.php; fi; \
    test -f config/app.php || { echo '!!! config/app.php так и не появился'; exit 1; }; \
    for F in config/*.php; do php -l "$F" >/dev/null || { echo "!!! синтаксис $F"; php -l "$F"; exit 1; }; done; \
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
# ВАЖНО: пути к php.ini/conf.d берём НЕ из PHP_INI_DIR (это переменная базовых
# образов docker-library; в symfony/*-alpine её может не быть, а конфиги лежат
# в /etc/php*/). Каталог доп. ini определяем по `php --ini` — именно его
# сканирует и CLI, и fpm того же apk-пакета.
RUN set -eux; \
    CONFDIR=""; for d in /usr/local/etc/php/conf.d /etc/php*/conf.d; do [ -d "$d" ] && CONFDIR="$d" && break; done; \
    test -n "$CONFDIR" || { echo "ERROR: не найден каталог conf.d для php-конфигов"; exit 1; }; \
    echo ">>> conf.d: $CONFDIR"; \
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
      > "$CONFDIR/zz-app.ini"

# Пользователь www-data: в базисе symfony его может не быть (там root), а
# пул php-fpm, COPY --chown=www-data:www-data на стадии app и права на
# storage/bootstrap/cache рассчитаны на www-data — создаём ДО стадий,
# которые на него ссылляются (идемпотентно).
# php-fpm слушает TCP 0.0.0.0:9000 (иначе nginx даёт 502 Connection refused —
# docker/nginx/default.conf использует fastcgi_pass backend:9000).
# pm=dynamic + request_terminate_timeout: при пиковой нагрузке (много вкладок)
# воркеры создаются по требованию вместо очереди на 6 статичных процессах;
# зависший запрос убивается через 120с, а не держит воркера вечно.
# ВАЖНО: каталог пулов берём НЕ из /usr/local/etc/php-fpm.d (путь образов
# docker-library): у apk-пакета php*-fpm он свой (/etc/php*/ ... /php-fpm.d или
# /fpm/pool.d). Ищем первый существующий; дефолтный пул, слушающий unix-сокет,
# отключаем, чтобы он не конфликтовал с zz-listen.conf.
RUN set -eux; \
    POOL=""; \
    for d in /usr/local/etc/php-fpm.d /etc/php*/php-fpm.d /etc/php*/fpm/pool.d; do [ -d "$d" ] && POOL="$d" && break; done; \
    [ -n "$POOL" ] || { mkdir -p /usr/local/etc/php-fpm.d; POOL=/usr/local/etc/php-fpm.d; }; \
    echo ">>> каталог пулов php-fpm: $POOL"; \
    printf '%s\n' \
      '[www]' \
      'user = www-data' \
      'group = www-data' \
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
      > "$POOL/zz-listen.conf"; \
    # Глушим штатный www.conf того же пула: он объявляет [www] повторно и/или
    # слушает unix-сокет — два одинаковых секции php-fpm не переживает.
    if [ -f "$POOL/www.conf" ]; then mv "$POOL/www.conf" "$POOL/www.conf.disabled"; fi; \
    echo ">>> zz-listen.conf готов (listen 0.0.0.0:9000)"

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
# хоста (bind-mount удалены из docker-compose.yml), поэтому весь каркас
# config/ должен быть готов на стадии app (блок "Каркас config/*.php") — там же
# он генерируется из ENV, если каркаса в контексте нет. Здесь только права:
# config/ в образе принадлежит root и рантайму доступен на чтение.
RUN set -eux; \
    mkdir -p storage/app/public storage/app/tmp storage/app/backups \
             storage/framework/cache/data storage/framework/sessions \
             storage/framework/testing storage/framework/views storage/logs \
             bootstrap/cache config; \
    chown -R www-data:www-data storage bootstrap/cache; \
    chmod -R 777 storage bootstrap/cache; \
    test -f config/app.php || { echo '!!! config/app.php отсутствует в образе — сломана стадия app'; exit 1; }

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
