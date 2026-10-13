#!/usr/bin/env bash
# Подготовка проекта к запуску через Docker (Linux/macOS/WSL).
# Аналог setup-project.ps1: восстанавливает каркас Laravel в backend/,
# создаёт .env-файлы и генерирует APP_KEY.
#
# Запуск из папки проекта:   bash ./setup-project.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
SKELETON="$ROOT/docker/skeleton/laravel12"
FORCE_ENV=0
[ "${1:-}" = "--force-env" ] && FORCE_ENV=1

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
ok()   { printf '    \033[0;32m%s\033[0m\n' "$1"; }
skip() { printf '    \033[0;90m%s\033[0m\n' "$1"; }

[ -d "$BACKEND" ]  || { echo "Не найден каталог $BACKEND" >&2; exit 1; }
[ -d "$SKELETON" ] || { echo "Не найден каркас $SKELETON" >&2; exit 1; }

if docker version >/dev/null 2>&1; then ok "Docker отвечает"; else
  echo "    ВНИМАНИЕ: docker недоступен — запустите Docker Desktop/демон и повторите." >&2
fi

# 1. config/ ---------------------------------------------------------------
step "Файлы конфигурации Laravel (backend/config)"
mkdir -p "$BACKEND/config"
for f in "$SKELETON"/config/*.php; do
  target="$BACKEND/config/$(basename "$f")"
  if [ -f "$target" ] && [ "$FORCE_ENV" -eq 0 ]; then
    skip "$(basename "$f") — уже есть, не трогаем"
  else
    cp "$f" "$target"; ok "$(basename "$f") — скопирован из каркаса"
  fi
done

# 1b. отсутствующие миграции каркаса (queue/cache) -------------------------
step "Миграции Laravel (backend/database/migrations)"
mkdir -p "$BACKEND/database/migrations"
for f in "$SKELETON"/database/migrations/*.php; do
  [ -e "$f" ] || continue
  target="$BACKEND/database/migrations/$(basename "$f")"
  if [ -f "$target" ]; then
    skip "$(basename "$f") — уже есть"
  else
    cp "$f" "$target"; ok "$(basename "$f") — скопирована из каркаса"
  fi
done

# 2. storage + bootstrap/cache --------------------------------------------
step "Каталоги backend/storage и backend/bootstrap/cache"
for rel in storage bootstrap; do
  src="$SKELETON/.staging/$rel"
  [ -d "$src" ] || continue
  while IFS= read -r d; do
    rel_path="${d#"$src"}"        # "/app/public"; для самой $src -> ""
    rel_path="${rel_path#/}"
    newdir="$BACKEND/$rel${rel_path:+/$rel_path}"
    if [ -e "$newdir" ]; then
      skip "$rel${rel_path:+/$rel_path} — уже есть"
    else
      mkdir -p "$newdir" && ok "создан $rel${rel_path:+/$rel_path}"
    fi
  done < <(find "$src" -type d)
done

# 3. backend/.env + APP_KEY ----------------------------------------------
step "backend/.env"
if [ "$FORCE_ENV" -eq 1 ]; then rm -f "$BACKEND/.env"; fi
if [ ! -f "$BACKEND/.env" ]; then
  [ -f "$BACKEND/.env.example" ] || { echo "Нет ни backend/.env, ни backend/.env.example" >&2; exit 1; }
  cp "$BACKEND/.env.example" "$BACKEND/.env"; ok "создан из .env.example"
else
  skip "уже существует"
fi

if ! grep -qE '^APP_KEY=..*' "$BACKEND/.env"; then
  step "Генерация APP_KEY"
  if docker compose ps --services --status running 2>/dev/null | grep -qx backend; then
    KEY="$(docker compose exec -T backend php artisan key:generate --show 2>/dev/null | tail -1 || true)"
  else
    KEY="$(docker compose run --rm backend php artisan key:generate --show 2>/dev/null | tail -1 || true)"
  fi
  if printf '%s' "$KEY" | grep -qE '^(base64:)?[A-Za-z0-9+/=]{20,}$'; then
    grep -qE '^APP_KEY=' "$BACKEND/.env" || printf 'APP_KEY=\n' >>"$BACKEND/.env"
    sed -i.bak "s|^APP_KEY=.*|APP_KEY=$KEY|" "$BACKEND/.env" && rm -f "$BACKEND/.env.bak"
    ok "APP_KEY записан в backend/.env"
  else
    echo "    ВНИМАНИЕ: APP_KEY получить не удалось (образ ещё не собран?). Сначала: docker compose build backend" >&2
  fi
else
  skip "APP_KEY уже задан"
fi

# 4. корневой .env ---------------------------------------------------------
step ".env рядом с docker-compose.yml"
if [ "$FORCE_ENV" -eq 1 ]; then rm -f "$ROOT/.env"; fi
if [ ! -f "$ROOT/.env" ]; then
  if [ -f "$ROOT/.env.example" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"; ok "создан из .env.example"
  else
    # В скачанном архиве .env.example может отсутствовать (он совпадает по имени
    # с gitignore-маской) — создаём минимальный файл, иначе compose не соберётся.
    cat > "$ROOT/.env" <<'EOF'
# Сайт по адресу http://<IP машины>/ без порта — Nginx на 80 порту (зафиксирован)
listen_ip=0.0.0.0
APP_KEY=
APP_ENV=production
APP_DEBUG=false
DB_DATABASE=vks_schedule
DB_USERNAME=vks_user
DB_PASSWORD=vks_2026
DB_ROOT_PASSWORD=vks_2026_root
REDIS_PASSWORD=vks_2026_redis
MESSENGER=max
MAX_BOT_TOKEN=
EOF
    ok "создан минимальный .env (нет .env.example в архиве)"
  fi
else
  skip "уже существует"
fi

# IP этой машины — чтобы Laravel (APP_URL) и ссылки генерировались по http://<IP>/
MYIP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -n "$MYIP" ]; then
  for f in "$ROOT/.env" "$BACKEND/.env"; do
    if grep -qE '^SITE_IP=' "$f"; then
      sed -i.bak "s|^SITE_IP=.*|SITE_IP=$MYIP|" "$f" && rm -f "$f.bak"
    else
      printf 'SITE_IP=%s\n' "$MYIP" >>"$f"
    fi
  done
  grep -qE '^APP_URL=' "$BACKEND/.env" || printf 'APP_URL=http://%s\n' "$MYIP" >>"$BACKEND/.env"
  ok "SITE_IP=$MYIP записан в .env (сайт будет по http://$MYIP/)"
fi

BK="$(grep -m1 -E '^APP_KEY=' "$BACKEND/.env" | cut -d= -f2- | tr -d '\r' || true)"
if [ -n "$BK" ] && ! grep -qE '^APP_KEY=..*' "$ROOT/.env"; then
  grep -qE '^APP_KEY=' "$ROOT/.env" || printf 'APP_KEY=\n' >>"$ROOT/.env"
  sed -i.bak "s|^APP_KEY=.*|APP_KEY=$BK|" "$ROOT/.env" && rm -f "$ROOT/.env.bak"
  ok "APP_KEY скопирован из backend/.env в корневой .env"
fi

printf '\n\033[1;36mГотово. Следующая команда:\033[0m\n    docker compose up -d --build\n'
echo
# Наружный порт Nginx зафиксирован в docker-compose.yml = 80,
# поэтому адрес сайта всегда БЕЗ порта в браузере.
MYIP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -n "$MYIP" ] || MYIP='<IP этой машины>'
echo "Для пользователей сайт будет по адресу: http://$MYIP/"
echo "IP этой машины: $(hostname -I 2>/dev/null || ipconfig getifaddr en0 2>/dev/null || echo '<посмотрите через ip a / ifconfig>')"
echo
echo "Проверьте в .env значения DB_PASSWORD / DB_ROOT_PASSWORD / REDIS_PASSWORD и MAX_BOT_TOKEN."
