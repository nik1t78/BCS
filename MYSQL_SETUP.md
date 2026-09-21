# 🚀 Настройка MySQL и подключение к API

## 📋 Проблема

Сейчас frontend работает с localStorage, и пользователи не видят данные друг друга. Нужно:
1. Запустить MySQL в Docker
2. Настроить backend Laravel для работы с MySQL
3. Переключить frontend на работу с API

---

## 🔧 Шаг 1: Полная очистка Docker

```powershell
# Остановить все контейнеры
docker compose down

# Удалить все volumes (это удалит старые данные MySQL)
docker volume prune -f

# Удалить неиспользуемые образы
docker system prune -f
```

---

## 🔧 Шаг 2: Запуск MySQL

```powershell
# Запустить только MySQL
docker compose up -d mysql

# Подождать 30 секунд пока MySQL полностью запустится
timeout /t 30

# Проверить статус
docker compose ps mysql

# Проверить логи MySQL
docker compose logs mysql --tail=50
```

**Ожидаемый результат:** В логах должно быть сообщение `ready for connections`

---

## 🔧 Шаг 3: Запуск Backend

```powershell
# Запустить backend
docker compose up -d backend

# Подождать 10 секунд
timeout /t 10

# Проверить статус
docker compose ps backend

# Проверить логи backend
docker compose logs backend --tail=50
```

---

## 🔧 Шаг 4: Выполнение миграций

```powershell
# Очистить кэш конфигурации
docker compose exec backend php artisan config:clear

# Выполнить миграции (создание таблиц)
docker compose exec backend php artisan migrate:fresh

# Загрузить тестовые данные
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

**Ожидаемый результат:** Должны создаться таблицы и загрузиться тестовые пользователи

---

## 🔧 Шаг 5: Проверка подключения к MySQL

```powershell
# Войти в MySQL
docker compose exec mysql mysql -u vks_user -pvks_password_2024 vks_schedule

# В MySQL выполнить:
SHOW TABLES;
SELECT COUNT(*) FROM users;
EXIT;
```

**Ожидаемый результат:** Должны увидеть таблицы и количество пользователей

---

## 🔧 Шаг 6: Запуск всех сервисов

```powershell
# Запустить все контейнеры
docker compose up -d

# Проверить статус всех контейнеров
docker compose ps
```

Все контейнеры должны быть в статусе `Up`:
- ✅ vks-mysql
- ✅ vks-backend
- ✅ vks-frontend
- ✅ vks-nginx
- ✅ vks-redis
- ✅ vks-queue
- ✅ vks-scheduler

---

## 🔧 Шаг 7: Настройка CORS для API

Откройте файл `backend/config/cors.php` и убедитесь что настройки правильные:

```php
<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => ['http://localhost:3000', 'http://localhost:5173'],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
```

---

## 🔧 Шаг 8: Переключение Frontend на API

### 8.1. Обновите `src/api/client.ts`

```typescript
const API_BASE_URL = 'http://localhost/api';
```

### 8.2. Обновите компоненты

Замените импорты в компонентах с `../store` на `../store-api`:

**Dashboard.tsx:**
```typescript
import { getMeetings, getUsers } from '../store-api';
```

**UserPanel.tsx:**
```typescript
import { getMeetings, createMeeting, updateMeeting, deleteMeeting, getUsers } from '../store-api';
```

**AdminPanel.tsx:**
```typescript
import { getUsers, getMeetings, createUser, updateUser, deleteUser, toggleUserActive, changeUserRole, resetUserPassword, updateMeeting, deleteMeeting, createMeeting } from '../store-api';
```

**Notifications.tsx:**
```typescript
import { getNotifications, markNotificationRead, markAllNotificationsRead, clearAllNotifications } from '../store-api';
```

**Profile.tsx:**
```typescript
import { updateProfile, changePassword } from '../store-api';
```

### 8.3. Измените функции на async/await

Пример для Dashboard.tsx:

```typescript
useEffect(() => {
  const loadData = async () => {
    const meetings = await getMeetings();
    const users = await getUsers();
    setMeetings(meetings);
    setUsers(users);
  };
  loadData();
  
  const timer = setInterval(() => setCurrentTime(new Date()), 1000);
  const dataTimer = setInterval(loadData, 30000);
  
  return () => {
    clearInterval(timer);
    clearInterval(dataTimer);
  };
}, []);
```

---

## 🔧 Шаг 9: Сборка и запуск Frontend

```powershell
# Установить зависимости (если нужно)
npm install

# Собрать проект
npm run build

# Запустить сервер
serve -s dist -l 3000
```

---

## 🔧 Шаг 10: Проверка работы

1. Откройте **http://localhost:3000**
2. Войдите как `admin` / `admin123`
3. Создайте конференцию
4. Откройте второй браузер (или режим инкогнито)
5. Войдите как `ivanov` / `user123`
6. Проверьте что конференция видна

---

## 🐛 Решение проблем

### Проблема: MySQL не запускается

```powershell
# Проверить логи
docker compose logs mysql

# Перезапустить MySQL
docker compose restart mysql

# Если не помогает, удалить volume и создать заново
docker compose down -v
docker compose up -d mysql
```

### Проблема: Backend не подключается к MySQL

```powershell
# Проверить что MySQL запущен
docker compose ps mysql

# Проверить переменные окружения в backend
docker compose exec backend env | grep DB_

# Перезапустить backend
docker compose restart backend
```

### Проблема: Ошибки CORS

```powershell
# Очистить кэш конфигурации
docker compose exec backend php artisan config:clear

# Перезапустить backend
docker compose restart backend
```

### Проблема: Миграции не выполняются

```powershell
# Проверить подключение к MySQL
docker compose exec backend php artisan migrate:status

# Если ошибка подключения, проверить .env
docker compose exec backend cat .env | grep DB_
```

---

## 📊 Итоговая проверка

После всех шагов проверьте:

- [ ] MySQL запущен и работает
- [ ] Backend подключается к MySQL
- [ ] Миграции выполнены
- [ ] Тестовые данные загружены
- [ ] Frontend работает с API
- [ ] Пользователи видят общие данные
- [ ] Конференции синхронизируются

---

## 🎯 Быстрый старт (все команды)

```powershell
# 1. Очистка
docker compose down -v
docker volume prune -f

# 2. Запуск MySQL
docker compose up -d mysql
timeout /t 30

# 3. Запуск Backend
docker compose up -d backend
timeout /t 10

# 4. Миграции
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan migrate:fresh
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder

# 5. Запуск всех сервисов
docker compose up -d

# 6. Сборка Frontend
npm run build
serve -s dist -l 3000

# 7. Открыть http://localhost:3000
```

---

<div align="center">

## ✅ Готово!

**MySQL запущен, Frontend подключен к API, пользователи видят общие данные!**

</div>
