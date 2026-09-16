# 🚀 Полная инструкция по развертыванию ВКС Расписание

## 📋 Содержание

1. [Что нужно установить](#что-нужно-установить)
2. [Установка на Linux (Ubuntu/Debian)](#установка-на-linux-ubuntudebian)
3. [Установка на Windows](#установка-на-windows)
4. [Установка на macOS](#установка-на-macos)
5. [Развертывание проекта](#развертывание-проекта)
6. [Настройка production](#настройка-production)
7. [Обновление](#обновление)
8. [Troubleshooting](#troubleshooting)

---

## 📦 Что нужно установить

### Обязательные компоненты

| Компонент | Версия | Назначение | Скачать |
|-----------|--------|------------|---------|
| **Docker** | 20.10+ | Контейнеризация | [docker.com](https://docker.com) |
| **Docker Compose** | 2.0+ | Оркестрация контейнеров | Входит в Docker Desktop |
| **Git** | 2.30+ | Система контроля версий | [git-scm.com](https://git-scm.com) |
| **Composer** | 2.5+ | PHP менеджер пакетов | [getcomposer.org](https://getcomposer.org) |
| **Node.js** | 20+ | JavaScript runtime | [nodejs.org](https://nodejs.org) |

### Опциональные компоненты

| Компонент | Назначение | Скачать |
|-----------|------------|---------|
| **MySQL Workbench** | GUI для MySQL | [mysql.com](https://mysql.com/products/workbench) |
| **VS Code** | Редактор кода | [code.visualstudio.com](https://code.visualstudio.com) |
| **Postman** | Тестирование API | [postman.com](https://postman.com) |

---

## 🐧 Установка на Linux (Ubuntu/Debian)

### 1. Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Установка Docker

```bash
# Удаление старых версий
sudo apt remove docker docker-engine docker.io containerd runc

# Установка зависимостей
sudo apt install -y ca-certificates curl gnupg lsb-release

# Добавление GPG ключа Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Добавление репозитория
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Добавление пользователя в группу docker (без sudo)
sudo usermod -aG docker $USER
newgrp docker

# Проверка
docker --version
docker compose version
```

### 3. Установка Git

```bash
sudo apt install -y git
git --version
```

### 4. Установка Composer

```bash
# Установка зависимостей
sudo apt install -y php-cli unzip curl

# Установка Composer
cd ~
curl -sS https://getcomposer.org/installer -o composer-setup.php
sudo php composer-setup.php --install-dir=/usr/local/bin --filename=composer
rm composer-setup.php

# Проверка
composer --version
```

### 5. Установка Node.js

```bash
# Установка Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Проверка
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 6. Опционально: MySQL Workbench

```bash
sudo snap install mysql-workbench-community
```

---

## 🪟 Установка на Windows

### 1. Установка Docker Desktop

1. Скачайте [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Запустите установщик
3. Следуйте инструкциям
4. Перезагрузите компьютер
5. Запустите Docker Desktop
6. Дождитесь запуска (зелёный индикатор)

```powershell
# Проверка в PowerShell
docker --version
docker compose version
```

### 2. Установка Git

1. Скачайте [Git for Windows](https://git-scm.com/download/win)
2. Установите с настройками по умолчанию
3. Откройте Git Bash

```bash
git --version
```

### 3. Установка Composer

1. Скачайте [Composer-Setup.exe](https://getcomposer.org/Composer-Setup.exe)
2. Установите (автоматически найдёт PHP)
3. Если PHP не установлен, скачайте [PHP for Windows](https://windows.php.net/download/)

```powershell
composer --version
```

### 4. Установка Node.js

1. Скачайте [Node.js LTS](https://nodejs.org/)
2. Установите с настройками по умолчанию

```powershell
node --version
npm --version
```

---

## 🍎 Установка на macOS

### 1. Установка Homebrew (менеджер пакетов)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Установка Docker Desktop

```bash
brew install --cask docker
```

Или скачайте с [docker.com](https://docker.com/products/docker-desktop/)

### 3. Установка Git

```bash
brew install git
git --version
```

### 4. Установка Composer

```bash
brew install composer
composer --version
```

### 5. Установка Node.js

```bash
brew install node@20
node --version
npm --version
```

---

## 🚀 Развертывание проекта

### 1. Клонирование репозитория

```bash
# Создайте директорию для проектов
mkdir ~/projects
cd ~/projects

# Клонируйте репозиторий
git clone https://github.com/your-username/vks-schedule.git
cd vks-schedule
```

**Или создайте проект с нуля:**

```bash
mkdir vks-schedule && cd vks-schedule
git init
```

### 2. Создание Laravel backend

```bash
# Создайте директорию backend
mkdir backend
cd backend

# Создайте Laravel проект
composer create-project laravel/laravel . --prefer-dist

# Вернитесь в корень
cd ..
```

### 3. Копирование файлов проекта

Скопируйте следующие файлы из примеров в соответствующие директории:

```bash
# Модели
cp backend-examples/Meeting.php backend/app/Models/
cp backend-examples/AuthController.php backend/app/Http/Controllers/Api/
cp backend-examples/MeetingController.php backend/app/Http/Controllers/Api/

# Миграции
cp backend-examples/create_meetings_table.php backend/database/migrations/2024_01_01_000001_create_meetings_table.php

# Маршруты
cp backend-examples/api.php backend/routes/api.php

# Команды
cp backend-examples/SendMeetingReminders.php backend/app/Console/Commands/
cp backend-examples/Kernel.php backend/app/Console/
```

### 4. Настройка .env

```bash
# Откройте backend/.env и измените:
nano backend/.env
```

```env
APP_NAME="ВКС Расписание"
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost

DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=vks_schedule
DB_USERNAME=vks_user
DB_PASSWORD=vks_password_2024

REDIS_HOST=redis
REDIS_PASSWORD=null
REDIS_PORT=6379
```

### 5. Запуск Docker

```bash
# Сборка и запуск контейнеров
docker compose up -d --build

# Проверка статуса
docker compose ps
```

Вы должны увидеть:
```
NAME              STATUS
vks-frontend      Up
vks-backend       Up
vks-nginx         Up
vks-mysql         Up
vks-redis         Up
vks-queue         Up
vks-scheduler     Up
vks-mailhog       Up
```

### 6. Инициализация базы данных

```bash
# Генерация ключа приложения
docker compose exec backend php artisan key:generate

# Запуск миграций
docker compose exec backend php artisan migrate

# Заполнение демо-данными
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

### 7. Установка прав доступа

```bash
docker compose exec backend chown -R www-www-data storage bootstrap/cache
docker compose exec backend chmod -R 775 storage bootstrap/cache
```

### 8. Открытие приложения

Откройте браузер и перейдите по адресу:

```
http://localhost
```

### 9. Вход в систему

Используйте демо-аккаунты:

| Роль | Email | Пароль |
|------|-------|--------|
| 👑 Админ | admin@vks.local | admin123 |
| 🔧 Модератор | sidorov@vks.local | mod123 |
| 👤 Пользователь | ivanov@vks.local | user123 |

---

## 🌐 Настройка production

### 1. Измените .env

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://vks.yourdomain.com

# Сильные пароли
DB_PASSWORD=your_strong_password_here
REDIS_PASSWORD=your_redis_password_here
```

### 2. Получите SSL сертификат

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d vks.yourdomain.com
```

### 3. Настройте firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 4. Настройте автоматический backup

```bash
# Создайте скрипт backup
nano /opt/scripts/vks-backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backups/vks"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup БД
docker compose exec -T mysql mysqldump -u vks_user -pvks_password_2024 vks_schedule > "$BACKUP_DIR/db_$DATE.sql"
gzip "$BACKUP_DIR/db_$DATE.sql"

# Удаление старых backup (30 дней)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

```bash
chmod +x /opt/scripts/vks-backup.sh

# Добавьте в crontab
crontab -e
# Каждый день в 2:00
0 2 * * * /opt/scripts/vks-backup.sh
```

### 5. Настройте мониторинг

```bash
# Uptime Robot (бесплатно)
# https://uptimerobot.com
# Добавьте URL: https://vks.yourdomain.com/api/health
```

---

## 🔄 Обновление

### Обновление кода

```bash
# Получение изменений
git pull origin main

# Пересборка контейнеров
docker compose down
docker compose up -d --build

# Применение миграций
docker compose exec backend php artisan migrate

# Очистка кэша
docker compose exec backend php artisan cache:clear
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan route:clear
```

### Обновление зависимостей

```bash
# Frontend
docker compose exec frontend npm update

# Backend
docker compose exec backend composer update
```

---

## 🐛 Troubleshooting

### Порт 80 занят

```bash
# Проверка
sudo lsof -i :80

# Остановка процесса
sudo kill -9 <PID>

# Или измените порт в docker-compose.yml
ports:
  - "8080:80"
```

### Ошибки прав доступа

```bash
docker compose exec backend chown -R www-www-data storage bootstrap/cache
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

# Очистка кэша
docker compose exec backend php artisan route:clear
```

### Контейнер не запускается

```bash
# Просмотр логов
docker compose logs backend
docker compose logs nginx
docker compose logs mysql

# Перезапуск
docker compose restart backend
```

### Полный сброс

```bash
# Остановка и удаление всех данных
docker compose down -v

# Удаление образов
docker compose down --rmi all

# Начало заново
docker compose up -d --build
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate:fresh --seed
```

---

## 📞 Полезные команды

### Docker

```bash
# Запуск
docker compose up -d

# Остановка
docker compose down

# Перезапуск
docker compose restart

# Логи
docker compose logs -f
docker compose logs -f backend

# Статус
docker compose ps

# Вход в контейнер
docker compose exec backend bash
docker compose exec mysql mysql -u vks_user -p vks_schedule
```

### Laravel

```bash
# Миграции
docker compose exec backend php artisan migrate
docker compose exec backend php artisan migrate:fresh --seed

# Кэш
docker compose exec backend php artisan cache:clear
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan route:clear

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

## ✅ Чек-лист перед запуском

- [ ] Docker установлен и запущен
- [ ] Docker Compose установлен
- [ ] Git установлен
- [ ] Composer установлен
- [ ] Node.js установлен
- [ ] Проект клонирован
- [ ] Laravel backend создан
- [ ] Файлы скопированы из примеров
- [ ] .env настроен
- [ ] Docker контейнеры запущены
- [ ] Миграции выполнены
- [ ] Демо-данные загружены
- [ ] Приложение открывается по http://localhost
- [ ] Вход работает с демо-аккаунтами

---

<div align="center">

**Готово к использованию! 🚀**

[Документация](../README.md) • [Безопасность](../SECURITY.md) • [Функции](../FUNCTIONS.md)

</div>
