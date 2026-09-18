# 🐧 РАЗВЁРТЫВАНИЕ НА РЕД ОС (RED OS)

## 📋 О системе

**РЕД ОС** - российская операционная система на базе RPM-пакетов (аналог CentOS/Fedora).

**Особенности:**
- Пакетный менеджер: `yum` или `dnf`
- Службы: `systemd`
- Firewall: `firewalld`
- Основана на Fedora/CentOS

---

## 🚀 ПОШАГОВАЯ ИНСТРУКЦИЯ

### Шаг 1: Обновление системы

```bash
# Обновите систему
sudo yum update -y

# Или используйте dnf (если доступен)
sudo dnf update -y
```

---

### Шаг 2: Установка необходимых зависимостей

#### 2.1. Установка Git

```bash
sudo yum install git -y

# Проверка
git --version
```

#### 2.2. Установка Node.js (версия 20)

**Вариант A: Через NodeSource (рекомендуется)**

```bash
# Добавьте репозиторий Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -

# Установите Node.js
sudo yum install nodejs -y

# Проверка
node --version  # Должно быть v20.x.x
npm --version   # Должно быть 10.x.x
```

**Вариант B: Через модули (если NodeSource недоступен)**

```bash
# Установите модуль Node.js
sudo yum module enable nodejs:20 -y

# Установите Node.js
sudo yum install nodejs -y

# Проверка
node --version
npm --version
```

**Вариант C: Через NVM (менеджер версий Node)**

```bash
# Установите NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Перезагрузите оболочку
source ~/.bashrc

# Установите Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Проверка
node --version
npm --version
```

#### 2.3. Установка Docker

```bash
# Добавьте репозиторий Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Установите Docker
sudo yum install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y

# Запустите Docker
sudo systemctl start docker
sudo systemctl enable docker

# Добавьте пользователя в группу docker (чтобы запускать без sudo)
sudo usermod -aG docker $USER

# Перезагрузите систему или выполните
newgrp docker

# Проверка
docker --version
docker compose version
```

#### 2.4. Установка дополнительных инструментов

```bash
# Установите утилиты
sudo yum install wget curl htop net-tools -y
```

---

### Шаг 3: Загрузка проекта

#### Вариант A: Клонирование из Git

```bash
# Создайте директорию для проектов
sudo mkdir -p /opt/projects
cd /opt/projects

# Клонируйте репозиторий
sudo git clone https://github.com/ваш-username/BCS.git vks-schedule

# Перейдите в папку проекта
cd vks-schedule

# Установите права доступа
sudo chown -R $USER:$USER .
```

#### Вариант B: Копирование файлов

```bash
# Создайте директорию
sudo mkdir -p /opt/projects/vks-schedule
cd /opt/projects/vks-schedule

# Скопируйте файлы из локальной папки
sudo cp -r /путь/к/вашему/проекту/* .

# Установите права доступа
sudo chown -R $USER:$USER .
```

---

### Шаг 4: Установка зависимостей проекта

```bash
# Перейдите в папку проекта
cd /opt/projects/vks-schedule

# Установите npm зависимости
npm install

# Соберите проект
npm run build

# Установите serve глобально
sudo npm install -g serve
```

---

### Шаг 5: Настройка Firewall

#### 5.1. Проверка статуса firewall

```bash
sudo firewall-cmd --state
```

#### 5.2. Открытие порта 3000

```bash
# Откройте порт 3000 для TCP
sudo firewall-cmd --permanent --add-port=3000/tcp

# Перезагрузите firewall
sudo firewall-cmd --reload

# Проверьте что порт открыт
sudo firewall-cmd --list-ports
```

#### 5.3. Открытие портов для Docker (если используете)

```bash
# Откройте HTTP и HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# Перезагрузите firewall
sudo firewall-cmd --reload
```

---

### Шаг 6: Запуск сервера

#### Вариант A: Ручной запуск

```bash
cd /opt/projects/vks-schedule
serve -s dist -l 3000
```

#### Вариант B: Запуск в фоне (screen)

```bash
# Установите screen
sudo yum install screen -y

# Запустите в screen
screen -S vks-server
cd /opt/projects/vks-schedule
serve -s dist -l 3000

# Отключитесь от screen (сервер продолжит работать)
# Нажмите Ctrl+A, затем D

# Вернитесь к screen
screen -r vks-server
```

#### Вариант C: Запуск в фоне (nohup)

```bash
cd /opt/projects/vks-schedule
nohup serve -s dist -l 3000 > /var/log/vks-server.log 2>&1 &

# Проверка что сервер запущен
ps aux | grep serve

# Остановка сервера
pkill -f "serve -s dist"
```

