#!/bin/sh
set -eu

APP_DIR=/var/www/html
cd "$APP_DIR"

# Named Docker volumes can outlive the image. Recreate writable Laravel paths
# on every container start so stale/empty volumes cannot break file cache,
# sessions, logs or compiled views (fopen: No such file or directory).
mkdir -p \
  storage/framework/cache/data \
  storage/framework/sessions \
  storage/framework/views \
  storage/logs \
  storage/app/heartbeat \
  storage/app/public \
  storage/app/private \
  bootstrap/cache

chown -R www-data:www-data \
  storage/framework \
  storage/logs \
  storage/app/heartbeat \
  storage/app/public \
  storage/app/private \
  bootstrap/cache
chmod -R ug+rwX \
  storage/framework \
  storage/logs \
  storage/app/heartbeat \
  storage/app/public \
  storage/app/private \
  bootstrap/cache

# queue/scheduler run as www-data to keep shared cache/log files writable
# by php-fpm. php-fpm itself must start as root and drops privileges per pool.
if [ "${BCS_RUN_AS_WWW_DATA:-0}" = "1" ]; then
  exec su-exec www-data "$@"
fi

exec "$@"
