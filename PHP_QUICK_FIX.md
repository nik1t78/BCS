# ⚡ БЫСТРОЕ РЕШЕНИЕ ПРОБЛЕМЫ С PHP

## ❌ Ошибка

```
laravel/framework v13.32.0 requires php >=8.4.1
```

## ✅ Решение

**PHP версия обновлена с 8.3 до 8.4 в `backend/Dockerfile`**

---

## 🚀 Выполните команды:

```powershell
cd D:\BCS

# 1. Остановите контейнеры
docker compose down

# 2. Очистите кэш
docker system prune -a

# 3. Пересоберите
docker compose build --no-cache

# 4. Запустите
docker compose up -d

# 5. Инициализируйте БД
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate
```

---

## 🌐 Откройте браузер

**http://localhost**

Войдите: `admin` / `admin123`

---

**Проблема решена!** 🎉
