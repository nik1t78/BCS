# 🎥 ВКС Расписание

> Полнофункциональная система управления видеоконференциями с ролевой моделью доступа, уведомлениями и интеграциями

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Laravel](https://img.shields.io/badge/Laravel-10.x-red.svg)](https://laravel.com)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com)

---

## 📖 О проекте

**ВКС Расписание** — это современная веб-система для планирования и управления видеоконференциями. Идеально подходит для организаций любого размера.

### ✨ Ключевые возможности

- 🔐 **Регистрация и авторизация** с ролевой моделью (Admin/Moderator/User)
- 📅 **Удобное расписание** с просмотром по дням/неделям/месяцам
- 🔔 **Умные уведомления** (звуковые + браузерные + email)
- 👥 **Управление пользователями** с гибкими правами доступа
- 📊 **Статистика и аналитика** конференций
- 🎨 **Современный интерфейс** с подсказками и анимациями
- 📱 **Адаптивный дизайн** для всех устройств
- 💾 **Экспорт данных** в ICS, JSON, CSV
- 🌐 **Доступ из сети** (LAN + интернет)

---

## 🚀 Быстрый старт

### Запуск за 3 команды

```bash
# 1. Клонирование
git clone <your-repo-url> vks-schedule && cd vks-schedule

# 2. Создание Laravel backend
cd backend && composer create-project laravel/laravel . && cd ..

# 3. Запуск
docker compose up -d --build
```

### Инициализация

```bash
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

### Доступ

- **Приложение**: http://localhost
- **MailHog**: http://localhost:8025

### Демо-аккаунты

| Роль | Email | Пароль |
|------|-------|--------|
| 👑 Админ | admin@vks.local | admin123 |
| 🔧 Модератор | sidorov@vks.local | mod123 |
| 👤 Пользователь | ivanov@vks.local | user123 |

---

## 📚 Документация

| Файл | Описание | Время чтения |
|------|----------|--------------|
| 📘 [QUICKSTART.md](./QUICKSTART.md) | Быстрый старт | 2 мин |
| 📗 [START_HERE.md](./START_HERE.md) | Полное руководство | 15 мин |
| 📙 [FUNCTIONS.md](./FUNCTIONS.md) | Все функции системы | 30 мин |
| 📕 [DATABASE.md](./DATABASE.md) | Подключение к БД | 10 мин |
| 📔 [NETWORKING.md](./NETWORKING.md) | Доступ из сети | 10 мин |

---

## 👥 Роли и права

### 👑 Администратор
- ✅ Полный доступ ко всем функциям
- ✅ Управление пользователями (CRUD)
- ✅ Назначение ролей
- ✅ Доступ к приватным конференциям
- ✅ Статистика и аналитика

### 🔧 Модератор
- ✅ Все конференции (включая приватные)
- ✅ Блокировка пользователей
- ❌ Создание/удаление пользователей
- ❌ Изменение ролей

### 👤 Пользователь
- ✅ Свои конференции
- ✅ Публичные конференции
- ✅ Профиль и настройки
- ❌ Админ-панель

---

## 🏗️ Технологии

### Frontend
- **React 18** — UI библиотека
- **TypeScript** — типизация
- **Tailwind CSS** — стилизация
- **Vite** — сборщик

### Backend
- **Laravel 10** — PHP фреймворк
- **MySQL 8.0** — база данных
- **Redis** — кэш и очереди
- **Sanctum** — API аутентификация

### Infrastructure
- **Docker** — контейнеризация
- **Nginx** — web сервер
- **MailHog** — тестирование email

---

## 📊 Функции (51 реализовано / 75 всего)

### ✅ Реализовано

#### Авторизация (4)
- Регистрация пользователей
- Вход в систему
- Выход из системы
- Автоматическая блокировка

#### Профиль (4)
- Просмотр профиля
- Редактирование профиля
- Смена пароля
- Настройки уведомлений

#### Конференции (8)
- Создание конференции
- Просмотр списка
- Просмотр деталей
- Редактирование
- Удаление
- Изменение статуса
- Приватные конференции
- Повторяющиеся конференции

#### Расписание (5)
- Просмотр по дням
- Просмотр по неделям
- Просмотр по месяцам
- Фильтры расписания
- Экспорт расписания

#### Уведомления (10)
- Напоминания о конференциях
- Уведомление о начале
- Уведомление о добавлении
- Список уведомлений
- Отметка прочитанным
- Прочитать все
- Очистка уведомлений
- Счётчик непрочитанных
- Браузерные уведомления (Push)
- Звуковые уведомления

#### Управление пользователями (7)
- Список пользователей
- Создание пользователя
- Редактирование пользователя
- Удаление пользователя
- Изменение роли
- Блокировка/разблокировка
- Просмотр деталей

#### Статистика (3)
- Статистика конференций
- Статистика пользователей
- Дашборд

#### Интерфейс (5)
- Интерактивный тур
- Подсказки (Tooltips)
- Адаптивный дизайн
- Анимации
- Экспорт в ICS/JSON/CSV

#### Поиск (4)
- Глобальный поиск
- Фильтры по статусу
- Фильтры по дате
- Фильтры по участникам

### 🚧 Планируется

- Шаблоны конференций
- Избранные конференции
- Теги и категории
- Комментарии к конференциям
- Загрузка файлов
- Интеграция с Google Calendar
- Интеграция с Zoom/Teams
- Email уведомления
- Telegram уведомления
- Slack уведомления
- Двухфакторная аутентификация
- PWA поддержка
- Тёмная тема
- Мультиязычность

---

## 🗄️ База данных

### Структура

```
users              — Пользователи
meetings           — Конференции
notifications      — Уведомления
user_settings      — Настройки пользователей
personal_access_tokens — API токены
```

### Подключение

```bash
# Через Docker
docker compose exec mysql mysql -u vks_user -p vks_schedule

# Прямое подключение
mysql -h localhost -P 3306 -u vks_user -p vks_schedule
```

📖 **Подробная документация**: [DATABASE.md](./DATABASE.md)

---

## 🌐 Доступ из сети

### Локальная сеть (LAN)

```bash
# Узнать IP сервера
ip addr show

# Доступ для пользователей
http://192.168.1.100
```

### Интернет

#### Вариант 1: VPS + домен (рекомендуется)
```bash
# Арендовать VPS
# Настроить домен
# Получить SSL сертификат
certbot --nginx -d vks.yourdomain.com
```

#### Вариант 2: Cloudflare Tunnel (бесплатно)
```bash
cloudflared tunnel --url http://localhost:80
```

#### Вариант 3: Ngrok (тестирование)
```bash
ngrok http 80
```

📖 **Подробная документация**: [NETWORKING.md](./NETWORKING.md)

---

## 📡 API Endpoints

### Авторизация
```
POST   /api/auth/register     # Регистрация
POST   /api/auth/login        # Вход
POST   /api/auth/logout       # Выход
GET    /api/auth/user         # Текущий пользователь
```

### Конференции
```
GET    /api/meetings          # Список
POST   /api/meetings          # Создать
GET    /api/meetings/{id}     # Получить
PUT    /api/meetings/{id}     # Обновить
DELETE /api/meetings/{id}     # Удалить
```

### Уведомления
```
GET    /api/notifications              # Список
PUT    /api/notifications/{id}/read    # Прочитать
PUT    /api/notifications/read-all     # Прочитать все
DELETE /api/notifications/clear        # Очистить
```

### Админ-панель
```
GET    /api/admin/users                # Список пользователей
POST   /api/admin/users                # Создать
PUT    /api/admin/users/{id}/role      # Изменить роль
PUT    /api/admin/users/{id}/toggle-active  # Блок/разблок
```

📖 **Полная документация API**: [FUNCTIONS.md](./FUNCTIONS.md)

---

## 🔧 Команды

### Docker

```bash
# Запуск
docker compose up -d

# Остановка
docker compose down

# Логи
docker compose logs -f

# Войти в контейнер
docker compose exec backend bash
```

### Laravel

```bash
# Миграции
docker compose exec backend php artisan migrate

# Кэш
docker compose exec backend php artisan cache:clear

# Tinker
docker compose exec backend php artisan tinker

# Напоминания
docker compose exec backend php artisan meetings:send-reminders
```

### Резервное копирование

```bash
# Backup БД
docker compose exec mysql mysqldump -u vks_user -pvks_password_2024 vks_schedule > backup.sql

# Restore
docker compose exec -T mysql mysql -u vks_user -pvks_password_2024 vks_schedule < backup.sql
```

---

## 🔐 Безопасность

### Реализовано

- ✅ Хеширование паролей (bcrypt)
- ✅ Laravel Sanctum токены
- ✅ CORS настройки
- ✅ Валидация входных данных
- ✅ Защита от CSRF
- ✅ Защита от XSS
- ✅ Rate limiting
- ✅ Ролевая модель доступа

### Рекомендации для production

- ⚠️ SSL сертификат (Let's Encrypt)
- ⚠️ Firewall (UFW/firewalld)
- ⚠️ Fail2Ban
- ⚠️ Регулярные backups
- ⚠️ Мониторинг
- ⚠️ 2FA для админов

---

## 📦 Установка

### Требования

- Docker 20.10+
- Docker Compose 2.0+
- Git
- Composer (для Laravel)

### Пошаговая установка

```bash
# 1. Клонирование
git clone <repo-url> vks-schedule
cd vks-schedule

# 2. Backend
cd backend
composer create-project laravel/laravel . --no-interaction
cd ..

# 3. Docker
docker compose up -d --build

# 4. Инициализация
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder

# 5. Готово!
open http://localhost
```

### Автоматическая установка

```bash
chmod +x setup.sh
./setup.sh
```

---

## 🐛 Troubleshooting

### Порт 80 занят

```bash
sudo lsof -i :80
sudo kill -9 <PID>
```

### Ошибки прав доступа

```bash
docker compose exec backend chown -R www-www-data storage bootstrap/cache
docker compose exec backend chmod -R 775 storage bootstrap/cache
```

### Ошибки БД

```bash
docker compose down -v
docker compose up -d
docker compose exec backend php artisan migrate:fresh --seed
```

📖 **Полный список проблем**: [START_HERE.md](./START_HERE.md#troubleshooting)

---

## 📝 Лицензия

MIT License - см. файл [LICENSE](./LICENSE)

---

## 👥 Авторы

Разработано для удобного управления видеоконференциями в организациях.

---

## 🎉 Благодарности

- [Laravel](https://laravel.com) — PHP фреймворк
- [React](https://reactjs.org) — UI библиотека
- [Tailwind CSS](https://tailwindcss.com) — CSS фреймворк
- [Docker](https://docker.com) — Контейнеризация

---

## 📞 Поддержка

- 📖 Документация: [START_HERE.md](./START_HERE.md)
- 🎯 Функции: [FUNCTIONS.md](./FUNCTIONS.md)
- 🗄️ БД: [DATABASE.md](./DATABASE.md)
- 🌐 Сеть: [NETWORKING.md](./NETWORKING.md)

---

<div align="center">

**Сделано с ❤️ для удобного управления видеоконференциями**

[⬆ Вернуться наверх](#вкс-расписание)

</div>
