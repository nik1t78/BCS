# 🎥 ВКС Расписание

> Полнофункциональная система управления видеоконференциями с ролевой моделью доступа, уведомлениями и админ-панелью

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
- 🔔 **Умные уведомления** (звуковые + браузерные)
- 👥 **Управление пользователями** с гибкими правами доступа
- 📊 **Статистика и аналитика** конференций
- 🎨 **Современный интерфейс** с подсказками и анимациями
- 🌙 **Тёмная тема** для комфортной работы
- 📋 **Шаблоны конференций** для быстрого создания
- 🏷️ **Теги и категории** для организации
- ⭐ **Избранные конференции** для быстрого доступа
- 📎 **Вложения файлов** к конференциям
- 📜 **История изменений** для аудита
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

### 🔒 Безопасность

**Демо-аккаунты удалены!** Для начала работы:

1. Зарегистрируйте первого пользователя через форму регистрации
2. Назначьте роль администратора через базу данных или Tinker
3. Создайте дополнительных пользователей через админ-панель

📖 **Подробная инструкция**: [SECURITY_CLEANUP.md](./SECURITY_CLEANUP.md)

---

## 📚 Документация

**📖 [ALL_DOCUMENTATION.md](./ALL_DOCUMENTATION.md)** — полная документация проекта

В одном файле содержится:
- ✅ Описание всех 59 функций
- ✅ Структура проекта и базы данных
- ✅ API Endpoints
- ✅ Инструкция по установке и развёртыванию
- ✅ Безопасность и настройка
- ✅ Подключение к БД
- ✅ Доступ из сети
- ✅ Устранение неполадок
- ✅ Полезные команды

---

## 👥 Роли и права

### 👑 Администратор (admin)
- ✅ Полный доступ ко всем функциям
- ✅ Управление пользователями (CRUD)
- ✅ Назначение ролей
- ✅ Смена паролей всех пользователей
- ✅ Доступ к приватным конференциям

### 🔧 Модератор (moderator)
- ✅ Все конференции (включая приватные)
- ✅ Блокировка пользователей
- ✅ Редактирование любых конференций
- ❌ Создание/удаление пользователей
- ❌ Изменение ролей

### 👤 Пользователь (user)
- ✅ Свои конференции
- ✅ Публичные конференции
- ✅ Профиль и настройки
- ❌ Админ-панель
- ❌ Приватные конференции (если не участник)

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

---

## 📊 Статистика проекта

- **Функций реализовано**: 59
- **Компонентов React**: 16
- **Контроллеров Laravel**: 5
- **Моделей**: 4
- **Файлов документации**: 1
- **Строк кода**: ~10,000+

---

## 📁 Структура проекта

```
vks-schedule/
├── 📄 ALL_DOCUMENTATION.md    # Полная документация
├── 📄 docker-compose.yml      # Docker конфигурация
│
├── 📂 backend/                # Laravel backend
│   ├── app/
│   │   ├── Console/Commands/  # Artisan команды
│   │   ├── Http/Controllers/  # Контроллеры
│   │   ├── Http/Middleware/   # Middleware
│   │   └── Models/            # Eloquent модели
│   ├── database/
│   │   ├── migrations/        # Миграции БД
│   │   └── seeders/           # Seeders
│   └── routes/                # Маршруты
│
├── 📂 frontend/               # React frontend
│   ├── Dockerfile
│   └── nginx.conf
│
├── 📂 src/                    # Исходный код React
│   ├── components/            # React компоненты
│   ├── utils/                 # Утилиты
│   ├── App.tsx                # Главный компонент
│   ├── store.ts               # LocalStorage API
│   └── types.ts               # TypeScript типы
│
└── 📂 docker/                 # Docker конфигурации
    ├── nginx/
    └── mysql/
```

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
PUT    /api/admin/users/{id}/reset-password # Сменить пароль
```

📖 **Полный список API**: [ALL_DOCUMENTATION.md](./ALL_DOCUMENTATION.md)

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

📖 **Полная инструкция**: [ALL_DOCUMENTATION.md](./ALL_DOCUMENTATION.md#🔐-безопасность)

---

## 🗄️ База данных

### Таблицы
- `users` — Пользователи системы
- `meetings` — Конференции
- `notifications` — Уведомления
- `user_settings` — Настройки пользователей
- `personal_access_tokens` — API токены

### Подключение
```bash
# Через Docker
docker compose exec mysql mysql -u vks_user -p vks_schedule

# Прямое подключение
mysql -h localhost -P 3306 -u vks_user -p vks_schedule
```

📖 **Подробная документация**: [ALL_DOCUMENTATION.md](./ALL_DOCUMENTATION.md#🗄️-структура-базы-данных)

---

## 🌐 Доступ из сети

### Локальная сеть (LAN)
```bash
# Узнать IP сервера
ip addr show

# Открыть порт
sudo ufw allow 80/tcp

# Пользователи открывают:
http://192.168.1.100
```

### Интернет
- **Вариант 1**: VPS + домен + SSL (рекомендуется)
- **Вариант 2**: Cloudflare Tunnel (бесплатно)
- **Вариант 3**: Ngrok (тестирование)

📖 **Подробная инструкция**: [ALL_DOCUMENTATION.md](./ALL_DOCUMENTATION.md#🌐-доступ-из-сети)

---

## 🔧 Полезные команды

### Docker
```bash
docker compose up -d              # Запуск
docker compose down               # Остановка
docker compose logs -f            # Логи
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

## 🐛 Устранение неполадок

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

### Не вижу изменений
Используйте кнопку **"Сброс данных"** в правом нижнем углу экрана

📖 **Полный список проблем**: [ALL_DOCUMENTATION.md](./ALL_DOCUMENTATION.md#🐛-устранение-неполадок)

---

## 📝 Лицензия

MIT License - свободное использование с указанием авторства

---

## 📞 Поддержка

- 📖 **Полная документация**: [ALL_DOCUMENTATION.md](./ALL_DOCUMENTATION.md)
- 🐛 **Баги и предложения**: Создайте issue в репозитории
- 💬 **Вопросы**: Обсуждение в issues

---

## 🎉 Благодарности

- [Laravel](https://laravel.com) — PHP фреймворк
- [React](https://reactjs.org) — UI библиотека
- [Tailwind CSS](https://tailwindcss.com) — CSS фреймворк
- [Docker](https://docker.com) — Контейнеризация

---

<div align="center">

**Сделано с ❤️ для удобного управления видеоконференциями**

[📖 Полная документация](./ALL_DOCUMENTATION.md) • [🚀 Быстрый старт](#🚀-быстрый-старт)

**Версия**: 1.0 | **Статус**: ✅ Production Ready

</div>
