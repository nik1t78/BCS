# 🚀 Развертывание на сервере (Production)

## 📋 Обзор

Теперь когда frontend работает с API, все пользователи видят общие данные из базы MySQL. Для развертывания на сервере нужно:

1. Настроить production окружение
2. Настроить SSL/HTTPS
3. Настроить домен
4. Настроить автозапуск
5. Настроить резервное копирование

---

## 🔧 Вариант 1: Развертывание на VPS (Virtual Private Server)

### Шаг 1: Аренда VPS

Рекомендуемые провайдеры:
- **Timeweb** (Россия) - от 199 руб/мес
- **Beget** (Россия) - от 199 руб/мес
- **DigitalOcean** (международный) - от $5/мес
- **Hetzner** (Европа) - от €3.79/мес

**Минимальные требования:**
- CPU: 2 vCPU
- RAM: 2 GB
- Disk: 40 GB SSD
- OS: Ubuntu 22.04 LTS

### Шаг 2: Подключение к серверу

```bash
# Подключение по SSH
ssh root@your_server_ip

# Или с ключом
ssh -i ~/.ssh/your_key.pem root@your_server_ip
```

### Шаг 3: Установка Docker

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER

# Проверка установки
docker --version
docker compose version
```

### Шаг 4: Установка Git

```bash
sudo apt install git -y
git --version
```

### Шаг 5: Клонирование проекта

```bash
# Создание директории
sudo mkdir -p /var/www
cd /var/www

# Клонирование репозитория
sudo git clone https://github.com/your-username/vks-schedule.git
cd vks-schedule

# Установка прав
sudo chown -R $USER:$USER .
```

### Шаг 6: Настройка .env для production

```bash
# Копирование .env.example
cp backend/.env.example backend/.env

# Редактирование .env
nano backend/.env
```

**Важные изменения для production:**

```env
APP_NAME="ВКС Расписание"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://vks.yourdomain.com

# База данных (используйте сильные пароли!)
DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=vks_schedule
DB_USERNAME=vks_user
DB_PASSWORD=YourStrongPassword123!

# Redis
REDIS_HOST=redis
REDIS_PASSWORD=YourRedisPassword456!
REDIS_PORT=6379

# Mail (опционально)
MAIL_MAILER=smtp
MAIL_HOST=smtp.yourdomain.com
MAIL_PORT=587
MAIL_USERNAME=noreply@yourdomain.com
MAIL_PASSWORD=YourEmailPassword
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@yourdomain.com
MAIL_FROM_NAME="${APP_NAME}"
```

### Шаг 7: Настройка docker-compose.yml для production

Отредактируйте `docker-compose.yml`:

```yaml
services:
  # Frontend
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: vks-frontend
    restart: always  # Изменено на always
    networks:
      - vks-network
    volumes:
      - frontend_build:/app/dist

  # Backend
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: vks-backend
    restart: always  # Изменено на always
    volumes:
      - ./backend:/var/www/html
      - ./backend/storage:/var/www/html/storage
    environment:
      - DB_CONNECTION=mysql
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_DATABASE=vks_schedule
      - DB_USERNAME=vks_user
      - DB_PASSWORD=YourStrongPassword123!
      - REDIS_HOST=redis
      - REDIS_PASSWORD=YourRedisPassword456!
      - REDIS_PORT=6379
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - vks-network

  # Nginx
  nginx:
    image: nginx:alpine
    container_name: vks-nginx
    restart: always  # Изменено на always
    ports:
      - "80:80"
      - "443:443"  # Добавлен HTTPS
    volumes:
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf
      - ./docker/nginx/ssl:/etc/nginx/ssl  # SSL сертификаты
      - frontend_build:/var/www/frontend
      - ./backend/public:/var/www/backend/public
    depends_on:
      - frontend
      - backend
    networks:
      - vks-network

  # MySQL
  mysql:
    image: mysql:8.0
    container_name: vks-mysql
    restart: always  # Изменено на always
    environment:
      MYSQL_ROOT_PASSWORD: YourRootPassword789!
      MYSQL_DATABASE: vks_schedule
      MYSQL_USER: vks_user
      MYSQL_PASSWORD: YourStrongPassword123!
    volumes:
      - mysql_/var/lib/mysql
    ports:
      - "127.0.0.1:3306:3306"  # Только localhost!
    networks:
      - vks-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:alpine
    container_name: vks-redis
    restart: always  # Изменено на always
    command: redis-server --requirepass YourRedisPassword456!
    networks:
      - vks-network

  # Queue Worker
  queue:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: vks-queue
    restart: always  # Изменено на always
    command: php artisan queue:work --sleep=3 --tries=3
    volumes:
      - ./backend:/var/www/html
    environment:
      - DB_CONNECTION=mysql
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_DATABASE=vks_schedule
      - DB_USERNAME=vks_user
      - DB_PASSWORD=YourStrongPassword123!
    depends_on:
      - backend
      - redis
    networks:
      - vks-network

  # Scheduler
  scheduler:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: vks-scheduler
    restart: always  # Изменено на always
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
      - DB_PASSWORD=YourStrongPassword123!
    depends_on:
      - backend
    networks:
      - vks-network

