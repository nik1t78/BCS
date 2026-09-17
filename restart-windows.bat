@echo off
echo Очистка кэша Vite...
if exist "node_modules\.vite" (
    rmdir /s /q node_modules\.vite
    echo Кэш успешно удалён.
) else (
    echo Кэш не найден, пропускаем удаление.
)

echo Запуск сервера разработки...
npm run dev
