# 🌐 Настройка доступа из внешней сети

## 📋 Содержание

1. [Доступ из локальной сети (LAN)](#доступ-из-локальной-сети-lan)
2. [Доступ из интернета](#доступ-из-интернета)
3. [Настройка домена и SSL](#настройка-домена-и-ssl)
4. [Альтернативные решения](#альтернативные-решения)
5. [Безопасность](#безопасность)

---

## 🏠 Доступ из локальной сети (LAN)

### Сценарий: Сервер и клиенты в одной сети

Если ваш сервер и пользователи находятся в одной локальной сети (офис, дом):

### 1. Узнать IP сервера

```bash
# Linux
ip addr show
# или
hostname -I

# macOS
ifconfig | grep "inet "

# Windows
ipconfig
```

Пример результата: `192.168.1.100`

### 2. Проверить доступность

```bash
# С другого компьютера в сети
ping 192.168.1.100

# Проверить порт 80
curl http://192.168.1.100:80
```

### 3. Настроить firewall

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS (если есть SSL)
sudo ufw allow 3306/tcp  # MySQL (опционально, только для разработчиков)
sudo ufw status

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=3306/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-all

# Windows (через PowerShell от администратора)
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

### 4. Доступ для пользователей

Пользователи могут открыть приложение по адресу:

```
http://192.168.1.100
```

### 5. Настроить Nginx для LAN

```nginx
# docker/nginx/default.conf
server {
    listen 80;
    server_name 192.168.1.100 localhost;  # Добавить IP сервера
    
    # ... остальная конфигурация
}
```

```bash
# Перезапустить Nginx
docker compose restart nginx
```

---

## 🌍 Доступ из интернета

### Вариант 1: Статический IP + Домен (рекомендуется)

#### Требования:
- Статический IP адрес от провайдера
- Зарегистрированный домен (например, vks.example.com)

#### Шаги:

**1. Получить статический IP**

```bash
# Связаться с провайдером и запросить статический IP
# Или использовать сервисы:
# - Ростелеком Бизнес
# - МТС Бизнес
# - Beeline Бизнес
```

**2. Зарегистрировать домен**

```
Регистраторы:
- reg.ru
- nic.ru
- beget.com
- name.com

Пример: vks.yourcompany.com
Стоимость: ~200-500 руб/год
```

**3. Настроить DNS**

```
A запись:
vks.yourcompany.com → ваш статический IP

Пример:
vks.yourcompany.com → 203.0.113.50

Время propagations: 15 минут - 24 часа
```

**4. Настроить port forwarding на роутере**

```
Войти в админку роутера (обычно 192.168.1.1)

Найти раздел: Port Forwarding / Virtual Server / NAT

Добавить правила:
- External Port: 80 → Internal Port: 80 → IP: 192.168.1.100
- External Port: 443 → Internal Port: 443 → IP: 192.168.1.100
```

**5. Получить SSL сертификат**

```bash
# Установить Certbot
sudo apt install certbot python3-certbot-nginx

# Получить сертификат
sudo certbot --nginx -d vks.yourcompany.com

# Автообновление
sudo certbot renew --dry-run
```

**6. Обновить Nginx конфигурацию**

```nginx
server {
    listen 80;
    server_name vks.yourcompany.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name vks.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/vks.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vks.yourcompany.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    root /var/www/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        root /var/www/backend/public;
        try_files $uri /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass backend:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

**7. Обновить APP_URL**

```bash
# backend/.env
APP_URL=https://vks.yourcompany.com
```

```bash
# Перезапустить
docker compose restart backend nginx
```

**8. Доступ**

```
https://vks.yourcompany.com
```

---

### Вариант 2: Динамический IP + DDNS

Если у вас динамический IP:

**1. Зарегистрироваться в DDNS сервисе**

```
Бесплатные сервисы:
- No-IP (noip.com)
- DynDNS (dyndns.com)
- DuckDNS (duckdns.org)

Пример: vks.ddns.net
```

**2. Установить DDNS клиент**

```bash
# Ubuntu/Debian
sudo apt install ddclient

# Конфигурация
sudo nano /etc/ddclient.conf
```

```ini
# /etc/ddclient.conf
daemon=300
syslog=yes
pid=/var/run/ddclient.pid
ssl=yes

use=web, web=myip.dnsomatic.com
server=dynupdate.no-ip.com
protocol=dyndns2
login=your_username
password=your_password
vks.ddns.net
```

```bash
# Запустить
sudo systemctl start ddclient
sudo systemctl enable ddclient
```

**3. Настроить port forwarding** (как в Варианте 1)

**4. Получить SSL сертификат**

```bash
sudo certbot --nginx -d vks.ddns.net
```

---

### Вариант 3: VPS/Облачный сервер (рекомендуется для production)

#### Аренда VPS

```
Провайдеры:
- DigitalOcean ($5/мес)
- Hetzner (€3.79/мес)
- AWS Lightsail ($3.5/мес)
- Timeweb Cloud (от 200 руб/мес)
- Beget VPS (от 199 руб/мес)

Рекомендуемые характеристики:
- CPU: 2 vCPU
- RAM: 2 GB
- Disk: 40 GB SSD
- OS: Ubuntu 22.04 LTS
```

#### Установка

```bash
# 1. Подключение к серверу
ssh root@your_server_ip

# 2. Обновление системы
apt update && apt upgrade -y

# 3. Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 4. Установка Docker Compose
apt install docker-compose-plugin -y

# 5. Загрузка проекта
cd /var/www
git clone <your-repo-url> vks-schedule
cd vks-schedule

# 6. Запуск
docker compose up -d --build

# 7. Инициализация
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

#### Настройка домена

```bash
# 1. Направить A запись на IP сервера
# 2. Получить SSL
certbot --nginx -d vks.yourdomain.com

# 3. Настроить автообновление SSL
systemctl enable certbot.timer
systemctl start certbot.timer
```

---

## 🔄 Альтернативные решения

### 1. Ngrok (быстрое тестирование)

```bash
# Установка
npm install -g ngrok

# Запуск туннеля
ngrok http 80

# Результат:
# Forwarding  https://abc123.ngrok.io -> http://localhost:80
```

**Плюсы:**
- ✅ Мгновенный публичный доступ
- ✅ Не нужна настройка
- ✅ Бесплатно для тестирования

**Минусы:**
- ❌ URL меняется при каждом запуске
- ❌ Ограничения бесплатной версии
- ❌ Не для production

### 2. Cloudflare Tunnel (бесплатно + надёжно)

```bash
# Установка
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Аутентификация
cloudflared tunnel login

# Создание туннеля
cloudflared tunnel create vks-tunnel

# Конфигурация
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << EOF
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: vks.yourdomain.com
    service: http://localhost:80
  - service: http_status:404
EOF

# DNS запись
cloudflared tunnel route dns vks-tunnel vks.yourdomain.com

# Запуск
cloudflared tunnel run vks-tunnel

# Как сервис
sudo cloudflared service install
systemctl start cloudflared
systemctl enable cloudflared
```

**Плюсы:**
- ✅ Бесплатно
- ✅ Не нужно открывать порты
- ✅ Встроенный DDoS защита
- ✅ SSL автоматически

**Минусы:**
- ❌ Нужен домен на Cloudflare

### 3. Tailscale (для внутренней сети)

```bash
# Установка на всех устройствах
curl -fsSL https://tailscale.com/install.sh | sh

# Авторизация
sudo tailscale up

# Доступ по Tailscale IP
# http://100.64.0.1 (Tailscale IP сервера)
```

**Плюсы:**
- ✅ Безопасная VPN сеть
- ✅ Не нужен публичный IP
- ✅ Бесплатно до 100 устройств

**Минусы:**
- ❌ Нужна установка клиента на все устройства
- ❌ Не для публичного доступа

---

## 🔐 Безопасность

### 1. Firewall настройки

```bash
# Ubuntu/Debian
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Проверка
sudo ufw status verbose
```

### 2. Fail2Ban (защита от брутфорса)

```bash
# Установка
sudo apt install fail2ban

# Конфигурация
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[nginx-botsearch]
enabled = true
port = http,https
filter = nginx-botsearch
logpath = /var/log/nginx/access.log
```

```bash
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban
```

### 3. Rate Limiting в Nginx

```nginx
# docker/nginx/default.conf
http {
    # Ограничение запросов
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    server {
        # API
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            # ...
        }

        # Login (строже)
        location /api/auth/login {
            limit_req zone=login burst=3 nodelay;
            # ...
        }
    }
}
```

### 4. CORS настройки (Laravel)

```php
// backend/config/cors.php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => ['https://vks.yourdomain.com'],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
```

### 5. Security Headers

```nginx
# docker/nginx/default.conf
server {
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Скрыть версию Nginx
    server_tokens off;
}
```

### 6. Резервное копирование

```bash
# Автоматический backup каждый день
0 2 * * * /path/to/backup.sh

# Копирование в облако
aws s3 sync /backups/ s3://your-bucket/backups/
```

### 7. Мониторинг

```bash
# Uptime Robot (бесплатно)
# https://uptimerobot.com
# Проверка каждые 5 минут
# Уведомления при падении

# Или self-hosted:
# - Uptime Kuma
# - Healthchecks.io
```

---

## 📝 Чек-лист для production

### Перед запуском:

- [ ] Статический IP или DDNS настроен
- [ ] Домен зарегистрирован и DNS настроены
- [ ] SSL сертификат получен (Let's Encrypt)
- [ ] Firewall настроен (только 80, 443, 22)
- [ ] Fail2Ban установлен
- [ ] Rate limiting настроен
- [ ] Security headers добавлены
- [ ] APP_URL обновлён в .env
- [ ] APP_DEBUG=false в .env
- [ ] APP_ENV=production в .env
- [ ] Сильные пароли для БД
- [ ] Резервное копирование настроено
- [ ] Мониторинг настроен
- [ ] Логи настроены

### После запуска:

- [ ] Проверить доступ по HTTPS
- [ ] Проверить все функции
- [ ] Проверить уведомления
- [ ] Проверить backup
- [ ] Настроить алерты
- [ ] Документировать для команды

---

## 🎯 Итого

### Варианты доступа:

| Вариант | Сложность | Стоимость | Для чего |
|---------|-----------|-----------|----------|
| LAN | ⭐ | Бесплатно | Офис, дом |
| VPS + домен | ⭐⭐⭐ | ~500 руб/мес | Production |
| Ngrok | ⭐ | Бесплатно | Тестирование |
| Cloudflare Tunnel | ⭐⭐ | Бесплатно | Production (бесплатно) |
| Tailscale | ⭐⭐ | Бесплатно | Внутренняя сеть |

### Рекомендации:

- **Для офиса**: LAN + статический IP
- **Для компании**: VPS + домен + SSL
- **Для тестирования**: Ngrok или Cloudflare Tunnel
- **Для удалённой команды**: Tailscale или VPS

Готово к использованию! 🚀
