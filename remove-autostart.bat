@echo off
chcp 65001 >nul
title Удаление автозапуска ВКС Расписание
color 0E

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║                                                  ║
echo ║   🗑️  Удаление автозапуска ВКС Расписание        ║
echo ║                                                  ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: Получаем путь к папке автозагрузки
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

echo 📁 Путь к папке автозагрузки:
echo    %STARTUP%
echo.

:: Проверяем существование ярлыка
if exist "%STARTUP%\ВКС Расписание.lnk" (
    echo 🔍 Ярлык автозапуска найден.
    echo.
    echo Удаление ярлыка...
    
    del "%STARTUP%\ВКС Расписание.lnk"
    
    if not exist "%STARTUP%\ВКС Расписание.lnk" (
        echo ✅ Автозапуск успешно удален!
        echo.
        echo ℹ️  Сервер больше не будет запускаться автоматически.
        echo    Для ручного запуска используйте: start-server.bat
    ) else (
        echo ❌ Ошибка при удалении ярлыка!
        echo Попробуйте удалить вручную:
        echo    %STARTUP%\ВКС Расписание.lnk
    )
) else (
    echo ℹ️  Автозапуск не настроен.
    echo Ярлык не найден в папке автозагрузки.
)

echo.
pause
