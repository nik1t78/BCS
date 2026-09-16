# 🐧 Развёртывание на Linux (Ubuntu/Debian)

## 📋 Полная пошаговая инструкция

---

## 1️⃣ Требования к серверу

### Минимальные:
- **OS**: Ubuntu 22.04 LTS / Debian 12
- **CPU**: 2 vCPU
- **RAM**: 2 GB
- **Disk**: 20 GB SSD
- **Сеть**: Открытые порты 22, 80, 443

### Рекомендуемые:
- **CPU**: 4 vCPU
- **RAM**: 4 GB
- **Disk**: 40 GB SSD
- **Сеть**: Статический IP, домен

---

## 2️⃣ Подготовка сервера

### Подключение к серверу:
```bash
ssh root@your_server_ip
```

### Обновление системы:
```bash
sudo apt update && sudo apt upgrade -y
```

### Создание пользователя (не работайте под root):
```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

### Установка базовых утилит:
```bash
sudo apt install -y curl wget git unzip htop nano
```

---

## 3️⃣ Установка Docker

### Удаление старых версий:
```bash
sudo apt remove -y docker docker-engine docker.io containerd runc
```

### Установка зависимостей:
```bash
sudo apt install -y ca-certificates curl gnupg lsb-release
```

### Добавление GPG ключа Docker:
```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

### Добавление репозитория:
```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### Установка Docker:
```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Добавление пользователя в группу docker:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Проверка:
```bash
docker --version
docker compose version
```

---

## 4️⃣ Установка дополнительных инструментов

### Git:
```bash
sudo apt install -y git
git --version
```

### Composer (для Laravel):
```bash
cd ~
curl -sS https://getcomposer.org/installer -o composer-setup.php
sudo php composer-setup.php --install-dir=/usr/local/bin --filename=composer
rm composer-setup.php
composer --version
```

### Node.js (опционально, для разработки):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

---

## 5️⃣ Клонирование проекта

```bash
# Создайте директорию
mkdir -p ~/projects
cd ~/projects

# Клонируйте репозиторий
git clone https://github.com/your-username/vks-schedule.git
cd vks-schedule
```

**Или загрузите файлы вручную:**
```bash
# Создайте структуру
mkdir -p vks-schedule
cd vks-schedule

# Загрузите файлы через scp, rsync или FTP
scp -r ./vks-schedule deploy@your_server_ip:~/projects/
```

---

## 6️⃣ Настройка Laravel Backend

### Создание проекта Laravel:
```bash
cd ~/projects/vks-schedule
mkdir -p backend
cd backend

# Создайте Laravel проект
composer create-project laravel/laravel . --prefer-dist --no-interaction
```

### Настройка .env:
```bash
nano .env
```

**Измените следующие параметры:**
```env
APP_NAME="ВКС Расписание"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=http://your_domain.com

DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=vks_schedule
DB_USERNAME=vks_user
DB_PASSWORD=YourStrongPassword123!

REDIS_HOST=redis
REDIS_PASSWORD=YourRedisPassword456!
REDIS_PORT=6379

MAIL_MAILER=smtp
MAIL_HOST=smtp.yourdomain.com
MAIL_PORT=587
MAIL_USERNAME=noreply@yourdomain.com
MAIL_PASSWORD=YourEmailPassword
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@yourdomain.com
MAIL_FROM_NAME="${APP_NAME}"
```

### Копирование файлов из проекта:
```bash
cd ~/projects/vks-schedule

# Модели
cp backend-examples/*.php backend/app/Models/ 2>/dev/null || echo "Модели уже на месте"

# Контроллеры
mkdir -p backend/app/Http/Controllers/Api
cp backend-examples/*Controller.php backend/app/Http/Controllers/Api/ 2>/dev/null || echo "Контроллеры уже на месте"

# Маршруты
cp backend-examples/api.php backend/routes/ 2>/dev/null || echo "Маршруты уже на месте"

# Миграции
cp backend-examples/create_meetings_table.php backend/database/migrations/ 2>/dev/null || echo "Миграции уже на месте"

# Команды
mkdir -p backend/app/Console/Commands
cp backend-examples/SendMeetingReminders.php backend/app/Console/Commands/ 2>/dev/null || echo "Команды уже на месте"
cp backend-examples/Kernel.php backend/app/Console/ 2>/dev/null || echo "Kernel уже на месте"
```

