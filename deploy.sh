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
# 2) fолбэк — ./fix-env.sh (bash+od+dd+iconv, работает в Git Bash и Linux).
if grep -q $'\x00' .env 2>/dev/null; then
  echo "[deploy] в .env нулевые байты (UTF-16 от PowerShell) — чищу через fix-env.ps1..."
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./fix-env.ps1 || true
  fi
fi
if grep -q $'\x00' .env 2>/dev/null; then
  echo "[deploy]powershell не помог/недоступен — чищу через fix-env.sh (bash/iconv)..."
  chmod +x fix-env.sh 2>/dev/null || true
  ./fix-env.sh || true
fi
if grep -q $'\x00' .env 2>/dev/null; then
  echo "[deploy] ОШИБКА: .env всё ещё битый. Почините вручную:"
  echo "  в PowerShell:  powershell -ExecutionPolicy Bypass -File .\\fix-env.ps1"
  echo "  либо скопируйте .env.example в .env и впишите свои значения (NOTEPAD, СОХРАНИТЬ КАК -> кодировка UTF-8)"
  exit 1
fi

# Пересобрать только фронтенд (nginx отдаёт новый dist) — бэкенд/БД не трогаем
docker compose build frontend
# Убрать контейнер ВКС-бота (не запускается по умолчанию; экономия ~1 ГБ RAM)
docker rm -f vks-bot 2>/dev/null || true
docker compose up -d frontend

# Полная чистка Docker: контейнер бота, неиспользуемые образы, кеш сборки.
# Безопасно: данные mysql (bind ./docker/mysql/data) и volume frontend_build не трогаются.
./scripts/docker-lean.sh || true

echo "Готово. Сайт обновлён: https://salutejazz.ru"
