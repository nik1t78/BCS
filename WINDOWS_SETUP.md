# 🪟 ПОЛНАЯ ИНСТРУКЦИЯ ПО ЗАПУСКУ НА WINDOWS

## 📋 Два способа запуска

| Способ | Сложность | Время | Для чего |
|--------|-----------|-------|----------|
| **Docker** | ⭐⭐ | 15 мин | Production, команда |
| **Node.js** | ⭐ | 5 мин | Разработка, тестирование |

---

# 🐳 СПОСОБ 1: ЧЕРЕЗ DOCKER (РЕКОМЕНДУЕТСЯ)

## Шаг 1: Установка Docker Desktop

### 1.1. Скачайте Docker Desktop

Откройте браузер и перейдите:
**https://www.docker.com/products/docker-desktop/**

Нажмите большую синюю кнопку **"Download for Windows - AMD64"**

### 1.2. Установите Docker Desktop

1. Найдите скачанный файл `Docker Desktop Installer.exe`
2. **Дважды кликните** по нему
3. Нажмите **"OK"** в окне контроля учётных записей
4. Дождитесь установки (3-5 минут)
5. **Перезагрузите компьютер**
6. После перезагрузки запустите **Docker Desktop** из меню Пуск
7. Примите лицензионное соглашение
8. Пропустите обучение (Skip tutorial)
9. Дождитесь запуска (в трее появится зелёный значок кита 🐳)

### 1.3. Проверьте установку

Откройте **PowerShell** или **Командную строку** (Win + R → cmd → Enter):

```powershell
docker --version
docker compose version
```

Должно показать версии Docker и Docker Compose.

---

## Шаг 2: Загрузка проекта

### Вариант A: Если проект уже на компьютере

Откройте PowerShell и перейдите в папку:

```powershell
cd D:\BCS
```

### Вариант B: Клонирование с GitHub

```powershell
# Создайте папку для проектов
mkdir D:\projects
cd D:\projects

# Клонируйте репозиторий
git clone https://github.com/nik1t78/BCS.git
cd BCS
```

**Если Git не установлен:**
1. Скачайте: https://git-scm.com/download/win
2. Установите с настройками по умолчанию
3. Перезапустите PowerShell

---

## Шаг 3: Запуск проекта

В PowerShell выполните:

```powershell
# Запуск всех контейнеров
docker compose up -d --build
```

⏳ Первая сборка займёт **5-10 минут** (скачиваются образы)

### Проверка статуса

```powershell
docker compose ps
```

Должны быть запущены:
- ✅ vks-frontend
- ✅ vks-backend
- ✅ vks-nginx
- ✅ vks-mysql
- ✅ vks-redis
- ✅ vks-queue
- ✅ vks-scheduler

---

## Шаг 4: Инициализация базы данных

```powershell
# Генерация ключа Laravel
docker compose exec backend php artisan key:generate

# Создание таблиц в БД
docker compose exec backend php artisan migrate

# Загрузка тестовых данных (опционально)
docker compose exec backend php artisan db:seed --class=VksDatabaseSeeder
```

---

## Шаг 5: Открытие сайта

Откройте браузер и перейдите:

**http://localhost**

Должна открыться страница входа!

---

## Шаг 6: Вход в систему

| Роль | Логин | Пароль |
|------|-------|--------|
| 👑 Админ | `admin` | `admin123` |
| 🔧 Модератор | `moderator` | `mod123` |
| 👤 Пользователь | `ivanov` | `user123` |

---

## 🌐 Доступ для других компьютеров в сети

### Шаг 1: Узнайте IP адрес

```powershell
ipconfig
```

Найдите строку **"IPv4-адрес"** (например: `192.168.1.100`)

### Шаг 2: Откройте порт в firewall

Запустите PowerShell **ОТ ИМЕНИ АДМИНИСТРАТОРА**:

1. Нажмите **Пуск**
2. Введите `powershell`
3. **Правый клик** → **"Запуск от имени администратора"**

Выполните:

```powershell
netsh advfirewall firewall add rule name="ВКС Расписание" dir=in action=allow protocol=TCP localport=80
```

### Шаг 3: Готово!

Другие сотрудники открывают: **http://192.168.1.100**

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
docker compose logs nginx
docker compose logs mysql

# Логи в реальном времени
docker compose logs -f
```

### Обновление проекта

```powershell
# Получить изменения из Git
git pull

# Пересобрать и перезапустить
docker compose up -d --build

# Применить миграции
docker compose exec backend php artisan migrate
```

---

## 🗄️ Работа с базой данных

### Подключение к MySQL

```powershell
docker compose exec mysql mysql -u vks_user -pvks_password_2024 vks_schedule
```

### Резервное копирование

```powershell
# Создать backup
docker compose exec mysql mysqldump -u vks_user -pvks_password_2024 vks_schedule > backup.sql

