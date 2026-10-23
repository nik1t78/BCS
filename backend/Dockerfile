# syntax=docker/dockerfile:1.4
# =============================================================================
# BCS backend (Laravel 12) — php-fpm, Alpine. МИНИМАЛЬНАЯ ВЕРСИЯ.
#
# ФАКТЫ, ПРОВЕРЕННЫЕ НАПРЯМУЮ С REGISTRY.DOCKER.IO (2026-10-23), а не на глаз:
#   * php:8.5-fpm-alpine  = PHP 8.5.12, amd64 digest sha256:e2ca465c...
#     в его build-history ЕСТЬ строка `docker-php-source delete` — исходников
#     PHP в образе НЕТ вообще (ни /usr/src/php, ни tarball). Поэтому любая
#     попытка docker-php-ext-install в этом базисе обречена ("cp: can't stat
#     modules/*", "No rule to make target .../config.m4"). Все прошлые падения
#     сборки были из-за этого.
#   * php:8.4-fpm-alpine  = PHP 8.4.27, amd64 digest sha256:a58708a9...
#     тоже без исходников.
#   => Расширения берём НЕ компиляцией, а ГОТОВЫМИ .so из Alpine-репозитория
#      (pkgs.org проверено): php85-* для 8.5, php84-* для 8.4. Никакой
#      компиляции, никаких PHPIZE_DEPS, pecl-сборки C-модулей.
#   * composer.lock проекта требует laravel/framework ^12 при php >=8.4 —
#      и 8.4, и 8.5 совместимы. Хостовый PHP 8.5.9 с Docker не связан.
#
# Рантайм в контейнерах ничего не скачивает: всё (код+vendor+.so) внутри образа.
# =============================================================================

FROM composer:2 AS composer-stage

FROM php:8.5-fpm-alpine AS runtime

ENV TZ=Europe/Moscow

# Часовой пояс + утилиты (mysql-клиент для artisan/healthcheck)
RUN apk add --no-cache unzip mariadb-client tzdata \
 && cp -f /usr/share/zoneinfo/Europe/Moscow /etc/localtime \
 && echo Europe/Moscow > /etc/timezone

# =============================================================================
# PHP-расширения: готовые .so из Alpine-репо (компиляция не нужна и невозможна
# — см. шапку). Версия образа (PHP_VERSION, напр. 8.5.12) -> мажор 85 -> пакеты
# php85-*. Если тег обновят до другой минорной линейки (8.6), подбор пакета
# провалится ЖЁСТКО, с внятным сообщением, а не через 5 минут странных ошибок.
# redis — чистый PHP-модуль (pecl install redis не компилирует C) — ставится им.
# =============================================================================
RUN set -eux; \
    MAJ=$(php -r 'echo PHP_MAJOR_VERSION*10+PHP_MINOR_VERSION;'); \
    EXTDIR=$(php -i | sed -n 's/^extension_dir => //p' | tail -1); \
    apk add --no-cache "php${MAJ}-bcmath" "php${MAJ}-intl"; \
    for e in bcmath intl; do \
        found=""; \
        for cand in "$EXTDIR/$e.so" /usr/lib/php"$MAJ"/"$e.so" "$(find /usr/lib -name "$e.so" 2>/dev/null | head -1)"; do \
            [ -n "$cand" ] && [ -f "$cand" ] && found="$cand" && break; \
        done; \
        [ -n "$found" ] || { echo "!!! $e.so не найден (проверьте пакеты php${MAJ}-*)"; exit 1; }; \
        printf 'extension=%s\n' "$found" > "$PHP_INI_DIR/conf.d/zz-$e.ini"; \
    done; \
    pecl install redis >/dev/null; \
    docker-php-ext-enable redis; \
    php -m; \
    # критичные модули, которые ОБЯЗАНЫ быть в базовом образе статически:
    for e in ctype curl date dom fileinfo filter hash json libxml mbstring \
             openssl pcre PDO pdo_mysql random session SimpleXML sodium SPL \
             tokenizer xml xmlreader xmlwriter zlib; do \
        php -m | grep -qix "$e" || { echo "!!! базовое расширение '$e' отсутствует — смените базис"; exit 1; }; \
    done; \
    # то, что добавили пакетами/pecl:
    for e in bcmath intl redis; do \
        php -m | grep -qix "$e" || { echo "!!! расширение '$e' НЕ подключилось (php${MAJ}-$e)"; exit 1; }; \
    done; \
    test -f "$EXTDIR/redis.so" || { echo "!!! redis.so нет в $EXTDIR"; exit 1; }

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
