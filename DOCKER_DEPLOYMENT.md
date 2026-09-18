# 🐳 РАЗВЁРТЫВАНИЕ ЧЕРЕЗ DOCKER

## 📋 Что включено в Docker-конфигурацию

Проект настроен для запуска через Docker Compose со следующими сервисами:

- **frontend** - React приложение (собирается через Dockerfile)
- **backend** - Laravel API (PHP 8.2 + FPM)
- **nginx** - Веб-сервер (порт 80)
- **mysql** - База данных MySQL 8.0 (порт 3306)
- **redis** - Кэш и очереди
- **queue** - Обработчик очередей Laravel
- **scheduler** - Планировщик задач Laravel

---

## 🚀 БЫСТРЫЙ ЗАПУСК

### Шаг 1: Установите Docker

**Windows:**
1. Скачайте Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Установите с настройками по умолчанию
3. Перезагрузите компьютер
4. Запустите Docker Desktop

**Linux (Ubuntu/Debian):**
```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker

# Установка Docker Compose
sudo apt install docker-compose-plugin -y
```

**РЕД ОС:**
```bash
# Установка Docker
sudo yum install docker -y
sudo systemctl start docker
sudo systemctl enable docker

# Установка Docker Compose
sudo yum install docker-compose-plugin -y
```

**Проверка установки:**
```bash
docker --version
docker compose version
```

---

### Шаг 2: Запустите проект

Откройте терминал в папке проекта и выполните:

```bash
# Запуск всех контейнеров
docker compose up -d --build
```

⏳ Первая сборка займёт 5-10 минут...

---

### Шаг 3: Инициализация базы данных

```bash
# Генерация ключа Laravel
docker compose exec backend php artisan key:generate

# Запуск миграций
docker compose exec backend php artisan migrate

# Создание тестовых данных (опционально)
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

---

### Шаг 4: Проверка работы

Откройте браузер: **http://localhost**

Должна открыться страница входа!

---

## 🔐 Данные для входа

| Роль | Логин | Пароль |
|------|-------|--------|
| 👑 Админ | `admin` | `admin123` |
| 🔧 Модератор | `moderator` | `mod123` |
| 👤 Пользователь | `ivanov` | `user123` |

---

## 📊 Управление контейнерами

### Проверка статуса

```bash
# Показать все запущенные контейнеры
docker compose ps

# Ожидаемый результат:
# NAME           STATUS
# vks-frontend   Up
# vks-backend    Up
# vks-nginx      Up
# vks-mysql      Up
# vks-redis      Up
# vks-queue      Up
# vks-scheduler  Up
```

### Просмотр логов

```bash
# Логи всех контейнеров
docker compose logs

# Логи конкретного контейнера
docker compose logs backend
docker compose logs nginx
docker compose logs mysql

# Логи в реальном времени
docker compose logs -f backend
```

### Остановка проекта

```bash
# Остановить все контейнеры
docker compose down

# Остановить и удалить volumes (внимание: удалит данные БД!)
docker compose down -v
```

### Перезапуск

```bash
# Перезапустить все контейнеры
docker compose restart

# Перезапустить конкретный контейнер
docker compose restart backend
```

### Обновление проекта

```bash
# Получить новые изменения из Git
git pull

# Пересобрать и перезапустить
docker compose up -d --build

# Применить новые миграции
docker compose exec backend php artisan migrate
```

---

## 🗄️ Работа с базой данных

### Подключение к MySQL

```bash
# Через Docker CLI
docker compose exec mysql mysql -u vks_user -pvks_password_2024 vks_schedule

# Или через внешний клиент
# Host: localhost
# Port: 3306
# User: vks_user
# Password: vks_password_2024
# Database: vks_schedule
```

### Резервное копирование

```bash
# Создать backup
docker compose exec mysql mysqldump -u vks_user -pvks_password_2024 vks_schedule > backup_$(date +%Y%m%d).sql

