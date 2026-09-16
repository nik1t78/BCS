# ВКС Расписание - Система управления видеоконференциями

Полноценное веб-приложение для управления расписанием видеоконференций с системой регистрации, авторизацией, ролями пользователей, уведомлениями и админ-панелью.

## 🚀 Возможности

### Для пользователей:
- ✅ Регистрация и авторизация
- ✅ Личный профиль с настройками
- ✅ Создание и управление конференциями
- ✅ Просмотр расписания (день/неделя/месяц)
- ✅ Система уведомлений (звуковые + браузерные)
- ✅ Экспорт расписания (ICS, JSON, CSV)
- ✅ Интерактивный тур по приложению
- ✅ Подсказки (tooltips) на всех кнопках

### Для администраторов:
- 🛡️ Управление пользователями (CRUD)
- 🛡️ Назначение ролей (admin/moderator/user)
- 🛡️ Блокировка/разблокировка аккаунтов
- 🛡️ Управление всеми конференциями
- 🛡️ Статистика и аналитика
- 🛡️ Мониторинг системы

## 📋 Демо-аккаунты

| Роль | Email | Пароль |
|------|-------|--------|
| Администратор | admin@vks.local | admin123 |
| Пользователь | ivanov@vks.local | user123 |
| Модератор | sidorov@vks.local | mod123 |

## 🐳 Запуск с Docker и Nginx

### Структура проекта

```
vks-schedule/
├── frontend/          # React приложение (этот проект)
├── backend/           # Laravel API
├── docker/
│   ├── nginx/
│   │   └── default.conf
│   ├── php/
│   │   └── Dockerfile
│   └── mysql/
│       └── my.cnf
├── docker-compose.yml
└── README.md
```

### 1. Установка Docker и Docker Compose

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install docker.io docker-compose-plugin

# Проверка установки
docker --version
docker compose version
```

### 2. Создание docker-compose.yml

```yaml
version: '3.8'

services:
  # Frontend (React)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: vks-frontend
    restart: unless-stopped
    networks:
      - vks-network

  # Backend (Laravel)
  backend:
    build:
      context: ./backend
      dockerfile: docker/php/Dockerfile
    container_name: vks-backend
    restart: unless-stopped
    volumes:
      - ./backend:/var/www/html
      - ./backend/storage:/var/www/html/storage
    environment:
      - DB_CONNECTION=mysql
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_DATABASE=vks_schedule
      - DB_USERNAME=vks_user
      - DB_PASSWORD=your_secure_password
    depends_on:
      - mysql
    networks:
      - vks-network

  # Nginx
  nginx:
    image: nginx:alpine
    container_name: vks-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf
      - ./frontend/dist:/var/www/frontend
      - ./backend/public:/var/www/backend/public
      - ./docker/nginx/ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    networks:
      - vks-network

  # MySQL
  mysql:
    image: mysql:8.0
    container_name: vks-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: vks_schedule
      MYSQL_USER: vks_user
      MYSQL_PASSWORD: your_secure_password
    volumes:
      - mysql_data:/var/lib/mysql
      - ./docker/mysql/my.cnf:/etc/mysql/conf.d/my.cnf
    ports:
      - "3306:3306"
    networks:
      - vks-network

  # Redis (для кэша и очередей)
  redis:
    image: redis:alpine
    container_name: vks-redis
    restart: unless-stopped
    networks:
      - vks-network

  # Laravel Queue Worker
  queue:
    build:
      context: ./backend
      dockerfile: docker/php/Dockerfile
    container_name: vks-queue
    restart: unless-stopped
    command: php artisan queue:work --sleep=3 --tries=3
    volumes:
      - ./backend:/var/www/html
    environment:
      - DB_CONNECTION=mysql
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_DATABASE=vks_schedule
      - DB_USERNAME=vks_user
      - DB_PASSWORD=your_secure_password
    depends_on:
      - backend
      - redis
    networks:
      - vks-network

  # Laravel Scheduler
  scheduler:
    build:
      context: ./backend
      dockerfile: docker/php/Dockerfile
    container_name: vks-scheduler
    restart: unless-stopped
    command: >
      sh -c "while true; do php artisan schedule:run --verbose --no-interaction & sleep 60; done"
    volumes:
      - ./backend:/var/www/html
    environment:
      - DB_CONNECTION=mysql
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_DATABASE=vks_schedule
      - DB_USERNAME=vks_user
      - DB_PASSWORD=your_secure_password
    depends_on:
      - backend
    networks:
      - vks-network

networks:
  vks-network:
    driver: bridge

volumes:
  mysql_data:
```

### 3. Dockerfile для Frontend (React)

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /var/www/frontend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

### 4. Dockerfile для Backend (Laravel)

```dockerfile
# backend/docker/php/Dockerfile
FROM php:8.2-fpm

# Установка зависимостей
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    libzip-dev \
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip

# Установка Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Копирование проекта
COPY . .

# Установка зависимостей
RUN composer install --no-dev --optimize-autoloader

# Права доступа
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

