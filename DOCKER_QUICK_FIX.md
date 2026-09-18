# ⚡ БЫСТРОЕ РЕШЕНИЕ ПРОБЛЕМЫ С СЕТЬЮ В DOCKER

## ❌ Ошибка

```
npm error code ECONNRESET
npm error network aborted
```

---

## ✅ САМОЕ ПРОСТОЕ РЕШЕНИЕ (2 минуты)

### Шаг 1: Установите зависимости локально

Откройте PowerShell в папке проекта:

```powershell
cd D:\BCS
npm install
```

⏳ Ждите 2-5 минут.

### Шаг 2: Измените docker-compose.yml

Откройте файл `docker-compose.yml` в блокноте:

```powershell
notepad docker-compose.yml
```

Найдите строку:

```yaml
dockerfile: frontend/Dockerfile
```

Замените на:

```yaml
dockerfile: frontend/Dockerfile.offline
```

Сохраните файл (Ctrl+S).

### Шаг 3: Пересоберите Docker

```powershell
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Шаг 4: Инициализируйте базу данных

```powershell
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate
```

### Шаг 5: Откройте браузер

**http://localhost**

Войдите: `admin` / `admin123`

---

## 🎯 ГОТОВО!

Проблема с сетью решена! Docker теперь использует локальные `node_modules` и не скачивает пакеты из интернета.

---

## 📖 Подробная инструкция

Если это решение не помогло, откройте файл **DOCKER_NETWORK_FIX.md** для 5 альтернативных решений.
