# 🔧 РЕШЕНИЕ ПРОБЛЕМЫ С СЕТЬЮ В DOCKER

## ❌ Ошибка

```
npm error code ECONNRESET
npm error network aborted
npm error network This is a problem related to network connectivity.
```

**Причина:** Docker не может скачать npm-пакеты из интернета внутри контейнера.

---

## ✅ РЕШЕНИЕ 1: Использовать локальные node_modules (РЕКОМЕНДУЕТСЯ)

### Шаг 1: Установите зависимости локально

Откройте PowerShell в папке проекта:

```powershell
cd D:\BCS
npm install
```

⏳ Дождитесь завершения установки (2-5 минут).

### Шаг 2: Используйте offline Dockerfile

Отредактируйте `docker-compose.yml`:

```yaml
services:
  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile.offline  # ← Измените эту строку
    container_name: vks-frontend
    restart: unless-stopped
    networks:
      - vks-network
    volumes:
      - frontend_build:/app/dist
```

### Шаг 3: Пересоберите Docker

```powershell
# Остановите контейнеры
docker compose down

# Очистите кэш
docker system prune -a

# Пересоберите
docker compose build --no-cache

# Запустите
docker compose up -d
```

---

## ✅ РЕШЕНИЕ 2: Настроить npm для работы через прокси

Если вы за корпоративным прокси:

### Шаг 1: Создайте файл `.npmrc` в корне проекта

```powershell
cd D:\BCS
notepad .npmrc
```

Вставьте (замените на ваши данные):

```
registry=https://registry.npmjs.org/
proxy=http://proxy.company.com:8080
https-proxy=http://proxy.company.com:8080
strict-ssl=false
```

### Шаг 2: Обновите Dockerfile

Отредактируйте `frontend/Dockerfile`:

```dockerfile
FROM node:20-alpine as builder

WORKDIR /app

# Копирование .npmrc
COPY .npmrc ./

# Копирование package.json
COPY package*.json ./

# Установка зависимостей
RUN npm install --legacy-peer-deps

# Копирование исходного кода
COPY src ./src
COPY index.html ./
COPY vite.config.js ./
COPY tsconfig.json ./

# Сборка
RUN npm run build

# Финальный образ
FROM nginx:alpine
COPY --from=builder /app/dist /var/www/frontend
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Шаг 3: Пересоберите Docker

```powershell
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## ✅ РЕШЕНИЕ 3: Использовать зеркало npm (для России)

### Шаг 1: Создайте `.npmrc`

```powershell
cd D:\BCS
notepad .npmrc
```

Вставьте:

```
registry=https://npm.webbrief.ru/
```

Или используйте другое зеркало:

```
registry=https://registry.npmmirror.com/
```

### Шаг 2: Обновите Dockerfile (как в Решении 2)

### Шаг 3: Пересоберите Docker

```powershell
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## ✅ РЕШЕНИЕ 4: Увеличить таймауты npm

### Обновите Dockerfile

```dockerfile
FROM node:20-alpine as builder

WORKDIR /app

# Настройка таймаутов
RUN npm config set fetch-retries 10
RUN npm config set fetch-retry-mintimeout 60000
RUN npm config set fetch-retry-maxtimeout 300000
RUN npm config set registry https://registry.npmjs.org/

# Копирование package.json
COPY package*.json ./

# Установка зависимостей
RUN npm install --legacy-peer-deps

# Копирование исходного кода
COPY src ./src
COPY index.html ./
COPY vite.config.js ./
COPY tsconfig.json ./

# Сборка
RUN npm run build

# Финальный образ
FROM nginx:alpine
COPY --from=builder /app/dist /var/www/frontend
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## ✅ РЕШЕНИЕ 5: Собрать frontend локально (БЕЗ DOCKER)

Если Docker продолжает вызывать проблемы, соберите frontend локально:

### Шаг 1: Установите зависимости

```powershell
cd D:\BCS
npm install
```

### Шаг 2: Соберите проект

```powershell
npm run build
```

✅ В папке `dist/` появится готовый сайт.

### Шаг 3: Запустите локальный сервер

```powershell
npm install -g serve
serve -s dist -l 3000
```

### Шаг 4: Откройте браузер

**http://localhost:3000**

---

## 🎯 КАКОЕ РЕШЕНИЕ ВЫБРАТЬ?

| Решение | Когда использовать | Сложность |
|---------|-------------------|-----------|
| **Решение 1** (offline) | Всегда, самое надёжное | ⭐ |
| **Решение 2** (прокси) | Корпоративная сеть с прокси | ⭐⭐ |
| **Решение 3** (зеркало) | Проблемы с доступом к npmjs.org | ⭐⭐ |
| **Решение 4** (таймауты) | Медленный интернет | ⭐⭐ |
| **Решение 5** (локально) | Docker не работает вообще | ⭐ |

**РЕКОМЕНДАЦИЯ:** Начните с **Решения 1** (offline) - оно самое простое и надёжное.

---

## 🚀 ПОШАГОВАЯ ИНСТРУКЦИЯ (РЕШЕНИЕ 1)

