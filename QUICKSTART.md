# 🚀 Быстрый старт - ВКС Расписание

## 📋 Что включено

✅ **Frontend**: React + TypeScript + Tailwind CSS
✅ **Backend**: Laravel 10 (примеры кода в `/backend-examples`)
✅ **Docker**: Готовые конфигурации для контейнеризации
✅ **Nginx**: Настройки reverse proxy
✅ **MySQL**: База данных
✅ **Redis**: Кэш и очереди

## 🎯 Демо-доступ

| Роль | Email | Пароль |
|------|-------|--------|
| 👑 Админ | admin@vks.local | admin123 |
| 👤 Пользователь | ivanov@vks.local | user123 |
| 🔧 Модератор | sidorov@vks.local | mod123 |

## ⚡ Быстрый запуск (локально)

### 1. Frontend (уже готов)

```bash
# Установка зависимостей
npm install

# Запуск dev сервера
npm run dev

# Сборка для production
npm run build
```

Приложение будет доступно на `http://localhost:5173`

### 2. Backend (Laravel)

```bash
# Создание проекта Laravel
composer create-project laravel/laravel backend
cd backend

# Установка пакетов
composer require laravel/sanctum
composer require predis/predis

# Настройка .env
cp .env.example .env
php artisan key:generate

# Настройка БД в .env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=vks_schedule
DB_USERNAME=root
DB_PASSWORD=your_password

# Создание таблиц
php artisan make:model Meeting -mcr
php artisan make:model Notification -mcr

# Копирование миграций из /backend-examples
# Запуск миграций
php artisan migrate

# Создание админа
php artisan tinker
>>> App\Models\User::create([
    'name' => 'Администратор',
    'email' => 'admin@vks.local',
    'password' => bcrypt('admin123'),
    'role' => 'admin',
    'is_active' => true
]);

# Запуск сервера
php artisan serve
```

## 🐳 Запуск с Docker (production)

### 1. Подготовка структуры

```bash
# Создание директорий
mkdir -p docker/nginx docker/mysql docker/php

# Копирование конфигураций из README.md
# - docker-compose.yml
# - docker/nginx/default.conf
# - docker/php/Dockerfile
# - frontend/Dockerfile
```

### 2. Сборка и запуск

```bash
# Сборка образов
docker compose build

# Запуск контейнеров
docker compose up -d

# Проверка статуса
docker compose ps

# Просмотр логов
docker compose logs -f
```

### 3. Инициализация

```bash
# Установка зависимостей Laravel
docker compose exec backend composer install

# Генерация ключа
docker compose exec backend php artisan key:generate

# Запуск миграций
docker compose exec backend php artisan migrate

# Создание админа
docker compose exec backend php artisan tinker
```

### 4. Доступ

- **Frontend**: http://your-domain.com
- **API**: http://your-domain.com/api
- **MySQL**: localhost:3306

## 🔧 Настройка Nginx

### Базовая конфигурация

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Frontend
    root /var/www/frontend;
    index index.html;

    # API
    location /api/ {
        root /var/www/backend/public;
        try_files $uri /index.php?$query_string;
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # PHP-FPM
    location ~ \.php$ {
        fastcgi_pass backend:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

### SSL (Let's Encrypt)

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com

# Автообновление
sudo certbot renew --dry-run
```

## 📊 Мониторинг

### Проверка статуса контейнеров

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f nginx
```

### Логи Laravel

```bash
docker compose exec backend tail -f storage/logs/laravel.log
```

### Статистика БД

```bash
docker compose exec mysql mysql -u vks_user -p vks_schedule
mysql> SELECT COUNT(*) FROM users;
mysql> SELECT COUNT(*) FROM meetings;
```

## 🔄 Обновление

```bash
# Остановка
docker compose down

# Получение обновлений
git pull

# Пересборка
docker compose up -d --build

# Миграции
docker compose exec backend php artisan migrate

# Очистка кэша
docker compose exec backend php artisan cache:clear
docker compose exec backend php artisan config:clear
```

## 📝 Полезные команды

### Frontend

```bash
npm run dev          # Dev сервер
npm run build        # Production сборка
npm run preview      # Preview production сборки
```

### Backend

```bash
# Миграции
docker compose exec backend php artisan migrate
docker compose exec backend php artisan migrate:fresh

# Кэш
docker compose exec backend php artisan cache:clear
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan route:clear

# Очереди
docker compose exec backend php artisan queue:work
docker compose exec backend php artisan queue:restart

# Tinker
docker compose exec backend php artisan tinker
```

### Docker

```bash
docker compose up -d              # Запуск
docker compose down               # Остановка
docker compose restart            # Перезапуск
docker compose logs -f            # Логи
docker compose exec backend bash  # Вход в контейнер
```

## 🆘 Решение проблем

### Порт 80 занят

```bash
# Проверка занятого порта
sudo lsof -i :80

# Остановка процесса
sudo kill -9 <PID>

# Или изменить порт в docker-compose.yml
ports:
  - "8080:80"
```

### Ошибки прав доступа

```bash
# Исправление прав для Laravel
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

## 📚 Дополнительная информация

- **Полная документация**: [README.md](./README.md)
- **API документация**: `/backend-examples/api.php`
- **Примеры кода**: `/backend-examples/`

## 🎉 Готово!

Приложение готово к использованию. Откройте браузер и перейдите по адресу вашего домена.

**Первые шаги:**
1. Войдите как администратор (admin@vks.local / admin123)
2. Создайте пользователей через админ-панель
3. Создайте первую конференцию
4. Настройте уведомления в профиле

Удачи! 🚀
