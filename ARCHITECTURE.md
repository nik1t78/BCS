# 🏗️ Архитектура системы ВКС Расписание

## 📐 Общая архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                         NGINX (Reverse Proxy)                │
│                    Порт 80/443 (HTTP/HTTPS)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────┐           ┌─────────────────────┐
│   Frontend      │           │    Backend (Laravel) │
│   (React SPA)   │           │    PHP 8.2 + FPM     │
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
         │     MySQL       │  │     Redis       │  │   File Storage  │
         │   (Database)    │  │    (Cache)      │  │   (Uploads)     │
         │                 │  │                 │  │                 │
         │  • users        │  │  • sessions     │  │  • avatars      │
         │  • meetings     │  │  • cache        │  │  • attachments  │
         │  • notifications│  │  • queues       │  │                 │
         └─────────────────┘  └─────────────────┘  └─────────────────┘
```

## 🗄️ Схема базы данных

### Таблица: users

```sql
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified_at TIMESTAMP NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'moderator', 'user') DEFAULT 'user',
    phone VARCHAR(20) NULL,
    department VARCHAR(255) NULL,
    position VARCHAR(255) NULL,
    avatar VARCHAR(255) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    remember_token VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_is_active (is_active)
);
```

### Таблица: meetings

```sql
CREATE TABLE meetings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    organizer_id BIGINT UNSIGNED NOT NULL,
    participants JSON NULL,
    participant_emails JSON NULL,
    link VARCHAR(500) NULL,
    room VARCHAR(255) NULL,
    status ENUM('scheduled', 'in-progress', 'completed', 'cancelled') DEFAULT 'scheduled',
    reminder_minutes INT DEFAULT 15,
    recurring ENUM('none', 'daily', 'weekly', 'monthly') DEFAULT 'none',
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_date_time (date, start_time),
    INDEX idx_organizer (organizer_id),
    INDEX idx_status (status),
    INDEX idx_priority (priority)
);
```

### Таблица: notifications

```sql
CREATE TABLE notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    meeting_id BIGINT UNSIGNED NULL,
    message TEXT NOT NULL,
    type ENUM('reminder', 'starting', 'info', 'warning', 'user-added') NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    INDEX idx_user_read (user_id, read),
    INDEX idx_type (type),
    INDEX idx_created (created_at)
);
```

### Таблица: user_settings

```sql
CREATE TABLE user_settings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    browser_notifications BOOLEAN DEFAULT TRUE,
    default_reminder_minutes INT DEFAULT 15,
    work_hours_start TIME DEFAULT '09:00:00',
    work_hours_end TIME DEFAULT '18:00:00',
    timezone VARCHAR(50) DEFAULT 'Europe/Moscow',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## 🔐 Система авторизации

### Flow авторизации

```
1. Регистрация
   POST /api/auth/register
   └─> Создание пользователя
   └─> Генерация токена
   └─> Возврат user + token

2. Вход
   POST /api/auth/login
   └─> Проверка credentials
   └─> Проверка is_active
   └─> Генерация токена
   └─> Возврат user + token

3. Запросы с токеном
   GET /api/meetings
   Headers: Authorization: Bearer {token}
   └─> Laravel Sanctum проверяет токен
   └─> Загрузка пользователя
   └─> Выполнение запроса

4. Выход
   POST /api/auth/logout
   └─> Удаление токена
```

### Роли и права доступа

| Роль | Просмотр | Создание | Редактирование | Удаление | Админ |
|------|----------|----------|----------------|----------|-------|
| User | ✅ Свои | ✅ Свои | ✅ Свои | ✅ Свои | ❌ |
| Moderator | ✅ Все | ✅ Все | ✅ Все | ✅ Все | ⚠️ Частично |
| Admin | ✅ Все | ✅ Все | ✅ Все | ✅ Все | ✅ Все |

## 📡 API Endpoints

### Auth

```
POST   /api/auth/register     # Регистрация
POST   /api/auth/login        # Вход
POST   /api/auth/logout       # Выход
GET    /api/auth/user         # Текущий пользователь
```

### Meetings

```
GET    /api/meetings          # Список (с фильтрами)
POST   /api/meetings          # Создать
GET    /api/meetings/{id}     # Получить
PUT    /api/meetings/{id}     # Обновить
DELETE /api/meetings/{id}     # Удалить
```

### Notifications

