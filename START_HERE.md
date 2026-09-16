# 🚀 ВКС Расписание - Полная документация

## 📋 Содержание

1. [Быстрый старт](#быстрый-старт)
2. [Роли и права доступа](#роли-и-права-доступа)
3. [Архитектура](#архитектура)
4. [API Endpoints](#api-endpoints)
5. [Команды](#команды)
6. [Troubleshooting](#troubleshooting)

---

## 🚀 Быстрый старт

### Требования

- Docker 20.10+
- Docker Compose 2.0+
- Git

### Установка (3 команды)

```bash
# 1. Клонирование проекта
git clone <your-repo-url> vks-schedule
cd vks-schedule

# 2. Установка Laravel backend
cd backend
composer create-project laravel/laravel . --no-interaction
cd ..

# 3. Запуск Docker
docker compose up -d --build
```

### Инициализация базы данных

```bash
# Генерация ключа приложения
docker compose exec backend php artisan key:generate

# Запуск миграций
docker compose exec backend php artisan migrate

# Заполнение демо-данными
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

### Доступ

- **Приложение**: http://localhost
- **MailHog** (тестовые письма): http://localhost:8025
- **MySQL**: localhost:3306

### Демо-аккаунты

| Роль | Email | Пароль |
|------|-------|--------|
| 👑 Администратор | admin@vks.local | admin123 |
| 🔧 Модератор | sidorov@vks.local | mod123 |
| 👤 Пользователь | ivanov@vks.local | user123 |
| 👤 Пользователь | petrova@vks.local | user123 |

---

## 👥 Роли и права доступа

### 👑 Администратор (admin)

**Полный доступ ко всем функциям системы.**

#### Права:
- ✅ Просмотр всех конференций (включая приватные)
- ✅ Создание/редактирование/удаление любых конференций
- ✅ Управление пользователями (CRUD)
- ✅ Назначение ролей
- ✅ Блокировка/разблокировка аккаунтов
- ✅ Просмотр статистики
- ✅ Экспорт данных
- ✅ Импорт пользователей
- ✅ Настройки системы

#### API доступ:
```
GET    /api/admin/users              # Список пользователей
POST   /api/admin/users              # Создать пользователя
PUT    /api/admin/users/{id}         # Обновить
DELETE /api/admin/users/{id}         # Удалить
PUT    /api/admin/users/{id}/role    # Изменить роль
PUT    /api/admin/users/{id}/toggle-active  # Блок/разблок
GET    /api/admin/stats              # Статистика
```

---

### 🔧 Модератор (moderator)

**Расширенные права, но без управления пользователями.**

#### Права:
- ✅ Просмотр всех конференций (включая приватные)
- ✅ Создание/редактирование/удаление любых конференций
- ✅ Просмотр списка пользователей (без создания/удаления)
- ✅ Блокировка/разблокировка аккаунтов
- ✅ Просмотр статистики конференций
- ❌ Создание новых пользователей
- ❌ Удаление пользователей
- ❌ Изменение ролей

#### API доступ:
```
GET    /api/admin/users              # Список пользователей
GET    /api/admin/users/{id}         # Просмотр пользователя
PUT    /api/admin/users/{id}         # Обновить
PUT    /api/admin/users/{id}/toggle-active  # Блок/разблок
```

---

### 👤 Пользователь (user)

**Базовые права для работы с конференциями.**

#### Права:
- ✅ Просмотр своих конференций
- ✅ Просмотр публичных конференций
- ✅ Создание своих конференций
- ✅ Редактирование своих конференций
- ✅ Удаление своих конференций
- ✅ Управление профилем
- ✅ Настройка уведомлений
- ❌ Просмотр других пользователей (кроме списка участников)
- ❌ Доступ к админ-панели
- ❌ Просмотр приватных конференций (если не участник)

#### API доступ:
```
GET    /api/meetings                 # Мои конференции
POST   /api/meetings                 # Создать
PUT    /api/meetings/{id}            # Обновить (только свои)
DELETE /api/meetings/{id}            # Удалить (только свои)
GET    /api/notifications            # Уведомления
PUT    /api/notifications/{id}/read  # Отметить прочитанным
PUT    /api/profile                  # Обновить профиль
PUT    /api/settings                 # Настройки
```

---

### 📊 Таблица сравнения ролей

| Функция | Admin | Moderator | User |
|---------|-------|-----------|------|
| Просмотр всех конференций | ✅ | ✅ | ❌ |
| Просмотр приватных конференций | ✅ | ✅ | Только свои |
| Создание конференций | ✅ | ✅ | ✅ |
| Редактирование любых конференций | ✅ | ✅ | Только свои |
| Удаление любых конференций | ✅ | ✅ | Только свои |
| Создание пользователей | ✅ | ❌ | ❌ |
| Удаление пользователей | ✅ | ❌ | ❌ |
| Изменение ролей | ✅ | ❌ | ❌ |
| Блокировка пользователей | ✅ | ✅ | ❌ |
| Просмотр статистики | ✅ | ✅ | Только свою |
| Экспорт данных | ✅ | ✅ | Только свои |

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    NGINX (Reverse Proxy)                     │
│                      Порт 80 (HTTP)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────┐           ┌─────────────────────┐
│   Frontend      │           │    Backend          │
│   (React SPA)   │           │    (Laravel 10)     │
│   Node.js 20    │           │    PHP 8.2 + FPM    │
│                 │           │                      │
│  • Auth         │           │  • REST API          │
│  • Dashboard    │◄─────────►│  • Business Logic    │
│  • Schedule     │   API     │  • Database          │
│  • Meetings     │           │  • Notifications     │
│  • Admin Panel  │           │  • Queue Jobs        │
└─────────────────┘           └──────────┬──────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
         ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
         │     MySQL 8.0   │  │     Redis       │  │    MailHog      │
         │   (Database)    │  │    (Cache)      │  │   (Email Test)  │
         └─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Контейнеры Docker

| Контейнер | Описание | Порт |
|-----------|----------|------|
| vks-frontend | React приложение | - |
| vks-backend | Laravel API | 9000 (PHP-FPM) |
| vks-nginx | Reverse proxy | 80 |
| vks-mysql | База данных | 3306 |
| vks-redis | Кэш и очереди | 6379 |
| vks-queue | Queue worker | - |
| vks-scheduler | Cron scheduler | - |
| vks-mailhog | Тестовый SMTP | 1025, 8025 |

---

## 📡 API Endpoints

### Авторизация

```
POST   /api/auth/register     # Регистрация
  Body: { name, email, password, password_confirmation, phone?, department? }
  Response: { user, token }

POST   /api/auth/login        # Вход
  Body: { email, password }
  Response: { user, token }

POST   /api/auth/logout       # Выход (требует токен)
  Headers: Authorization: Bearer {token}

GET    /api/auth/user         # Текущий пользователь
  Headers: Authorization: Bearer {token}
  Response: { user with settings }
```

### Конференции

```
GET    /api/meetings          # Список конференций
  Query: ?status=scheduled&date=2024-01-15&my=1&search=текст&per_page=50
  Response: { data: [meetings], current_page, last_page, total }

POST   /api/meetings          # Создать конференцию
  Body: {
    title: "Название",
    description: "Описание",
    date: "2024-01-15",
    start_time: "10:00",
    end_time: "11:00",
    room: "Переговорная №1",
    link: "https://meet.example.com/...",
    priority: "high|medium|low",
    reminder_minutes: 15,
    recurring: "none|daily|weekly|monthly",
    participants: [1, 2, 3],  // ID пользователей
    participant_emails: ["guest@example.com"],
    is_private: false
  }

GET    /api/meetings/{id}     # Получить конференцию
PUT    /api/meetings/{id}     # Обновить конференцию
DELETE /api/meetings/{id}     # Удалить конференцию
GET    /api/meetings-stats    # Статистика конференций
```

### Уведомления

```
GET    /api/notifications              # Список
  Query: ?type=reminder&unread=1&per_page=50

PUT    /api/notifications/{id}/read    # Отметить прочитанным
PUT    /api/notifications/read-all     # Прочитать все
DELETE /api/notifications/clear        # Очистить все
GET    /api/notifications/unread-count # Количество непрочитанных
```

### Профиль и настройки

```
PUT    /api/profile                    # Обновить профиль
  Body: { name?, email?, phone?, department?, position? }

POST   /api/profile/change-password    # Сменить пароль
  Body: { current_password, password, password_confirmation }

GET    /api/settings                   # Получить настройки
PUT    /api/settings                   # Обновить настройки
  Body: {
    sound_enabled: true,
    browser_notifications: true,
    default_reminder_minutes: 15,
    work_hours_start: "09:00",
    work_hours_end: "18:00",
    timezone: "Europe/Moscow"
  }
```

### Админ-панель

```
GET    /api/admin/users                # Список пользователей
  Query: ?search=текст&role=user&per_page=50

POST   /api/admin/users                # Создать пользователя (admin)
  Body: { name, email, password, role, phone?, department?, position?, is_active }

PUT    /api/admin/users/{id}           # Обновить пользователя
DELETE /api/admin/users/{id}           # Удалить пользователя (admin)
PUT    /api/admin/users/{id}/role      # Изменить роль (admin)
  Body: { role: "admin|moderator|user" }

PUT    /api/admin/users/{id}/toggle-active  # Блок/разблок
GET    /api/admin/stats                # Статистика пользователей (admin)
```

---

## ⚙️ Команды

### Docker

```bash
# Запуск
docker compose up -d

# Остановка
docker compose down

# Перезапуск
docker compose restart

# Просмотр логов
docker compose logs -f
docker compose logs -f backend
docker compose logs -f nginx

# Статус контейнеров
docker compose ps

# Вход в контейнер
docker compose exec backend bash
docker compose exec mysql mysql -u vks_user -p vks_schedule
```

### Laravel

```bash
# Миграции
docker compose exec backend php artisan migrate
docker compose exec backend php artisan migrate:fresh
docker compose exec backend php artisan migrate:fresh --seed

# Сидирование
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder

# Кэш
docker compose exec backend php artisan cache:clear
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan route:clear
docker compose exec backend php artisan view:clear

# Ключ приложения
docker compose exec backend php artisan key:generate

# Tinker (интерактивная консоль)
docker compose exec backend php artisan tinker

# Очереди
docker compose exec backend php artisan queue:work
docker compose exec backend php artisan queue:restart

# Ручной запуск напоминаний
docker compose exec backend php artisan meetings:send-reminders
```

### Резервное копирование

```bash
# Backup БД
docker compose exec mysql mysqldump -u vks_user -pvks_password_2024 vks_schedule > backup_$(date +%Y%m%d).sql

# Restore БД
docker compose exec -T mysql mysql -u vks_user -pvks_password_2024 vks_schedule < backup.sql

# Backup файлов
tar -czf backup_files_$(date +%Y%m%d).tar.gz backend/storage
```

---

## 🔧 Troubleshooting

### Порт 80 занят

```bash
# Проверка
sudo lsof -i :80

# Остановка процесса
sudo kill -9 <PID>

# Или изменить порт в docker-compose.yml
ports:
  - "8080:80"
```

### Ошибки прав доступа

```bash
docker compose exec backend chown -R www-data:www-data storage bootstrap/cache
docker compose exec backend chmod -R 775 storage bootstrap/cache
```

### Ошибки БД

```bash
# Пересоздание БД
docker compose down -v
docker compose up -d
docker compose exec backend php artisan migrate:fresh --seed
```

### Frontend не загружается

```bash
# Пересборка frontend
docker compose down
docker compose build frontend
docker compose up -d
```

### API возвращает 404

```bash
# Проверка маршрутов
docker compose exec backend php artisan route:list

# Очистка кэша маршрутов
docker compose exec backend php artisan route:clear
```

### Уведомления не отправляются

```bash
# Проверка scheduler
docker compose logs vks-scheduler

# Ручной запуск
docker compose exec backend php artisan meetings:send-reminders

# Проверка cron
docker compose exec scheduler crontab -l
```

### Очистка всего и начало заново

```bash
docker compose down -v
rm -rf backend/vendor backend/node_modules
docker compose up -d --build
docker compose exec backend composer install
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate:fresh --seed
```

---

## 📝 Обновление приложения

```bash
# 1. Остановка
docker compose down

# 2. Получение обновлений
git pull origin main

# 3. Пересборка
docker compose up -d --build

# 4. Миграции
docker compose exec backend php artisan migrate

# 5. Очистка кэша
docker compose exec backend php artisan cache:clear
docker compose exec backend php artisan config:clear
```

---

## 🎉 Готово!

Приложение готово к использованию. Откройте http://localhost и войдите под администратором.

**Первые шаги:**
1. Войдите как admin@vks.local / admin123
2. Создайте пользователей через админ-панель
3. Создайте конференцию
4. Настройте уведомления в профиле

Удачи! 🚀
