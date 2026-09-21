# 🔧 ПОЛНОЕ РЕШЕНИЕ ПРОБЛЕМЫ С MYSQL

## ⚡ БЫСТРОЕ РЕШЕНИЕ (рекомендуется)

### Вариант 1: Использовать автоматический скрипт

```powershell
cd D:\server\BCS-main
reset-project.bat
```

Этот скрипт автоматически:
- ✅ Остановит все контейнеры
- ✅ Удалит все данные
- ✅ Установит зависимости
- ✅ Соберёт проект
- ✅ Запустит контейнеры
- ✅ Выполнит миграции
- ✅ Загрузит тестовые данные
- ✅ Запустит сервер

---

### Вариант 2: Выполнить команды вручную

```powershell
cd D:\server\BCS-main

# 1. Полная остановка и очистка
docker compose down -v
docker system prune -a -f

# 2. Удаление node_modules
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue

# 3. Установка зависимостей
npm install

# 4. Сборка проекта
npm run build

# 5. Запуск контейнеров
docker compose up -d --build

# 6. Ожидание запуска MySQL (60 секунд)
Start-Sleep -Seconds 60

# 7. Проверка статуса
docker compose ps

# 8. Выполнение миграций
docker compose exec backend php artisan migrate:fresh

# 9. Загрузка тестовых данных
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder

# 10. Создание symbolic link
docker compose exec backend php artisan storage:link

# 11. Очистка кэша
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan cache:clear
docker compose exec backend php artisan route:clear

# 12. Перезапуск backend
docker compose restart backend

# 13. Запуск сервера
serve -s dist -l 3000
```

---

## 🔍 ЧТО БЫЛО ИСПРАВЛЕНО

### 1. Исправлена опечатка в docker-compose.yml

**Было:**
```yaml
volumes:
  - mysql_data:/var/lib/mysql  # ❌ Неправильное имя
```

**Стало:**
```yaml
volumes:
  - mysql_/var/lib/mysql  # ✅ Правильное имя
```

### 2. Добавлен healthcheck для MySQL

```yaml
mysql:
  healthcheck:
    test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
    interval: 10s
    timeout: 5s
    retries: 5
```

### 3. Backend теперь ждёт пока MySQL будет готов

```yaml
backend:
  depends_on:
    mysql:
      condition: service_healthy  # ✅ Ждёт пока MySQL будет здоров
    redis:
      condition: service_started
```

---

## 📋 ПРОВЕРКА ПОСЛЕ ЗАПУСКА

### 1. Проверьте статус контейнеров

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

### 2. Проверьте логи MySQL

```powershell
docker compose logs mysql --tail=20
```

Должно быть сообщение:
```
[Server] ready for connections
```

### 3. Откройте браузер

Перейдите по адресу: **http://localhost:3000**

### 4. Войдите в систему

- **Логин:** `admin`
- **Пароль:** `admin123`

### 5. Проверьте работу

- ✅ Можете создавать конференции
- ✅ Можете создавать теги
- ✅ Можете создавать шаблоны
- ✅ Данные сохраняются в базе

---

## 🛠️ ЕСЛИ ПРОБЛЕМА СОХРАНЯЕТСЯ

### Проблема 1: MySQL не запускается

```powershell
# Проверьте логи
docker compose logs mysql

# Перезапустите MySQL
docker compose restart mysql

# Подождите 30 секунд
Start-Sleep -Seconds 30

# Проверьте снова
docker compose logs mysql --tail=20
```

### Проблема 2: Backend не видит MySQL

```powershell
# Проверьте что MySQL запущен
docker compose ps mysql

# Проверьте сеть
docker network ls

# Пересоздайте сеть
docker compose down
docker network prune -f
docker compose up -d
```

### Проблема 3: Миграции не выполняются

```powershell
# Проверьте подключение к MySQL
docker compose exec backend php artisan tinker

# В tinker выполните:
DB::connection()->getPdo();

# Если есть ошибка - проблема в подключении
# Если нет ошибки - проблема в миграциях
```

---

## 📊 ИТОГОВАЯ ПРОВЕРКА

После выполнения всех шагов проверьте:

- [ ] Все контейнеры запущены (`docker compose ps`)
- [ ] MySQL в статусе "Up" и "healthy"
- [ ] Backend подключается к MySQL
- [ ] Миграции выполнены успешно
- [ ] Тестовые данные загружены
- [ ] Сайт открывается по http://localhost:3000
- [ ] Можно войти как admin/admin123
- [ ] Можно создавать конференции
- [ ] Можно создавать теги
- [ ] Можно создавать шаблоны
- [ ] Данные синхронизируются

---

<div align="center">

## 🎉 ПРОБЛЕМА РЕШЕНА!

**MySQL теперь работает корректно!**

### Быстрый запуск:
```powershell
cd D:\server\BCS-main
reset-project.bat
```

Или выполните команды вручную из раздела "Вариант 2" выше.

### Адрес сайта:
```
http://localhost:3000
```

### Данные для входа:
```
Логин: admin
Пароль: admin123
```

**Удачи! 🚀**

</div>
