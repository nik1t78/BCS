# 🔄 ПЕРЕЗАПУСК ПРОЕКТА - ПОЛНАЯ ИНСТРУКЦИЯ

## 📋 ЧТО НУЖНО ПЕРЕЗАПУСКАТЬ

Проект состоит из двух частей:
1. **Backend** (Laravel) - работает в Docker контейнерах
2. **Frontend** (React) - работает через `serve`

---

## 🚀 БЫСТРЫЙ ПЕРЕЗАПУСК (30 секунд)

### Если нужно просто перезапустить frontend:

```powershell
# 1. Остановите текущий сервер (Ctrl + C в окне PowerShell)

# 2. Пересоберите проект
npm run build

# 3. Запустите сервер заново
serve -s dist -l 3000
```

### Если нужно перезапустить backend:

```powershell
# 1. Перезапустите Docker контейнеры
docker compose restart

# 2. Подождите 30 секунд пока все сервисы запустятся

# 3. Проверьте статус
docker compose ps
```

---

## 🔄 ПОЛНЫЙ ПЕРЕЗАПУСК (2-3 минуты)

### Шаг 1: Остановите всё

```powershell
cd D:\server\BCS-main

# Остановите frontend сервер (Ctrl + C в окне где запущен serve)

# Остановите Docker контейнеры
docker compose down
```

### Шаг 2: Очистите кэш (опционально)

```powershell
# Очистите Docker кэш
docker system prune -f

# Очистите node_modules (если были проблемы)
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
```

### Шаг 3: Запустите Backend

```powershell
# Запустите Docker контейнеры
docker compose up -d

# Подождите 30 секунд пока все сервисы запустятся
timeout /t 30

# Проверьте статус
docker compose ps
```

Все контейнеры должны быть в статусе **"Up"**:
- ✅ vks-frontend
- ✅ vks-backend
- ✅ vks-nginx
- ✅ vks-mysql
- ✅ vks-redis
- ✅ vks-queue
- ✅ vks-scheduler

### Шаг 4: Запустите Frontend

```powershell
# Установите зависимости (если очистили node_modules)
npm install

# Соберите проект
npm run build

# Запустите сервер
serve -s dist -l 3000
```

### Шаг 5: Проверьте работу

Откройте браузер: **http://localhost:3000**

Войдите:
- **Логин:** `admin`
- **Пароль:** `admin123`

---

## 🛠️ ПЕРЕЗАПУСК С ПОЛНОЙ ОЧИСТКОЙ БАЗЫ ДАННЫХ

Если нужно начать с чистыми данными:

```powershell
# 1. Остановите всё
docker compose down

# 2. Удалите volume с базой данных
docker volume rm bcs-main_mysql_data

# 3. Запустите заново
docker compose up -d

# 4. Подождите 30 секунд
timeout /t 30

# 5. Выполните миграции
docker compose exec backend php artisan migrate:fresh

# 6. Загрузите тестовые данные
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder

# 7. Запустите frontend
npm run build
serve -s dist -l 3000
```

---

## 📊 ПРОВЕРКА СТАТУСА

### Проверить Backend:

```powershell
# Статус контейнеров
docker compose ps

# Логи backend
docker compose logs backend

# Логи MySQL
docker compose logs mysql

# Проверить API
curl http://localhost/api/health
```

### Проверить Frontend:

```powershell
# Проверить что сервер запущен
netstat -ano | findstr :3000

# Открыть в браузере
start http://localhost:3000
```

---

## 🐛 РЕШЕНИЕ ПРОБЛЕМ

### Проблема: Backend не запускается

```powershell
# Проверьте логи
docker compose logs backend

# Перезапустите backend
docker compose restart backend

# Если не помогает, пересоберите
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Проблема: Frontend не открывается

```powershell
# Проверьте что порт 3000 свободен
netstat -ano | findstr :3000

# Если занят, убейте процесс
taskkill /PID [номер] /F

