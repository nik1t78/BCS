#!/usr/bin/env bash
# Автоматическая чистка Docker: старые образы, volumes, кеш сборки.
# Безопасно для BCS: НЕ трогает запущенные контейнеры и данные mysql (bind ./docker/mysql/data).
set -euo pipefail
docker container prune -f
docker image prune -f
docker network prune -f
docker builder prune -f --keep-storage 2GB
echo "Готово. Текущее потребление:"
docker system df
