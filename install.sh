#!/bin/bash

# Скрипт автоматической установки ВКС Расписание

echo "🚀 Установка ВКС Расписание..."
echo ""

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker:"
    echo "   curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "   sudo sh get-docker.sh"
    exit 1
fi

# Проверка Docker Compose
if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose не установлен."
    exit 1
fi

# Создание директорий
echo "📁 Создание структуры проекта..."
mkdir -p backend frontend docker/nginx docker/mysql docker/php

# Копирование файлов
echo "📋 Копирование конфигураций..."

# Создание .env для Laravel
cat > backend/.env << 'EOF'
APP_NAME="ВКС Расписание"
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost

LOG_CHANNEL=stack
LOG_LEVEL=debug

DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=vks_schedule
DB_USERNAME=vks_user
DB_PASSWORD=vks_password_2024

BROADCAST_DRIVER=log
CACHE_DRIVER=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
SESSION_LIFETIME=120

MEMCACHED_HOST=127.0.0.1

REDIS_HOST=redis
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=smtp
MAIL_HOST=mailhog
MAIL_PORT=1025
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="noreply@vks.local"
MAIL_FROM_NAME="${APP_NAME}"

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

PUSHER_APP_ID=
PUSHER_APP_KEY=
PUSHER_APP_SECRET=
PUSHER_APP_CLUSTER=mt1

MIX_PUSHER_APP_KEY="${PUSHER_APP_KEY}"
MIX_PUSHER_APP_CLUSTER="${PUSHER_APP_CLUSTER}"

SANCTUM_STATEFUL_DOMAINS=localhost,localhost:3000,localhost:5173
SESSION_DOMAIN=localhost
EOF

echo "✅ Базовая конфигурация создана"
echo ""
echo "📝 Следующие шаги:"
echo "1. cd backend && composer create-project laravel/laravel ."
echo "2. Скопируйте файлы из /backend-examples в соответствующие директории"
echo "3. docker compose up -d --build"
echo "4. docker compose exec backend php artisan key:generate"
echo "5. docker compose exec backend php artisan migrate"
echo "6. Откройте http://localhost"
echo ""
echo "🎉 Установка завершена!"