# Запустите заново
serve -s dist -l 3000
```

### Проблема: Ошибки CORS

```powershell
# Очистите кэш Laravel
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan cache:clear

# Перезапустите backend
docker compose restart backend
```

### Проблема: База данных не подключается

```powershell
# Проверьте статус MySQL
docker compose ps mysql

# Перезапустите MySQL
docker compose restart mysql

# Подождите 30 секунд
timeout /t 30

# Проверьте подключение
docker compose exec backend php artisan migrate:status
```

---

## 🔄 АВТОМАТИЧЕСКИЙ ПЕРЕЗАПУСК

### Создать скрипт для быстрого перезапуска:

Создайте файл `restart.bat` в корне проекта:

```batch
@echo off
echo Остановка проекта...
docker compose down
echo.
echo Запуск проекта...
docker compose up -d
echo.
echo Ожидание запуска сервисов...
timeout /t 30
echo.
echo Пересборка frontend...
call npm run build
echo.
echo Запуск frontend сервера...
start "VKS Server" cmd /k "serve -s dist -l 3000"
echo.
echo Проект перезапущен!
echo Откройте: http://localhost:3000
pause
```

Теперь можно просто запустить `restart.bat` для полного перезапуска.

---

## 📋 КОМАНДЫ ДЛЯ РАЗНЫХ СИТУАЦИЙ

### Только перезапустить frontend:
```powershell
npm run build
serve -s dist -l 3000
```

### Только перезапустить backend:
```powershell
docker compose restart
```

### Полный перезапуск:
```powershell
docker compose down
docker compose up -d
npm run build
serve -s dist -l 3000
```

### Перезапуск с очисткой БД:
```powershell
docker compose down -v
docker compose up -d
docker compose exec backend php artisan migrate:fresh
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
npm run build
serve -s dist -l 3000
```

### Перезапуск с полной очисткой:
```powershell
docker compose down -v --rmi all
docker system prune -a --volumes -f
Remove-Item -Recurse -Force node_modules
npm install
docker compose up -d
docker compose exec backend php artisan migrate:fresh
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
npm run build
serve -s dist -l 3000
```

---

## ✅ ЧЕК-ЛИСТ ПЕРЕЗАПУСКА

### Быстрый перезапуск:
- [ ] Остановлен frontend сервер (Ctrl + C)
- [ ] Пересобран проект (`npm run build`)
- [ ] Запущен frontend сервер (`serve -s dist -l 3000`)
- [ ] Открыт http://localhost:3000
- [ ] Проверен вход в систему

### Полный перезапуск:
- [ ] Остановлены Docker контейнеры (`docker compose down`)
- [ ] Запущены Docker контейнеры (`docker compose up -d`)
- [ ] Проверен статус контейнеров (`docker compose ps`)
- [ ] Пересобран frontend (`npm run build`)
- [ ] Запущен frontend сервер (`serve -s dist -l 3000`)
- [ ] Открыт http://localhost:3000
- [ ] Проверен вход в систему
- [ ] Проверена синхронизация данных
- [ ] Проверены уведомления

---

## 🎯 ИТОГ

### Самый быстрый способ перезапуска:

```powershell
# Frontend
Ctrl + C
npm run build
serve -s dist -l 3000

# Backend (если нужно)
docker compose restart
```

### Полный перезапуск:

```powershell
docker compose down
docker compose up -d
timeout /t 30
npm run build
serve -s dist -l 3000
```

---

<div align="center">

## 🚀 ПРОЕКТ ПЕРЕЗАПУЩЕН!

**Все данные синхронизированы через сервер!**  
**Уведомления работают автоматически!**  
**Многопользовательский режим активен!**

### Адрес:
```
http://localhost:3000
```

### Данные для входа:
```
Админ: admin / admin123
Модератор: moderator / mod123
Пользователь: ivanov / user123
```

**Удачи! 🎉**

</div>
