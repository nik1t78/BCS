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
# Если iconv нет/не сработало — python-фолбэк (проверен на 3 сценариях:
# гибрид UTF-8+UTF-16LE, весь файл UTF-16 с BOM, хвост после двойного \n).
if grep -q $'\x00' .env 2>/dev/null; then
  echo "[deploy] в .env есть нулевые байты (UTF-16 от PowerShell) — чищу через python..."
  python3 - <<'PY'
import re
raw = open('.env','rb').read()

def fix_env(raw):
    # 1) чистый UTF-8 без нулей
    if b'\x00' not in raw:
        return raw.decode('utf-8', 'ignore')
    # 2) граница utf8|utf16: последний \n перед серией >=4 нулей, дальше блок
    #    чётной длины декодируется как UTF-16LE без потерь (PowerShell «echo >>»
    #    дописывает именно так: UTF-8-файл + кусок UTF-16LE без BOM)
    for mm in re.finditer(rb'\x00{4,}', raw):
        nl = raw.rfind(b'\n', 0, mm.start())
        if nl == -1 or (len(raw) - (nl + 1)) % 2:
            continue
        try:
            s = raw[nl+1:].decode('utf-16le')
            if '\x00' not in s and sum(1 for c in s if ord(c) < 9 or ord(c) in (11,12)) <= 2:
                return raw[:nl+1].decode('utf-8', 'ignore') + s
        except Exception:
            pass
    # 3) весь файл UTF-16 (с BOM или без)
    for enc in ('utf-16', 'utf-16le'):
        try:
            s = raw.decode(enc)
            if '\x00' not in s and any(k in s for k in ('VITE_', 'APP_', 'DB_')):
                return s
        except Exception:
            pass
    # 4) крайний случай: просто выбросить нули
    return raw.replace(b'\x00', b'').decode('utf-8', 'ignore')

txt = fix_env(raw)
txt = txt.replace('\ufeff','').replace('\x00','').replace('\r\n','\n').replace('\r','\n')
open('.env','w',encoding='utf-8',newline='\n').write(txt.strip()+'\n')
print('[deploy] .env пересохранён в UTF-8 (LF)')
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
