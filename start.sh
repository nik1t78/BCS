#!/bin/bash
# Полный запуск проекта BCS ВКС (Docker)
set -e
cd "$(dirname "$0")"
git pull origin main
docker-compose up -d --build
docker exec vks-backend php artisan config:clear
docker exec vks-backend php artisan route:clear
docker exec vks-backend php artisan migrate --force
echo "Готово. Сайт: http://10.48.4.235 и https://salutejazz.ru"
