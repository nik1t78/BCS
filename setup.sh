#!/bin/bash

# =================================================================
# ВКС Расписание - Скрипт быстрой установки
# Запуск: chmod +x setup.sh && ./setup.sh
# =================================================================

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║   🚀 ВКС Расписание - Установка                         ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен!"
    echo ""
    echo "Установите Docker:"
    echo "  curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "  sudo sh get-docker.sh"
    echo ""
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose не установлен!"
    exit 1
fi

echo "✅ Docker найден: $(docker --version)"
echo ""

# Создание backend проекта
if [ ! -f "backend/composer.json" ]; then
    echo "📦 Создание Laravel проекта..."
    mkdir -p backend
    cd backend
    composer create-project laravel/laravel . --no-interaction --prefer-dist
    cd ..
    echo "✅ Laravel создан"
else
    echo "✅ Laravel уже существует"
fi

# Копирование файлов
echo ""
echo "📋 Копирование файлов..."

# Миграции
if [ -f "backend/database/migrations/2024_01_01_000000_create_vks_tables.php" ]; then
    echo "  ✅ Миграции"
fi

# Модели
for model in User Meeting Notification UserSetting; do
    if [ -f "backend/app/Models/${model}.php" ]; then
        echo "  ✅ Модель: ${model}"
    fi
done

# Контроллеры
for ctrl in AuthController MeetingController UserController NotificationController; do
    if [ -f "backend/app/Http/Controllers/Api/${ctrl}.php" ]; then
        echo "  ✅ Контроллер: ${ctrl}"
    fi
done

# Команды
if [ -f "backend/app/Console/Commands/SendMeetingReminders.php" ]; then
    echo "  ✅ Команда: SendMeetingReminders"
fi

# Seeder
if [ -f "backend/database/seeders/VksDatabaseSeeder.php" ]; then
    echo "  ✅ Seeder: VksDatabaseSeeder"
fi

# Middleware
if [ -f "backend/app/Http/Middleware/CheckRole.php" ]; then
    echo "  ✅ Middleware: CheckRole"
fi

# Маршруты
if [ -f "backend/routes/api.php" ]; then
    echo "  ✅ Маршруты API"
fi

echo ""
echo "🐳 Запуск Docker контейнеров..."
docker compose up -d --build

echo ""
echo "⏳ Ожидание готовности MySQL..."
sleep 10

echo ""
echo "🔑 Генерация ключа приложения..."
docker compose exec backend php artisan key:generate --no-interaction

echo ""
echo "🗄️  Запуск миграций..."
docker compose exec backend php artisan migrate --no-interaction

echo ""
echo "🌱 Заполнение демо-данными..."
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder --no-interaction

echo ""
echo "🔧 Установка прав доступа..."
docker compose exec backend chown -R www-data:www-data storage bootstrap/cache
docker compose exec backend chmod -R 775 storage bootstrap/cache

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║   ✅ Установка завершена успешно!                       ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "📍 Доступ:"
echo "   🌐 Приложение:    http://localhost"
echo "   📧 MailHog:       http://localhost:8025"
echo "   🗄️  MySQL:         localhost:3306"
echo ""
echo "👤 Демо-аккаунты:"
echo "   👑 Админ:         admin@vks.local / admin123"
echo "   🔧 Модератор:     sidorov@vks.local / mod123"
echo "   👤 Пользователь:  ivanov@vks.local / user123"
echo "   👤 Пользователь:  petrova@vks.local / user123"
echo ""
echo "📖 Документация:    START_HERE.md"
echo ""
echo "🎉 Откройте http://localhost в браузере!"
echo ""