# Восстановить из backup
docker compose exec -T mysql mysql -u vks_user -pvks_password_2024 vks_schedule < backup.sql
```

### Полный сброс базы

```powershell
docker compose down -v
docker compose up -d
docker compose exec backend php artisan migrate
```

---

# 💻 СПОСОБ 2: ЧЕРЕЗ NODE.JS (БЫСТРЫЙ)

## Шаг 1: Установка Node.js

### 1.1. Скачайте Node.js

Откройте: **https://nodejs.org/**

Нажмите на большую зелёную кнопку **"LTS"** (рекомендуемая версия)

### 1.2. Установите Node.js

1. Найдите скачанный файл `node-v20.x.x-x64.msi`
2. **Дважды кликните** по нему
3. Нажмите **"Next"**
4. Примите лицензию: поставьте галочку **"I accept..."**
5. Нажмите **"Next"** (оставьте путь по умолчанию)
6. Нажмите **"Next"** (оставьте компоненты)
7. Нажмите **"Install"**
8. Дождитесь установки
9. Нажмите **"Finish"**

### 1.3. Проверьте установку

Откройте PowerShell:

```powershell
node --version
npm --version
```

Должно показать версии (v20.x.x и 10.x.x).

---

## Шаг 2: Установка Git (если не установлен)

1. Скачайте: **https://git-scm.com/download/win**
2. Установите с настройками по умолчанию
3. Проверьте:

```powershell
git --version
```

---

## Шаг 3: Запуск проекта

```powershell
# 1. Перейдите в папку проекта
cd D:\BCS

# 2. Установите зависимости
npm install

# 3. Соберите проект
npm run build

# 4. Установите веб-сервер (один раз)
npm install -g serve

# 5. Запустите сервер
serve -s dist -l 3000
```

✅ Готово! Откройте **http://localhost:3000**

---

## 🌐 Доступ для других компьютеров

### Шаг 1: Узнайте IP адрес

```powershell
ipconfig
```

Запомните **IPv4-адрес** (например: `192.168.1.100`)

### Шаг 2: Откройте порт в firewall

Запустите PowerShell **ОТ ИМЕНИ АДМИНИСТРАТОРА**:

```powershell
netsh advfirewall firewall add rule name="ВКС Расписание" dir=in action=allow protocol=TCP localport=3000
```

### Шаг 3: Готово!

Другие сотрудники открывают: **http://192.168.1.100:3000**

---

## 🔄 Ежедневное использование

### Запуск сервера (утром)

```powershell
cd D:\BCS
serve -s dist -l 3000
```

### Остановка сервера (вечером)

В окне PowerShell нажмите **Ctrl + C**

---

# 🛠️ РЕШЕНИЕ ПРОБЛЕМ

## Проблема 1: Docker Desktop не запускается

**Решение:**

1. Убедитесь что включена виртуализация в BIOS:
   - Перезагрузите компьютер
   - Войдите в BIOS (обычно F2 или Del при загрузке)
   - Найдите **"Intel VT-x"** или **"AMD-V"**
   - Включите (Enable)
   - Сохраните и перезагрузите

2. Обновите WSL2:
```powershell
wsl --update
wsl --set-default-version 2
```

3. Перезапустите Docker Desktop

---

## Проблема 2: Порт 80 занят

**Решение:**

```powershell
# Найдите процесс
netstat -ano | findstr :80

# Убейте процесс (замените PID)
taskkill /PID [номер] /F
```

**Или измените порт:**

Откройте `docker-compose.yml`, найдите строку:
```yaml
ports:
  - "80:80"
```

Измените на:
```yaml
ports:
  - "8080:80"
```

Перезапустите:
```powershell
docker compose down
docker compose up -d
```

Доступ будет по адресу: **http://localhost:8080**

---

## Проблема 3: Порт 3000 занят

**Решение:**

```powershell
# Найдите процесс
netstat -ano | findstr :3000

# Убейте процесс
taskkill /PID [номер] /F
```

**Или используйте другой порт:**

```powershell
serve -s dist -l 8080
```

Доступ: **http://localhost:8080**

---

## Проблема 4: npm install зависает

**Решение:**

```powershell
# Очистите кэш npm
npm cache clean --force

# Удалите старые файлы
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json

# Установите заново
npm install
```

---

## Проблема 5: Ошибка "serve не найден"

**Решение:**

```powershell
npm install -g serve
```

---

## Проблема 6: Контейнер не запускается

**Решение:**

```powershell
# Проверьте логи
docker compose logs backend
docker compose logs nginx
docker compose logs mysql

# Полная пересборка
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## Проблема 7: Ошибки прав доступа

**Решение:**

```powershell
docker compose exec backend chown -R www-www-data storage bootstrap/cache
docker compose exec backend chmod -R 775 storage bootstrap/cache
```

---

## Проблема 8: Сайт не открывается

**Решение:**

1. Проверьте что сервер запущен:
```powershell
docker compose ps
```

2. Проверьте адрес: **http://localhost**

