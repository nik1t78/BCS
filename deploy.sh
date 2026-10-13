#!/bin/bash
# Деплой обновлений BCS ВКС на сервер (быстро, без даунтайма для пользователей)
set -e
cd "$(dirname "$0")"

git fetch origin main
git checkout main 2>/dev/null || git checkout -B main origin/main
git pull --ff-only origin main

# Пересобрать только фронтенд (nginx отдаёт новый dist) — бэкенд/БД не трогаем
docker compose build frontend
# Убрать контейнер ВКС-бота (не запускается по умолчанию; экономия ~1 ГБ RAM)
docker rm -f vks-bot 2>/dev/null || true
docker compose up -d frontend

# Полная чистка Docker: контейнер бота, неиспользуемые образы, кеш сборки.
# Безопасно: данные mysql (bind ./docker/mysql/data) и volume frontend_build не трогаются.
./scripts/docker-lean.sh || true

echo "Готово. Сайт обновлён: https://salutejazz.ru"
