# 🚀 БЫСТРЫЙ ЗАПУСК (ОДНОЙ КОМАНДОЙ)

## ✅ Проблема решена!

Теперь можно запустить весь проект **одним кликом**!

---

## 🎯 Как запустить

### Вариант 1: Двойной клик (самый простой)

1. Откройте папку `D:\server\BCS-main`
2. Найдите файл **`start-all.bat`**
3. **Дважды кликните** по нему
4. Дождитесь запуска (30-60 секунд)
5. Откройте браузер: **http://localhost:5173**
6. Войдите: `admin` / `admin123`

### Вариант 2: Через командную строку

```powershell
cd D:\server\BCS-main
start-all.bat
```

---

## 🛑 Как остановить

### Вариант 1: Двойной клик

1. Найдите файл **`stop-all.bat`**
2. **Дважды кликните** по нему

### Вариант 2: Через командную строку

```powershell
cd D:\server\BCS-main
stop-all.bat
```

---

## 🔧 Что было исправлено

### 1. Маршруты API

Созданы недостающие файлы Laravel:
- ✅ `backend/bootstrap/app.php` - конфигурация приложения
- ✅ `backend/routes/web.php` - веб-маршруты
- ✅ `backend/routes/console.php` - консольные команды

### 2. Автоматический запуск

Созданы скрипты:
- ✅ `start-all.bat` - запуск всего проекта
- ✅ `stop-all.bat` - остановка всего проекта

---

## 📋 Что происходит при запуске

Скрипт `start-all.bat` автоматически:

1. ✅ Запускает Docker контейнеры (MySQL, Backend, Redis)
2. ✅ Ждёт 30 секунд пока MySQL запустится
3. ✅ Запускает Laravel API сервер (порт 8000)
4. ✅ Запускает Frontend сервер (порт 5173)
5. ✅ Открывает браузер

---

## 🌐 Адреса после запуска

| Сервис | Адрес |
|--------|-------|
| **Frontend** | http://localhost:5173 |
| **API** | http://localhost:8000/api |
| **API Health** | http://localhost:8000/api/health |

---

## 🔐 Данные для входа

| Роль | Логин | Пароль |
|------|-------|--------|
| 👑 Администратор | `admin` | `admin123` |
| 🔧 Модератор | `moderator` | `mod123` |
| 👤 Пользователь | `ivanov` | `user123` |

---

## 🌍 Доступ из сети

### Для других пользователей:

1. Узнайте IP адрес:
```powershell
ipconfig
```

2. Откройте порты в Firewall (от имени администратора):
```powershell
netsh advfirewall firewall add rule name="ВКС Frontend" dir=in action=allow protocol=TCP localport=5173
netsh advfirewall firewall add rule name="ВКС API" dir=in action=allow protocol=TCP localport=8000
```

3. Другие пользователи открывают:
```
http://10.48.4.235:5173
```

---

## 🛠️ Решение проблем

### Проблема: "The route api/auth/login could not be found"

**Решение:**
```powershell
cd D:\server\BCS-main
docker compose exec backend php artisan route:clear
docker compose exec backend php artisan config:clear
docker compose restart backend
```

### Проблема: Ошибка подключения к API

**Решение:**
1. Убедитесь что Laravel API запущен
2. Проверьте что порт 8000 открыт
3. Проверьте логи: `docker compose logs backend --tail=50`

### Проблема: Frontend не открывается

**Решение:**
1. Проверьте что npm запущен
2. Попробуйте другой порт: `npm run dev -- --port 3000`
3. Очистите кэш браузера: `Ctrl + Shift + Delete`

---

## 📊 Структура проекта после исправлений

```
D:\server\BCS-main\
├── start-all.bat              ← ЗАПУСК ОДНИМ КЛИКОМ
├── stop-all.bat               ← ОСТАНОВКА ОДНИМ КЛИКОМ
├── backend/
│   ├── bootstrap/
│   │   └── app.php           ← НОВОЕ: конфигурация Laravel
│   ├── routes/
│   │   ├── api.php           ← API маршруты
│   │   ├── web.php           ← НОВОЕ: веб маршруты
│   │   └── console.php       ← НОВОЕ: консольные команды
│   └── ...
└── ...
```

---

## 🎯 Быстрая проверка

После запуска проверьте:

```powershell
# 1. Проверьте Docker
docker compose ps

# 2. Проверьте API
curl http://localhost:8000/api/health

# 3. Откройте браузер
start http://localhost:5173
```

---

## 💡 Советы

### Ежедневное использование:

**Утром:**
- Двойной клик на `start-all.bat`
- Подождите 30-60 секунд
- Откройте http://localhost:5173

**Вечером:**
- Двойной клик на `stop-all.bat`

### Для разработки:

Если нужно изменить код frontend:
```powershell
cd D:\server\BCS-main
npm run dev
```

Vite автоматически перезагрузит страницу при изменениях.

### Для просмотра логов:

```powershell
# Логи Docker
docker compose logs -f

# Логи Backend
docker compose logs backend -f

# Логи MySQL
docker compose logs mysql -f
```

---

## ✅ Итого

**Теперь запуск проекта - это просто двойной клик на `start-all.bat`!** 🎉

Не нужно:
- ❌ Открывать 2 консоли
- ❌ Запоминать команды
- ❌ Запускать всё по отдельности

Нужно:
- ✅ Двойной клик на `start-all.bat`
- ✅ Подождать 30-60 секунд
- ✅ Открыть http://localhost:5173

---

<div align="center">

## 🚀 ГОТОВО!

**Простой запуск одним кликом!**

### Файлы:
- `start-all.bat` - запуск
- `stop-all.bat` - остановка

### Адрес:
```
http://localhost:5173
```

### Вход:
```
admin / admin123
```

</div>