---

### Шаг 7: Создание systemd службы (автозапуск)

#### 7.1. Создайте файл службы

```bash
sudo nano /etc/systemd/system/vks-schedule.service
```

#### 7.2. Добавьте содержимое

```ini
[Unit]
Description=ВКС Расписание - Сервер
After=network.target

[Service]
Type=simple
User=ваш-пользователь
WorkingDirectory=/opt/projects/vks-schedule
ExecStart=/usr/bin/serve -s dist -l 3000
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Замените `ваш-пользователь` на ваше имя пользователя в системе.**

#### 7.3. Активируйте службу

```bash
# Перезагрузите systemd
sudo systemctl daemon-reload

# Включите автозапуск
sudo systemctl enable vks-schedule

# Запустите службу
sudo systemctl start vks-schedule

# Проверьте статус
sudo systemctl status vks-schedule
```

#### 7.4. Управление службой

```bash
# Запуск
sudo systemctl start vks-schedule

# Остановка
sudo systemctl stop vks-schedule

# Перезапуск
sudo systemctl restart vks-schedule

# Статус
sudo systemctl status vks-schedule

# Просмотр логов
sudo journalctl -u vks-schedule -f
```

---

### Шаг 8: Проверка работы

#### 8.1. Проверка локально

```bash
# Проверьте что сервер запущен
curl http://localhost:3000

# Или откройте в браузере
# http://localhost:3000
```

#### 8.2. Проверка из сети

```bash
# Узнайте IP адрес сервера
ip addr show

# Или
hostname -I

# Проверьте с другого компьютера
# Откройте в браузере: http://IP-сервера:3000
```

---

### Шаг 9: Настройка SELinux (если включен)

РЕД ОС может использовать SELinux. Если возникают проблемы с доступом:

#### 9.1. Проверка статуса SELinux

```bash
sestatus
```

#### 9.2. Временное отключение (для тестирования)

```bash
sudo setenforce 0
```

#### 9.3. Постоянное отключение (не рекомендуется)

```bash
sudo nano /etc/selinux/config
# Измените SELINUX=enforcing на SELINUX=disabled
# Перезагрузите систему
```

#### 9.4. Настройка правил SELinux (рекомендуется)

```bash
# Разрешите HTTP соединения
sudo setsebool -P httpd_can_network_connect 1

# Разрешите доступ к порту 3000
sudo semanage port -a -t http_port_t -p tcp 3000

