@echo off
chcp 65001 >nul
title Настройка автозапуска ВКС Расписание
color 0B

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║                                                  ║
echo ║   🔧 Настройка автозапуска ВКС Расписание       ║
echo ║                                                  ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: Получаем путь к папке автозагрузки
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

:: Проверяем что скрипт запускается от администратора
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Рекомендуется запустить от имени администратора
    echo.
)

echo 📁 Путь к папке автозагрузки:
echo    %STARTUP%
echo.

:: Создаем ярлык в папке автозагрузки
echo 🔗 Создание ярлыка для автозапуска...

set SCRIPT="%TEMP%\CreateShortcut.vbs"

echo Set oWS = WScript.CreateObject("WScript.Shell") > %SCRIPT%
echo sLinkFile = "%STARTUP%\ВКС Расписание.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "D:\BCS\start-server-silent.vbs" >> %SCRIPT%
echo oLink.WorkingDirectory = "D:\BCS" >> %SCRIPT%
echo oLink.Description = "ВКС Расписание - Автозапуск сервера" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%

cscript /nologo %SCRIPT%
del %SCRIPT%

echo ✅ Ярлык создан в папке автозагрузки!
echo.

:: Проверяем что файл создан
if exist "%STARTUP%\ВКС Расписание.lnk" (
    echo ✅ Автозапуск настроен успешно!
    echo.
    echo 📋 Информация:
    echo    • Сервер будет запускаться автоматически при входе в Windows
    echo    • Сервер работает в скрытом режиме (без окна консоли)
    echo    • Доступ: http://localhost:3000
    echo.
    echo 🔧 Управление:
    echo    • Чтобы остановить сервер, выполните: stop-server.bat
    echo    • Чтобы удалить автозапуск, выполните: remove-autostart.bat
    echo.
) else (
    echo ❌ Ошибка при создании ярлыка!
    echo Попробуйте настроить автозапуск вручную.
    echo.
)

pause