---

## 7️⃣ Запуск Docker

### Сборка и запуск:
```bash
cd ~/projects/vks-schedule
docker compose up -d --build
```

### Проверка статуса:
```bash
docker compose ps
```

**Должны быть запущены:**
- ✅ vks-frontend
- ✅ vks-backend
- ✅ vks-nginx
- ✅ vks-mysql
- ✅ vks-redis
- ✅ vks-queue
- ✅ vks-scheduler

### Просмотр логов:
```bash
# Все логи
docker compose logs -f

# Логи backend
docker compose logs -f backend

# Логи nginx
docker compose logs -f nginx
```

---

## 8️⃣ Инициализация базы данных

### Генерация ключа приложения:
```bash
docker compose exec backend php artisan key:generate
```

### Запуск миграций:
```bash
docker compose exec backend php artisan migrate
```

### Проверка подключения к БД:
```bash
docker compose exec mysql mysql -u vks_user -pYourStrongPassword123! vks_schedule -e "SHOW TABLES;"
```

---

## 9️⃣ Создание первого администратора

### Вариант 1: Через Tinker (рекомендуется)
```bash
docker compose exec backend php artisan tinker
```

**В tinker выполните:**
```php
$user = new App\Models\User();
$user->name = 'Ваше Имя Фамилия';
$user->login = 'admin';
$user->password = bcrypt('YourStrongPassword123!');
$user->role = 'admin';
$user->phone = '+7 (999) 123-45-67';
$user->department = 'IT';
$user->position = 'Системный администратор';
$user->is_active = true;
$user->save();

echo "Пользователь создан с ID: " . $user->id;
exit
```

### Вариант 2: Через SQL
```bash
docker compose exec mysql mysql -u vks_user -pYourStrongPassword123! vks_schedule
```

**В MySQL выполните:**
```sql
INSERT INTO users (name, login, password, role, phone, department, position, is_active, created_at, updated_at)
VALUES (
    'Ваше Имя Фамилия',
    'admin',
    '$2y$10$...', -- Используйте bcrypt хеш
    'admin',
    '+7 (999) 123-45-67',
    'IT',
    'Системный администратор',
    1,
    NOW(),
    NOW()
);
```

### Вариант 3: Через регистрацию + изменение роли
1. Зарегистрируйтесь через веб-интерфейс
2. Измените роль на admin:
```bash
docker compose exec backend php artisan tinker
$user = App\Models\User::where('login', 'your_login')->first();
$user->role = 'admin';
$user->save();
exit
```

---

## 🔟 Настройка Firewall

### Установка UFW:
```bash
sudo apt install -y ufw
```

### Настройка правил:
```bash
# Сброс правил
sudo ufw reset

# Разрешить SSH
sudo ufw allow 22/tcp

# Разрешить HTTP
sudo ufw allow 80/tcp

# Разрешить HTTPS
sudo ufw allow 443/tcp

# Запретить всё остальное
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Включить firewall
sudo ufw enable

# Проверка статуса
sudo ufw status verbose
```

---

## 1️⃣1️⃣ Настройка домена и SSL

### Покупка домена:
Зарегистрируйте домен у любого регистратора:
- reg.ru
- nic.ru
- beget.com
- name.com

### Настройка DNS:
Добавьте A запись:
```
Тип: A
Имя: vks.yourdomain.com (или @)
Значение: ваш_IP_сервера
TTL: 3600
```

**Ожидание распространения DNS:** 15 минут - 24 часа

