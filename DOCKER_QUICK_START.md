# ⚡ БЫСТРЫЙ ЗАПУСК ЧЕРЕЗ DOCKER

## 🚀 Запуск за 3 команды

### 1. Запустите контейнеры

```bash
docker compose up -d --build
```

⏳ Первая сборка: 5-10 минут

### 2. Инициализируйте базу данных

```bash
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate
```

### 3. Откройте браузер

**http://localhost**

---

## 🔐 Вход в систему

| Роль | Логин | Пароль |
|------|-------|--------|
| 👑 Админ | `admin` | `admin123` |
| 🔧 Модератор | `moderator` | `mod123` |
| 👤 Пользователь | `ivanov` | `user123` |

---

## 📊 Управление

```bash
# Статус контейнеров
docker compose ps

# Логи
docker compose logs -f

# Остановка
docker compose down

# Перезапуск
docker compose restart

# Обновление
git pull
docker compose up -d --build
docker compose exec backend php artisan migrate
```

---

## 🛠️ Решение проблем

### Порт 80 занят

Измените в `docker-compose.yml`:
```yaml
ports:
  - "8080:80"  # Вместо "80:80"
```

Доступ: http://localhost:8080

### Контейнер не запускается

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Ошибки прав доступа

```bash
docker compose exec backend chown -R www-data:www-data storage bootstrap/cache
```

---

## 🌐 Доступ из сети

### Windows

```powershell
netsh advfirewall firewall add rule name="ВКС" dir=in action=allow protocol=TCP localport=80
```

### Linux / РЕД ОС

```bash
sudo ufw allow 80/tcp
```

Узнайте IP:
```bash
ipconfig  # Windows
ifconfig  # Linux
```

Доступ: **http://IP-сервера**

---

## 📋 Полезные команды

```bash
# Вход в backend
docker compose exec backend bash

# Вход в MySQL
docker compose exec mysql mysql -u vks_user -pvks_password_2024 vks_schedule

# Очистка кэша
docker compose exec backend php artisan cache:clear

# Backup БД
docker compose exec mysql mysqldump -u vks_user -pvks_password_2024 vks_schedule > backup.sql
```

---

## ✅ Проверка

- [ ] Docker установлен
- [ ] `docker compose up -d --build` выполнен
- [ ] Все контейнеры запущены (`docker compose ps`)
- [ ] Миграции выполнены
- [ ] Сайт открывается: http://localhost
- [ ] Вход работает: admin / admin123

---

<div align="center">

## 🎉 Готово!

**Проект запущен через Docker!**

Откройте: **http://localhost**

</div>
