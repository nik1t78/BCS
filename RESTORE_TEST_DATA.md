# 🔄 ВОССТАНОВЛЕНИЕ ТЕСТОВЫХ ДАННЫХ

## ⚡ БЫСТРОЕ РЕШЕНИЕ

Выполните эти команды для загрузки тестовых данных:

```powershell
cd D:\server\BCS-main

# Загрузите тестовые данные
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

---

## 📋 ПОЛНАЯ ИНСТРУКЦИЯ

### Шаг 1: Проверьте что база данных пуста

```powershell
# Подключитесь к MySQL
docker compose exec mysql mysql -u vks_user -pvks_password_2024 vks_schedule

# В MySQL выполните:
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM meetings;
EXIT;
```

Если видите `0` - база данных пуста.

### Шаг 2: Загрузите тестовые данные

```powershell
cd D:\server\BCS-main
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

Должно появиться:
```
Database seeding completed successfully.
```

### Шаг 3: Проверьте что данные загрузились

```powershell
# Подключитесь к MySQL
docker compose exec mysql mysql -u vks_user -pvks_password_2024 vks_schedule

# В MySQL выполните:
SELECT id, login, role FROM users;
SELECT id, title, date FROM meetings;
EXIT;
```

Должны увидеть:
- 4 пользователя (admin, ivanov, petrova, sidorov)
- 7 конференций

### Шаг 4: Очистите кэш Laravel

```powershell
docker compose exec backend php artisan cache:clear
docker compose exec backend php artisan config:clear
```

### Шаг 5: Перезапустите frontend

```powershell
npm run build
serve -s dist -l 3000
```

---

## 🔐 ДАННЫЕ ДЛЯ ВХОДА

После загрузки тестовых данных используйте:

| Роль | Логин | Пароль |
|------|-------|--------|
| 👑 Администратор | `admin` | `admin123` |
| 🔧 Модератор | `sidorov` | `mod123` |
| 👤 Пользователь | `ivanov` | `user123` |
| 👤 Пользователь | `petrova` | `user123` |

---

## 📊 ЧТО БУДЕТ ЗАГРУЖЕНО

### Пользователи (4):
1. **Администратор Системы** (admin) - роль: admin
2. **Иванов Алексей Сергеевич** (ivanov) - роль: user
3. **Петрова Мария Владимировна** (petrova) - роль: user
4. **Сидоров Константин Львович** (sidorov) - роль: moderator

### Конференции (7):
1. **Еженедельный стендап** - сегодня, 10:00-10:30, Переговорная №1
2. **Обзор проекта Q4** - сегодня, 14:00-15:30, Конференц-зал А
3. **Собеседование** - завтра, 11:00-12:00, Онлайн
4. **Демо продукта** - завтра, 16:00-17:00, Переговорная №3
5. **Ретроспектива** - через 2 дня, 15:00-16:00, Переговорная №2
6. **Обучение: Новый стек** - через 5 дней, 10:00-12:00, Конференц-зал Б
7. **Планёрка с клиентом** - вчера, 09:00-10:00, Онлайн (завершена)

---

## 🛠️ ЕСЛИ ОШИБКА

### Ошибка: "Class VksDatabaseSeeder does not exist"

```powershell
# Перезагрузите composer
docker compose exec backend composer dump-autoload

# Попробуйте снова
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

### Ошибка: "Table 'users' doesn't exist"

```powershell
# Выполните миграции
docker compose exec backend php artisan migrate:fresh

# Затем загрузите данные
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

### Ошибка: "Duplicate entry"

```powershell
# Очистите базу данных
docker compose exec backend php artisan migrate:fresh

# Загрузите данные заново
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

---

## 🚀 БЫСТРЫЕ КОМАНДЫ (копировать и вставить)

```powershell
cd D:\server\BCS-main

# Полная очистка и загрузка данных
docker compose exec backend php artisan migrate:fresh
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
docker compose exec backend php artisan storage:link
docker compose exec backend php artisan cache:clear
docker compose exec backend php artisan config:clear
docker compose restart backend

# Пересборка frontend
npm run build

# Запуск сервера
serve -s dist -l 3000
```

---

## ✅ ПРОВЕРКА

После загрузки данных:

1. Откройте http://localhost:3000
2. Войдите как `admin` / `admin123`
3. Перейдите в "Админ-панель" → "Пользователи"
4. ✅ Должны видеть 4 пользователя
5. Перейдите в "Расписание"
6. ✅ Должны видеть 7 конференций

---

<div align="center">

## 🎉 ДАННЫЕ ЗАГРУЖЕНЫ!

**Тестовые пользователи и конференции восстановлены!**

</div>