### Проверка DNS:
```bash
dig vks.yourdomain.com
# или
nslookup vks.yourdomain.com
```

### Установка Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Получение SSL сертификата:
```bash
sudo certbot --nginx -d vks.yourdomain.com
```

**Следуйте инструкциям:**
- Email для уведомлений
- Согласие с условиями
- Перенаправление HTTP → HTTPS (Yes)

### Проверка автообновления:
```bash
sudo certbot renew --dry-run
```

---

## 1️⃣2️⃣ Обновление конфигурации Nginx

### Отредактируйте конфигурацию:
```bash
nano docker/nginx/default.conf
```

**Замените `server_name localhost;` на:**
```nginx
server_name vks.yourdomain.com;
```

### Перезапуск Nginx:
```bash
docker compose restart nginx
```

### Обновите APP_URL в .env:
```bash
nano backend/.env
```

**Измените:**
```env
APP_URL=https://vks.yourdomain.com
```

### Перезапуск backend:
```bash
docker compose restart backend
```

---

## 1️⃣3️⃣ Настройка резервного копирования

### Создание скрипта backup:
```bash
sudo mkdir -p /opt/scripts
sudo nano /opt/scripts/vks-backup.sh
```

**Содержимое скрипта:**
```bash
#!/bin/bash

# Конфигурация
BACKUP_DIR="/backups/vks"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
PROJECT_DIR="/home/deploy/projects/vks-schedule"

# Создание директории
mkdir -p $BACKUP_DIR

cd $PROJECT_DIR

# Backup базы данных
docker compose exec -T mysql mysqldump \
    -u vks_user -pYourStrongPassword123! \
    --single-transaction \
    --routines \
    --triggers \
    vks_schedule > "$BACKUP_DIR/db_$DATE.sql"

# Сжатие
gzip "$BACKUP_DIR/db_$DATE.sql"

# Backup файлов
tar -czf "$BACKUP_DIR/files_$DATE.tar.gz" \
    -C $PROJECT_DIR \
    backend/storage \
    backend/.env

# Удаление старых backup
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Логирование
echo "[$DATE] Backup completed successfully" >> /var/log/vks-backup.log
```

**Сделайте скрипт исполняемым:**
```bash
sudo chmod +x /opt/scripts/vks-backup.sh
```

### Добавление в crontab:
```bash
crontab -e
```

**Добавьте строку:**
```bash
# Backup каждый день в 2:00
0 2 * * * /opt/scripts/vks-backup.sh
```

### Тестовый запуск:
```bash
sudo /opt/scripts/vks-backup.sh
```

### Проверка backup:
```bash
ls -lh /backups/vks/
```

---

## 1️⃣4️⃣ Настройка мониторинга

### Установка Fail2Ban:
```bash
sudo apt install -y fail2ban
```

### Конфигурация:
```bash
sudo nano /etc/fail2ban/jail.local
```

**Содержимое:**
```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
```

**Перезапуск:**
```bash
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban
```

### Мониторинг ресурсов:
```bash
# Установка htop
sudo apt install -y htop

# Запуск
htop
```

### Uptime мониторинг (бесплатно):
1. Зарегистрируйтесь на https://uptimerobot.com
2. Добавьте мониторинг:
   - URL: https://vks.yourdomain.com/api/health
   - Интервал: 5 минут
   - Email для уведомлений

---

## 1️⃣5️⃣ Полезные команды

### Управление Docker:
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
docker compose logs -f nginx

# Статус
docker compose ps

# Вход в контейнер
docker compose exec backend bash
docker compose exec mysql mysql -u vks_user -p vks_schedule
```

### Laravel команды:
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

### База данных:
```bash
# Подключение
docker compose exec mysql mysql -u vks_user -pYourStrongPassword123! vks_schedule

# Backup
docker compose exec mysql mysqldump -u vks_user -pYourStrongPassword123! vks_schedule > backup.sql