# Восстановить из backup
docker compose exec -T mysql mysql -u vks_user -pvks_password_2024 vks_schedule < backup.sql
```

### Сброс базы данных

```bash
# Удалить все данные и пересоздать
docker compose down -v
docker compose up -d
docker compose exec backend php artisan migrate
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

---

## 🔧 Работа с Laravel

### Выполнение Artisan команд

```bash
# Очистка кэша
docker compose exec backend php artisan cache:clear
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan route:clear

# Tinker (интерактивная консоль)
docker compose exec backend php artisan tinker

# Создание миграции
docker compose exec backend php artisan make:migration create_new_table

# Создание модели
docker compose exec backend php artisan make:model ModelName

# Создание контроллера
docker compose exec backend php artisan make:controller ControllerName
```

### Ручной запуск напоминаний

```bash
docker compose exec backend php artisan meetings:send-reminders
```

---

## 🌐 Доступ из сети

### Локальная сеть

По умолчанию проект доступен только на localhost. Чтобы открыть доступ из локальной сети:

**Измените docker-compose.yml:**

Найдите секцию nginx и измените:
```yaml
ports:
  - "80:80"  # Было
```

На:
```yaml
ports:
  - "0.0.0.0:80:80"  # Стало
```

**Откройте порт в firewall:**

Windows:
```powershell
netsh advfirewall firewall add rule name="ВКС Расписание" dir=in action=allow protocol=TCP localport=80
```

Linux:
```bash
sudo ufw allow 80/tcp
```

РЕД ОС:
```bash
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --reload
```

**Узнайте IP сервера:**
```bash
ipconfig  # Windows
ifconfig  # Linux
```

**Доступ:** http://IP-сервера

---

## 🐛 Решение проблем

### Проблема 1: Порт 80 уже занят

```bash
# Найдите процесс
netstat -ano | findstr :80  # Windows
sudo lsof -i :80            # Linux

# Остановите процесс или измените порт в docker-compose.yml
ports:
  - "8080:80"  # Используйте другой порт
```

Доступ будет по адресу: http://localhost:8080

---

### Проблема 2: Контейнер не запускается

```bash
# Проверьте логи
docker compose logs backend
docker compose logs nginx
docker compose logs mysql

# Пересоберите контейнер
docker compose down
docker compose up -d --build
```

---

### Проблема 3: Ошибки прав доступа

```bash
# Исправьте права на папку storage
docker compose exec backend chown -R www-data:www-data storage bootstrap/cache
docker compose exec backend chmod -R 775 storage bootstrap/cache
```

---

### Проблема 4: MySQL не подключается

```bash
# Подождите 30 секунд (MySQL запускается дольше других)
sleep 30

# Проверьте статус
docker compose ps mysql

# Перезапустите MySQL
docker compose restart mysql

# Проверьте логи
docker compose logs mysql
```

---

### Проблема 5: Проект не обновляется

```bash
# Полная пересборка
docker compose down
docker compose build --no-cache
docker compose up -d

# Примените миграции
docker compose exec backend php artisan migrate
```

---

### Проблема 6: Нет места на диске

```bash
# Очистите неиспользуемые образы
docker system prune -a

# Очистите volumes (внимание: удалит данные БД!)
docker volume prune
```

---

## 📈 Мониторинг

### Использование ресурсов

```bash
# Статистика по контейнерам
docker stats

# Использование диска
docker system df
```

### Health check

```bash
# Проверка API
curl http://localhost/api/health

# Ожидаемый ответ:
# {"status":"ok","timestamp":"2024-01-15T10:00:00+00:00","version":"1.0.0"}
```

---

## 🔄 Автоматический запуск

### Windows

Создайте файл `start-docker.bat`:

```batch
@echo off
cd /d D:\BCS
docker compose up -d
echo Проект запущен! Откройте http://localhost
pause
```

### Linux / РЕД ОС

Создайте systemd службу:

```bash
sudo nano /etc/systemd/system/vks-docker.service
```

