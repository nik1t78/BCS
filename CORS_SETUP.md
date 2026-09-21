# 🔧 НАСТРОЙКА CORS В LARAVEL

## 📋 Проблема

Frontend (React) работает на порту 3000, а Backend (Laravel) на порту 80. Браузер блокирует запросы между разными портами из-за CORS (Cross-Origin Resource Sharing).

## ✅ Решение

### Шаг 1: Установите пакет CORS

```powershell
cd D:\server\BCS-main\backend
docker compose exec backend composer require fruitcake/laravel-cors
```

### Шаг 2: Опубликуйте конфигурацию CORS

```powershell
docker compose exec backend php artisan vendor:publish --tag="cors"
```

### Шаг 3: Настройте CORS

Откройте файл `backend/config/cors.php` и измените:

```php
<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => ['http://localhost:3000', 'http://10.48.4.235:3000'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,
];
```

**Важно:**
- `allowed_origins` - добавьте все адреса с которых будет доступ
- `supports_credentials` - должно быть `true` для работы с токенами

### Шаг 4: Очистите кэш конфигурации

```powershell
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan cache:clear
```

### Шаг 5: Перезапустите backend

```powershell
docker compose restart backend
```

---

## 🌐 Настройка для разных адресов

### Локальная разработка

```php
'allowed_origins' => [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
],
```

### Доступ из локальной сети

```php
'allowed_origins' => [
    'http://localhost:3000',
    'http://10.48.4.235:3000',
    'http://192.168.1.100:3000',
],
```

### Production (все адреса)

```php
'allowed_origins' => ['*'], // Только для тестирования!
```

**Внимание:** В production лучше указывать конкретные домены:

```php
'allowed_origins' => [
    'https://vks.yourcompany.com',
    'https://admin.vks.yourcompany.com',
],
```

---

## 🔐 Настройка Sanctum

### Шаг 1: Опубликуйте конфигурацию Sanctum

```powershell
docker compose exec backend php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
```

### Шаг 2: Настройте Sanctum

Откройте файл `backend/config/sanctum.php`:

```php
<?php

return [
    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
        '%s%s',
        'localhost,localhost:3000,10.48.4.235:3000,127.0.0.1,127.0.0.1:8000,::1',
        env('APP_URL') ? ',' . parse_url(env('APP_URL'), PHP_URL_HOST) : ''
    ))),

    'guard' => ['web'],

    'expiration' => null,

    'middleware' => [
        'verify_csrf_token' => App\Http\Middleware\VerifyCsrfToken::class,
        'encrypt_cookies' => App\Http\Middleware\EncryptCookies::class,
    ],
];
```

### Шаг 3: Обновите .env

Откройте файл `backend/.env` и добавьте:

```env
SANCTUM_STATEFUL_DOMAINS=localhost,localhost:3000,10.48.4.235:3000
SESSION_DOMAIN=localhost
```

### Шаг 4: Очистите кэш

```powershell
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan cache:clear
```

---

## 🚀 Проверка работы

### Тест CORS

Откройте браузер и перейдите на frontend:

```
http://localhost:3000
```

Откройте DevTools (F12) → вкладка Console.

Попробуйте войти в систему. Если видите ошибки CORS:

```
Access to fetch at 'http://localhost/api/auth/login' from origin 'http://localhost:3000' 
has been blocked by CORS policy
```

Значит CORS не настроен правильно. Проверьте:

1. Файл `backend/config/cors.php`
2. Адреса в `allowed_origins`
3. Кэш очищен (`php artisan config:clear`)
4. Backend перезапущен (`docker compose restart backend`)

### Тест API напрямую

```powershell
# Проверьте health check
curl http://localhost/api/health

# Должно вернуть:
# {"status":"ok","timestamp":"...","version":"1.0.0"}
```

---

## 📋 Полная последовательность команд

```powershell
cd D:\server\BCS-main

# 1. Установите CORS
docker compose exec backend composer require fruitcake/laravel-cors

# 2. Опубликуйте конфигурацию
docker compose exec backend php artisan vendor:publish --tag="cors"
docker compose exec backend php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"

# 3. Отредактируйте файлы конфигурации
# backend/config/cors.php
# backend/config/sanctum.php
# backend/.env

# 4. Очистите кэш
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan cache:clear

# 5. Перезапустите backend
docker compose restart backend

# 6. Проверьте работу
# Откройте http://localhost:3000 и попробуйте войти
```

---

## 🛠️ Решение проблем

### Проблема: CORS ошибка

**Решение:**
1. Проверьте `backend/config/cors.php`
2. Убедитесь что адрес frontend в `allowed_origins`
3. Очистите кэш: `php artisan config:clear`
4. Перезапустите backend: `docker compose restart backend`

### Проблема: 401 Unauthorized

**Решение:**
1. Проверьте что токен передаётся в заголовке `Authorization: Bearer {token}`
2. Проверьте что Sanctum настроен правильно
3. Проверьте что пользователь активен в базе данных

### Проблема: 419 Page Expired

**Решение:**
1. Это CSRF ошибка
2. Для API запросов CSRF не нужен
3. Убедитесь что используете `api/*` маршруты, а не `web/*`

### Проблема: 429 Too Many Requests

**Решение:**
1. Это rate limiting
2. Увеличьте лимиты в `app/Providers/RouteServiceProvider.php`
3. Или временно отключите для тестирования

---

## 📊 Итоговая проверка

После настройки CORS вы должны:

✅ Видеть пользователей в админ-панели  
✅ Видеть конференции всех пользователей  
✅ Получать уведомления в реальном времени  
✅ Создавать конференции которые видят все  
✅ Работать с любого IP адреса в сети  

---

<div align="center">

## 🎉 CORS НАСТРОЕН!

**Теперь frontend и backend работают вместе!**

</div>
