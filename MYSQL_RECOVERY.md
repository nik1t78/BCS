# 🔧 ВОССТАНОВЛЕНИЕ MYSQL ПОСЛЕ ПОВРЕЖДЕНИЯ

## ❌ ПРОБЛЕМА

В логах MySQL видны критические ошибки:
- `data files are corrupt` - данные повреждены
- `Data Dictionary initialization failed` - MySQL не может инициализироваться
- `World-writable config file is ignored` - неправильные права у my.cnf

---

## ✅ ПОЛНОЕ РЕШЕНИЕ

### Шаг 1: Остановите всё и удалите повреждённые данные

```powershell
cd D:\server\BCS-main

# Остановите все контейнеры
docker compose down

# Удалите ВСЕ volumes (это удалит повреждённые данные MySQL)
docker volume prune -f

# Удалите все неиспользуемые образы
docker system prune -f
```

### Шаг 2: Запустите контейнеры заново

```powershell
# Запустите все контейнеры
docker compose up -d

# Подождите 60 секунд пока MySQL полностью инициализируется
timeout /t 60
```

### Шаг 3: Проверьте что MySQL запустился

```powershell
# Проверьте статус контейнеров
docker compose ps

# Проверьте логи MySQL
docker compose logs mysql --tail=20
```

Вы должны увидеть сообщение:
```
[Server] ready for connections
```

### Шаг 4: Выполните миграции

```powershell
# Выполните миграции с нуля
docker compose exec backend php artisan migrate:fresh

# Загрузите тестовые данные
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

### Шаг 5: Создайте symbolic link

```powershell
docker compose exec backend php artisan storage:link
```

### Шаг 6: Очистите кэш

```powershell
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan cache:clear
docker compose exec backend php artisan route:clear
```

### Шаг 7: Перезапустите backend

```powershell
docker compose restart backend
```

### Шаг 8: Пересоберите frontend

```powershell
npm run build
```

### Шаг 9: Запустите сервер

```powershell
serve -s dist -l 3000
```

---

## 🚀 БЫСТРЫЕ КОМАНДЫ (копировать и вставить)

```powershell
cd D:\server\BCS-main

# 1. Остановка и очистка
docker compose down
docker volume prune -f
docker system prune -f

# 2. Запуск
docker compose up -d
timeout /t 60

# 3. Проверка
docker compose ps
docker compose logs mysql --tail=20

# 4. Миграции
docker compose exec backend php artisan migrate:fresh
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder

# 5. Настройка
docker compose exec backend php artisan storage:link
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan cache:clear
docker compose restart backend

# 6. Frontend
npm run build
serve -s dist -l 3000
```

---

## 🔍 ЕСЛИ MYSQL ВСЁ РАВНО НЕ ЗАПУСКАЕТСЯ

### Проверка 1: Посмотрите полные логи

```powershell
docker compose logs mysql
```

### Проверка 2: Убедитесь что volume удалён

```powershell
docker volume ls
```

Если видите `bcs-main_mysql_data`, удалите его:

```powershell
docker volume rm bcs-main_mysql_data
```

### Проверка 3: Пересоздайте контейнер MySQL

```powershell
docker compose rm -s -f mysql
docker compose up -d mysql
timeout /t 60
```

### Проверка 4: Проверьте конфигурацию my.cnf

Файл `docker/mysql/my.cnf` должен быть упрощён (убраны устаревшие настройки).

---

## 📊 ИСПРАВЛЕННЫЕ ФАЙЛЫ

### docker-compose.yml
- ✅ Удалена устаревшая строка `version: '3.8'`

### docker/mysql/my.cnf
- ✅ Убраны устаревшие настройки:
  - `innodb_flush_log_at_trx_commit`
  - `innodb_flush_method`
  - `slow_query_log`
  - `slow_query_log_file`
  - `long_query_time`

---

## ✅ ПОСЛЕ ВОССТАНОВЛЕНИЯ

Откройте браузер: **http://localhost:3000**

Войдите:
- **Логин:** `admin`
- **Пароль:** `admin123`

Проверьте:
1. ✅ MySQL работает
2. ✅ Миграции выполнены
3. ✅ Тестовые данные загружены
4. ✅ Можно создавать конференции
5. ✅ Можно создавать теги
6. ✅ Можно создавать шаблоны
7. ✅ Данные синхронизируются

---

<div align="center">

## 🎉 MYSQL ВОССТАНОВЛЕН!

**Все данные очищены и созданы заново!**

</div>
