# 📁 Структура проекта ВКС Расписание

## 📋 Описание файла

Этот документ содержит полную структуру проекта с описанием каждого файла и директории. Используйте его как справочник для навигации по проекту.

---

## 🌳 Дерево файлов

```
vks-schedule/
│
├── 📄 README.md                          # Главная документация проекта
├── 📄 QUICKSTART.md                      # Быстрый старт (2 мин)
├── 📄 START_HERE.md                      # Полное руководство (15 мин)
├── 📄 INSTALL.md                         # Установка и настройка (10 мин)
├── 📄 DEPLOYMENT.md                      # Развертывание в production (15 мин)
├── 📄 SECURITY.md                        # Безопасность (20 мин)
├── 📄 FUNCTIONS.md                       # Все реализованные функции (30 мин)
├── 📄 PLANNED_FEATURES.md                # 24 планируемые функции (15 мин)
├── 📄 DATABASE.md                        # Подключение к БД (10 мин)
├── 📄 NETWORKING.md                      # Доступ из сети (10 мин)
├── 📄 STRUCTURE.md                       # Этот файл - структура проекта
├── 📄 TECHNICAL_SPECIFICATION.md         # Техническое задание (ТЗ)
├── 📄 SUMMARY.md                         # Что добавлено в последней версии
│
├── 📄 docker-compose.yml                 # Docker конфигурация
├── 📄 .gitignore                         # Git ignore файл
├── 📄 setup.sh                           # Скрипт автоматической установки
├── 📄 install.sh                         # Альтернативный скрипт установки
│
├── 📂 frontend/                          # React приложение
│   ├── 📄 Dockerfile                     # Docker образ для frontend
│   ├── 📄 nginx.conf                     # Nginx конфигурация для SPA
│   ├── 📄 package.json                   # NPM зависимости
│   ├── 📄 tsconfig.json                  # TypeScript конфигурация
│   ├── 📄 vite.config.ts                 # Vite сборщик
│   ├── 📄 tailwind.config.js             # Tailwind CSS конфигурация
│   ├── 📄 index.html                     # Главная HTML страница
│   │
│   ├── 📂 public/                        # Публичные файлы
│   │   ├── 📄 favicon.ico                # Иконка сайта
│   │   └── 📂 images/                    # Изображения
│   │
│   └── 📂 src/                           # Исходный код
│       ├── 📄 main.tsx                   # Точка входа
│       ├── 📄 App.tsx                    # Главный компонент
│       ├── 📄 index.css                  # Глобальные стили
│       ├── 📄 types.ts                   # TypeScript типы
│       ├── 📄 store.ts                   # LocalStorage API
│       │
│       ├── 📂 components/                # React компоненты
│       │   ├── 📄 AuthPage.tsx           # Страница входа/регистрации
│       │   ├── 📄 Dashboard.tsx          # Главная страница (дашборд)
│       │   ├── 📄 Schedule.tsx           # Расписание (день/неделя/месяц)
│       │   ├── 📄 UserPanel.tsx          # Мои конференции
│       │   ├── 📄 AdminPanel.tsx         # Админ-панель
│       │   ├── 📄 Notifications.tsx      # Уведомления
│       │   ├── 📄 Profile.tsx            # Профиль пользователя
│       │   ├── 📄 Stats.tsx              # Статистика и аналитика
│       │   ├── 📄 Tour.tsx               # Интерактивный тур
│       │   └── 📄 Tooltip.tsx            # Подсказки
│       │
│       └── 📂 utils/                     # Утилиты
│           └── 📄 export.ts              # Экспорт в ICS/JSON/CSV
│
├── 📂 backend/                           # Laravel backend
│   ├── 📄 Dockerfile                     # Docker образ для backend
│   ├── 📄 .env                           # Переменные окружения
│   ├── 📄 .env.example                   # Пример .env файла
│   ├── 📄 composer.json                  # Composer зависимости
│   │
│   ├── 📂 app/                           # Приложение Laravel
│   │   │
│   │   ├── 📂 Models/                    # Eloquent модели
│   │   │   ├── 📄 User.php               # Модель пользователя
│   │   │   ├── 📄 Meeting.php            # Модель конференции
│   │   │   ├── 📄 Notification.php       # Модель уведомления
│   │   │   └── 📄 UserSetting.php        # Модель настроек
│   │   │
│   │   ├── 📂 Http/                      # HTTP слой
│   │   │   │
│   │   │   ├── 📂 Controllers/           # Контроллеры
│   │   │   │   └── 📂 Api/               # API контроллеры
│   │   │   │       ├── 📄 AuthController.php      # Авторизация
│   │   │   │       ├── 📄 MeetingController.php   # Конференции
│   │   │   │       ├── 📄 UserController.php      # Пользователи
│   │   │   │       ├── 📄 NotificationController.php # Уведомления
│   │   │   │       └── 📄 AdminController.php     # Админ-функции
│   │   │   │
│   │   │   └── 📂 Middleware/            # Middleware
│   │   │       └── 📄 CheckRole.php      # Проверка ролей
│   │   │
│   │   └── 📂 Console/                   # Console команды
│   │       ├── 📄 Kernel.php             # Scheduler
│   │       └── 📂 Commands/              # Artisan команды
│   │           └── 📄 SendMeetingReminders.php  # Отправка напоминаний
│   │
│   ├── 📂 database/                      # База данных
│   │   ├── 📂 migrations/                # Миграции
│   │   │   └── 📄 2024_01_01_000000_create_vks_tables.php
│   │   │
│   │   └── 📂 seeders/                   # Seeders
│   │       └── 📄 VksDatabaseSeeder.php  # Демо-данные
│   │
│   ├── 📂 routes/                        # Маршруты
│   │   └── 📄 api.php                    # API маршруты
│   │
│   └── 📂 storage/                       # Хранилище
│       ├── 📂 app/                       # Файлы приложения
│       ├── 📂 framework/                 # Framework файлы
│       └── 📂 logs/                      # Логи
│
├── 📂 docker/                            # Docker конфигурации
│   ├── 📂 nginx/                         # Nginx
│   │   └── 📄 default.conf               # Основная конфигурация
│   │
│   └── 📂 mysql/                         # MySQL
│       └── 📄 my.cnf                     # Конфигурация MySQL
│
└── 📂 backend-examples/                  # Примеры кода Laravel
    ├── 📄 AuthController.php             # Пример контроллера авторизации
    ├── 📄 MeetingController.php          # Пример контроллера конференций
    ├── 📄 Meeting.php                    # Пример модели конференции
    ├── 📄 create_meetings_table.php      # Пример миграции
    ├── 📄 SendMeetingReminders.php       # Пример команды
    ├── 📄 Kernel.php                     # Пример scheduler
    └── 📄 api.php                        # Пример маршрутов
```