networks:
  vks-network:
    driver: bridge

volumes:
  mysql_
  frontend_build:
```

### Шаг 8: Настройка Nginx для HTTPS

Создайте файл `docker/nginx/default.conf`:

```nginx
# Перенаправление HTTP на HTTPS
server {
    listen 80;
    server_name vks.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS сервер
server {
    listen 443 ssl http2;
    server_name vks.yourdomain.com;

    # SSL сертификаты
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # SSL сессии
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Frontend
    root /var/www/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api/ {
        root /var/www/backend/public;
        try_files $uri /index.php?$query_string;
    }

    # PHP-FPM
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

    # Запрет доступа к скрытым файлам
    location ~ /\.ht {
        deny all;
    }
}
```

### Шаг 9: Получение SSL сертификата

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получение сертификата
sudo certbot certonly --standalone -d vks.yourdomain.com

# Копирование сертификатов в Docker
sudo mkdir -p docker/nginx/ssl
sudo cp /etc/letsencrypt/live/vks.yourdomain.com/fullchain.pem docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/vks.yourdomain.com/privkey.pem docker/nginx/ssl/

# Установка прав
sudo chown -R $USER:$USER docker/nginx/ssl
```

### Шаг 10: Настройка Firewall

```bash
# Установка UFW
sudo apt install ufw -y

# Настройка правил
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Включение firewall
sudo ufw enable

# Проверка статуса
sudo ufw status
```

### Шаг 11: Запуск проекта

```bash
# Запуск всех контейнеров
docker compose up -d --build

# Проверка статуса
docker compose ps

# Выполнение миграций
docker compose exec backend php artisan migrate:fresh

# Загрузка тестовых данных (опционально)
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder

# Создание symbolic link
docker compose exec backend php artisan storage:link

# Очистка кэша
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan cache:clear
```

### Шаг 12: Настройка автообновления SSL

```bash
# Добавление cron задачи
sudo crontab -e

# Добавьте строку:
0 0 1 * * certbot renew --quiet && docker compose restart nginx
```

---

## 🔧 Вариант 2: Развертывание на локальном сервере

### Шаг 1: Подготовка сервера

Если у вас есть локальный сервер (например, старый компьютер):

1. Установите Ubuntu Server 22.04 LTS
2. Настройте статический IP адрес
3. Настройте port forwarding на роутере (порты 80 и 443)

### Шаг 2: Получение белого IP

Если у вас динамический IP:
- Используйте DDNS сервис (No-IP, DynDNS)
- Или арендуйте статический IP у провайдера

### Шаг 3: Настройка домена

1. Зарегистрируйте домен (например, на reg.ru)
2. Настройте DNS записи:
   - A запись: vks.yourdomain.com → ваш IP адрес
   - TTL: 3600

### Шаг 4: Следуйте шагам из Варианта 1

Далее следуйте шагам 3-12 из Варианта 1.

---

## 🔧 Вариант 3: Развертывание в облаке

### AWS (Amazon Web Services)

```bash
# 1. Создайте EC2 инстанс
# 2. Настройте Security Group (откройте порты 22, 80, 443)
# 3. Подключитесь по SSH
ssh -i your-key.pem ubuntu@your-ec2-ip

# 4. Следуйте шагам из Варианта 1
```

### Google Cloud Platform

```bash
# 1. Создайте Compute Engine инстанс
# 2. Настройте Firewall rules
# 3. Подключитесь по SSH
gcloud compute ssh your-instance-name

# 4. Следуйте шагам из Варианта 1
```

### Yandex Cloud

```bash
# 1. Создайте VM инстанс
# 2. Настройте Security groups
# 3. Подключитесь по SSH
ssh ubuntu@your-yc-ip

# 4. Следуйте шагам из Варианта 1
```

---

## 🔐 Настройка безопасности

### Шаг 1: Измените SSH порт

```bash
sudo nano /etc/ssh/sshd_config

# Измените:
Port 2222

# Перезапустите SSH
sudo systemctl restart sshd
```

### Шаг 2: Настройте Fail2Ban

```bash
sudo apt install fail2ban -y

# Создайте конфигурацию
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
```

```bash
sudo systemctl restart fail2ban
```

### Шаг 3: Настройте резервное копирование

```bash
# Создайте скрипт backup
sudo nano /opt/scripts/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backups/vks"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup базы данных
docker compose exec -T mysql mysqldump -u vks_user -pYourStrongPassword123! vks_schedule > "$BACKUP_DIR/db_$DATE.sql"

# Backup файлов
tar -czf "$BACKUP_DIR/files_$DATE.tar.gz" backend/storage

# Удаление старых backup (старше 30 дней)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

```bash
# Сделайте скрипт исполняемым
sudo chmod +x /opt/scripts/backup.sh

# Добавьте в crontab
sudo crontab -e

# Добавьте строку (backup каждый день в 2:00)
0 2 * * * /opt/scripts/backup.sh
```

---

## 📊 Мониторинг

### Uptime Robot (бесплатно)

1. Зарегистрируйтесь на https://uptimerobot.com
2. Добавьте мониторинг:
   - URL: https://vks.yourdomain.com/api/health
   - Interval: 5 minutes
   - Email для уведомлений

### Локальный мониторинг

```bash
# Установка htop
sudo apt install htop -y

# Мониторинг ресурсов
htop

# Мониторинг Docker
docker stats
```

---

## 🔄 Обновление проекта

```bash
# Перейдите в директорию проекта
cd /var/www/vks-schedule

# Получите обновления
git pull origin main

# Пересоберите контейнеры
docker compose down
docker compose up -d --build

# Выполните миграции
docker compose exec backend php artisan migrate

# Очистите кэш
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan cache:clear
```

---

## 📋 Чек-лист перед запуском

- [ ] VPS арендован и настроен
- [ ] Docker установлен
- [ ] Git установлен
- [ ] Проект клонирован
- [ ] .env настроен для production
- [ ] docker-compose.yml обновлен для production
- [ ] SSL сертификат получен
- [ ] Nginx настроен для HTTPS
- [ ] Firewall настроен
- [ ] Миграции выполнены
- [ ] Тестовые данные загружены
- [ ] Автообновление SSL настроено
- [ ] Резервное копирование настроено
- [ ] Мониторинг настроен
- [ ] SSH порт изменен
- [ ] Fail2Ban настроен

---

## 🎯 Итого

### Что нужно для production:

1. **VPS сервер** (от 199 руб/мес)
2. **Домен** (от 200 руб/год)
3. **SSL сертификат** (бесплатно через Let's Encrypt)
4. **Настройка безопасности** (firewall, fail2ban, backup)

### Что получится:

✅ Все пользователи видят общие данные  
✅ HTTPS соединение  
✅ Автоматическое обновление SSL  
✅ Резервное копирование  
✅ Мониторинг доступности  
✅ Безопасный доступ  

---

<div align="center">

## 🚀 Готово к развертыванию!

**Frontend переключен на API, все пользователи видят общие данные!**

</div>
