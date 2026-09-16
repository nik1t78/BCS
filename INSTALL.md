# 🛠️ Установка и настройка ВКС Расписание

## 📦 Что нужно скачать и установить

### 1. Обязательные программы

| Программа | Версия | Для чего | Скачать |
|-----------|--------|----------|---------|
| **Docker Desktop** | 20.10+ | Запуск контейнеров | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Git** | 2.30+ | Клонирование проекта | [git-scm.com/downloads](https://git-scm.com/downloads) |
| **Composer** | 2.5+ | PHP пакеты (для backend) | [getcomposer.org](https://getcomposer.org/download/) |
| **Node.js** | 20+ | Frontend разработка | [nodejs.org](https://nodejs.org/) |

### 2. Опциональные программы

| Программа | Для чего | Скачать |
|-----------|----------|---------|
| **VS Code** | Редактор кода | [code.visualstudio.com](https://code.visualstudio.com/) |
| **MySQL Workbench** | Управление БД | [mysql.com/products/workbench](https://www.mysql.com/products/workbench/) |
| **Postman** | Тестирование API | [postman.com/downloads](https://www.postman.com/downloads/) |

---

## 🚀 Пошаговая установка

### Шаг 1: Установка Docker Desktop

#### Windows:
1. Скачайте [Docker Desktop for Windows](https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe)
2. Запустите установщик
3. Перезагрузите компьютер
4. Запустите Docker Desktop
5. Дождитесь запуска (иконка кита в трее станет зелёной)

#### macOS:
1. Скачайте [Docker Desktop for Mac](https://desktop.docker.com/mac/main/arm64/Docker.dmg)
2. Откройте DMG файл
3. Перетащите Docker в Applications
4. Запустите Docker из Applications

#### Linux (Ubuntu/Debian):
```bash
# Установка Docker
sudo apt update
sudo apt install -y docker.io docker-compose-plugin

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker

# Проверка
docker --version
docker compose version
```

### Шаг 2: Установка Git

#### Windows:
1. Скачайте [Git for Windows](https://git-scm.com/download/win)
2. Установите с настройками по умолчанию
3. Откройте Git Bash

#### macOS:
```bash
# Через Homebrew
brew install git

# Или скачайте с git-scm.com
```

#### Linux:
```bash
sudo apt install -y git
```

### Шаг 3: Установка Composer (для Laravel)

#### Windows:
1. Скачайте [Composer-Setup.exe](https://getcomposer.org/Composer-Setup.exe)
2. Установите (автоматически найдёт PHP)

#### macOS/Linux:
```bash
# Установка Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# Проверка
composer --version
```

### Шаг 4: Установка Node.js

#### Все платформы:
1. Скачайте [Node.js LTS](https://nodejs.org/) (версия 20+)
2. Установите с настройками по умолчанию

```bash
# Проверка
node --version  # v20.x.x
npm --version   # 10.x.x
```

---

## 📥 Клонирование и запуск проекта

### 1. Клонирование репозитория

```bash
# Создайте папку для проектов
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
# Создайте папку backend
mkdir backend
cd backend

# Создайте Laravel проект
composer create-project laravel/laravel . --prefer-dist

# Вернитесь в корень проекта
cd ..
```

### 3. Копирование файлов из примеров

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

### 4. Запуск Docker

```bash
# Сборка и запуск всех контейнеров
docker compose up -d --build

# Проверка статуса
docker compose ps
```

Вы должны увидеть все контейнеры в статусе "Up":
- vks-frontend
- vks-backend
- vks-nginx
- vks-mysql
- vks-redis
- vks-queue
- vks-scheduler
- vks-mailhog

### 5. Инициализация базы данных

```bash
# Генерация ключа приложения
docker compose exec backend php artisan key:generate

# Создание таблиц
docker compose exec backend php artisan migrate

# Заполнение демо-данными
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

### 6. Открытие приложения

Откройте браузер и перейдите:

```
http://localhost
```

### 7. Вход в систему

Используйте демо-аккаунты:

| Роль | Email | Пароль |
|------|-------|--------|
| 👑 Админ | admin@vks.local | admin123 |
| 🔧 Модератор | sidorov@vks.local | mod123 |
| 👤 Пользователь | ivanov@vks.local | user123 |

---

## 🔐 Безопасность

### 1. Смена паролей по умолчанию

**Сразу после установки измените пароли всех демо-аккаунтов!**

```bash
# Войдите в tinker
docker compose exec backend php artisan tinker
```

```php
// Изменение пароля админа
$user = App\Models\User::where('email', 'admin@vks.local')->first();
$user->password = bcrypt('YourStrongPassword123!');
$user->save();

// Выход
exit
```

**Или через админ-панель:**
1. Войдите как admin@vks.local / admin123
2. Перейдите в "Админ-панель"
3. Найдите пользователя
4. Нажмите на иконку ключа 🔑
5. Введите новый пароль

### 2. Настройка .env для production

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://vks.yourdomain.com

# Сильные пароли
DB_PASSWORD=YourStrongPassword123!
REDIS_PASSWORD=YourRedisPassword456!

# Email настройки
MAIL_MAILER=smtp
MAIL_HOST=smtp.yourdomain.com
MAIL_PORT=587
MAIL_USERNAME=noreply@yourdomain.com
MAIL_PASSWORD=YourEmailPassword
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@yourdomain.com
MAIL_FROM_NAME="${APP_NAME}"
```

### 3. SSL сертификат

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d vks.yourdomain.com

# Автообновление
sudo certbot renew --dry-run
```

### 4. Firewall

```bash
# Ubuntu/Debian
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Проверка
sudo ufw status
```

### 5. Защита БД

```bash
# БД не должна быть доступна из интернета
# В docker-compose.yml:
mysql:
  ports:
    - "127.0.0.1:3306:3306"  # Только localhost
```

### 6. Резервное копирование

```bash
# Создание скрипта backup
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

# Добавление в crontab
crontab -e
# Каждый день в 2:00
0 2 * * * /opt/scripts/vks-backup.sh
```

### 7. Мониторинг

```bash
# Uptime Robot (бесплатно)
# https://uptimerobot.com
# Добавьте URL: https://vks.yourdomain.com/api/health
```

---

## 📋 Чек-лист безопасности

### Перед запуском в production:

- [ ] Все пароли по умолчанию изменены
- [ ] APP_DEBUG=false в .env
- [ ] APP_ENV=production в .env
- [ ] SSL сертификат установлен
- [ ] Firewall настроен (только 22, 80, 443)
- [ ] БД недоступна из интернета
- [ ] Резервное копирование настроено
- [ ] Мониторинг настроен
- [ ] Логи настроены
- [ ] Rate limiting включён
- [ ] CORS настроен правильно

---

## 🐛 Решение проблем

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

### Контейнер не запускается

```bash
# Просмотр логов
docker compose logs backend
docker compose logs nginx

# Перезапуск
docker compose restart backend
```

### Полный сброс

```bash
# Остановка и удаление всех данных
docker compose down -v

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

# Логи
docker compose logs -f

# Статус
docker compose ps

# Вход в контейнер
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
```

### Резервное копирование

```bash
# Backup БД
docker compose exec mysql mysqldump -u vks_user -pvks_password_2024 vks_schedule > backup.sql

# Restore
docker compose exec -T mysql mysql -u vks_user -pvks_password_2024 vks_schedule < backup.sql
```

---

## 📚 Дополнительная документация

- 📘 [QUICKSTART.md](./QUICKSTART.md) — Быстрый старт
- 📗 [START_HERE.md](./START_HERE.md) — Полное руководство
- 📙 [FUNCTIONS.md](./FUNCTIONS.md) — Все функции
- 📕 [DATABASE.md](./DATABASE.md) — Подключение к БД
- 📔 [NETWORKING.md](./NETWORKING.md) — Доступ из сети
- 🔐 [SECURITY.md](./SECURITY.md) — Безопасность
- 🚀 [DEPLOYMENT.md](./DEPLOYMENT.md) — Развертывание

---

<div align="center">

**Готово к использованию! 🚀**

[Главная документация](./README.md) • [Безопасность](./SECURITY.md) • [Функции](./FUNCTIONS.md)

</div>
