#!/bin/bash
# Полный запуск проекта BCS ВКС (Docker)
# Использование:  ./start.sh          — обычный запуск
#                 ./start.sh --clean  — принудительная пересборка образов (после изменения Dockerfile)
set -e
cd "$(dirname "$0")"

# 1. Свежий код с GitHub
git pull origin main

# 2. .env: если нет — создаём из образца и генерируем APP_KEY
if [ ! -f .env ]; then
  cp .env.example .env
  echo "[start] Создан .env из .env.example"
fi
if ! grep -qE '^APP_KEY=base64:.+' .env; then
  KEY="base64:$(head -c 32 /dev/urandom | base64)"
  if sed -i "s|^APP_KEY=.*|APP_KEY=$KEY|" .env 2>/dev/null; then :; else
    sed -i '' "s|^APP_KEY=.*|APP_KEY=$KEY|" .env   # macOS
  fi
  echo "[start] Сгенерирован APP_KEY в .env"
fi

# 3. Сборка и запуск контейнеров (--clean для пересборки без кеша)
if [ "$1" = "--clean" ]; then
  docker compose build --no-cache backend frontend
fi
docker compose up -d --build

# 4. Ждём готовности MySQL, затем миграции БД
echo "[start] Ожидаю готовности MySQL..."
for i in $(seq 1 60); do
  if docker exec vks-backend php artisan migrate --force >/dev/null 2>&1; then
    echo "[start] Миграции выполнены."
    break
  fi
  sleep 3
done

# 5. Кеши Laravel (config/route/view) — быстрее работает бэкенд
docker exec vks-backend php artisan config:cache || true
docker exec vks-backend php artisan route:cache || true
docker exec vks-backend php artisan view:cache || true

echo ""
echo "Готово ✅  Сайт: http://localhost  (или http://10.48.4.235 / https://salutejazz.ru)"
