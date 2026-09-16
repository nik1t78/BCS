# ⚡ QUICKSTART — Быстрый старт

## 📖 Что это за файл?

**QUICKSTART.md** — это краткое руководство для быстрого запуска проекта за 5 минут.

### Для кого:
- 🆕 Новые разработчики, которые хотят быстро попробовать проект
- 🚀 Когда нужно быстро развернуть приложение
- 📝 Минимум информации, только самое важное

### Отличие от других файлов:
| Файл | Размер | Назначение |
|------|--------|------------|
| **QUICKSTART.md** (этот) | 2 минуты | Быстрый старт |
| **START_HERE.md** | 15 минут | Полное руководство |
| **FUNCTIONS.md** | 30 минут | Все функции системы |
| **README.md** | 10 минут | Обзор проекта |

---

## 🚀 Запуск за 3 команды

### 1️⃣ Клонирование и установка

```bash
git clone <your-repo-url> vks-schedule
cd vks-schedule
```

### 2️⃣ Создание Laravel backend

```bash
cd backend
composer create-project laravel/laravel . --no-interaction
cd ..
```

### 3️⃣ Запуск Docker

```bash
docker compose up -d --build
```

### 4️⃣ Инициализация БД

```bash
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

---

## ✅ Готово!

Откройте **http://localhost**

### Демо-аккаунты:

| Роль | Email | Пароль |
|------|-------|--------|
| 👑 Админ | admin@vks.local | admin123 |
| 🔧 Модератор | sidorov@vks.local | mod123 |
| 👤 Пользователь | ivanov@vks.local | user123 |

---

## 📍 Полезные команды

```bash
# Остановить
docker compose down

# Перезапустить
docker compose restart

# Логи
docker compose logs -f

# Войти в контейнер
docker compose exec backend bash

# Очистить кэш
docker compose exec backend php artisan cache:clear
```

---

## 📚 Нужна помощь?

- 📖 **Полная документация**: [START_HERE.md](./START_HERE.md)
- 🎯 **Все функции**: [FUNCTIONS.md](./FUNCTIONS.md)
- 🐛 **Проблемы**: Раздел Troubleshooting в START_HERE.md

---

## 🎉 Всё!

Вы запустили систему за 5 минут. Теперь читайте [START_HERE.md](./START_HERE.md) для полного понимания.
