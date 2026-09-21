@echo off
chcp 65001 >nul
echo ==========================================
echo  Полная очистка и перезапуск проекта ВКС
echo ==========================================
echo.

echo [1/8] Остановка всех контейнеров...
docker compose down -v
echo.

echo [2/8] Удаление всех Docker образов...
docker rmi $(docker images -q) 2>nul
echo.

echo [3/8] Очистка Docker кэша...
docker system prune -a -f
echo.

echo [4/8] Удаление node_modules...
if exist node_modules (
    rmdir /s /q node_modules
    echo node_modules удалены
) else (
    echo node_modules не найдены
)
echo.

echo [5/8] Установка зависимостей...
call npm install
echo.

echo [6/8] Сборка проекта...
call npm run build
echo.

echo [7/8] Запуск контейнеров...
docker compose up -d --build
echo.

echo [8/8] Ожидание запуска MySQL (60 секунд)...
timeout /t 60 /nobreak >nul
echo.

echo ==========================================
echo  Проверка статуса контейнеров
echo ==========================================
docker compose ps
echo.

echo ==========================================
echo  Выполнение миграций базы данных
echo ==========================================
docker compose exec backend php artisan migrate:fresh
echo.

echo ==========================================
echo  Загрузка тестовых данных
echo ==========================================
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
echo.

echo ==========================================
echo  Создание symbolic link для storage
echo ==========================================
docker compose exec backend php artisan storage:link
echo.

echo ==========================================
echo  Очистка кэша Laravel
echo ==========================================
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan cache:clear
docker compose exec backend php artisan route:clear
echo.

echo ==========================================
echo  Перезапуск backend контейнера
echo ==========================================
docker compose restart backend
echo.

echo ==========================================
echo  Запуск локального сервера
echo ==========================================
echo Откройте браузер: http://localhost:3000
echo.
echo Логин: admin
echo Пароль: admin123
echo.
echo ==========================================
echo  Проект готов к использованию!
echo ==========================================
echo.

call serve -s dist -l 3000
