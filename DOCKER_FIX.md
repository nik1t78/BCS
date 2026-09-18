# 🔧 ИСПРАВЛЕНИЕ ОШИБКИ DOCKER BUILD

## ❌ Ошибка

```
ERROR [frontend builder 6/6] RUN npm run build
npm error Missing script: "build"
```

## ✅ Решение

Ошибка возникала потому что `Dockerfile` для frontend искал `package.json` в папке `frontend/`, но он находится в корне проекта.

### Что было исправлено:

1. **docker-compose.yml** - изменён контекст сборки:
```yaml
# Было:
build:
  context: ./frontend
  dockerfile: Dockerfile

# Стало:
build:
  context: .
  dockerfile: frontend/Dockerfile
```

2. **frontend/Dockerfile** - исправлены пути копирования:
```dockerfile
# Копирование package.json из корня проекта
COPY package*.json ./

# Копирование исходного кода
COPY src ./src
COPY index.html ./
COPY vite.config.js ./
COPY tsconfig.json ./

# Копирование nginx.conf
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
```

---

## 🚀 Как запустить теперь

### Шаг 1: Остановите старые контейнеры

```powershell
docker compose down
```

### Шаг 2: Пересоберите образы

```powershell
docker compose build --no-cache
```

### Шаг 3: Запустите контейнеры

```powershell
docker compose up -d
```

### Шаг 4: Проверьте статус

```powershell
docker compose ps
```

Все контейнеры должны быть в статусе "Up".

### Шаг 5: Инициализируйте базу данных

```powershell
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate
```

### Шаг 6: Откройте браузер

**http://localhost**

---

## 📋 Проверка файлов

Убедитесь что все файлы на месте:

```
D:\BCS\
├── package.json              ✓
├── index.html                ✓
├── vite.config.js            ✓
├── tsconfig.json             ✓
├── docker-compose.yml        ✓ (исправлен)
├── frontend/
│   ├── Dockerfile            ✓ (исправлен)
│   └── nginx.conf            ✓
└── src/
    ├── App.tsx               ✓
    ├── main.tsx              ✓
    └── components/           ✓
```

---

## 🛠️ Если ошибка повторяется

### Очистите Docker кэш

```powershell
# Удалите все образы
docker system prune -a

# Удалите volumes
docker volume prune

# Пересоберите
docker compose build --no-cache
docker compose up -d
```

### Проверьте логи

```powershell
docker compose logs frontend
```

### Проверьте что package.json содержит скрипт build

```powershell
type package.json
```

Должно быть:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## ✅ Готово!

Теперь Docker должен успешно собираться и запускаться.

Откройте **http://localhost** и войдите:
- Логин: `admin`
- Пароль: `admin123`
