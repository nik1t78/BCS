# ⚡ БЫСТРЫЙ ЗАПУСК НА WINDOWS

## 🐳 Вариант 1: Docker (рекомендуется)

### Установка Docker Desktop

1. Скачайте: https://www.docker.com/products/docker-desktop/
2. Установите с настройками по умолчанию
3. Перезагрузите компьютер
4. Запустите Docker Desktop

### Запуск проекта

Откройте PowerShell в папке проекта:

```powershell
cd D:\BCS

# Запуск контейнеров
docker compose up -d --build

# Инициализация БД
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate
```

Откройте: **http://localhost**

---

## 💻 Вариант 2: Node.js (быстрее)

### Установка Node.js

1. Скачайте: https://nodejs.org/ (LTS версия)
2. Установите с настройками по умолчанию

### Запуск проекта

Откройте PowerShell в папке проекта:

```powershell
cd D:\BCS

# Установка зависимостей
npm install

# Сборка проекта
npm run build

# Установка веб-сервера
npm install -g serve

# Запуск сервера
serve -s dist -l 3000
```

Откройте: **http://localhost:3000**

---

## 🔐 Вход в систему

| Роль | Логин | Пароль |
|------|-------|--------|
| 👑 Админ | `admin` | `admin123` |
| 🔧 Модератор | `moderator` | `mod123` |
| 👤 Пользователь | `ivanov` | `user123` |

---

## 🌐 Доступ для других компьютеров

### Узнайте IP адрес

```powershell
ipconfig
```

Запомните **IPv4-адрес** (например: `192.168.1.100`)

### Откройте порт в firewall

Запустите PowerShell **ОТ ИМЕНИ АДМИНИСТРАТОРА**:

**Для Docker (порт 80):**
```powershell
netsh advfirewall firewall add rule name="ВКС Расписание" dir=in action=allow protocol=TCP localport=80
```

**Для Node.js (порт 3000):**
```powershell
netsh advfirewall firewall add rule name="ВКС Расписание" dir=in action=allow protocol=TCP localport=3000
```

### Готово!

Другие сотрудники открывают:
- Docker: **http://192.168.1.100**
- Node.js: **http://192.168.1.100:3000**

---

## 🔄 Ежедневное использование

### Docker

```powershell
# Запуск
docker compose up -d

# Остановка
docker compose down

# Перезапуск
docker compose restart

# Логи
docker compose logs -f
```

### Node.js

```powershell
# Запуск
cd D:\BCS
serve -s dist -l 3000

# Остановка
Ctrl + C
```

---

## 🛠️ Решение проблем

### Порт занят

```powershell
# Найдите процесс
netstat -ano | findstr :80  # для Docker
netstat -ano | findstr :3000  # для Node.js

# Убейте процесс
taskkill /PID [номер] /F
```

### Docker не запускается

1. Включите виртуализацию в BIOS
2. Обновите WSL2: `wsl --update`
3. Перезапустите Docker Desktop

### Не могу войти

Очистите localStorage:
- Нажмите **F12**
- Вкладка **Console**
- Введите: `localStorage.clear()`
- Нажмите **Enter**
- Обновите страницу (**F5**)

---

## 📚 Подробная документация

📖 **WINDOWS_SETUP.md** - полная инструкция с решением всех проблем

---

<div align="center">

## 🎉 Готово!

**Проект запущен на Windows!**

</div>
