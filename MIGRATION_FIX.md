# 🔧 ИСПРАВЛЕНИЕ МИГРАЦИИ БАЗЫ ДАННЫХ

## ❌ Проблема

Ошибка: **"Table 'users' already exists"**

**Причина:** 
- Таблицы уже были созданы ранее
- В миграции использовалось поле `email`, но в коде используется `login`

---

## ✅ Что было исправлено

### 1. Миграция базы данных
**Файл:** `backend/database/migrations/2024_01_01_000000_create_vks_tables.php`

**Изменения:**
- ❌ Удалено поле `email`
- ❌ Удалено поле `email_verified_at`
- ✅ Добавлено поле `login` (уникальное)
- ✅ Обновлены индексы

### 2. Модель User
**Файл:** `backend/app/Models/User.php`

**Изменения:**
- ✅ Заменено `email` на `login` в `$fillable`
- ✅ Удалено `email_verified_at` из `$casts`

### 3. Контроллер AuthController
**Файл:** `backend/app/Http/Controllers/Api/AuthController.php`

**Изменения:**
- ✅ Заменена валидация `email` на `login`
- ✅ Обновлены запросы к базе данных

### 4. Контроллер UserController
**Файл:** `backend/app/Http/Controllers/Api/UserController.php`

**Изменения:**
- ✅ Заменены все упоминания `email` на `login`
- ✅ Обновлена валидация и поиск

### 5. Seeder
**Файл:** `backend/database/seeders/VksDatabaseSeeder.php`

**Изменения:**
- ✅ Заменены `email` на `login` для всех пользователей
- ✅ Обновлены тестовые данные

---

## 🚀 Что делать сейчас

### Шаг 1: Полная перезагрузка базы данных

```powershell
cd D:\server\BCS-main

# Удалить все таблицы и создать заново
docker compose exec backend php artisan migrate:fresh
```

Эта команда:
- Удалит все старые таблицы
- Создаст новые таблицы с правильными полями
- Применит все миграции

### Шаг 2: Загрузка тестовых данных (опционально)

```powershell
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

### Шаг 3: Проверка работы

Откройте браузер: **http://localhost**

Войдите:
- Логин: `admin`
- Пароль: `admin123`

---

## 📊 Структура таблицы users (новая)

```sql
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    login VARCHAR(255) NOT NULL UNIQUE,  -- ✅ Было email
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'moderator', 'user') DEFAULT 'user',
    phone VARCHAR(20) NULL,
    department VARCHAR(255) NULL,
    position VARCHAR(255) NULL,
    avatar VARCHAR(255) NULL,
    is_active TINYINT(1) DEFAULT 1,
    last_login TIMESTAMP NULL,
    remember_token VARCHAR(100) NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    
    INDEX idx_login (login),
    INDEX idx_role (role),
    INDEX idx_is_active (is_active)
);
```

---

## 🔐 Данные для входа

| Роль | Логин | Пароль |
|------|-------|--------|
| 👑 Админ | `admin` | `admin123` |
| 🔧 Модератор | `sidorov` | `mod123` |
| 👤 Пользователь | `ivanov` | `user123` |
| 👤 Пользователь | `petrova` | `user123` |

---

## 🛠️ Если возникли проблемы

### Проблема: migrate:fresh не работает

**Решение:**
```powershell
# Остановите контейнеры
docker compose down

# Удалите volume с базой данных
docker volume prune

# Запустите снова
docker compose up -d

# Подождите 30 секунд пока MySQL запустится
timeout /t 30

# Выполните миграции
docker compose exec backend php artisan migrate:fresh
```

### Проблема: Ошибка подключения к MySQL

**Решение:**
```powershell
# Проверьте статус MySQL
docker compose ps mysql

# Перезапустите MySQL
docker compose restart mysql

# Подождите 30 секунд
timeout /t 30

# Попробуйте снова
docker compose exec backend php artisan migrate:fresh
```

---

## ✅ Итого

**Все файлы исправлены:**
- ✅ Миграция базы данных
- ✅ Модель User
- ✅ Контроллер AuthController
- ✅ Контроллер UserController
- ✅ Seeder VksDatabaseSeeder

**Выполните команды:**
```powershell
docker compose exec backend php artisan migrate:fresh
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

**Откройте:** http://localhost  
**Войдите:** `admin` / `admin123`

---

<div align="center">

## 🎉 ВСЁ ИСПРАВЛЕНО!

**База данных готова к использованию!**

</div>
