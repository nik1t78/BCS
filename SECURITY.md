# 🔐 Инструкция по безопасности ВКС Расписание

## 📋 Содержание

1. [Аутентификация](#аутентификация)
2. [Авторизация и роли](#авторизация-и-роли)
3. [Защита данных](#защита-данных)
4. [Сетевая безопасность](#сетевая-безопасность)
5. [SSL/TLS](#ssltls)
6. [Firewall](#firewall)
7. [Мониторинг](#мониторинг)
8. [Резервное копирование](#резервное-копирование)
9. [Обновления](#обновления)
10. [Чек-лист безопасности](#чек-лист-безопасности)

---

## 🔑 Аутентификация

### 1. Пароли

#### Требования к паролям

```php
// backend/app/Http/Controllers/Api/AuthController.php

$request->validate([
    'password' => [
        'required',
        'string',
        'min:8',                          // Минимум 8 символов
        'regex:/[a-z]/',                  // Хотя бы одна строчная буква
        'regex:/[A-Z]/',                  // Хотя бы одна заглавная буква
        'regex:/[0-9]/',                  // Хотя бы одна цифра
        'regex:/[@$!%*?&]/',             // Хотя бы один спецсимвол
        'confirmed',
    ],
]);
```

#### Хеширование паролей

```php
// Laravel автоматически хеширует пароли через bcrypt
// В модели User.php
protected $casts = [
    'password' => 'hashed',
];

// Или вручную
use Illuminate\Support\Facades\Hash;
$hashedPassword = Hash::make($plainPassword);
```

#### Проверка пароля

```php
if (Hash::check($request->password, $user->password)) {
    // Пароль верный
}
```

### 2. Токены (Laravel Sanctum)

#### Генерация токена

```php
$token = $user->createToken('auth_token')->plainTextToken;
```

#### Использование токена

```javascript
// Frontend
const response = await fetch('/api/meetings', {
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    }
});
```

#### Удаление токена (logout)

```php
$request->user()->currentAccessToken()->delete();
```

### 3. Защита от брутфорса

#### Rate Limiting

```php
// backend/app/Providers/RouteServiceProvider.php

protected function configureRateLimiting()
{
    RateLimiter::for('login', function (Request $request) {
        return Limit::perMinute(5)->by($request->ip);
    });

    RateLimiter::for('api', function (Request $request) {
        return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
    });
}

// Применение
Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:login');
```

#### Fail2Ban (сервер)

```bash
# Установка
sudo apt install fail2ban

# Конфигурация
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[nginx-botsearch]
enabled = true
port = http,https
filter = nginx-botsearch
logpath = /var/log/nginx/access.log
maxretry = 2
```

```bash
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban
```

---

## 👥 Авторизация и роли

### 1. Middleware для проверки ролей

```php
// backend/app/Http/Middleware/CheckRole.php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckRole
{
    public function handle(Request $request, Closure $next, ...$roles)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Не авторизован'], 401);
        }

        if (!in_array($user->role, $roles)) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        return $next($request);
    }
}
```

### 2. Регистрация middleware

```php
// backend/app/Http/Kernel.php

protected $middlewareAliases = [
    // ...
    'role' => \App\Http\Middleware\CheckRole::class,
];
```

### 3. Использование в маршрутах

```php
// backend/routes/api.php

// Только для админов
Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::post('/admin/users', [UserController::class, 'store']);
    Route::delete('/admin/users/{id}', [UserController::class, 'destroy']);
});

// Для админов и модераторов
Route::middleware(['auth:sanctum', 'role:admin,moderator'])->group(function () {
    Route::get('/admin/users', [UserController::class, 'index']);
    Route::put('/admin/users/{id}/toggle-active', [UserController::class, 'toggleActive']);
});
```

### 4. Проверка в контроллерах

```php
public function destroy(Request $request, $id)
{
    $user = $request->user();
    
    // Проверка роли
    if (!$user->isAdmin()) {
        return response()->json(['message' => 'Доступ запрещён'], 403);
    }

    // Проверка что не удаляет себя
    if ($user->id == $id) {
        return response()->json(['message' => 'Нельзя удалить свой аккаунт'], 422);
    }

    // ... удаление
}
```

---

## 🛡️ Защита данных

### 1. Валидация входных данных

```php
// Всегда валидируйте входные данные
$request->validate([
    'title' => 'required|string|max:255',
    'email' => 'required|email|unique:users,email,' . $id,
    'date' => 'required|date|after_or_equal:today',
    'participants' => 'array',
    'participants.*' => 'integer|exists:users,id',
]);
```

### 2. Защита от SQL инъекций

```php
// ✅ ПРАВИЛЬНО - использует prepared statements
$user = User::where('email', $request->email)->first();

// ❌ НЕПРАВИЛЬНО - уязвимо к SQL инъекциям
$user = DB::select("SELECT * FROM users WHERE email = '{$request->email}'");
```

### 3. Защита от XSS

```php
// Laravel автоматически экранирует данные в Blade
{{ $user->name }}  // Безопасно
{!! $user->name !!}  // Опасно - не экранирует

// В React (автоматическое экранирование)
<div>{user.name}</div>  // Безопасно
```

### 4. Защита от CSRF

```php
// Laravel Sanctum автоматически защищает API
// Для веб-форм используйте @csrf
<form method="POST" action="/submit">
    @csrf
    <!-- ... -->
</form>
```

### 5. Шифрование чувствительных данных

```php
use Illuminate\Support\Facades\Crypt;

// Шифрование
$encrypted = Crypt::encryptString($sensitiveData);

// Дешифрование
$decrypted = Crypt::decryptString($encrypted);
```

### 6. Маскирование данных в логах

```php
// backend/app/Http/Middleware/LogSensitiveData.php

public function handle($request, Closure $next)
{
    $response = $next($request);
    
    // Маскируем пароли в логах
    $content = $response->getContent();
    $content = preg_replace('/"password":"[^"]*"/', '"password":"***"', $content);
    
    return $response->setContent($content);
}
```

---

## 🌐 Сетевая безопасность

### 1. CORS настройки

```php
// backend/config/cors.php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => ['https://vks.yourdomain.com'],  // Только ваш домен
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
```

### 2. Security Headers

```nginx
# docker/nginx/default.conf

server {
    # Защита от clickjacking
    add_header X-Frame-Options "SAMEORIGIN" always;
    
    # Защита от MIME type sniffing
    add_header X-Content-Type-Options "nosniff" always;
    
    # XSS защита
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Referrer Policy
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;" always;
    
    # HSTS (HTTPS only)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Скрыть версию сервера
    server_tokens off;
}
```

### 3. Ограничение доступа по IP

```nginx
# Разрешить доступ к админке только из офиса
location /api/admin/ {
    allow 192.168.1.0/24;  # Офисная сеть
    allow 10.0.0.0/8;      # VPN
    deny all;
    
    # ... остальная конфигурация
}
```

---

## 🔒 SSL/TLS

### 1. Получение сертификата Let's Encrypt

```bash
# Установка Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d vks.yourdomain.com

# Следуйте инструкциям:
# - Email для уведомлений
# - Согласие с условиями
# - Перенаправление HTTP → HTTPS
```

### 2. Настройка Nginx для HTTPS

```nginx
# docker/nginx/default.conf

# Перенаправление HTTP на HTTPS
server {
    listen 80;
    server_name vks.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS сервер
server {
    listen 443 ssl http2;
    server_name vks.yourdomain.com;

    # SSL сертификаты
    ssl_certificate /etc/letsencrypt/live/vks.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vks.yourdomain.com/privkey.pem;

    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # SSL сессии
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;

    # ... остальная конфигурация
}
```

### 3. Автообновление сертификата

```bash
# Проверка автообновления
sudo certbot renew --dry-run

# Certbot автоматически добавляет cron задачу
# Проверить:
sudo systemctl list-timers | grep certbot
```

---

## 🚧 Firewall

### 1. UFW (Ubuntu/Debian)

```bash
# Установка
sudo apt install ufw

# Настройка по умолчанию
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Разрешить SSH
sudo ufw allow ssh
# или
sudo ufw allow 22/tcp

# Разрешить HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Разрешить MySQL (только для разработки!)
sudo ufw allow from 192.168.1.0/24 to any port 3306

# Включить firewall
sudo ufw enable

# Проверка статуса
sudo ufw status verbose
```

### 2. iptables (продвинутая настройка)

```bash
# Разрешить установленные соединения
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Разрешить localhost
sudo iptables -A INPUT -i lo -j ACCEPT

# Разрешить SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Разрешить HTTP/HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Заблокировать всё остальное
sudo iptables -A INPUT -j DROP

# Сохранить правила
sudo iptables-save > /etc/iptables/rules.v4
```

### 3. Docker firewall

```yaml
# docker-compose.yml

services:
  mysql:
    ports:
      - "127.0.0.1:3306:3306"  # Только localhost
    # или
    ports:
      - "3306:3306"  # Все интерфейсы (НЕ РЕКОМЕНДУЕТСЯ)
```

---

## 📊 Мониторинг

### 1. Логи Laravel

```bash
# Просмотр логов
docker compose exec backend tail -f storage/logs/laravel.log

# Очистка старых логов
docker compose exec backend php artisan log:clear
```

### 2. Nginx логи

```bash
# Access logs
docker compose exec nginx tail -f /var/log/nginx/access.log

# Error logs
docker compose exec nginx tail -f /var/log/nginx/error.log
```

### 3. Аудит действий пользователей

```php
// Создание таблицы аудитов
Schema::create('audits', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->nullable()->constrained();
    $table->string('action');  // login, logout, create, update, delete
    $table->string('model_type');  // App\Models\User
    $table->unsignedBigInteger('model_id');
    $table->json('old_values')->nullable();
    $table->json('new_values')->nullable();
    $table->string('ip_address', 45);
    $table->string('user_agent')->nullable();
    $table->timestamps();
});

// Middleware для аудита
public function handle($request, Closure $next)
{
    $response = $next($request);
    
    if ($request->user() && in_array($request->method(), ['POST', 'PUT', 'DELETE'])) {
        Audit::create([
            'user_id' => $request->user()->id,
            'action' => strtolower($request->method()),
            'model_type' => get_class($request->route()->getController()),
            'model_id' => $request->route()->parameters['id'] ?? 0,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }
    
    return $response;
}
```

### 4. Мониторинг ресурсов

```bash
# Docker stats
docker stats

# Использование CPU/RAM
top
htop

# Использование диска
df -h
du -sh /var/lib/docker

# MySQL мониторинг
docker compose exec mysql mysql -u root -p -e "SHOW STATUS;"
```

### 5. Uptime мониторинг

```bash
# Uptime Robot (бесплатно)
# https://uptimerobot.com
# Проверка каждые 5 минут

# Self-hosted: Uptime Kuma
docker run -d --restart=always -p 3001:3001 -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:1
```

---

## 💾 Резервное копирование

### 1. Автоматический backup

```bash
#!/bin/bash
# /opt/scripts/backup.sh

BACKUP_DIR="/backups/vks"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Создание директории
mkdir -p $BACKUP_DIR

# Backup БД
docker compose exec -T mysql mysqldump \
    -u vks_user -pvks_password_2024 \
    --single-transaction \
    --routines \
    --triggers \
    vks_schedule > "$BACKUP_DIR/db_$DATE.sql"

# Сжатие
gzip "$BACKUP_DIR/db_$DATE.sql"

# Backup файлов
tar -czf "$BACKUP_DIR/files_$DATE.tar.gz" \
    -C /path/to/project \
    backend/storage \
    backend/.env

# Удаление старых backup
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Логирование
echo "[$DATE] Backup completed successfully" >> /var/log/vks-backup.log
```

```bash
# Добавить в crontab
crontab -e

# Каждый день в 2:00
0 2 * * * /opt/scripts/backup.sh
```

### 2. Backup в облако

```bash
# AWS S3
aws s3 cp $BACKUP_DIR/db_$DATE.sql.gz s3://your-bucket/backups/

# Google Cloud Storage
gsutil cp $BACKUP_DIR/db_$DATE.sql.gz gs://your-bucket/backups/

# Яндекс.Облако
aws s3 cp $BACKUP_DIR/db_$DATE.sql.gz s3://your-bucket/backups/ \
    --endpoint-url https://storage.yandexcloud.net
```

### 3. Проверка backup

```bash
# Восстановление в тестовую БД
docker compose exec -T mysql mysql \
    -u root -proot_password \
    vks_schedule_test < backup.sql

# Проверка целостности
docker compose exec mysql mysql \
    -u vks_user -pvks_password_2024 \
    vks_schedule_test -e "SELECT COUNT(*) FROM users;"
```

---

## 🔄 Обновления

### 1. Обновление зависимостей

```bash
# Frontend
cd frontend
npm update
npm audit fix

# Backend
docker compose exec backend composer update
```

### 2. Обновление Laravel

```bash
# Проверка текущей версии
docker compose exec backend php artisan --version

# Обновление
docker compose exec backend composer update laravel/framework

# Применение миграций
docker compose exec backend php artisan migrate
```

### 3. Обновление Docker образов

```bash
# Pull новых образов
docker compose pull

# Пересоздание контейнеров
docker compose up -d --force-recreate

# Очистка старых образов
docker image prune -a
```

### 4. Обновление безопасности

```bash
# Система
sudo apt update && sudo apt upgrade -y

# Docker
sudo apt update && sudo apt upgrade docker-ce -y

# Проверка уязвимостей
docker scout cves vks-backend:latest
```

---

## ✅ Чек-лист безопасности

### Перед запуском в production:

#### Аутентификация
- [ ] Пароли хешируются (bcrypt)
- [ ] Минимальная длина пароля 8+ символов
- [ ] Rate limiting на login (5 попыток/минуту)
- [ ] Fail2Ban установлен и настроен
- [ ] Токены имеют срок действия

#### Авторизация
- [ ] Middleware для проверки ролей
- [ ] Проверка прав доступа в контроллерах
- [ ] Защита от IDOR (неправильный ID)
- [ ] Приватные данные защищены

#### Данные
- [ ] Валидация всех входных данных
- [ ] Защита от SQL инъекций (prepared statements)
- [ ] Защита от XSS (экранирование)
- [ ] Защита от CSRF
- [ ] Чувствительные данные зашифрованы

#### Сеть
- [ ] SSL/TLS сертификат установлен
- [ ] HTTP перенаправляется на HTTPS
- [ ] CORS настроен правильно
- [ ] Security headers добавлены
- [ ] Firewall настроен (только 80, 443, 22)

#### База данных
- [ ] Сильный пароль для БД
- [ ] БД недоступна из интернета
- [ ] Регулярные backups
- [ ] Проверка восстановления из backup

#### Мониторинг
- [ ] Логи настроены
- [ ] Аудит действий пользователей
- [ ] Мониторинг ресурсов
- [ ] Uptime monitoring

#### Обновления
- [ ] Автообновление SSL сертификатов
- [ ] Регулярное обновление зависимостей
- [ ] Патчи безопасности применяются

#### Резервное копирование
- [ ] Ежедневный backup БД
- [ ] Backup файлов
- [ ] Хранение в другом месте (облако)
- [ ] Тестовое восстановление

### Дополнительные рекомендации:

- [ ] Двухфакторная аутентификация для админов
- [ ] IP whitelist для админки
- [ ] Регулярный аудит безопасности
- [ ] Тестирование на проникновение
- [ ] Документация для команды
- [ ] План действий при инциденте

---

## 🚨 Действия при взломе

### 1. Немедленные действия

```bash
# Остановить приложение
docker compose down

# Изолировать сервер
sudo ufw default deny incoming
sudo ufw allow ssh

# Сохранить логи
cp -r backend/storage/logs /secure/location/
```

### 2. Анализ

```bash
# Проверить последние входы
docker compose exec mysql mysql -u root -p -e "
SELECT id, name, email, last_login 
FROM users 
WHERE last_login > DATE_SUB(NOW(), INTERVAL 1 DAY)
ORDER BY last_login DESC;
"

# Проверить изменения
git log --since="24 hours ago"
```

### 3. Восстановление

```bash
# Сменить все пароли
docker compose exec backend php artisan tinker
>>> User::all()->each(fn($u) => $u->update(['password' => bcrypt('new_password_' . $u->id)]));

# Отозвать все токены
docker compose exec mysql mysql -u root -p -e "
DELETE FROM personal_access_tokens;
"

# Восстановить из backup
docker compose exec -T mysql mysql -u root -p vks_schedule < backup.sql
```

### 4. Уведомление

- Уведомить пользователей
- Уведомить regulators (если требуется по GDPR)
- Документировать инцидент
- Провести post-mortem анализ

---

## 📞 Полезные ссылки

- [Laravel Security](https://laravel.com/docs/10.x/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [Security Headers](https://securityheaders.com/)
- [SSL Labs Test](https://www.ssllabs.com/ssltest/)

---

<div align="center">

**Безопасность — это процесс, а не результат** 🔒

</div>
