#!/usr/bin/env bash
# Полная «похуделка» Docker: убирает всё, что не нужно работающему сайту.
# Безопасно: НЕ трогает запущенные контейнеры и данные mysql (bind ./docker/mysql/data).
set -uo pipefail

echo "== 1. Контейнер ВКС-бота (Chromium, ~1 ГБ RAM) =="
docker rm -f vks-bot 2>/dev/null && echo "vks-bot удалён" || echo "vks-bot не запущен — ок"

echo "== 2. Остановленные контейнеры и неиспользуемые сети =="
docker container prune -f
docker network prune -f

echo "== 3. ВСЕ неиспользуемые образы (включая старый chromium-образ бота) =="
docker image prune -a -f

echo "== 4. Кеш сборки (builder cache) =="
docker builder prune -af

echo "== 5. Висячие volumes (кроме frontend_build — он нужен nginx) =="
for v in $(docker volume ls -qf dangling=true); do
  case "$v" in
    *frontend_build) continue ;;   # этот volume нужен nginx — не удаляем
  esac
  docker volume rm "$v" 2>/dev/null || true
done

echo
echo "Готово. Текущее потребление Docker:"
docker system df