---

## 📖 Описание файлов

### 📘 Документация (корневая директория)

| Файл | Описание | Время чтения |
|------|----------|--------------|
| **README.md** | Главная документация проекта с обзором всех возможностей | 5 мин |
| **QUICKSTART.md** | Краткое руководство для быстрого запуска (3 команды) | 2 мин |
| **START_HERE.md** | Полное руководство по всем аспектам системы | 15 мин |
| **INSTALL.md** | Пошаговая инструкция по установке для всех ОС | 10 мин |
| **DEPLOYMENT.md** | Развертывание в production с настройкой SSL и firewall | 15 мин |
| **SECURITY.md** | Полное руководство по безопасности | 20 мин |
| **FUNCTIONS.md** | Описание всех 51 реализованных функций | 30 мин |
| **PLANNED_FEATURES.md** | Описание 24 планируемых функций | 15 мин |
| **DATABASE.md** | Подключение к БД, структура таблиц, backup | 10 мин |
| **NETWORKING.md** | Настройка доступа из локальной сети и интернета | 10 мин |
| **STRUCTURE.md** | Этот файл - структура проекта | 5 мин |
| **TECHNICAL_SPECIFICATION.md** | Техническое задание (ТЗ) | 15 мин |
| **SUMMARY.md** | Что добавлено в последней версии | 5 мин |