# Restore
docker compose exec -T mysql mysql -u vks_user -pYourStrongPassword123! vks_schedule < backup.sql
```

### Обновление:
```bash
# Получение изменений
git pull origin main

# Пересборка
docker compose down
docker compose up -d --build

# Миграции
docker compose exec backend php artisan migrate

# Очистка кэша
docker compose exec backend php artisan cache:clear
docker compose exec backend php artisan config:clear
```

---

## 1️⃣6️⃣ Проверка работоспособности

### Чек-лист:

- [ ] Docker запущен (`docker compose ps`)
- [ ] Все контейнеры в статусе "Up"
- [ ] Приложение доступно по http://your_server_ip
- [ ] SSL сертификат работает (https://vks.yourdomain.com)
- [ ] Firewall настроен (`sudo ufw status`)
- [ ] Fail2Ban работает (`sudo systemctl status fail2ban`)
- [ ] Backup настроен (`crontab -l`)
- [ ] Первый администратор создан
- [ ] Можно войти в систему
- [ ] Можно создать конференцию
- [ ] Уведомления работают

### Тест API:
```bash
curl https://vks.yourdomain.com/api/health
```

**Ожидаемый ответ:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00+00:00",
  "version": "1.0.0"
}
```

---

## 1️⃣7️⃣ Устранение неполадок

### Контейнер не запускается:
```bash
# Просмотр логов
docker compose logs backend
docker compose logs nginx

# Перезапуск
docker compose restart backend
```

### Ошибки прав доступа:
```bash
docker compose exec backend chown -R www-www-data storage bootstrap/cache
docker compose exec backend chmod -R 775 storage bootstrap/cache
```

### Порт занят:
```bash
sudo lsof -i :80
sudo kill -9 <PID>
```

### Ошибки БД:
```bash
# Пересоздание БД
docker compose down -v
docker compose up -d
docker compose exec backend php artisan migrate:fresh
```

### SSL проблемы:
```bash
# Проверка сертификата
sudo certbot certificates

# Обновление
sudo certbot renew --force-renewal
```

---

## 📊 Итоговая структура

```
/home/deploy/projects/vks-schedule/
├── 📄 README.md
├── 📄 ALL_DOCUMENTATION.md
├── 📄 SECURITY_CLEANUP.md
├── 📄 LINUX_DEPLOYMENT.md (этот файл)
├── 📄 docker-compose.yml
│
├── 📂 backend/
│   ├── 📄 Dockerfile
│   ├── 📄 .env
│   ├── 📂 app/
│   ├── 📂 database/
│   └── 📂 routes/
│
├── 📂 frontend/
│   ├── 📄 Dockerfile
│   └── 📄 nginx.conf
│
├── 📂 src/
│   ├── 📂 components/
│   └── 📄 App.tsx
│
└── 📂 docker/
    ├── 📂 nginx/
    └── 📂 mysql/
```

---

## ✅ Финальный чек-лист

### Установка:
- [ ] Ubuntu/Debian установлен
- [ ] Docker установлен
- [ ] Docker Compose установлен
- [ ] Git установлен
- [ ] Composer установлен

### Проект:
- [ ] Проект клонирован
- [ ] Laravel backend создан
- [ ] .env настроен
- [ ] Docker запущен
- [ ] Миграции выполнены

### Безопасность:
- [ ] Firewall настроен
- [ ] SSL сертификат получен
- [ ] Fail2Ban установлен
- [ ] Первый администратор создан
- [ ] Демо-аккаунты удалены

### Мониторинг:
- [ ] Backup настроен
- [ ] Uptime мониторинг настроен
- [ ] Логи проверяются

### Функциональность:
- [ ] Вход работает
- [ ] Создание конференций работает
- [ ] Уведомления работают
- [ ] Подключение к ВКС работает

---

<div align="center">

## 🎉 Развёртывание завершено!

**Ваше приложение доступно по адресу:** https://vks.yourdomain.com

**Версия**: 1.0  
**Статус**: ✅ Production Ready

</div>
