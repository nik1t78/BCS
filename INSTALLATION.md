# 🚀 ПОЛНАЯ ИНСТРУКЦИЯ ПО УСТАНОВКЕ И ЗАПУСКУ

## 📋 Что нужно скачать

### Обязательные программы:

| Программа | Версия | Размер | Для чего | Скачать |
|-----------|--------|--------|----------|---------|
| **Docker Desktop** | 20.10+ | ~500 MB | Запуск контейнеров | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Git** | 2.30+ | ~50 MB | Клонирование проекта | [git-scm.com](https://git-scm.com/downloads) |
| **Composer** | 2.5+ | ~10 MB | PHP пакеты (для Laravel) | [getcomposer.org](https://getcomposer.org/download/) |
| **Node.js** | 20+ | ~100 MB | Frontend разработка | [nodejs.org](https://nodejs.org/) |

### Опциональные программы:

| Программа | Размер | Для чего | Скачать |
|-----------|--------|----------|---------|
| **VS Code** | ~200 MB | Редактор кода | [code.visualstudio.com](https://code.visualstudio.com/) |
| **MySQL Workbench** | ~300 MB | Управление БД | [mysql.com](https://www.mysql.com/products/workbench/) |
| **Postman** | ~150 MB | Тестирование API | [postman.com](https://www.postman.com/downloads/) |

---

## 📥 Пошаговая установка

### Шаг 1: Установка Docker Desktop

#### Windows:
1. Скачайте [Docker Desktop for Windows](https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe)
2. Запустите установщик
3. Следуйте инструкциям
4. Перезагрузите компьютер
5. Запустите Docker Desktop
6. Дождитесь запуска (иконка кита в трее станет зелёной)

**Проверка:**
```powershell
docker --version
docker compose version
```

#### macOS:
1. Скачайте [Docker Desktop for Mac](https://desktop.docker.com/mac/main/arm64/Docker.dmg)
2. Откройте DMG файл
3. Перетащите Docker в Applications
4. Запустите Docker из Applications

**Проверка:**
```bash
docker --version
docker compose version
```

#### Linux (Ubuntu/Debian):
```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker

# Проверка
docker --version
docker compose version
```

---

### Шаг 2: Установка Git

#### Windows:
1. Скачайте [Git for Windows](https://git-scm.com/download/win)
2. Установите с настройками по умолчанию
3. Откройте Git Bash

**Проверка:**
```bash
git --version
```

#### macOS:
```bash
# Через Homebrew
brew install git

# Или скачайте с git-scm.com
git --version
```

#### Linux:
```bash
sudo apt install -y git
git --version
```

---

### Шаг 3: Установка Composer (для Laravel)

#### Windows:
1. Скачайте [Composer-Setup.exe](https://getcomposer.org/Composer-Setup.exe)
2. Установите (автоматически найдёт PHP)

**Проверка:**
```powershell
composer --version
```

#### macOS/Linux:
```bash
# Установка Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# Проверка
composer --version
```

---

### Шаг 4: Установка Node.js

#### Все платформы:
1. Скачайте [Node.js LTS](https://nodejs.org/) (версия 20+)
2. Установите с настройками по умолчанию

**Проверка:**
```bash
node --version  # Должно быть v20.x.x
npm --version   # Должно быть 10.x.x
```

---

## 🚀 Запуск проекта

### Шаг 1: Клонирование проекта

```bash
# Создайте папку для проектов
mkdir projects
cd projects

# Клонируйте репозиторий
git clone https://github.com/your-username/vks-schedule.git
cd vks-schedule
```

**Или создайте проект с нуля:**
```bash
mkdir vks-schedule
cd vks-schedule
git init
```

---

### Шаг 2: Создание Laravel Backend

```bash
# Создайте папку backend
mkdir backend
cd backend

# Создайте Laravel проект
composer create-project laravel/laravel . --prefer-dist --no-interaction

# Вернитесь в корень проекта
cd ..
```

---

### Шаг 3: Запуск Docker

```bash
# Сборка и запуск всех контейнеров
docker compose up -d --build
```

**Проверка статуса:**
```bash
docker compose ps
```

**Должны быть запущены:**
- ✅ vks-frontend
- ✅ vks-backend
- ✅ vks-nginx
- ✅ vks-mysql
- ✅ vks-redis
- ✅ vks-queue
- ✅ vks-scheduler

---

### Шаг 4: Инициализация базы данных

```bash
# Генерация ключа приложения
docker compose exec backend php artisan key:generate

# Создание таблиц
docker compose exec backend php artisan migrate
```

---

### Шаг 5: Создание первого администратора

**Вариант 1: Через Tinker (рекомендуется)**
```bash
docker compose exec backend php artisan tinker
```

**В tinker выполните:**
```php
$user = new App\Models\User();
$user->name = 'Ваше Имя Фамилия';
$user->login = 'admin';
$user->password = bcrypt('YourStrongPassword123!');
$user->role = 'admin';
$user->phone = '+7 (999) 123-45-67';
$user->department = 'IT';
$user->position = 'Системный администратор';
$user->is_active = true;
$user->save();

echo "Пользователь создан с ID: " . $user->id;
exit
```

**Вариант 2: Через регистрацию + изменение роли**
1. Откройте http://localhost
2. Зарегистрируйтесь через форму
3. Измените роль на admin:
```bash
docker compose exec backend php artisan tinker
$user = App\Models\User::where('login', 'your_login')->first();
$user->role = 'admin';
$user->save();
exit
```

---

### Шаг 6: Открытие приложения

Откройте браузер и перейдите:

```
http://localhost
```

**Войдите с созданным администратором:**
- Логин: `admin`
- Пароль: `YourStrongPassword123!`

---

## ✅ Проверка работоспособности

### Чек-лист:

- [ ] Docker запущен (`docker compose ps`)
- [ ] Все контейнеры в статусе "Up"
- [ ] Приложение открывается по http://localhost
- [ ] Можно войти в систему
- [ ] Можно создать конференцию
- [ ] Уведомления работают

### Тест API:
```bash
curl http://localhost/api/health
```

**Ожидаемый ответ:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00+00:00",
  "version": "1.0.0"
}
```

---

## 🔧 Полезные команды

### Docker:
```bash
# Запуск
docker compose up -d

# Остановка
docker compose down

# Перезапуск
docker compose restart

# Логи
docker compose logs -f
docker compose logs -f backend

# Статус
docker compose ps

# Вход в контейнер
docker compose exec backend bash
docker compose exec mysql mysql -u vks_user -p vks_schedule
```

### Laravel:
```bash
# Миграции
docker compose exec backend php artisan migrate
docker compose exec backend php artisan migrate:fresh

# Кэш
docker compose exec backend php artisan cache:clear
docker compose exec backend php artisan config:clear

# Tinker
docker compose exec backend php artisan tinker
```

### База данных:
```bash
# Подключение
docker compose exec mysql mysql -u vks_user -p vks_schedule

# Backup
docker compose exec mysql mysqldump -u vks_user -pvks_password_2024 vks_schedule > backup.sql

# Restore
docker compose exec -T mysql mysql -u vks_user -pvks_password_2024 vks_schedule < backup.sql
```

---

## 🐛 Решение проблем

### Порт 80 занят
```bash
# Проверка
sudo lsof -i :80

# Остановка процесса
sudo kill -9 <PID>

# Или измените порт в docker-compose.yml
ports:
  - "8080:80"
```

### Ошибки прав доступа
```bash
docker compose exec backend chown -R www-www-data storage bootstrap/cache
docker compose exec backend chmod -R 775 storage bootstrap/cache
```

### Ошибки БД
```bash
# Пересоздание БД
docker compose down -v
docker compose up -d
docker compose exec backend php artisan migrate:fresh
```

### Контейнер не запускается
```bash
# Просмотр логов
docker compose logs backend
docker compose logs nginx

# Перезапуск
docker compose restart backend
```

### Полный сброс
```bash
# Остановка и удаление всех данных
docker compose down -v

# Начало заново
docker compose up -d --build
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate:fresh
```

---

## 📊 Структура проекта

```
vks-schedule/
│
├── 📄 README.md                    # Главная документация
├── 📄 ALL_DOCUMENTATION.md         # Полная документация
├── 📄 INSTALLATION.md              # Этот файл
├── 📄 SECURITY_CLEANUP.md          # Безопасность
├── 📄 LINUX_DEPLOYMENT.md          # Развёртывание на Linux
│
├── 📄 docker-compose.yml           # Docker конфигурация
│
├── 📂 backend/                     # Laravel backend
│   ├── Dockerfile
│   ├── .env                        # Переменные окружения
│   ├── app/
│   │   ├── Console/Commands/       # Artisan команды
│   │   ├── Http/Controllers/Api/   # Контроллеры
│   │   ├── Http/Middleware/        # Middleware
│   │   └── Models/                 # Eloquent модели
│   ├── database/
│   │   ├── migrations/             # Миграции БД
│   │   └── seeders/                # Seeders
│   └── routes/                     # Маршруты
│
├── 📂 frontend/                    # React frontend
│   ├── Dockerfile
│   └── nginx.conf
│
├── 📂 src/                         # Исходный код React
│   ├── components/                 # React компоненты
│   ├── utils/                      # Утилиты
│   ├── App.tsx                     # Главный компонент
│   ├── store.ts                    # LocalStorage API
│   └── types.ts                    # TypeScript типы
│
└── 📂 docker/                      # Docker конфигурации
    ├── nginx/
    └── mysql/
```

---

## 📚 Документация

| Файл | Описание | Время чтения |
|------|----------|--------------|
| **README.md** | Главная документация | 5 мин |
| **ALL_DOCUMENTATION.md** | Полная документация | 30 мин |
| **INSTALLATION.md** | Этот файл - установка и запуск | 10 мин |
| **SECURITY_CLEANUP.md** | Безопасность | 10 мин |
| **LINUX_DEPLOYMENT.md** | Развёртывание на Linux | 20 мин |

---

## 🎯 Быстрый старт (для опытных)

Если вы уже знакомы с Docker и Laravel:

```bash
# 1. Клонирование
git clone <repo-url> vks-schedule && cd vks-schedule

# 2. Создание Laravel
cd backend && composer create-project laravel/laravel . && cd ..

# 3. Запуск
docker compose up -d --build

# 4. Инициализация
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate

# 5. Создание админа
docker compose exec backend php artisan tinker
# В tinker: создайте пользователя с role = 'admin'

# 6. Открытие
open http://localhost
```

---

## ✅ Финальный чек-лист

### Установка:
- [ ] Docker Desktop установлен
- [ ] Git установлен
- [ ] Composer установлен
- [ ] Node.js установлен

### Проект:
- [ ] Проект клонирован
- [ ] Laravel backend создан
- [ ] Docker запущен
- [ ] Миграции выполнены

### Настройка:
- [ ] Первый администратор создан
- [ ] Можно войти в систему
- [ ] Можно создать конференцию
- [ ] Уведомления работают

---

<div align="center">

## 🎉 Готово к использованию!

**Приложение доступно по адресу:** http://localhost

**Версия**: 1.0  
**Статус**: ✅ Production Ready

</div>