# Если semanage не установлен
sudo yum install policycoreutils-python-utils -y
```

---

### Шаг 10: Настройка Nginx (опционально, для production)

Если хотите использовать Nginx как reverse proxy:

#### 10.1. Установка Nginx

```bash
sudo yum install nginx -y
```

#### 10.2. Конфигурация Nginx

```bash
sudo nano /etc/nginx/conf.d/vks-schedule.conf
```

Добавьте:

```nginx
server {
    listen 80;
    server_name ваш-домен.ru;  # Или IP адрес

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 10.3. Запуск Nginx

```bash
# Проверьте конфигурацию
sudo nginx -t

# Запустите Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## 🔧 УПРАВЛЕНИЕ ПРОЕКТОМ

### Обновление проекта

```bash
cd /opt/projects/vks-schedule

# Получите обновления
git pull

# Установите зависимости
npm install

# Соберите проект
npm run build

# Перезапустите службу
sudo systemctl restart vks-schedule
```

### Просмотр логов

```bash
# Логи службы
sudo journalctl -u vks-schedule -f

# Логи Nginx (если используете)
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Резервное копирование

```bash
# Создайте скрипт backup
sudo nano /opt/scripts/vks-backup.sh
```

Содержимое:

```bash
#!/bin/bash
BACKUP_DIR="/backups/vks"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup проекта
tar -czf "$BACKUP_DIR/vks-project-$DATE.tar.gz" /opt/projects/vks-schedule

# Удаление старых backup (30 дней)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "[$DATE] Backup completed" >> /var/log/vks-backup.log
```

```bash
# Сделайте исполняемым
sudo chmod +x /opt/scripts/vks-backup.sh

# Добавьте в crontab
sudo crontab -e
```

Добавьте строку:

```bash
# Backup каждый день в 2:00
0 2 * * * /opt/scripts/vks-backup.sh
```

---

## 🆘 РЕШЕНИЕ ПРОБЛЕМ

### Проблема 1: Node.js не устанавливается

**Решение:**

```bash
# Очистите кэш yum
sudo yum clean all

# Попробуйте другой репозиторий
sudo yum install epel-release -y
sudo yum install nodejs npm -y

# Или используйте NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
```

### Проблема 2: Docker не запускается

**Решение:**

```bash
# Проверьте статус
sudo systemctl status docker

# Перезапустите
sudo systemctl restart docker

# Проверьте логи
sudo journalctl -u docker -f
```

### Проблема 3: Порт 3000 занят

**Решение:**

```bash
# Найдите процесс
sudo netstat -tulpn | grep :3000

# Убейте процесс
sudo kill -9 PID

# Или используйте другой порт
serve -s dist -l 8080
```

### Проблема 4: Firewall блокирует доступ

**Решение:**

```bash
# Проверьте статус firewall
sudo firewall-cmd --state

# Проверьте открытые порты
sudo firewall-cmd --list-all

# Откройте порт
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### Проблема 5: SELinux блокирует доступ

**Решение:**

```bash
# Проверьте статус
sestatus

# Временно отключите
sudo setenforce 0

# Или настройте правила
sudo setsebool -P httpd_can_network_connect 1
```

### Проблема 6: npm install зависает

**Решение:**

```bash
# Очистите кэш npm
npm cache clean --force

# Удалите node_modules
rm -rf node_modules
rm package-lock.json

# Установите заново
npm install
```

---

## 📊 МОНИТОРИНГ

### Использование ресурсов

```bash
# Использование CPU и RAM
top

# Или более удобный вариант
htop

# Использование диска
df -h

# Использование сети
iftop
```

### Мониторинг службы

```bash
# Статус службы
sudo systemctl status vks-schedule

# Логи в реальном времени
sudo journalctl -u vks-schedule -f

# Проверка что порт слушается
sudo netstat -tulpn | grep :3000
```

---

## ✅ ЧЕК-ЛИСТ УСТАНОВКИ

- [ ] Система обновлена (`yum update`)
- [ ] Git установлен
- [ ] Node.js 20 установлен
- [ ] npm установлен
- [ ] Docker установлен (опционально)
- [ ] Проект загружен в `/opt/projects/vks-schedule`
- [ ] Зависимости установлены (`npm install`)
- [ ] Проект собран (`npm run build`)
- [ ] Firewall настроен (порт 3000 открыт)
- [ ] SELinux настроен (если используется)
- [ ] Служба systemd создана
- [ ] Служба запущена и работает
- [ ] Автозапуск включен
- [ ] Сайт открывается локально (http://localhost:3000)
- [ ] Сайт открывается из сети (http://IP:3000)
- [ ] Резервное копирование настроено

---

## 🎯 БЫСТРЫЕ КОМАНДЫ

### Запуск сервера

```bash
sudo systemctl start vks-schedule
```

### Остановка сервера

```bash
sudo systemctl stop vks-schedule
```

### Перезапуск сервера

```bash
sudo systemctl restart vks-schedule
```

### Статус сервера

```bash
sudo systemctl status vks-schedule
```

### Просмотр логов

```bash
sudo journalctl -u vks-schedule -f
```

### Обновление проекта

```bash
cd /opt/projects/vks-schedule
git pull
npm install
npm run build
sudo systemctl restart vks-schedule
```

---

## 📚 ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ

### Полезные ссылки

- РЕД ОС: https://redos.red-soft.ru/
- Документация РЕД ОС: https://docs.redos.red-soft.ru/
- Node.js: https://nodejs.org/
- Docker: https://docs.docker.com/

### Команды РЕД ОС

```bash
# Управление пакетами
sudo yum install пакет      # Установить
sudo yum remove пакет       # Удалить
sudo yum update             # Обновить все
sudo yum search пакет       # Поиск пакета

# Управление службами
sudo systemctl start служба
sudo systemctl stop служба
sudo systemctl restart служба
sudo systemctl status служба
sudo systemctl enable служба

# Firewall
sudo firewall-cmd --list-all
sudo firewall-cmd --add-port=3000/tcp
sudo firewall-cmd --reload

# SELinux
sestatus
sudo setenforce 0
sudo setsebool -P httpd_can_network_connect 1
```

---

<div align="center">

## 🎉 ГОТОВО!

**Проект развернут на РЕД ОС!**

### Адрес сайта:
```
http://localhost:3000
http://IP-сервера:3000
```

### Управление службой:
```bash
sudo systemctl start vks-schedule    # Запуск
sudo systemctl stop vks-schedule     # Остановка
sudo systemctl restart vks-schedule  # Перезапуск
sudo systemctl status vks-schedule   # Статус
```

**Удачи! 🚀**

</div>
