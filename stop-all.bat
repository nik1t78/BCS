@echo off
chcp 65001 >nul
title Остановка ВКС Расписание
color 0C

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║                                                  ║
echo ║     🛑 Остановка ВКС Расписание...              ║
echo ║                                                  ║
echo ╚══════════════════════════════════════════════════╝
echo.

cd /d D:\server\BCS-main

echo [1/3] Остановка Laravel API...
taskkill /FI "WINDOWTITLE eq Laravel API*" /T /F >nul 2>&1

echo [2/3] Остановка Frontend...
taskkill /FI "WINDOWTITLE eq Frontend*" /T /F >nul 2>&1

echo [3/3] Остановка Docker контейнеров...
docker compose down

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║                                                  ║
echo ║   ✅ Все серверы остановлены!                   ║
echo ║                                                  ║
echo ╚══════════════════════════════════════════════════╝
echo.
pause
