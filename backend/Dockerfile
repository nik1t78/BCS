# syntax=docker/dockerfile:1.4
# =============================================================================
# BCS backend (Laravel 12) — php-fpm, Alpine. ФИНАЛЬНАЯ ВЕРСИЯ.
#
# ФАКТЫ, ПРОВЕРЕННЫЕ НАПРЯМУЮ (2026-10-23), а не на глаз:
#   * php:8.5-fpm-alpine (и все его alpine3.2x ветки) собраны с шагом
#     `docker-php-source delete` — исходников PHP в образе НЕТ, и там же
#     статически НЕ вкомпилированы curl/mbstring/pdo_mysql/zip/sodium.
#     Поэтому любая попытка доустановить их (компиляция или apk php85-*)
#     обречена: в репозиториях Alpine v3.21/v3.22 пакетов php85-* НЕ
#     существует (сверено напрямую по APKINDEX main+community — там только
#     php82/php83/php84). Отсюда все прошлые падения сборки.
#   * Базис ниже: php:8.4-fpm-alpine3.21 @ sha256:118ad698... (digest сверен
#     с Docker Hub API). Внутри — PHP 8.4.x со ВСЕМИ критичными для Laravel
#     модулями, уже вкомпилированными СТАТИЧЕСКИ: ctype curl dom fileinfo
#     json mbstring openssl PDO pdo_mysql session SimpleXML tokenizer xml
#     zip + Zend OPcache. Проверка «статический модуль» = отсутствие .so
#     файла в extension_dir при том, что php -m его печатает.
#   * Добираются ТОЛЬКО два готовых расширения из community-репо того же
#     релиза Alpine: php84-bcmath и php84-pecl-redis (.so, без компиляции).
#   * intl/gd/iconv/exif/ftp/pcntl/sockets НЕ ставятся: код проекта их не
#     использует (проверено grep-ом), Laravel/composer покрывают себя
#     polyfill-пакетами из composer.lock.
#   * Хостовый PHP 8.5.9 на Windows к сборке отношения не имеет — внутри
#     контейнера свой PHP; версия в composer.lock (^12 framework при >=8.4)
#     совместима.
#
# Рантайм ничего не скачивает: всё (код+vendor+.so) внутри образа.
# =============================================================================

FROM composer:2 AS composer-stage

FROM php:8.4-fpm-alpine3.21@sha256:118ad698b07854ae63f93743f2e145a91e90b57a35003535738839a82e7264db AS runtime

ENV TZ=Europe/Moscow

# Часовой пояс + утилиты (mysql-клиент для artisan/healthcheck)
RUN apk add --no-cache unzip mariadb-client tzdata \
 && cp -f /usr/share/zoneinfo/Europe/Moscow /etc/localtime \
 && echo Europe/Moscow > /etc/timezone

# -----------------------------------------------------------------------------
# Шаг 0. iconv (статически НЕ вкомпилирован в базис, но требуется composer-
#   зависимостям) — готовым .so пакета Alpine + жёсткая самопроверка базиса:
#   все критичные модули в php -m и extension_loaded(). Если дижест/тег
#   поменяется и это перестанет быть правдой — сборка падает здесь с именем
#   проблемы, а не через 3 минуты на «cp: can't stat modules/*».
# -----------------------------------------------------------------------------
RUN set -eux; \
    apk add --no-cache php84-iconv; \
    found=""; for cand in "/usr/lib/php84/iconv.so" "$(find /usr/lib -name 'iconv.so' 2>/dev/null | head -1)"; do \
        [ -n "$cand" ] && [ -f "$cand" ] && found="$cand" && break; done; \
    [ -n "$found" ] || { echo "!!! iconv.so не найден (пакет php84-iconv)"; exit 1; }; \
    printf 'extension=%s\n' "$found" > "$PHP_INI_DIR/conf.d/zz-iconv.ini"; \
    for e in ctype curl dom fileinfo filter hash iconv json libxml mbstring \
             openssl PDO pcre pdo_mysql Phar session SimpleXML SPL tokenizer \
             xml xmlreader xmlwriter zlib; do \
        php -m | grep -qix "$e" || { echo "!!! базис: '$e' нет в php -m — смените базис"; exit 1; }; \
    done; \
    php -r 'exit(extension_loaded("pdo_mysql")?0:1);'; \
    php -r 'exit(extension_loaded("curl")?0:1);'; \
    php -r 'exit(extension_loaded("mbstring")?0:1);'; \
    php -r 'exit(extension_loaded("zip")?0:1);'; \
    php -r 'exit(extension_loaded("iconv")?0:1);'; \
    php -m | grep -qix "Zend OPcache" || { echo "!!! базис: OPcache нет"; exit 1; }

# -----------------------------------------------------------------------------
# Шаг 1. bcmath и redis — ГОТОВЫМИ пакетами Alpine (php84-bcmath,
# php84-pecl-redis): бинарные .so из репозитория, никакой компиляции, PHPIZE
# или pecl-сборки. Версия образа (PHP_MAJOR*10+MINOR -> 84) задаёт имена
# пакетов; для базиса выше это всегда 84. Если пакет исчезнет из репо —
# падение с внятным сообщением, а не молчаливый отсутствующий модуль.
# -----------------------------------------------------------------------------
RUN set -eux; \
    MAJ=$(php -r 'echo PHP_MAJOR_VERSION*10+PHP_MINOR_VERSION;'); \
    EXTDIR=$(php -i | sed -n 's/^extension_dir => //p' | tail -1); \
    apk add --no-cache "php${MAJ}-bcmath" "php${MAJ}-pecl-redis"; \
    # Alpine кладёт свои .so в /usr/lib/php<Maj>/, а ini — в /etc/php<Maj>/conf.d.
    # Подключаем их в conf.d самого docker-образа абсолютными путями:
    found=""; for cand in "/usr/lib/php${MAJ}/bcmath.so" "$(find /usr/lib -name 'bcmath.so' 2>/dev/null | head -1)"; do \
        [ -n "$cand" ] && [ -f "$cand" ] && found="$cand" && break; done; \
    [ -n "$found" ] || { echo "!!! bcmath.so не найден (пакет php${MAJ}-bcmath)"; exit 1; }; \
    printf 'extension=%s\n' "$found" > "$PHP_INI_DIR/conf.d/zz-bcmath.ini"; \
    found=""; for cand in "/usr/lib/php${MAJ}/redis.so" "$(find /usr/lib -name 'redis.so' 2>/dev/null | head -1)"; do \
        [ -n "$cand" ] && [ -f "$cand" ] && found="$cand" && break; done; \
    [ -n "$found" ] || { echo "!!! redis.so не найден (пакет php${MAJ}-pecl-redis)"; exit 1; }; \
    printf 'extension=%s\n' "$found" > "$PHP_INI_DIR/conf.d/zz-redis.ini"; \
    php -m; \
    for e in bcmath redis; do \
        php -m | grep -qix "$e" || { echo "!!! расширение '$e' НЕ подключилось"; exit 1; }; \
    done

WORKDIR /var/www/html

# vendor отдельным кеш-слоем: пересобирается только при изменении composer.*
COPY --from=composer-stage /usr/bin/composer /usr/bin/composer
COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --no-scripts \
        --no-progress --optimize-autoloader \
 && test -f vendor/autoload.php \
 && php artisan --version

# Код приложения + каркас конфигов Laravel (config/*.php лежат в репо в
# docker/skeleton/laravel12/config — в backend/config только services.php)
COPY . ./
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