### 1. Остановите Docker

```powershell
cd D:\BCS
docker compose down
```

### 2. Установите зависимости локально

```powershell
npm install
```

⏳ Ждите 2-5 минут.

### 3. Проверьте что node_modules создан

```powershell
dir node_modules
```

Должна появиться папка с множеством подпапок.

### 4. Измените docker-compose.yml

Откройте `docker-compose.yml` в блокноте:

```powershell
notepad docker-compose.yml
```

Найдите секцию `frontend:` и измените `dockerfile`:

```yaml
services:
  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile.offline  # ← Измените эту строку
    container_name: vks-frontend
    restart: unless-stopped
    networks:
      - vks-network
    volumes:
      - frontend_build:/app/dist
```

Сохраните файл (Ctrl+S).

### 5. Пересоберите Docker

```powershell
docker system prune -a
docker compose build --no-cache
```

⏳ Ждите 5-10 минут.

### 6. Запустите контейнеры

```powershell
docker compose up -d
```

### 7. Проверьте статус

```powershell
docker compose ps
```

Все контейнеры должны быть в статусе **"Up"**.

### 8. Инициализируйте базу данных

```powershell
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate
```

### 9. Откройте браузер

**http://localhost**

Войдите:
- Логин: `admin`
- Пароль: `admin123`

---

## 🛠️ ЕСЛИ ВСЁ РАВНО НЕ РАБОТАЕТ

### Проверьте интернет в Docker

```powershell
docker run --rm alpine ping -c 4 google.com
```

Если ping не работает - проблемы с сетью Docker.

### Проверьте DNS

```powershell
docker run --rm alpine nslookup registry.npmjs.org
```

Если DNS не работает - настройте DNS в Docker.

### Перезапустите Docker Desktop

1. Закройте Docker Desktop
2. Откройте Диспетчер задач (Ctrl+Shift+Esc)
3. Найдите процесс "Docker Desktop"
4. Завершите задачу
5. Запустите Docker Desktop заново
6. Дождитесь запуска (зелёный значок)

### Проверьте firewall

```powershell
# Откройте PowerShell от имени администратора
netsh advfirewall firewall show rule name=all | findstr "npm"
```

Если есть блокирующие правила - удалите их.

---

## 📊 СРАВНЕНИЕ РЕШЕНИЙ

### Решение 1: Offline (локальные node_modules)

**Плюсы:**
✅ Не зависит от интернета в Docker  
✅ Самый быстрый способ  
✅ Работает всегда  

**Минусы:**
❌ Нужно установить зависимости локально  
❌ node_modules занимает место на диске  

**Когда использовать:** Всегда, особенно при проблемах с сетью

### Решение 2: Прокси

**Плюсы:**
✅ Работает в корпоративной сети  
✅ Использует корпоративный прокси  

**Минусы:**
❌ Нужен доступ к прокси  
❌ Сложная настройка  

**Когда использовать:** Только в корпоративной сети с прокси

### Решение 3: Зеркало npm

**Плюсы:**
✅ Быстрее в России  
✅ Обходит блокировки  

**Минусы:**
❌ Зеркало может быть недоступно  
❌ Пакеты могут устареть  

**Когда использовать:** При проблемах с доступом к npmjs.org

### Решение 4: Таймауты

**Плюсы:**
✅ Простая настройка  
✅ Работает при медленном интернете  

**Минусы:**
❌ Не помогает при полном отсутствии интернета  
❌ Долгая сборка  

**Когда использовать:** При медленном, но работающем интернете

### Решение 5: Локальная сборка

**Плюсы:**
✅ Не нужен Docker для frontend  
✅ Самый быстрый способ  
✅ Работает всегда  

**Минусы:**
❌ Не используется Docker для frontend  
❌ Нужно запускать serve отдельно  

**Когда использовать:** Когда Docker вообще не работает

---

## ✅ ЧЕК-ЛИСТ

### Перед началом:
- [ ] Docker Desktop запущен
- [ ] Интернет работает
- [ ] Папка проекта существует (D:\BCS)

### Решение 1 (Offline):
- [ ] Выполнено `npm install` локально
- [ ] Папка `node_modules` создана
- [ ] Изменён `docker-compose.yml` (dockerfile: frontend/Dockerfile.offline)
- [ ] Выполнено `docker compose down`
- [ ] Выполнено `docker compose build --no-cache`
- [ ] Выполнено `docker compose up -d`
- [ ] Все контейнеры в статусе "Up"
- [ ] Сайт открывается: http://localhost

---

## 🎯 ИТОГ

**Самое простое решение:**

```powershell
cd D:\BCS

# 1. Установите зависимости локально
npm install

# 2. Измените docker-compose.yml (dockerfile: frontend/Dockerfile.offline)

# 3. Пересоберите Docker
docker compose down
docker compose build --no-cache
docker compose up -d

# 4. Инициализируйте БД
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate

# 5. Откройте http://localhost
```

---

<div align="center">

## 🎉 ПРОБЛЕМА РЕШЕНА!

**Используйте Решение 1 (offline) - оно самое надёжное!**

</div>
