# 🔄 ПОЛНАЯ ИНСТРУКЦИЯ ПО ПЕРЕЗАПУСКУ ПРОЕКТА

## 📋 СОДЕРЖАНИЕ

1. [Быстрый перезапуск (30 секунд)](#быстрый-перезапуск-30-секунд)
2. [Полный перезапуск (2-3 минуты)](#полный-перезапуск-2-3-минуты)
3. [Перезапуск с очисткой БД](#перезапуск-с-очисткой-бд)
4. [Полная очистка и переустановка](#полная-очистка-и-переустановка)
5. [Решение проблем](#решение-проблем)

---

## ⚡ БЫСТРЫЙ ПЕРЕЗАПУСК (30 секунд)

**Когда использовать:** Если нужно просто перезапустить frontend после изменений в коде.

### Шаги:

```powershell
# 1. Остановите frontend сервер
# Перейдите в окно PowerShell где запущен serve
# Нажмите Ctrl + C

# 2. Пересоберите проект
npm run build

# 3. Запустите сервер заново
serve -s dist -l 3000
```

### Результат:
- ✅ Frontend перезапущен
- ✅ Backend продолжает работать
- ✅ База данных не затронута
- ✅ Все данные сохранены

---

## 🔄 ПОЛНЫЙ ПЕРЕЗАПУСК (2-3 минуты)

**Когда использовать:** Если нужно перезапустить весь проект (frontend + backend).

### Шаги:

```powershell
# 1. Перейдите в папку проекта
cd D:\server\BCS-main

# 2. Остановите frontend сервер (если запущен)
# Нажмите Ctrl + C в окне PowerShell где запущен serve

# 3. Остановите все Docker контейнеры
docker compose down

# 4. Запустите backend заново
docker compose up -d

# 5. Подождите 30 секунд пока все сервисы запустятся
timeout /t 30

# 6. Проверьте статус контейнеров
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

```powershell
# 7. Запустите frontend
npm run build
serve -s dist -l 3000
```

### Результат:
- ✅ Frontend перезапущен
- ✅ Backend перезапущен
- ✅ База данных не затронута
- ✅ Все данные сохранены

---

## 🗑️ ПЕРЕЗАПУСК С ОЧИСТКОЙ БД

**Когда использовать:** Если нужно начать с чистыми данными (удалить всех пользователей и конференции).

### Шаги:

```powershell
# 1. Перейдите в папку проекта
cd D:\server\BCS-main

# 2. Остановите frontend сервер (если запущен)
# Нажмите Ctrl + C

# 3. Остановите все Docker контейнеры
docker compose down

# 4. Удалите volume с базой данных
docker volume rm bcs-main_mysql_data

# Если volume не найден, найдите его имя:
docker volume ls
# И удалите:
docker volume rm [имя_volume]

# 5. Запустите backend заново
docker compose up -d

# 6. Подождите 30 секунд
timeout /t 30

# 7. Выполните миграции (создание таблиц)
docker compose exec backend php artisan migrate:fresh

# 8. Загрузите тестовые данные
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder

# 9. Запустите frontend
npm run build
serve -s dist -l 3000
```

### Результат:
- ✅ Frontend перезапущен
- ✅ Backend перезапущен
- ✅ База данных очищена
- ✅ Тестовые данные загружены
- ✅ Можно начинать с чистого листа

### Тестовые данные после очистки:

**Пользователи:**
- 👑 Админ: `admin` / `admin123`
- 🔧 Модератор: `moderator` / `mod123`
- 👤 Пользователи: `ivanov`, `petrova`, `sidorov`, `kozlova`, `nikolaev`, `fedorova`, `morozov`, `volkova` / `user123`

**Конференции:**
- 7 тестовых конференций на разные даты
- С разными участниками
- С разными приоритетами

---

## 🧹 ПОЛНАЯ ОЧИСТКА И ПЕРЕУСТАНОВКА

**Когда использовать:** Если ничего не помогает или нужно переустановить всё с нуля.

### Шаги:

```powershell
# 1. Перейдите в папку проекта
cd D:\server\BCS-main

# 2. Остановите frontend сервер (если запущен)
# Нажмите Ctrl + C

# 3. Остановите все Docker контейнеры и удалите всё
docker compose down -v --rmi all

# 4. Очистите Docker кэш
docker system prune -a --volumes -f

# 5. Удалите node_modules и package-lock.json
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json

# 6. Установите зависимости заново
npm install

# 7. Запустите backend
docker compose up -d

# 8. Подождите 2 минуты пока всё запустится
timeout /t 120

# 9. Выполните миграции
docker compose exec backend php artisan migrate:fresh

# 10. Загрузите тестовые данные
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder

# 11. Соберите frontend
npm run build

# 12. Запустите frontend сервер
serve -s dist -l 3000
```

### Результат:
- ✅ Полная переустановка
- ✅ Все зависимости установлены заново
- ✅ База данных очищена
- ✅ Тестовые данные загружены
- ✅ Всё работает с нуля

---

## 🛠️ РЕШЕНИЕ ПРОБЛЕМ

### Проблема 1: Порт 3000 занят

**Симптом:** `Error: Port 3000 is already in use`

**Решение:**
```powershell
# Найдите процесс который занимает порт
netstat -ano | findstr :3000

# Убейте процесс (замените PID на номер из предыдущей команды)
taskkill /PID [номер] /F

# Запустите сервер заново
serve -s dist -l 3000
```

**Альтернатива:** Используйте другой порт:
```powershell
serve -s dist -l 8080
```
Тогда открывайте: http://localhost:8080

---

### Проблема 2: Backend не запускается

**Симптом:** Контейнер backend не в статусе "Up"

**Решение:**
```powershell
# Проверьте логи
docker compose logs backend

# Перезапустите backend
docker compose restart backend

# Если не помогает, пересоберите
docker compose down
docker compose build --no-cache backend
docker compose up -d
```

---

### Проблема 3: MySQL не подключается

**Симптом:** Ошибка подключения к базе данных

**Решение:**
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

### Проблема 4: Ошибки CORS

**Симптом:** Ошибки в консоли браузера о CORS

**Решение:**
```powershell
# Очистите кэш Laravel
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan cache:clear

# Перезапустите backend
docker compose restart backend
```

---

### Проблема 5: Frontend не открывается

**Симптом:** Браузер не может открыть http://localhost:3000

**Решение:**
```powershell
# Проверьте что сервер запущен
netstat -ano | findstr :3000

# Если не запущен, запустите
serve -s dist -l 3000

# Проверьте firewall
netsh advfirewall firewall show rule name="ВКС Расписание"

# Если правила нет, добавьте
netsh advfirewall firewall add rule name="ВКС Расписание" dir=in action=allow protocol=TCP localport=3000
```

---

### Проблема 6: Не могу войти в систему

**Симптом:** Ошибка "Неверный логин или пароль"

**Решение:**
```javascript
// В консоли браузера (F12 → Console)
localStorage.clear()
// Обновите страницу (F5)
```

Затем войдите с правильными данными:
- Логин: `admin`
- Пароль: `admin123`

---

### Проблема 7: Данные не синхронизируются

**Симптом:** Изменения не видны в другом браузере

**Решение:**
1. Проверьте что все компоненты используют `store-api.ts`
2. Откройте DevTools (F12) → Network
3. Проверьте что API запросы отправляются
4. Проверьте что ответы приходят с кодом 200
5. Подождите 30 секунд (автоматическое обновление)

---

## 📊 КОМАНДЫ ДЛЯ РАЗНЫХ СИТУАЦИЙ

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
timeout /t 30
npm run build
serve -s dist -l 3000
```

### Перезапуск с очисткой БД:
```powershell
docker compose down
docker volume rm bcs-main_mysql_data
docker compose up -d
timeout /t 30
docker compose exec backend php artisan migrate:fresh
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
npm run build
serve -s dist -l 3000
```

### Полная переустановка:
```powershell
docker compose down -v --rmi all
docker system prune -a --volumes -f
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
docker compose up -d
timeout /t 120
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
