# 🗄️ Подключение к базе данных

## 📋 Содержание

1. [Локальное подключение](#локальное-подключение)
2. [Внешнее подключение](#внешнее-подключение)
3. [PHPMyAdmin](#phpmyadmin)
4. [Структура БД](#структура-бд)
5. [Резервное копирование](#резервное-копирование)
6. [Оптимизация](#оптимизация)

---

## 🔌 Локальное подключение

### Через Docker CLI

```bash
# Подключение к MySQL в контейнере
docker compose exec mysql mysql -u vks_user -p vks_schedule

# Пароль: vks_password_2024
```

### Прямое подключение с хоста

```bash
# MySQL клиент
mysql -h localhost -P 3306 -u vks_user -p vks_schedule

# Или с указанием пароля
mysql -h localhost -P 3306 -u vks_user -pvks_password_2024 vks_schedule
```

### Через GUI клиенты

#### MySQL Workbench

```
Host: localhost
Port: 3306
Username: vks_user
Password: vks_password_2024
Database: vks_schedule
```

#### DBeaver

```
Host: localhost
Port: 3306
Database: vks_schedule
Username: vks_user
Password: vks_password_2024
```

#### HeidiSQL

```
Hostname: localhost
Port: 3306
User: vks_user
Password: vks_password_2024
Database: vks_schedule
```

---

## 🌐 Внешнее подключение

### Из другой машины в локальной сети

```bash
# Узнать IP сервера
ip addr show  # Linux
ifconfig      # macOS
ipconfig      # Windows

# Подключение
mysql -h 192.168.1.100 -P 3306 -u vks_user -p vks_schedule
```

### Настройка firewall

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 3306/tcp
sudo ufw status

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3306/tcp
sudo firewall-cmd --reload

# Проверка
sudo netstat -tulpn | grep 3306
```

### Настройка MySQL для внешних подключений

```bash
# Войти в контейнер
docker compose exec mysql bash

# Отредактировать конфиг
mysql -u root -p
```

```sql
-- Разрешить подключения с любого хоста
CREATE USER 'vks_user'@'%' IDENTIFIED BY 'vks_password_2024';
GRANT ALL PRIVILEGES ON vks_schedule.* TO 'vks_user'@'%';
FLUSH PRIVILEGES;

-- Или разрешить только с определённой подсети
CREATE USER 'vks_user'@'192.168.1.%' IDENTIFIED BY 'vks_password_2024';
GRANT ALL PRIVILEGES ON vks_schedule.* TO 'vks_user'@'192.168.1.%';
FLUSH PRIVILEGES;
```

### docker-compose.yml (открыть порт)

```yaml
mysql:
  image: mysql:8.0
  ports:
    - "3306:3306"  # Уже открыт по умолчанию
  environment:
    MYSQL_ROOT_PASSWORD: root_password_2024
    MYSQL_DATABASE: vks_schedule
    MYSQL_USER: vks_user
    MYSQL_PASSWORD: vks_password_2024
```

---

## 🖥️ PHPMyAdmin

### Добавление в docker-compose.yml

```yaml
phpmyadmin:
  image: phpmyadmin/phpmyadmin:latest
  container_name: vks-phpmyadmin
  restart: unless-stopped
  ports:
    - "8080:80"
  environment:
    PMA_HOST: mysql
    PMA_PORT: 3306
    PMA_USER: vks_user
    PMA_PASSWORD: vks_password_2024
    UPLOAD_LIMIT: 64M
  depends_on:
    - mysql
  networks:
    - vks-network
```

### Запуск

```bash
docker compose up -d phpmyadmin
```

### Доступ

```
URL: http://localhost:8080
Username: vks_user
Password: vks_password_2024
```

### Безопасность (production)

```nginx
# Ограничить доступ по IP
location /phpmyadmin/ {
    allow 192.168.1.0/24;
    allow 10.0.0.0/8;
    deny all;
    
    proxy_pass http://phpmyadmin:80;
}

# Или добавить HTTP Basic Auth
location /phpmyadmin/ {
    auth_basic "Restricted Access";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    proxy_pass http://phpmyadmin:80;
}
```

---

## 📊 Структура БД

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
    INDEX idx_is_active (is_active),
    INDEX idx_department (department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
    tags JSON NULL,
    attachments JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_date_time (date, start_time),
    INDEX idx_organizer (organizer_id),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_is_private (is_private),
    FULLTEXT INDEX idx_search (title, description, room)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Таблица: meeting_templates (новая)

```sql
CREATE TABLE meeting_templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    duration_minutes INT DEFAULT 60,
    room VARCHAR(255) NULL,
    link VARCHAR(500) NULL,
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    reminder_minutes INT DEFAULT 15,
    recurring ENUM('none', 'daily', 'weekly', 'monthly') DEFAULT 'none',
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Таблица: meeting_comments (новая)

```sql
CREATE TABLE meeting_comments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    meeting_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    message TEXT NOT NULL,
    parent_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES meeting_comments(id) ON DELETE CASCADE,
    INDEX idx_meeting (meeting_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Таблица: favorites (новая)

```sql
CREATE TABLE favorites (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    meeting_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    UNIQUE KEY unique_favorite (user_id, meeting_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 💾 Резервное копирование

### Автоматический backup (cron)

```bash
# Создать скрипт backup.sh
#!/bin/bash
BACKUP_DIR="/backups/vks"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="vks_backup_$DATE.sql"

# Backup БД
docker compose exec -T mysql mysqldump -u vks_user -pvks_password_2024 vks_schedule > "$BACKUP_DIR/$FILENAME"

# Сжатие
gzip "$BACKUP_DIR/$FILENAME"

# Удаление старых backup (старше 30 дней)
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Backup created: $BACKUP_DIR/$FILENAME.gz"
```

```bash
# Добавить в crontab
crontab -e

# Каждый день в 2:00
0 2 * * * /path/to/backup.sh
```

### Ручной backup

```bash
# Backup БД
docker compose exec mysql mysqldump -u vks_user -pvks_password_2024 vks_schedule > backup_$(date +%Y%m%d).sql

# Сжатие
gzip backup_*.sql

# Backup файлов
tar -czf files_backup_$(date +%Y%m%d).tar.gz backend/storage

# Полный backup
tar -czf full_backup_$(date +%Y%m%d).tar.gz \
    backend/storage \
    backend/.env \
    docker-compose.yml
```

### Восстановление

```bash
# Восстановление БД
gunzip backup_20240115.sql.gz
docker compose exec -T mysql mysql -u vks_user -pvks_password_2024 vks_schedule < backup_20240115.sql

# Восстановление файлов
tar -xzf files_backup_20240115.tar.gz -C /

# Восстановление всего
docker compose down
tar -xzf full_backup_20240115.tar.gz
docker compose up -d
```

### Backup в облако

```bash
# AWS S3
aws s3 cp backup.sql.gz s3://your-bucket/backups/

# Google Cloud Storage
gsutil cp backup.sql.gz gs://your-bucket/backups/

# Яндекс.Облако
aws s3 cp backup.sql.gz s3://your-bucket/backups/ \
    --endpoint-url https://storage.yandexcloud.net
```

---

## ⚡ Оптимизация

### Индексы

```sql
-- Проверить медленные запросы
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;

-- Анализ таблиц
ANALYZE TABLE users;
ANALYZE TABLE meetings;
ANALYZE TABLE notifications;

-- Оптимизация таблиц
OPTIMIZE TABLE users;
OPTIMIZE TABLE meetings;
OPTIMIZE TABLE notifications;
```

### Настройки MySQL (my.cnf)

```ini
[mysqld]
# Память
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2

# Подключения
max_connections = 500
max_connect_errors = 100000

# Кэш
query_cache_size = 64M
query_cache_type = 1

# Логирование
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2

# Кодировка
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
```

### Мониторинг

```bash
# Статус MySQL
docker compose exec mysql mysql -u root -p -e "SHOW STATUS;"

# Активные соединения
docker compose exec mysql mysql -u root -p -e "SHOW PROCESSLIST;"

# Размер БД
docker compose exec mysql mysql -u root -p -e "
SELECT 
    table_name,
    ROUND((data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'vks_schedule'
ORDER BY (data_length + index_length) DESC;
"

# Медленные запросы
docker compose exec mysql tail -f /var/log/mysql/slow.log
```

---

## 🔐 Безопасность

### Смена пароля

```sql
-- Войти в MySQL
docker compose exec mysql mysql -u root -p

-- Сменить пароль
ALTER USER 'vks_user'@'%' IDENTIFIED BY 'new_secure_password';
FLUSH PRIVILEGES;
```

```bash
# Обновить .env
DB_PASSWORD=new_secure_password

# Перезапустить backend
docker compose restart backend
```

### Ограничение доступа

```sql
-- Только localhost
CREATE USER 'vks_user'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON vks_schedule.* TO 'vks_user'@'localhost';

-- Только определённый IP
CREATE USER 'vks_user'@'192.168.1.100' IDENTIFIED BY 'password';
GRANT SELECT, INSERT, UPDATE, DELETE ON vks_schedule.* TO 'vks_user'@'192.168.1.100';

FLUSH PRIVILEGES;
```

### Шифрование соединений

```bash
# Генерация SSL сертификатов
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout mysql-key.pem -out mysql-cert.pem

# Копирование в контейнер
docker cp mysql-key.pem vks-mysql:/var/lib/mysql/
docker cp mysql-cert.pem vks-mysql:/var/lib/mysql/
```

```ini
# my.cnf
[mysqld]
ssl-ca=/var/lib/mysql/mysql-cert.pem
ssl-cert=/var/lib/mysql/mysql-cert.pem
ssl-key=/var/lib/mysql/mysql-key.pem
require_secure_transport=ON
```

---

## 📝 Полезные SQL запросы

### Статистика

```sql
-- Количество пользователей по ролям
SELECT role, COUNT(*) as count FROM users GROUP BY role;

-- Конференции по статусам
SELECT status, COUNT(*) as count FROM meetings GROUP BY status;

-- Топ организаторов
SELECT u.name, COUNT(m.id) as meetings_count
FROM users u
JOIN meetings m ON u.id = m.organizer_id
GROUP BY u.id
ORDER BY meetings_count DESC
LIMIT 10;

-- Конференции за последнюю неделю
SELECT * FROM meetings
WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
ORDER BY date DESC, start_time DESC;

-- Непрочитанные уведомления
SELECT u.name, COUNT(n.id) as unread_count
FROM users u
JOIN notifications n ON u.id = n.user_id
WHERE n.read = FALSE
GROUP BY u.id;
```

### Очистка

```sql
-- Удалить старые уведомления (старше 30 дней)
DELETE FROM notifications
WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- Удалить завершённые конференции (старше 90 дней)
DELETE FROM meetings
WHERE status = 'completed'
AND date < DATE_SUB(CURDATE(), INTERVAL 90 DAY);

-- Очистить неактивных пользователей (не заходили 1 год)
DELETE FROM users
WHERE last_login < DATE_SUB(NOW(), INTERVAL 1 YEAR)
AND is_active = FALSE;
```

---

## 🎯 Итого

### Подключения:
- ✅ Локальное через Docker CLI
- ✅ Прямое через MySQL клиент
- ✅ Через GUI клиенты (Workbench, DBeaver, HeidiSQL)
- ✅ Внешнее из локальной сети
- ✅ PHPMyAdmin (опционально)

### Безопасность:
- ✅ Сильные пароли
- ✅ Ограничение доступа по IP
- ✅ SSL шифрование
- ✅ Firewall настройки

### Обслуживание:
- ✅ Автоматический backup
- ✅ Мониторинг
- ✅ Оптимизация
- ✅ Очистка старых данных

Готово к использованию! 🚀
