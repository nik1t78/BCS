@echo off
chcp 65001 >nul
title Остановка сервера ВКС Расписание
color 0C

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║                                                  ║
echo ║   🛑 Остановка сервера ВКС Расписание           ║
echo ║                                                  ║
echo ╚══════════════════════════════════════════════════╝
echo.

echo 🔍 Поиск процессов serve...
echo.

:: Находим все процессы serve
tasklist /FI "IMAGENAME eq node.exe" /FO CSV 2>nul | findstr /I "serve" >nul
if %errorlevel% equ 0 (
    echo ⚠️  Обнаружены работающие процессы сервера.
    echo.
    echo Остановка процессов...
    
    :: Останавливаем все процессы node которые запустили serve
    for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV ^| findstr /I "serve"') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    
    echo ✅ Сервер остановлен!
) else (
    echo ℹ️  Сервер не запущен.
)

echo.
pause
