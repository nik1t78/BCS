#!/bin/bash
# Деплой обновлений BCS ВКС на сервер (быстро, без даунтайма для пользователей)
set -e
cd "$(dirname "$0")"

git fetch origin main
git checkout main 2>/dev/null || git checkout -B main origin/main
git pull --ff-only origin main

# --- Починка .env: PowerShell (echo "..." >> .env) пишет UTF-16, из-за чего
# docker compose падает с "unexpected character \x00". Переконвертируем в UTF-8.
if command -v iconv >/dev/null 2>&1 && file .env 2>/dev/null | grep -qi 'UTF-16'; then
  echo "[deploy] .env в кодировке UTF-16 — конвертирую в UTF-8 (LF)..."
  cp .env ".env.bak.$(date +%s)"
  iconv -f UTF-16LE -t UTF-8 .env | tr -d '\r' > .env.tmp && mv .env.tmp .env
fi
# Если нули остались (гибрид UTF-8 + UTF-16LE-хвост) — чиним БЕЗ Python
# (на Windows python может быть Store-заглушкой и «молча» убивать скрипт):
# 1) powershell -File ./fix-env.ps1  (нативный способ для Windows),
# 2) фолбэк — ./fix-env.sh (bash+od+dd+iconv, работает в Git Bash и Linux).
# ВАЖНО: проверка делается через od, т.к. grep по '\x00' в Git Bash на Windows
# срабатывает ненадёжно (ложные «нули остались», хотя файл уже чистый).
has_nulls() { od -c "$1" 2>/dev/null | grep -q '\\0'; }

if has_nulls .env; then
  echo "[deploy] в .env нулевые байты (UTF-16 от PowerShell) — чищу через fix-env.ps1..."
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./fix-env.ps1 || true
  fi
fi
if has_nulls .env; then
  echo "[deploy] powershell не помог/недоступен — чищу через fix-env.sh (bash/iconv)..."
  chmod +x fix-env.sh 2>/dev/null || true
  ./fix-env.sh || true
fi
if has_nulls .env; then
  echo "[deploy] ОШИБКА: .env всё ещё содержит нулевые байты. Почините вручную:"
  echo "  в PowerShell из папки проекта:  powershell -ExecutionPolicy Bypass -File .\\fix-env.ps1"
  echo "  затем проверьте: docker compose config --quiet"
  echo "  либо скопируйте .env.example в .env и впишите свои значения (NOTEPAD, СОХРАНИТЬ КАК -> кодировка UTF-8)"
  exit 1
fi
echo "[deploy] .env чистый (UTF-8, без нулевых байтов)."

# Пересобрать только фронтенд (nginx отдаёт новый dist) — бэкенд/БД не трогаем
docker compose build frontend
# Убрать контейнер ВКС-бота (не запускается по умолчанию; экономия ~1 ГБ RAM)
docker rm -f vks-bot 2>/dev/null || true
docker compose up -d frontend

# Бэкенд: если менялся backend/ — пересобрать и ОБЯЗАТЕЛЬНО перезалить конфиг.
# После config:cache Laravel читает env() только из config/*; устаревший кеш
# с null-значениями — типичная причина «уведомления молчат».
if git diff --quiet HEAD@{1} HEAD -- backend/ 2>/dev/null; then
  echo "[deploy] backend не менялся — пересборка не требуется."
else
  echo "[deploy] изменения в backend/ — пересобираю и обновляю конфиг..."
  docker compose up -d --build backend queue scheduler
  # Статика public/ для nginx живёт в volume backend_public — обновляем её
  # из свежего образа (сервис backend-assets в docker-compose.yml).
  docker compose run --rm --no-deps backend-assets || true
fi
docker compose exec -T backend php artisan config:cache || true
docker compose exec -T backend php artisan route:cache   || true
# Пересборка статических кешей после деплоя (views/events) + перезапуск fpm,
# т.к. opcache.validate_timestamps=0 — байткод перечитывается только при старте.
docker compose exec -T backend php artisan view:cache    || true
docker compose exec -T backend php artisan event:cache   || true
docker compose restart backend                           || true
# Рабочие очередей кэшируют классы в памяти процесса — перезапускаем, чтобы
# подхватили новый код после git pull.
docker compose restart queue                             || true

# nginx читает Laravel public/ из volume backend_public (сервис backend-assets).
# Тихо перезаливаем том из образа и при «backend не менялся» тоже: гарантирует,
# что /api отдаёт свежий index.php даже после частичного деплоя.
docker compose run --rm --no-deps backend-assets >/dev/null 2>&1 || true

# Полная чистка Docker: контейнер бота, неиспользуемые образы, кеш сборки.
# Безопасно: данные mysql (bind ./docker/mysql/data) и volume frontend_build не трогаются.
./scripts/docker-lean.sh || true

echo "Готово. Сайт обновлён: https://salutejazz.ru"