3. Попробуйте другой браузер

4. Очистите кэш браузера: **Ctrl + Shift + Delete**

5. Проверьте что firewall не блокирует:
```powershell
netsh advfirewall firewall show rule name="ВКС Расписание"
```

---

## Проблема 9: Не могу войти

**Решение:**

1. Очистите localStorage:
   - Откройте сайт
   - Нажмите **F12**
   - Вкладка **Console**
   - Введите: `localStorage.clear()`
   - Нажмите **Enter**
   - Обновите страницу (**F5**)

2. Попробуйте войти снова:
   - Логин: `admin`
   - Пароль: `admin123`

---

## Проблема 10: Другие компьютеры не могут подключиться

**Решение:**

1. Проверьте что все компьютеры в одной сети

2. Проверьте IP адрес:
```powershell
ipconfig
```

3. Проверьте что firewall открыт:
```powershell
netsh advfirewall firewall show rule name="ВКС Расписание"
```

4. Если правила нет, добавьте:
```powershell
netsh advfirewall firewall add rule name="ВКС Расписание" dir=in action=allow protocol=TCP localport=80
```

5. Проверьте доступность с другого компьютера:
```powershell
Test-NetConnection -ComputerName 192.168.1.100 -Port 80
```

---

# 📊 СРАВНЕНИЕ СПОСОБОВ

## Docker

**Плюсы:**
✅ Все зависимости в контейнерах  
✅ Не нужно устанавливать Node.js, PHP, MySQL  
✅ Легко переносить между компьютерами  
✅ Готово к production  
✅ Автоматический запуск всех сервисов  

**Минусы:**
❌ Требует Docker Desktop (~500 MB)  
❌ Первый запуск дольше (5-10 минут)  
❌ Занимает больше места на диске  

**Когда использовать:**
- Для production
- Для команды
- Когда нужна стабильность

---

## Node.js

**Плюсы:**
✅ Быстрый запуск  
✅ Удобно для разработки  
✅ Меньше места на диске  
✅ Не нужен Docker  

**Минусы:**
❌ Нужно устанавливать Node.js  
❌ Только frontend (без backend)  
❌ Сложнее переносить  

**Когда использовать:**
- Для разработки
- Для тестирования
- Для быстрой демонстрации

---

# 🎯 РЕКОМЕНДАЦИИ

### Для разработки:
👉 Используйте **Node.js** (быстрее)

### Для демонстрации заказчику:
👉 Используйте **Node.js** (быстрый запуск)

### Для production:
👉 Используйте **Docker** (стабильность)

### Для команды:
👉 Используйте **Docker** (одинаковая среда)

---

# 📋 ЧЕК-ЛИСТ ПЕРЕД ЗАПУСКОМ

## Для Docker:
- [ ] Docker Desktop установлен
- [ ] Docker запущен (зелёный значок в трее)
- [ ] `docker --version` работает
- [ ] Проект скачан
- [ ] `docker compose up -d --build` выполнен
- [ ] Все контейнеры запущены (`docker compose ps`)
- [ ] База данных инициализирована
- [ ] Миграции выполнены
- [ ] Сайт открывается: http://localhost
- [ ] Вход работает: admin / admin123
- [ ] Firewall открыт (для доступа из сети)

## Для Node.js:
- [ ] Node.js 20+ установлен
- [ ] `node --version` работает
- [ ] Git установлен
- [ ] Проект скачан
- [ ] `npm install` выполнен
- [ ] `npm run build` выполнен
- [ ] `serve` установлен
- [ ] Сервер запущен
- [ ] Сайт открывается: http://localhost:3000
- [ ] Вход работает: admin / admin123
- [ ] Firewall открыт (для доступа из сети)

---

# 🚀 БЫСТРЫЕ КОМАНДЫ

## Docker

```powershell
# Запуск
docker compose up -d --build

# Инициализация
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate

# Остановка
docker compose down

# Перезапуск
docker compose restart

# Логи
docker compose logs -f

# Статус
docker compose ps
```

## Node.js

```powershell
# Установка
npm install

# Сборка
npm run build

# Запуск
serve -s dist -l 3000

# Остановка
Ctrl + C
```

---

# 📞 ПОДДЕРЖКА

### Если ничего не помогает:

1. Перезагрузите компьютер
2. Удалите и переустановите Docker/Node.js
3. Очистите все данные:
```powershell
docker compose down -v
Remove-Item -Recurse -Force node_modules
npm install
```
4. Начните заново с первого шага

---

<div align="center">

## 🎉 ГОТОВО!

**Проект готов к запуску на Windows!**

### Docker:
```powershell
docker compose up -d --build
```
Откройте: **http://localhost**

### Node.js:
```powershell
npm install
npm run build
serve -s dist -l 3000
```
Откройте: **http://localhost:3000**

### Вход:
```
Логин: admin
Пароль: admin123
```

**Удачи! 🚀**

</div>