---

### 🐳 Docker конфигурации

| Файл | Описание |
|------|----------|
| **docker-compose.yml** | Основная Docker конфигурация со всеми сервисами |
| **setup.sh** | Скрипт автоматической установки проекта |
| **install.sh** | Альтернативный скрипт установки |

#### Сервисы в docker-compose.yml:
- **frontend** - React приложение (Node.js 20)
- **backend** - Laravel API (PHP 8.2 + FPM)
- **nginx** - Reverse proxy (порт 80)
- **mysql** - База данных (порт 3306)
- **redis** - Кэш и очереди
- **queue** - Queue worker для Laravel
- **scheduler** - Cron scheduler для напоминаний
- **mailhog** - Тестовый SMTP сервер (порт 8025)

---

### 🎨 Frontend (React приложение)

#### Основные файлы:

| Файл | Описание |
|------|----------|
| **src/main.tsx** | Точка входа приложения |
| **src/App.tsx** | Главный компонент с роутингом и авторизацией |
| **src/types.ts** | TypeScript типы (User, Meeting, Notification, etc.) |
| **src/store.ts** | API для работы с LocalStorage |
| **src/index.css** | Глобальные стили и анимации |

#### Компоненты:

| Компонент | Описание | Доступ |
|-----------|----------|--------|
| **AuthPage.tsx** | Страница входа и регистрации | Публичный |
| **Dashboard.tsx** | Главная страница с обзором | Все пользователи |
| **Schedule.tsx** | Расписание (день/неделя/месяц) | Все пользователи |
| **UserPanel.tsx** | Управление своими конференциями | Все пользователи |
| **AdminPanel.tsx** | Админ-панель (пользователи, конференции, статистика) | Admin, Moderator |
| **Notifications.tsx** | Список уведомлений | Все пользователи |
| **Profile.tsx** | Профиль и настройки | Все пользователи |
| **Stats.tsx** | Статистика и аналитика | Все пользователи |
| **Tour.tsx** | Интерактивный тур для новых пользователей | Все пользователи |
| **Tooltip.tsx** | Компонент подсказок | Используется везде |

#### Утилиты:

| Файл | Описание |
|------|----------|
| **utils/export.ts** | Функции экспорта в ICS, JSON, CSV |

---

### 🔧 Backend (Laravel)

#### Модели (app/Models/):

| Модель | Описание | Таблица БД |
|--------|----------|------------|
| **User.php** | Пользователь системы | users |
| **Meeting.php** | Конференция | meetings |
| **Notification.php** | Уведомление | notifications |
| **UserSetting.php** | Настройки пользователя | user_settings |

#### Контроллеры (app/Http/Controllers/Api/):

| Контроллер | Описание | Методы |
|------------|----------|--------|
| **AuthController.php** | Авторизация | register, login, logout, user |
| **MeetingController.php** | Конференции | index, store, show, update, destroy, getStats |
| **UserController.php** | Пользователи | index, store, update, destroy, changeRole, toggleActive |
| **NotificationController.php** | Уведомления | index, markAsRead, markAllAsRead, clearAll |
| **AdminController.php** | Админ-функции | resetPassword, bulkResetPasswords, generateTemporaryPassword |

#### Middleware (app/Http/Middleware/):

| Middleware | Описание |
|------------|----------|
| **CheckRole.php** | Проверка роли пользователя (admin, moderator, user) |

#### Команды (app/Console/Commands/):

| Команда | Описание | Расписание |
|---------|----------|------------|
| **SendMeetingReminders.php** | Отправка напоминаний о конференциях | Каждую минуту |

#### Маршруты (routes/):

| Файл | Описание |
|------|----------|
| **api.php** | Все API маршруты с разделением по ролям |

#### База данных (database/):