Содержимое:

```ini
[Unit]
Description=ВКС Расписание Docker
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/projects/vks-schedule
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Активация:

```bash
sudo systemctl daemon-reload
sudo systemctl enable vks-docker
sudo systemctl start vks-docker
```

---

## 📊 Структура Docker-контейнеров

```
┌─────────────────────────────────────────┐
│           Docker Network                │
│                                         │
│  ┌──────────┐      ┌──────────┐        │
│  │  Nginx   │──────│ Frontend │        │
│  │  :80     │      │  React   │        │
│  └────┬─────┘      └──────────┘        │
│       │                                 │
│       ├──────────────┐                  │
│       │              │                  │
│  ┌────▼─────┐   ┌────▼─────┐          │
│  │ Backend  │   │  MySQL   │          │
│  │  Laravel │   │   :3306  │          │
│  └────┬─────┘   └──────────┘          │
│       │                                 │
│       ├──────────────┐                  │
│       │              │                  │
│  ┌────▼─────┐   ┌────▼─────┐          │
│  │  Queue   │   │  Redis   │          │
│  │  Worker  │   │          │          │
│  └──────────┘   └──────────┘          │
│                                         │
│  ┌──────────┐                          │
│  │Scheduler │                          │
│  │  (cron)  │                          │
│  └──────────┘                          │
└─────────────────────────────────────────┘
```

---

## 🎯 Полезные команды

### Быстрый старт

```bash
# Запуск проекта
docker compose up -d --build

# Инициализация БД
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate

# Остановка
docker compose down

# Перезапуск
docker compose restart
```

### Разработка

```bash
# Вход в контейнер backend
docker compose exec backend bash

# Вход в MySQL
docker compose exec mysql mysql -u vks_user -pvks_password_2024 vks_schedule

# Просмотр логов в реальном времени
docker compose logs -f
```

### Обслуживание

```bash
# Очистка кэша Laravel
docker compose exec backend php artisan cache:clear

# Обновление проекта
git pull
docker compose up -d --build
docker compose exec backend php artisan migrate

# Backup БД
docker compose exec mysql mysqldump -u vks_user -pvks_password_2024 vks_schedule > backup.sql
```

---

## ✅ Чек-лист запуска

- [ ] Docker установлен
- [ ] Docker Compose установлен
- [ ] Проект скачан/клонирован
- [ ] `docker compose up -d --build` выполнен
- [ ] Все контейнеры запущены (`docker compose ps`)
- [ ] База данных инициализирована
- [ ] Миграции выполнены
- [ ] Тестовые данные загружены (опционально)
- [ ] Сайт открывается по http://localhost
- [ ] Вход работает (admin / admin123)
- [ ] Firewall настроен (для доступа из сети)

---

## 📚 Дополнительная информация

### Переменные окружения

Основные параметры в docker-compose.yml:

```yaml
# MySQL
MYSQL_ROOT_PASSWORD: root_password_2024
MYSQL_DATABASE: vks_schedule
MYSQL_USER: vks_user
MYSQL_PASSWORD: vks_password_2024

# Laravel
DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=vks_schedule
DB_USERNAME=vks_user
DB_PASSWORD=vks_password_2024
```

**Важно:** Измените пароли перед production использованием!

### Volumes

- `mysql_data` - данные MySQL (сохраняются между перезапусками)
- `frontend_build` - собранный frontend

### Networks

- `vks-network` - внутренняя сеть для всех контейнеров

---

<div align="center">

## 🎉 ГОТОВО!

**Проект запущен через Docker!**

### Адрес сайта:
```
http://localhost
```

### Данные для входа:
```
Логин: admin
Пароль: admin123
```

### Полезные команды:

**Запуск:**
```bash
docker compose up -d --build
```

**Остановка:**
```bash
docker compose down
```

**Логи:**
```bash
docker compose logs -f
```

**Удачи! 🚀**

</div>
