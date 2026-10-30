#!/bin/bash
# Диагностика ВКС-бота и дат. Запускать в папке проекта на сервере (bash, не PowerShell).
set -u
echo "=== 1) git: должен быть ad98ca66 ==="
git log --oneline -3

echo; echo "=== 2) Контейнеры ==="
docker compose ps

echo; echo "=== 3) Время в контейнерах (должно совпасть с МСК) ==="
echo -n "backend:   "; docker compose exec -T backend date "+%d.%m.%Y %H:%M %Z" || true
echo -n "vks-bot:   "; docker compose exec -T vks-bot date "+%d.%m.%Y %H:%M %Z" || true

echo; echo "=== 4) /api/time (эталонное время сервера для фронта) ==="
docker compose exec -T backend curl -s http://localhost/api/time || true

echo; echo "=== 5) Health бота изнутри сети ==="
docker compose exec -T backend curl -s http://vks-bot:8090/health || echo "БОТ НЕ ОТВЕЧАЕТ"

echo; echo "=== 6) Реальное создание ссылки ботом (проверка даты в ответе) ==="
docker compose exec -T backend curl -s -X POST http://vks-bot:8090/create-link \
  -H 'Content-Type: application/json' -H "X-Bot-Token: ${BOT_TOKENS:-}" \
  -d '{"title":"Диагностика","name":"Проверка"}' || echo "ЗАПРОС НЕ ПРОШЕЛ"

echo; echo "=== 7) Настройки бота в Laravel ==="
docker compose exec -T backend php artisan tinker --execute="
echo 'VKSBOT_URL=' . config('services.vksbot.url') . PHP_EOL;
echo 'VKSBOT_AUTO=' . var_export(config('services.vksbot.auto'), true) . PHP_EOL;
echo 'VKSBOT_EXPECTED=' . var_export(config('services.vksbot.expected'), true) . PHP_EOL;
echo 'now MSK=' . now()->format('d.m.Y H:i') . PHP_EOL;
" || true

echo; echo "=== 8) Логи очереди за 5 мин (создание ссылок) ==="
docker compose logs --since 5m queue 2>&1 | tail -20

echo; echo "=== 9) Логи бота за 5 мин ==="
docker compose logs --since 5m vks-bot 2>&1 | tail -20

echo; echo "=== 10) Флаг автосоздания во фронт-бандле ==="
docker compose exec -T frontend sh -c "grep -o 'VKS_AUTOBOT[^,]*' /usr/share/nginx/html/assets/*.js 2>/dev/null | head -2" || \
docker compose exec -T backend sh -c "grep -ro 'autobot[^,]\{0,20\}' /var/www/html/public/assets/ 2>/dev/null | head -2" || echo "не нашли (проверьте имя контейнера фронта)"
echo "Готово."