| Директория | Описание |
|------------|----------|
| **migrations/** | Миграции для создания таблиц |
| **seeders/** | Seeders для заполнения демо-данными |

---

### 📦 Docker конфигурации

#### Nginx (docker/nginx/):

| Файл | Описание |
|------|----------|
| **default.conf** | Основная конфигурация Nginx для reverse proxy |

**Особенности**:
- Reverse proxy для frontend и backend
- Gzip сжатие
- Кэширование статических файлов
- SPA routing для React
- PHP-FPM для Laravel
- Security headers

#### MySQL (docker/mysql/):

| Файл | Описание |
|------|----------|
| **my.cnf** | Конфигурация MySQL для оптимизации |

**Особенности**:
- UTF-8 кодировка
- Оптимизация производительности
- Логирование медленных запросов

---

### 📚 Примеры кода (backend-examples/)

Эта директория содержит примеры кода Laravel для быстрого копирования в основной проект:

| Файл | Описание |
|------|----------|
| **AuthController.php** | Пример контроллера авторизации |
| **MeetingController.php** | Пример контроллера конференций |
| **Meeting.php** | Пример модели конференции |
| **create_meetings_table.php** | Пример миграции |
| **SendMeetingReminders.php** | Пример artisan команды |
| **Kernel.php** | Пример scheduler конфигурации |
| **api.php** | Пример API маршрутов |

---

## 🗄️ Структура базы данных

### Таблицы:

```
users                    # Пользователи системы
├── id
├── name
├── email (unique)
├── password (hashed)
├── role (admin/moderator/user)
├── phone
├── department
├── position
├── is_active
├── last_login
└── timestamps

meetings                 # Конференции
├── id
├── title
├── description
├── date
├── start_time
├── end_time
├── organizer_id (FK → users)
├── participants (JSON)
├── participant_emails (JSON)
├── link
├── room
├── status
├── reminder_minutes
├── recurring
├── priority
├── is_private
└── timestamps

notifications            # Уведомления
├── id
├── user_id (FK → users)
├── meeting_id (FK → meetings)
├── message
├── type
├── read
└── timestamps

user_settings            # Настройки пользователей
├── id
├── user_id (FK → users, unique)
├── sound_enabled
├── browser_notifications
├── default_reminder_minutes
├── work_hours_start
├── work_hours_end
├── timezone
└── timestamps

personal_access_tokens   # API токены (Laravel Sanctum)
├── id
├── tokenable_id
├── tokenable_type
├── name
├── token
├── abilities
├── last_used_at
└── timestamps
```

---

## 🌐 API Endpoints

### Публичные (без авторизации):
```
POST /api/auth/register          # Регистрация
POST /api/auth/login             # Вход
GET  /api/health                 # Проверка здоровья
```

### Защищённые (требуют токен):
```
POST /api/auth/logout            # Выход
GET  /api/auth/user              # Текущий пользователь

PUT  /api/profile                # Обновить профиль
POST /api/profile/change-password # Сменить пароль

GET  /api/meetings               # Список конференций
POST /api/meetings               # Создать конференцию
GET  /api/meetings/{id}          # Получить конференцию
PUT  /api/meetings/{id}          # Обновить конференцию
DELETE /api/meetings/{id}        # Удалить конференцию

GET  /api/notifications          # Список уведомлений
PUT  /api/notifications/{id}/read # Отметить прочитанным
PUT  /api/notifications/read-all # Прочитать все
DELETE /api/notifications/clear  # Очистить все

GET  /api/settings               # Получить настройки
PUT  /api/settings               # Обновить настройки
```

### Админ-панель (только admin/moderator):
```
GET  /api/admin/users            # Список пользователей
PUT  /api/admin/users/{id}/toggle-active # Блок/разблок
```

### Только для админов:
```
POST /api/admin/users            # Создать пользователя
PUT  /api/admin/users/{id}       # Обновить пользователя
DELETE /api/admin/users/{id}     # Удалить пользователя
PUT  /api/admin/users/{id}/role  # Изменить роль
PUT  /api/admin/users/{id}/reset-password # Сменить пароль
POST /api/admin/users/bulk-reset-passwords # Массовая смена паролей
POST /api/admin/users/{id}/generate-temporary-password # Генерация временного пароля
GET  /api/admin/stats            # Статистика
```

---

## 🔐 Роли и права доступа

### 👑 Администратор (admin)
- ✅ Полный доступ ко всем функциям
- ✅ Управление пользователями (CRUD)
- ✅ Назначение ролей
- ✅ Смена паролей всех пользователей
- ✅ Доступ к приватным конференциям

### 🔧 Модератор (moderator)
- ✅ Все конференции (включая приватные)
- ✅ Блокировка пользователей
- ❌ Создание/удаление пользователей
- ❌ Изменение ролей
- ❌ Смена паролей

### 👤 Пользователь (user)
- ✅ Свои конференции
- ✅ Публичные конференции
- ✅ Профиль и настройки
- ❌ Админ-панель
- ❌ Приватные конференции (если не участник)

---

## 🚀 Быстрый старт

### 1. Клонирование
```bash
git clone <repo-url> vks-schedule
cd vks-schedule
```

### 2. Создание Laravel
```bash
cd backend
composer create-project laravel/laravel .
cd ..
```

### 3. Запуск
```bash
docker compose up -d --build
```

### 4. Инициализация
```bash
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

### 5. Открытие
```
http://localhost
```

---

## 📊 Статистика проекта

### Код:
- **Frontend**: ~3000 строк кода
- **Backend**: ~2000 строк кода
- **Документация**: ~10000 строк

### Функции:
- ✅ Реализовано: 51 функция
- 🚧 Планируется: 24 функции
- 📊 Всего: 75 функций

### Файлы:
- 📄 Документация: 13 файлов
- 🎨 Frontend компоненты: 10 файлов
- 🔧 Backend контроллеры: 5 файлов
- 🗄️ Модели: 4 файла
- 📦 Docker конфигурации: 3 файла

---

## 📞 Полезные команды

### Docker
```bash
docker compose up -d              # Запуск
docker compose down               # Остановка
docker compose logs -f            # Логи
docker compose ps                 # Статус
docker compose exec backend bash  # Вход в контейнер
```

### Laravel
```bash
docker compose exec backend php artisan migrate          # Миграции
docker compose exec backend php artisan cache:clear      # Кэш
docker compose exec backend php artisan tinker           # Tinker
docker compose exec backend php artisan meetings:send-reminders # Напоминания
```

### База данных
```bash
docker compose exec mysql mysql -u vks_user -p vks_schedule  # Подключение к БД
```

---

## 🎯 Навигация по документации

### Для быстрого старта:
1. 📘 [QUICKSTART.md](./QUICKSTART.md) - 2 минуты

### Для полного понимания:
2. 📗 [START_HERE.md](./START_HERE.md) - 15 минут

### Для понимания функций:
3. 📙 [FUNCTIONS.md](./FUNCTIONS.md) - 30 минут

### Для установки:
4. 📕 [INSTALL.md](./INSTALL.md) - 10 минут

### Для развертывания:
5. 📔 [DEPLOYMENT.md](./DEPLOYMENT.md) - 15 минут

### Для безопасности:
6. 📓 [SECURITY.md](./SECURITY.md) - 20 минут

### Для подключения к БД:
7. 📒 [DATABASE.md](./DATABASE.md) - 10 минут

### Для доступа из сети:
8. 📚 [NETWORKING.md](./NETWORKING.md) - 10 минут

### Для понимания что планируется:
9. 📖 [PLANNED_FEATURES.md](./PLANNED_FEATURES.md) - 15 минут

### Для технического задания:
10. 📄 [TECHNICAL_SPECIFICATION.md](./TECHNICAL_SPECIFICATION.md) - 15 минут

---

<div align="center">

**Полная структура проекта для удобной навигации 📁**

[Главная документация](./README.md) • [Быстрый старт](./QUICKSTART.md) • [Полное руководство](./START_HERE.md)

</div>
