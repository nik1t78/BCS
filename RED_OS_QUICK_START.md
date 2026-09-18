# 🚀 БЫСТРЫЙ СТАРТ НА РЕД ОС

## ⚡ Установка за 10 минут

### 1. Обновление системы

```bash
sudo yum update -y
```

### 2. Установка Node.js 20

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install nodejs -y
```

### 3. Установка Git

```bash
sudo yum install git -y
```

### 4. Загрузка проекта

```bash
sudo mkdir -p /opt/projects
cd /opt/projects
sudo git clone https://github.com/ваш-username/BCS.git vks-schedule
cd vks-schedule
sudo chown -R $USER:$USER .
```

### 5. Установка зависимостей

```bash
npm install
npm run build
sudo npm install -g serve
```

### 6. Открытие порта в firewall

```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### 7. Создание systemd службы

```bash
sudo nano /etc/systemd/system/vks-schedule.service
```

Вставьте:

```ini
[Unit]
Description=ВКС Расписание
After=network.target

[Service]
Type=simple
User=ваш-пользователь
WorkingDirectory=/opt/projects/vks-schedule
ExecStart=/usr/bin/serve -s dist -l 3000
Restart=always

[Install]
WantedBy=multi-user.target
```

### 8. Запуск службы

```bash
sudo systemctl daemon-reload
sudo systemctl enable vks-schedule
sudo systemctl start vks-schedule
```

### 9. Проверка

```bash
# Статус
sudo systemctl status vks-schedule

# Открыть в браузере
# http://localhost:3000
# http://IP-сервера:3000
```

---

## 🎯 ГОТОВО!

Сайт доступен по адресу: **http://IP-сервера:3000**

### Управление:

```bash
sudo systemctl start vks-schedule    # Запуск
sudo systemctl stop vks-schedule     # Остановка
sudo systemctl restart vks-schedule  # Перезапуск
sudo systemctl status vks-schedule   # Статус
sudo journalctl -u vks-schedule -f   # Логи
```

---

## 🔧 Если что-то не работает

### Node.js не устанавливается

```bash
# Используйте NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
```

### Firewall блокирует

```bash
sudo firewall-cmd --list-ports
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### SELinux блокирует

```bash
sudo setenforce 0
sudo setsebool -P httpd_can_network_connect 1
```

### Порт занят

```bash
sudo netstat -tulpn | grep :3000
sudo kill -9 PID
```

---

**Подробная инструкция:** [RED_OS_DEPLOYMENT.md](./RED_OS_DEPLOYMENT.md)