EXPOSE 9000
CMD ["php-fpm"]
```

### 5. Конфигурация Nginx

```nginx
# docker/nginx/default.conf
server {
    listen 80;
    server_name your-domain.com;
    
    # Frontend (React SPA)
    root /var/www/frontend;
    index index.html;

    # API запросы к Laravel
    location /api/ {
        root /var/www/backend/public;
        try_files $uri /index.php?$query_string;
    }

    # Laravel routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # PHP-FPM для Laravel
    location ~ \.php$ {
        fastcgi_pass backend:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Статические файлы
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Безопасность
    location ~ /\.ht {
        deny all;
    }
}
```

### 6. Запуск приложения

```bash
# Клонирование проекта
git clone https://github.com/your-repo/vks-schedule.git
cd vks-schedule

# Создание backend проекта
cd backend
composer create-project laravel/laravel .
cd ..

# Настройка .env для Laravel
cat > backend/.env << EOF
APP_NAME="ВКС Расписание"
APP_ENV=production
APP_KEY=base64:$(openssl rand -base64 32)
APP_DEBUG=false
APP_URL=http://your-domain.com

LOG_CHANNEL=stack
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=vks_schedule
DB_USERNAME=vks_user
DB_PASSWORD=your_secure_password

BROADCAST_DRIVER=log
CACHE_DRIVER=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis

REDIS_HOST=redis
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=smtp
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@your-domain.com
MAIL_FROM_NAME="${APP_NAME}"
EOF

# Сборка и запуск
docker compose up -d --build

# Проверка статуса
docker compose ps

# Просмотр логов
docker compose logs -f
```

### 7. Инициализация базы данных

```bash
# Выполнить миграции
docker compose exec backend php artisan migrate

# Создать таблицы
docker compose exec backend php artisan make:model Meeting -mcr
docker compose exec backend php artisan make:model User -mcr
docker compose exec backend php artisan make:model Notification -mcr

# Запустить миграции
docker compose exec backend php artisan migrate

# Создать администратора
docker compose exec backend php artisan tinker

# В tinker:
\App\Models\User::create([
    'name' => 'Администратор',
    'email' => 'admin@vks.local',
    'password' => bcrypt('admin123'),
    'role' => 'admin',
    'is_active' => true,
]);
```

### 8. Настройка Laravel

```bash
# Создание миграций
docker compose exec backend php artisan make:migration create_meetings_table
docker compose exec backend php artisan make:migration create_notifications_table

# Создание контроллеров
docker compose exec backend php artisan make:controller Api/AuthController
docker compose exec backend php artisan make:controller Api/MeetingController
docker compose exec backend php artisan make:controller Api/UserController
docker compose exec backend php artisan make:controller Api/NotificationController

# Создание команд для уведомлений
docker compose exec backend php artisan make:command SendMeetingReminders
docker compose exec backend php artisan make:command SendMeetingStartingNotification
```

### 9. Настройка SSL (опционально)

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com

# Копирование сертификатов в Docker
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/

# Обновление nginx.conf для HTTPS
# Добавьте в server block:
# listen 443 ssl;
# ssl_certificate /etc/nginx/ssl/fullchain.pem;
# ssl_certificate_key /etc/nginx/ssl/privkey.pem;
```

### 10. Полезные команды

```bash
# Остановка всех контейнеров
docker compose down

# Перезапуск
docker compose restart

# Очистка кэша Laravel
docker compose exec backend php artisan cache:clear
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan route:clear

# Просмотр логов
docker compose logs -f backend
docker compose logs -f nginx
docker compose logs -f mysql

# Вход в контейнер
docker compose exec backend bash
docker compose exec mysql mysql -u vks_user -p vks_schedule

# Резервное копирование БД
docker compose exec mysql mysqldump -u vks_user -p vks_schedule > backup.sql

# Восстановление БД
docker compose exec -T mysql mysql -u vks_user -p vks_schedule < backup.sql

# Обновление приложения
git pull
docker compose down
docker compose up -d --build
docker compose exec backend php artisan migrate
```

## 🔧 Разработка

### Локальный запуск без Docker

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

### Структура API endpoints

```
POST   /api/auth/register          # Регистрация
POST   /api/auth/login             # Вход
POST   /api/auth/logout            # Выход
GET    /api/auth/user              # Текущий пользователь

GET    /api/users                  # Список пользователей (admin)
POST   /api/users                  # Создать пользователя (admin)
PUT    /api/users/{id}             # Обновить пользователя
DELETE /api/users/{id}             # Удалить пользователя (admin)

GET    /api/meetings               # Список конференций
POST   /api/meetings               # Создать конференцию
GET    /api/meetings/{id}          # Получить конференцию
PUT    /api/meetings/{id}          # Обновить конференцию
DELETE /api/meetings/{id}          # Удалить конференцию

GET    /api/notifications          # Уведомления пользователя
PUT    /api/notifications/{id}     # Отметить как прочитанное
PUT    /api/notifications/read-all # Прочитать все

GET    /api/settings               # Настройки пользователя
PUT    /api/settings               # Обновить настройки
```

## 📝 Лицензия

MIT

## 👥 Авторы

Разработано для удобного управления видеоконференциями в организациях.
