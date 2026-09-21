@echo off
chcp 65001 >nul
title ВКС Расписание - Запуск...
color 0A

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║                                                  ║
echo ║     🚀 Запуск ВКС Расписание...                 ║
echo ║                                                  ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: Переход в папку проекта
cd /d D:\server\BCS-main

:: Проверка что папка существует
if not exist "D:\server\BCS-main" (
    echo ❌ Ошибка: Папка D:\server\BCS-main не найдена!
    pause
    exit /b 1
)

echo [1/5] Запуск Docker контейнеров...
docker compose up -d mysql backend redis
if errorlevel neq 0 (
    echo ❌ Ошибка при запуске Docker!
    pause
    exit /b 1
)

echo.
echo [2/5] Ожидание запуска MySQL (30 секунд)...
timeout /t 30 /nobreak >nul

echo.
echo [3/5] Проверка статуса контейнеров...
docker compose ps

echo.
echo [4/5] Запуск Laravel API сервера...
start "Laravel API" cmd /k "cd /d D:\server\BCS-main && docker compose exec backend php artisan serve --host=0.0.0.0 --port=8000"

echo.
echo [5/5] Запуск Frontend сервера...
start "Frontend" cmd /k "cd /d D:\server\BCS-main && npm run dev"

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║                                                  ║
echo ║   ✅ Серверы запущены!                          ║
echo ║                                                  ║
echo ║   🌐 Frontend: http://localhost:5173            ║
echo ║   🔌 API: http://localhost:8000/api             ║
echo ║                                                  ║
echo ║   🔑 Вход:                                      ║
echo ║      Логин: admin                               ║
echo ║      Пароль: admin123                           ║
echo ║                                                  ║
echo ║   ⚠️  НЕ ЗАКРЫВАЙТЕ ОТКРЫТЫЕ ОКНА!              ║
echo ║                                                  ║
echo ╚══════════════════════════════════════════════════╝
echo.
echo Нажмите любую клавишу для остановки серверов...
pause >nul

echo.
echo Остановка серверов...
taskkill /FI "WINDOWTITLE eq Laravel API*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend*" /T /F >nul 2>&1
docker compose down

echo.
echo ✅ Серверы остановлены!
pause
