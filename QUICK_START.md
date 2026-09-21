# 🚀 БЫСТРЫЙ ЗАПУСК ПРОЕКТА

## ⚡ САМЫЙ БЫСТРЫЙ СПОСОБ (5 минут)

### Шаг 1: Запустите Backend

```powershell
cd D:\server\BCS-main
docker compose up -d
```

Подождите 30 секунд пока все сервисы запустятся.

### Шаг 2: Настройте Backend

```powershell
# Установите Sanctum
docker compose exec backend composer require laravel/sanctum

# Опубликуйте конфигурацию
docker compose exec backend php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"

# Выполните миграции
docker compose exec backend php artisan migrate

# Загрузите тестовые данные
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder

# Настройте CORS (автоматически)
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan cache:clear

# Перезапустите backend
docker compose restart backend
```

### Шаг 3: Запустите Frontend

```powershell
# Установите зависимости (если ещё не установлены)
npm install

# Соберите проект
npm run build

# Запустите сервер
serve -s dist -l 3000
```

### Шаг 4: Откройте браузер

Перейдите по адресу: **http://localhost:3000**

Войдите:
- **Логин:** `admin`
- **Пароль:** `admin123`

---

## 🎯 ПРОВЕРКА РАБОТЫ

### Тест 1: Создание конференции

1. Войдите как `admin` / `admin123`
2. Перейдите в "Мои конференции"
3. Нажмите "Создать конференцию"
4. Заполните форму:
   - Название: "Тестовая конференция"
   - Дата: сегодня
   - Время: через 1 час
   - Выберите 2-3 участников
5. Нажмите "Создать"

### Тест 2: Проверка синхронизации

1. Откройте **второй браузер** (или режим инкогнито)
2. Войдите как `ivanov` / `user123`
3. Перейдите в "Мои конференции"
4. **Проверьте:** конференция "Тестовая конференция" должна быть видна!

### Тест 3: Проверка уведомлений

1. Во втором браузере (как ivanov) перейдите в "Уведомления"
2. **Проверьте:** должно быть уведомление "👤 Вас добавили в конференцию 'Тестовая конференция'"

### Тест 4: Автоматические уведомления

1. Создайте конференцию которая начнётся через 5 минут
2. Добавьте участников
3. Подождите 4-5 минут
4. **Проверьте:** участники получат уведомление "⏰ Напоминание: через N мин. начнётся..."

---

## 📊 ЧТО ДОЛЖНО РАБОТАТЬ

### ✅ Синхронизация данных:
- Все пользователи видят одних и тех же пользователей
- Все видят все конференции
- Данные обновляются автоматически каждые 30 секунд

### ✅ Уведомления:
- При создании конференции участники получают уведомление
- За 5 минут до начала приходит напоминание
- В момент начала приходит уведомление "Конференция начинается"
- Уведомления очищаются автоматически через 30 дней

### ✅ Многопользовательский режим:
- Можно работать с нескольких компьютеров одновременно
- Данные синхронизируются в реальном времени
- Нет конфликтов

---

## 🛠️ ЕСЛИ ЧТО-ТО НЕ РАБОТАЕТ

### Проблема: Backend не запускается

```powershell
# Проверьте статус контейнеров
docker compose ps

# Перезапустите
docker compose restart

# Проверьте логи
docker compose logs backend
```

### Проблема: Ошибка CORS

```powershell
# Проверьте конфигурацию
docker compose exec backend cat config/cors.php

# Очистите кэш
docker compose exec backend php artisan config:clear

# Перезапустите backend
docker compose restart backend
```

### Проблема: Данные не синхронизируются

1. Проверьте что все компоненты используют `store-api.ts`
2. Откройте DevTools (F12) → Network
3. Проверьте что API запросы отправляются
4. Проверьте что ответы приходят с кодом 200

### Проблема: Уведомления не приходят

```powershell
# Проверьте что команда работает
docker compose exec backend php artisan meetings:send-notifications

# Проверьте логи
docker compose logs backend
```

---

## 🌐 ДОСТУП ИЗ СЕТИ

### Для доступа с других компьютеров:

1. Узнайте IP адрес сервера:
```powershell
ipconfig
```

2. Откройте порт в firewall:
```powershell
netsh advfirewall firewall add rule name="ВКС Расписание" dir=in action=allow protocol=TCP localport=3000
```

3. Другие пользователи открывают:
```
http://10.48.4.235:3000
```

---

## 📋 ПОЛНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ КОМАНД

```powershell
# 1. Перейдите в папку проекта
cd D:\server\BCS-main

# 2. Запустите backend
docker compose up -d

# 3. Подождите 30 секунд
timeout /t 30

# 4. Установите Sanctum
docker compose exec backend composer require laravel/sanctum

# 5. Опубликуйте конфигурацию
docker compose exec backend php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"

# 6. Выполните миграции
docker compose exec backend php artisan migrate

# 7. Загрузите тестовые данные
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder

# 8. Очистите кэш
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan cache:clear

# 9. Перезапустите backend
docker compose restart backend

# 10. Установите зависимости frontend
npm install

# 11. Соберите проект
npm run build

# 12. Запустите сервер
serve -s dist -l 3000

# 13. Откройте http://localhost:3000
```

---

## 🎯 ИТОГ

После выполнения всех шагов:

✅ Backend работает на http://localhost/api  
✅ Frontend работает на http://localhost:3000  
✅ Все данные синхронизированы  
✅ Уведомления работают автоматически  
✅ Можно работать с нескольких компьютеров  

---

## 📚 ДОКУМЕНТАЦИЯ

### Быстрый старт:
- **QUICK_START.md** - этот файл (5 минут)

### Полная инструкция:
- **PROJECT_READY.md** - что реализовано
- **FINISH_MIGRATION.md** - завершение миграции
- **API_MIGRATION_FULL.md** - полная инструкция по API

### Дополнительно:
- **CORS_SETUP.md** - настройка CORS
- **WINDOWS_SETUP.md** - установка на Windows
- **DOCKER_DEPLOYMENT.md** - развёртывание через Docker

---

<div align="center">

## 🎉 ПРОЕКТ ГОТОВ К ИСПОЛЬЗОВАНИЮ!

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

**Удачи! 🚀**

</div>