```
GET    /api/notifications              # Список
PUT    /api/notifications/{id}/read    # Отметить прочитанным
PUT    /api/notifications/read-all     # Прочитать все
DELETE /api/notifications/clear        # Очистить
```

### Admin

```
GET    /api/admin/users                # Список пользователей
POST   /api/admin/users                # Создать пользователя
PUT    /api/admin/users/{id}           # Обновить
DELETE /api/admin/users/{id}           # Удалить
PUT    /api/admin/users/{id}/role      # Изменить роль
PUT    /api/admin/users/{id}/toggle-active  # Блок/разблок
GET    /api/admin/stats                # Статистика
```

## 🔄 Система уведомлений

### Типы уведомлений

1. **reminder** - Напоминание за N минут до начала
2. **starting** - Конференция начинается сейчас
3. **user-added** - Вас добавили в конференцию
4. **info** - Информационное сообщение
5. **warning** - Предупреждение

### Механизм работы

```
Каждую минуту (cron):
├─> Проверка всех конференций на сегодня
├─> Для каждой конференции:
│   ├─> Проверка: start_time == now?
│   │   └─> Отправить "starting" уведомление
│   └─> Проверка: needsReminder(now)?
│       └─> Отправить "reminder" уведомление
└─> Запись в БД notifications
└─> Email уведомления (опционально)
└─> Push уведомления (опционально)
```

## 🎨 Frontend архитектура

### Структура компонентов

```
src/
├── components/
│   ├── AuthPage.tsx          # Вход/Регистрация
│   ├── Tour.tsx              # Интерактивный тур
│   ├── Tooltip.tsx           # Подсказки
│   ├── Dashboard.tsx         # Главная страница
│   ├── Schedule.tsx          # Расписание
│   ├── UserPanel.tsx         # Мои конференции
│   ├── AdminPanel.tsx        # Админ-панель
│   ├── Notifications.tsx     # Уведомления
│   └── Profile.tsx           # Профиль
├── types.ts                  # TypeScript типы
├── store.ts                  # LocalStorage API
├── utils/
│   └── export.ts             # Экспорт данных
└── App.tsx                   # Главный компонент
```

### State management

Используется LocalStorage для хранения:
- `vks_auth` - Данные авторизации (token + user)
- `vks_users` - Список пользователей
- `vks_meetings` - Конференции
- `vks_notifications` - Уведомления
- `vks_settings` - Настройки

В production с Laravel API:
- Auth data → LocalStorage (token)
- Meetings → API запросы
- Notifications → API запросы
- Settings → API запросы

## 🚀 Deployment

### Production checklist

- [ ] SSL сертификат установлен
- [ ] APP_DEBUG=false в .env
- [ ] APP_ENV=production в .env
- [ ] Сильные пароли для БД
- [ ] Настроен backup БД
- [ ] Настроен мониторинг
- [ ] Настроены логи
- [ ] Настроены очереди (Redis)
- [ ] Настроен cron для scheduler
- [ ] Настроены email уведомления
- [ ] Настроены push уведомления

### Мониторинг

```bash
# Проверка здоровья
curl http://your-domain.com/api/health

# Логи
docker compose logs -f --tail=100

# Статистика
docker stats
```

## 📦 Зависимости

### Frontend

```json
{
  "react": "^18.x",
  "typescript": "^5.x",
  "tailwindcss": "^3.x",
  "vite": "^5.x"
}
```

### Backend

```json
{
  "laravel/framework": "^10.x",
  "laravel/sanctum": "^3.x",
  "predis/predis": "^2.x"
}
```

### Infrastructure

- Docker 20.10+
- Docker Compose 2.0+
- Nginx 1.18+
- PHP 8.2+
- MySQL 8.0+
- Redis 6.0+
- Node.js 20+

## 🔒 Безопасность

### Реализовано

- ✅ Хеширование паролей (bcrypt)
- ✅ Sanctum токены
- ✅ CORS настройки
- ✅ Валидация входных данных
- ✅ Защита от CSRF
- ✅ Защита от XSS
- ✅ Rate limiting
- ✅ Ролевая модель доступа

### Рекомендации

- ⚠️ Регулярное обновление зависимостей
- ⚠️ Мониторинг подозрительной активности
- ⚠️ Резервное копирование
- ⚠️ Аудит безопасности
- ⚠️ 2FA для админов
