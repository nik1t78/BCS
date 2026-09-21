@echo off
title VKS Schedule - Stopping
color 0C

echo.
echo ==========================================
echo    Stopping VKS Schedule...
echo ==========================================
echo.

cd /d D:\server\BCS-main

echo [1/3] Stopping Laravel API...
taskkill /FI "WINDOWTITLE eq LaravelAPI*" /T /F >nul 2>&1

echo [2/3] Stopping Frontend...
taskkill /FI "WINDOWTITLE eq Frontend*" /T /F >nul 2>&1

echo [3/3] Stopping Docker containers...
docker compose down

echo.
echo ==========================================
echo    All servers stopped!
echo ==========================================
echo.
pause
