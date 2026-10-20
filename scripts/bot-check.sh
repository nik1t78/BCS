#!/usr/bin/env bash
# Диагностика VKS-бота (vks-bot): статус контейнера, /health, /create через nginx.
set -u
TOKEN="${BOT_TOKENS:-}"
BASE="${1:-http://localhost}"
fail=0

echo "== 1. Контейнер vks-bot =="
if docker ps --format '{{.Names}} {{.Status}}' | grep -q '^vks-bot '; then
  docker ps --format '{{.Names}}: {{.Status}}' | grep '^vks-bot'
else
  echo "НЕ запущен. Включите: docker compose --profile bot up -d vks-bot"
  fail=1
fi

echo; echo "== 2. /health напрямую в контейнере =="
docker exec vks-bot curl -s -m 5 http://127.0.0.1:8090/health 2>/dev/null \
  || curl -s -m 5 http://localhost:8090/health 2>/dev/null \
  || { echo "недоступен"; fail=1; }

echo; echo "== 3. /vks-bot/health через nginx =="
curl -s -m 8 "$BASE/vks-bot/health" || { echo "nginx не проксирует (502 = бот не запущен)"; fail=1; }

echo; echo "== 4. Реальный тест создания ссылки (/vks-bot/create) =="
if [ -z "$TOKEN" ]; then
  echo "BOT_TOKENS пуст — если секрет задан на сервере, запрос получит 401."
  echo "Запустите так: BOT_TOKENS=<секрет> ./scripts/bot-check.sh"
fi
RESP=$(curl -s -m 90 -X POST "$BASE/vks-bot/create" \
  -H 'Content-Type: application/json' \
  ${TOKEN:+-H "X-Bot-Token: $TOKEN"} \
  -d '{"title":"Проверка бота","name":"Диагностика"}')
echo "$RESP"
echo "$RESP" | grep -q '"ok":true' && echo "РЕАЛЬНАЯ ССЫЛКА ПОЛУЧЕНА ✓" || { echo "Бот не вернул ok:true (см. поле error/fallback_link выше)"; fail=1; }

echo; [ $fail -eq 0 ] && echo "ИТОГ: бот работает ✓" || echo "ИТОГ: есть проблемы ✗ (см. шаги выше)"
