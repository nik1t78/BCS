# Инструкция по развертыванию ВКС Расписание на сервере

## Требования
- Docker и Docker Compose
- Минимум 2GB RAM
- 10GB свободного места на диске

## Быстрый старт

### 1. Клонирование проекта
```bash
git clone <your-repo-url> vks-schedule
cd vks-schedule
```

### 2. Запуск всех сервисов
```bash
docker-compose up -d --build
```

### 3. Инициализация базы данных и backend
```bash
# Копирование .env файла
docker exec vks-backend cp .env.example .env

# Генерация APP_KEY
docker exec vks-backend php artisan key:generate

# Запуск миграций
docker exec vks-backend php artisan migrate --force

# Запуск сидеров (демо данные)
docker exec vks-backend php artisan db:seed --class=VksDatabaseSeeder --force
```

### 4. Проверка работы
Откройте в браузере: `http://ваш-сервер-ip/`

## Демо доступы
- **Администратор**: login: `admin`, password: `admin123`
- **Модератор**: login: `moderator`, password: `moderator123`
- **Пользователь**: login: `user`, password: `user123`

## Управление сервисами

### Просмотр логов
```bash
# Все логи
docker-compose logs -f

# Backend логи
docker-compose logs -f backend

# Frontend логи
docker-compose logs -f nginx
```

### Перезапуск
```bash
docker-compose restart
```

### Остановка
```bash
docker-compose down
```

### Полная очистка (с удалением БД)
```bash
docker-compose down -v
```

## Структура проекта
```
vks-schedule/
├── backend/              # Laravel API
│   ├── app/             # Контроллеры, модели
│   ├── database/        # Миграции, сидеры
│   ├── routes/          # Маршруты API
│   └── storage/         # Файлы, логи
├── src/                 # React frontend
├── docker-compose.yml   # Конфигурация Docker
└── DEPLOYMENT.md        # Эта инструкция
```

## Порты
- **80** - Web интерфейс (nginx)
- **3306** - MySQL (только внутри сети Docker)

## Безопасность
1. Смените пароли в `docker-compose.yml` перед production
2. Настройте HTTPS через reverse proxy (nginx, traefik)
3. Закройте порт 3306 фаерволом для внешнего доступа

## Обновление
```bash
git pull
docker-compose up -d --build
docker exec vks-backend php artisan migrate --force
```
