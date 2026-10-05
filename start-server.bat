@echo off
chcp 65001 >nul
title ВКС Расписание - Сервер
color 0A

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║                                                  ║
echo ║     🎥 ВКС Расписание - Запуск сервера...       ║
echo ║                                                  ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: Переход в папку проекта
cd /d D:\BCS

:: Проверка что папка существует
if not exist "D:\BCS" (
    echo ❌ Ошибка: Папка D:\BCS не найдена!
    echo Пожалуйста, проверьте путь к проекту.
    pause
    exit /b 1
)

:: Проверка что node_modules существует
if not exist "node_modules" (
    echo ⚠️  Папка node_modules не найдена.
    echo Выполняется установка зависимостей...
    echo.
    call npm install
    echo.
)

:: Проверка что dist существует
if not exist "dist" (
    echo ⚠️  Папка dist не найдена.
    echo Выполняется сборка проекта...
    echo.
    call npm run build
    echo.
)

:: Проверка что serve установлен
where serve >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  Serve не установлен.
    echo Выполняется установка serve...
    echo.
    call npm install -g serve
    echo.
)

echo ✅ Все проверки пройдены!
echo.
echo ╔══════════════════════════════════════════════════╗
echo ║                                                  ║
echo ║   🌐 Сервер запущен!                            ║
echo ║                                                  ║
echo ║   📍 Локальный доступ:                          ║
echo ║      http://localhost:3000                      ║
echo ║                                                  ║
echo ║   📍 Сетевой доступ:                            ║
echo ║      http://%COMPUTERNAME%:3000                 ║
echo ║                                                  ║
echo ║   🔑 Данные для входа:                          ║
echo ║      Логин: admin                               ║
echo ║      Пароль: admin123                           ║
echo ║                                                  ║
echo ║   ⚠️  НЕ ЗАКРЫВАЙТЕ ЭТО ОКНО!                   ║
echo ║                                                  ║
echo ╚══════════════════════════════════════════════════╝
echo.
echo Сервер работает... Нажмите любую клавишу для остановки.
echo.

:: Запуск сервера
serve -s dist -l 3000

pause
