# 🚀 БЫСТРЫЙ ЗАПУСК ПРОЕКТА

## ✅ Проблема решена!

Создан файл `Dockerfile` в корне проекта. Теперь Docker найдёт его автоматически.

---

## 🎯 ПОШАГОВАЯ ИНСТРУКЦИЯ

### Шаг 1: Перейдите в папку проекта

Откройте PowerShell и перейдите в папку где находится проект:

```powershell
cd D:\server\BCS-main
```

**ВАЖНО:** Убедитесь что вы находитесь в правильной папке! Проверьте что есть файлы:
- `docker-compose.yml`
- `Dockerfile`
- `package.json`
- папка `src/`
- папка `backend/`

### Шаг 2: Остановите старые контейнеры (если есть)

```powershell
docker compose down
```

### Шаг 3: Очистите Docker кэш

```powershell
docker system prune -a
docker volume prune
```

Подтвердите удаление (введите `y` и нажмите Enter).

### Шаг 4: Соберите проект

```powershell
docker compose build --no-cache
```

⏳ Это займёт **10-15 минут** при первой сборке.

### Шаг 5: Запустите контейнеры

```powershell
docker compose up -d
```

### Шаг 6: Проверьте статус

```powershell
docker compose ps
```

Все контейнеры должны быть в статусе **"Up"**:
- ✅ vks-frontend
- ✅ vks-backend
- ✅ vks-nginx
- ✅ vks-mysql
- ✅ vks-redis
- ✅ vks-queue
- ✅ vks-scheduler

### Шаг 7: Инициализируйте базу данных

```powershell
# Генерация ключа Laravel
docker compose exec backend php artisan key:generate

# Создание таблиц в БД
docker compose exec backend php artisan migrate
```

### Шаг 8: Откройте браузер

Перейдите по адресу: **http://localhost**

Должна открыться страница входа!

### Шаг 9: Войдите в систему

| Роль | Логин | Пароль |
|------|-------|--------|
| 👑 Админ | `admin` | `admin123` |
| 🔧 Модератор | `moderator` | `mod123` |
| 👤 Пользователь | `ivanov` | `user123` |

---

## 🌐 Доступ для других компьютеров

### Шаг 1: Узнайте IP адрес

```powershell
ipconfig
```

Найдите строку **"IPv4-адрес"** (например: `192.168.1.100`)

### Шаг 2: Откройте порт в firewall

Запустите PowerShell **ОТ ИМЕНИ АДМИНИСТРАТОРА**:

```powershell
netsh advfirewall firewall add rule name="ВКС Расписание" dir=in action=allow protocol=TCP localport=80
```

### Шаг 3: Готово!

Другие сотрудники открывают: **http://192.168.1.100**

---

## 🛠️ РЕШЕНИЕ ПРОБЛЕМ

### Проблема: "The system cannot find the file specified"

**Решение:**

1. Убедитесь что вы находитесь в правильной папке:
```powershell
cd D:\server\BCS-main
```

2. Проверьте что файл `Dockerfile` существует:
```powershell
dir Dockerfile
```

3. Если файла нет, создайте его (он уже создан в этом проекте)

### Проблема: Порт 80 занят

**Решение:**

```powershell
# Найдите процесс
netstat -ano | findstr :80

# Убейте процесс (замените PID)
taskkill /PID [номер] /F
```

**Или измените порт:**

Откройте `docker-compose.yml` и измените:
```yaml
ports:
  - "8080:80"  # Вместо "80:80"
```

Доступ будет по адресу: **http://localhost:8080**

### Проблема: Контейнер не запускается

**Решение:**

```powershell
# Проверьте логи
docker compose logs backend
docker compose logs frontend

# Пересоберите
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 🔄 Управление контейнерами

### Остановка проекта

```powershell
docker compose down
```

### Запуск проекта

```powershell
docker compose up -d
```

### Перезапуск

```powershell
docker compose restart
```

### Просмотр логов

```powershell
# Все логи
docker compose logs

# Логи конкретного сервиса
docker compose logs backend
docker compose logs frontend

# Логи в реальном времени
docker compose logs -f
```

---

## 📊 ПРОВЕРКА ФАЙЛОВ

### Убедитесь что все файлы на месте:

```powershell
# Проверьте Dockerfile
dir Dockerfile

# Проверьте docker-compose.yml
dir docker-compose.yml

# Проверьте backend
dir backend\Dockerfile

# Проверьте frontend
dir frontend\Dockerfile
```

Все файлы должны существовать!

---

## ✅ ЧЕК-ЛИСТ ПЕРЕД ЗАПУСКОМ

- [ ] Вы находитесь в папке `D:\server\BCS-main`
- [ ] Файл `Dockerfile` существует в корне
- [ ] Файл `docker-compose.yml` существует
- [ ] Docker Desktop запущен
- [ ] Выполнено `docker compose down`
- [ ] Выполнено `docker system prune -a`
- [ ] Выполнено `docker compose build --no-cache`
- [ ] Выполнено `docker compose up -d`
- [ ] Все контейнеры в статусе "Up"
- [ ] База данных инициализирована
- [ ] Сайт открывается: http://localhost
- [ ] Вход работает: admin / admin123

---

## 🎯 БЫСТРЫЕ КОМАНДЫ

### Полный цикл запуска:

```powershell
cd D:\server\BCS-main
docker compose down
docker system prune -a
docker compose build --no-cache
docker compose up -d
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate
```

### Ежедневное использование:

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

---

## 📚 ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ

### Подробная документация:
- 📘 **FINAL_INSTRUCTION.md** - Полная инструкция
- 📗 **ALL_FIXED.md** - Все исправления
- 📙 **WINDOWS_SETUP.md** - Настройка для Windows

### Решение проблем:
- 📕 **DOCKER_FIX.md** - Исправление Docker
- 📓 **DOCKER_NETWORK_FIX.md** - Проблемы с сетью

---

<div align="center">

## 🎉 ГОТОВО!

**Проблема решена! Файл Dockerfile создан!**

### Быстрый старт:
```powershell
cd D:\server\BCS-main
docker compose down
docker compose build --no-cache
docker compose up -d
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate
```

### Вход:
```
Логин: admin
Пароль: admin123
```

### Адрес:
```
http://localhost
```

**Удачи! 🚀**

</div>
