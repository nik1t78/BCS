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
# Если iconv нет/не сработало — python-фолбэк (читает UTF-16 по BOM, пишет UTF-8)
if grep -q $'\x00' .env 2>/dev/null; then
  echo "[deploy] в .env остались нулевые байты — чищу через python..."
  python3 - <<'PY'
raw = open('.env','rb').read()
try:
    txt = raw.decode('utf-16')          # если весь файл UTF-16 (с BOM или без)
except Exception:
    txt = raw.decode('utf-8', 'ignore') # иначе просто вырезаем мусор
txt = txt.replace('\x00','').replace('\r\n','\n')
open('.env','w',encoding='utf-8',newline='\n').write(txt if txt.endswith('\n') else txt+'\n')
PY
fi
grep -q $'\x00' .env 2>/dev/null && { echo "[deploy] ОШИБКА: .env всё ещё битый — почините вручную"; exit 1; } || true

# Пересобрать только фронтенд (nginx отдаёт новый dist) — бэкенд/БД не трогаем
docker compose build frontend
# Убрать контейнер ВКС-бота (не запускается по умолчанию; экономия ~1 ГБ RAM)
docker rm -f vks-bot 2>/dev/null || true
docker compose up -d frontend

# Полная чистка Docker: контейнер бота, неиспользуемые образы, кеш сборки.
# Безопасно: данные mysql (bind ./docker/mysql/data) и volume frontend_build не трогаются.
./scripts/docker-lean.sh || true

echo "Готово. Сайт обновлён: https://salutejazz.ru"
