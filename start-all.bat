@echo off
title VKS Schedule - Starting...
color 0A

echo.
echo ==========================================
echo    Starting VKS Schedule...
echo ==========================================
echo.

cd /d D:\server\BCS-main

if not exist "D:\server\BCS-main" (
    echo ERROR: Folder D:\server\BCS-main not found!
    pause
    exit /b 1
)

echo [1/5] Starting Docker containers...
docker compose up -d mysql backend redis
if errorlevel neq 0 (
    echo ERROR: Docker failed to start!
    pause
    exit /b 1
)

echo.
echo [2/5] Waiting for MySQL to start (30 seconds)...
timeout /t 30 /nobreak >nul

echo.
echo [3/5] Checking container status...
docker compose ps

echo.
echo [4/5] Starting Laravel API server...
start "LaravelAPI" cmd /k "cd /d D:\server\BCS-main && docker compose exec backend php artisan serve --host=0.0.0.0 --port=8000"

echo.
echo [5/5] Starting Frontend server...
start "Frontend" cmd /k "cd /d D:\server\BCS-main && npm run dev"

echo.
echo ==========================================
echo    Servers started successfully!
echo ==========================================
echo.
echo    Frontend: http://localhost:5173
echo    API:      http://localhost:8000/api
echo.
echo    Login:    admin
echo    Password: admin123
echo.
echo    WARNING: DO NOT CLOSE THE OPENED WINDOWS!
echo ==========================================
echo.
echo Press any key to STOP all servers...
pause >nul

echo.
echo Stopping servers...
taskkill /FI "WINDOWTITLE eq LaravelAPI*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend*" /T /F >nul 2>&1
docker compose down

echo.
echo All servers stopped!
pause
