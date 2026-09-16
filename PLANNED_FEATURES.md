# 🚀 24 планируемых функции ВКС Расписание

## 📋 Список планируемых функций

### 🎯 Шаблоны и организация (4 функции)

#### 52. Шаблоны конференций
**Описание**: Сохранение часто используемых конфигураций конференций для быстрого создания
**Примеры шаблонов**:
- "Еженедельный стендап" (30 мин, вся команда, Zoom)
- "Собеседование" (60 мин, HR + Tech Lead, приватная)
- "Демо клиенту" (90 мин, высокая приоритетность)

**Функции**:
- Создание шаблона из существующей конференции
- Редактирование шаблонов
- Быстрое создание конференции из шаблона
- Категории шаблонов (рабочие, личные, срочные)

**Техническая реализация**:
```sql
CREATE TABLE meeting_templates (
    id BIGINT PRIMARY KEY,
    user_id BIGINT,
    name VARCHAR(255),
    description TEXT,
    duration_minutes INT,
    room VARCHAR(255),
    link VARCHAR(500),
    priority ENUM('low', 'medium', 'high'),
    reminder_minutes INT,
    recurring ENUM('none', 'daily', 'weekly', 'monthly'),
    is_private BOOLEAN,
    default_participants JSON,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**API**:
```
GET    /api/templates              # Список шаблонов
POST   /api/templates              # Создать шаблон
PUT    /api/templates/{id}         # Обновить
DELETE /api/templates/{id}         # Удалить
POST   /api/meetings/from-template # Создать из шаблона
```

---

#### 53. Избранные конференции
**Описание**: Добавление важных конференций в избранное для быстрого доступа
**Функции**:
- Добавление/удаление из избранного
- Отдельная вкладка "Избранное"
- Сортировка избранных по дате
- Быстрый переход к избранной конференции

**Техническая реализация**:
```sql
CREATE TABLE favorites (
    id BIGINT PRIMARY KEY,
    user_id BIGINT,
    meeting_id BIGINT,
    created_at TIMESTAMP,
    UNIQUE KEY unique_favorite (user_id, meeting_id)
);
```

**API**:
```
POST   /api/meetings/{id}/favorite      # Добавить в избранное
DELETE /api/meetings/{id}/favorite      # Удалить из избранного
GET    /api/favorites                   # Список избранных
```

---

#### 54. Теги и категории
**Описание**: Классификация конференций по тегам для удобной фильтрации
**Примеры тегов**:
- "Важное", "Обучение", "Клиенты", "Внутреннее"
- "Продажи", "Разработка", "HR", "Финансы"

**Функции**:
- Создание пользовательских тегов
- Назначение нескольких тегов конференции
- Фильтрация по тегам
- Цветовая маркировка тегов
- Статистика по тегам

**Техническая реализация**:
```sql
CREATE TABLE tags (
    id BIGINT PRIMARY KEY,
    user_id BIGINT,
    name VARCHAR(100),
    color VARCHAR(7),  -- #FF5733
    created_at TIMESTAMP
);

CREATE TABLE meeting_tag (
    meeting_id BIGINT,
    tag_id BIGINT,
    PRIMARY KEY (meeting_id, tag_id)
);
```

**API**:
```
GET    /api/tags                        # Список тегов
POST   /api/tags                        # Создать тег
PUT    /api/tags/{id}                   # Обновить
DELETE /api/tags/{id}                   # Удалить
POST   /api/meetings/{id}/tags          # Назначить теги
GET    /api/meetings?tag=important      # Фильтр по тегу
```

---

#### 55. История изменений
**Описание**: Лог всех изменений конференции для аудита
**Что отслеживается**:
- Кто изменил
- Когда изменил
- Что изменил (старые/новые значения)
- IP адрес
- User Agent

**Функции**:
- Просмотр истории изменений
- Откат к предыдущей версии
- Экспорт истории
- Уведомления об изменениях

**Техническая реализация**:
```sql
CREATE TABLE meeting_history (
    id BIGINT PRIMARY KEY,
    meeting_id BIGINT,
    user_id BIGINT,
    action ENUM('created', 'updated', 'status_changed', 'deleted'),
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP
);
```

**API**:
```
GET    /api/meetings/{id}/history       # История конференции
POST   /api/meetings/{id}/rollback      # Откат к версии
```

---

### 💬 Коммуникация (3 функции)

#### 56. Комментарии к конференции
**Описание**: Обсуждение конференции прямо в системе
**Функции**:
- Добавление комментариев
- Ответы на комментарии (threaded)
- Упоминания пользователей (@username)
- Редактирование/удаление своих комментариев
- Уведомления о новых комментариях
- Закрепление важных комментариев

**Техническая реализация**:
```sql
CREATE TABLE meeting_comments (
    id BIGINT PRIMARY KEY,
    meeting_id BIGINT,
    user_id BIGINT,
    parent_id BIGINT NULL,  -- для ответов
    message TEXT,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**API**:
```
GET    /api/meetings/{id}/comments      # Список комментариев
POST   /api/meetings/{id}/comments      # Добавить комментарий
PUT    /api/comments/{id}               # Редактировать
DELETE /api/comments/{id}               # Удалить
POST   /api/comments/{id}/pin           # Закрепить
```

---

#### 57. Чат участников
**Описание**: Групповой чат для участников конференции
**Функции**:
- Текстовые сообщения
- Отправка файлов (до 10 MB)
- Эмодзи и реакции
- История сообщений
- Поиск по сообщениям
- Уведомления о новых сообщениях
- Статус "печатает..."

**Техническая реализация**:
```sql
CREATE TABLE meeting_messages (
    id BIGINT PRIMARY KEY,
    meeting_id BIGINT,
    user_id BIGINT,
    message TEXT,
    file_path VARCHAR(500) NULL,
    file_name VARCHAR(255) NULL,
    file_size INT NULL,
    created_at TIMESTAMP
);
```

**WebSocket** для real-time обновлений:
```javascript
// Laravel Echo
Echo.channel(`meeting.${meetingId}`)
    .listen('MessageSent', (e) => {
        // Обновление UI
    });
```

**API**:
```
GET    /api/meetings/{id}/messages      # История сообщений
POST   /api/meetings/{id}/messages      # Отправить сообщение
DELETE /api/messages/{id}               # Удалить сообщение
```

---

#### 58. Упоминания пользователей
**Описание**: Система упоминаний @username в комментариях и сообщениях
**Функции**:
- Автодополнение при вводе @
- Уведомление упомянутому пользователю
- Кликабельные упоминания
- Список всех упоминаний пользователя

**Техническая реализация**:
```sql
CREATE TABLE mentions (
    id BIGINT PRIMARY KEY,
    user_id BIGINT,           -- кого упомянули
    mentioner_id BIGINT,      -- кто упомянул
    mentionable_type VARCHAR(255),  -- App\Models\MeetingComment
    mentionable_id BIGINT,
    created_at TIMESTAMP
);
```

---

### 📎 Вложения (3 функции)

#### 59. Загрузка файлов к конференции
**Описание**: Прикрепление презентаций, документов, изображений
**Поддерживаемые форматы**:
- Документы: PDF, DOCX, PPTX, XLSX
- Изображения: JPG, PNG, GIF, SVG
- Архивы: ZIP, RAR
- Видео: MP4, WebM (до 100 MB)

**Функции**:
- Drag & drop загрузка
- Прогресс-бар загрузки
- Предпросмотр файлов
- Скачивание файлов
- Ограничение по размеру (10 MB на файл)
- Квота на хранилище (1 GB на пользователя)

**Техническая реализация**:
```sql
CREATE TABLE meeting_attachments (
    id BIGINT PRIMARY KEY,
    meeting_id BIGINT,
    user_id BIGINT,
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    file_size INT,
    mime_type VARCHAR(100),
    created_at TIMESTAMP
);
```

**Хранилище**:
```
storage/app/meetings/{meeting_id}/
├── presentation.pdf
├── screenshot.png
└── document.docx
```

**API**:
```
POST   /api/meetings/{id}/attachments   # Загрузить файл
GET    /api/meetings/{id}/attachments   # Список файлов
GET    /api/attachments/{id}/download   # Скачать файл
DELETE /api/attachments/{id}            # Удалить файл
```

---

#### 60. Просмотр документов
**Описание**: Встроенный просмотрщик документов без скачивания
**Поддержка**:
- PDF (с zoom, постраничная навигация)
- Изображения (zoom, поворот)
- Текстовые файлы

**Функции**:
- Полноэкранный режим
- Zoom in/out
- Поворот изображения
- Поиск по PDF
- Скачивание оригинала

**Техническая реализация**:
- PDF.js для PDF
- Native browser viewer для изображений
- Iframe для других форматов

---

#### 61. Управление вложениями
**Описание**: Организация и управление загруженными файлами
**Функции**:
- Переименование файлов
- Перемещение между конференциями
- Массовое скачивание (ZIP)
- Статистика использования хранилища
- Очистка старых файлов

**API**:
```
PUT    /api/attachments/{id}/rename     # Переименовать
POST   /api/attachments/move            # Переместить
POST   /api/attachments/download-zip    # Скачать ZIP
GET    /api/storage/stats               # Статистика хранилища
```

---

### 🔗 Интеграции (5 функций)

#### 62. Интеграция с Google Calendar
**Описание**: Синхронизация конференций с Google Calendar
**Функции**:
- Авторизация через OAuth 2.0
- Автоматическое создание событий в Google Calendar
- Двусторонняя синхронизация
- Выбор календаря для синхронизации
- Настройка правил синхронизации

**Техническая реализация**:
```php
// Google Calendar API
$client = new Google_Client();
$client->setAuthConfig('credentials.json');
$client->addScope(Google_Service_Calendar::CALENDAR);

$service = new Google_Service_Calendar($client);

// Создание события
$event = new Google_Service_Calendar_Event([
    'summary' => $meeting->title,
    'description' => $meeting->description,
    'start' => ['dateTime' => $meeting->date . 'T' . $meeting->start_time],
    'end' => ['dateTime' => $meeting->date . 'T' . $meeting->end_time],
]);

$service->events->insert('primary', $event);
```

**API**:
```
POST   /api/integrations/google/connect    # Подключить Google
GET    /api/integrations/google/calendars  # Список календарей
POST   /api/integrations/google/sync       # Синхронизировать
DELETE /api/integrations/google/disconnect # Отключить
```

---

#### 63. Интеграция с Zoom API
**Описание**: Автоматическое создание Zoom конференций
**Функции**:
- Создание Zoom meeting при создании конференции
- Генерация уникальной ссылки
- Настройка параметров (waiting room, recording)
- Получение информации о записи
- Управление участниками

**Техническая реализация**:
```php
// Zoom API
$client = new GuzzleHttp\Client();
$response = $client->post('https://api.zoom.us/v2/users/me/meetings', [
    'headers' => [
        'Authorization' => 'Bearer ' . $zoom_token,
        'Content-Type' => 'application/json',
    ],
    'json' => [
        'topic' => $meeting->title,
        'type' => 2, // Scheduled
        'start_time' => $meeting->date . 'T' . $meeting->start_time . 'Z',
        'duration' => $duration_minutes,
        'settings' => [
            'join_before_host' => true,
            'waiting_room' => false,
        ],
    ],
]);

$zoom_meeting = json_decode($response->getBody());
$meeting->link = $zoom_meeting->join_url;
```

**API**:
```
POST   /api/integrations/zoom/connect     # Подключить Zoom
POST   /api/meetings/{id}/create-zoom     # Создать Zoom meeting
GET    /api/meetings/{id}/zoom/recording  # Получить запись
```

---

#### 64. Интеграция с Microsoft Teams
**Описание**: Создание Teams встреч через Microsoft Graph API
**Функции**:
- Создание onlineMeeting
- Синхронизация с Teams календарем
- Управление участниками
- Получение записи встречи

**Техническая реализация**:
```php
// Microsoft Graph API
$graph = new Graph();
$graph->setAccessToken($teams_token);

$meeting = $graph->createRequest("POST", "/me/onlineMeetings")
    ->attachBody([
        'subject' => $vks_meeting->title,
        'startDateTime' => $vks_meeting->date . 'T' . $vks_meeting->start_time,
        'endDateTime' => $vks_meeting->date . 'T' . $vks_meeting->end_time,
    ])
    ->execute();
```

---

#### 65. Slack уведомления
**Описание**: Отправка уведомлений в Slack каналы
**Функции**:
- Подключение Slack workspace
- Выбор каналов для уведомлений
- Настройка типов уведомлений
- Форматирование сообщений (Block Kit)

**Техническая реализация**:
```php
// Slack Webhook
$client = new GuzzleHttp\Client();
$client->post($slack_webhook_url, [
    'json' => [
        'blocks' => [
            [
                'type' => 'header',
                'text' => [
                    'type' => 'plain_text',
                    'text' => "🔴 Конференция начинается: {$meeting->title}",
                ],
            ],
            [
                'type' => 'section',
                'fields' => [
                    ['type' => 'mrkdwn', 'text' => "*Время:*\n{$meeting->start_time}"],
                    ['type' => 'mrkdwn', 'text' => "*Комната:*\n{$meeting->room}"],
                ],
            ],
            [
                'type' => 'actions',
                'elements' => [
                    [
                        'type' => 'button',
                        'text' => ['type' => 'plain_text', 'text' => 'Присоединиться'],
                        'url' => $meeting->link,
                    ],
                ],
            ],
        ],
    ],
]);
```

---

#### 66. Telegram уведомления
**Описание**: Отправка уведомлений в Telegram через Bot API
**Функции**:
- Создание Telegram бота
- Привязка Telegram аккаунта к пользователю
- Отправка личных уведомлений
- Групповые уведомления

**Техническая реализация**:
```php
// Telegram Bot API
$client = new GuzzleHttp\Client();
$client->post("https://api.telegram.org/bot{$bot_token}/sendMessage", [
    'json' => [
        'chat_id' => $user->telegram_chat_id,
        'text' => "⏰ Напоминание: через {$minutes} мин. начнётся \"{$meeting->title}\"",
        'parse_mode' => 'HTML',
    ],
]);
```

**API**:
```
POST   /api/integrations/telegram/connect    # Подключить Telegram
POST   /api/integrations/telegram/disconnect # Отключить
```

---

### 🔔 Дополнительные уведомления (3 функции)

#### 67. Email уведомления
**Описание**: Отправка email писем о конференциях
**Типы писем**:
- Приглашение на конференцию
- Напоминание за 1 час/день
- Изменение конференции
- Отмена конференции
- Еженедельный дайджест

**Функции**:
- HTML шаблоны писем
- Персонализация (имя, ссылки)
- Отложенная отправка
- Отписка от уведомлений

**Техническая реализация**:
```php
// Laravel Mail
Mail::to($user->email)->send(new MeetingReminderMail($meeting, $user));

// Mailable class
class MeetingReminderMail extends Mailable
{
    public function build()
    {
        return $this->subject("Напоминание: {$this->meeting->title}")
                    ->view('emails.meeting-reminder')
                    ->with([
                        'meeting' => $this->meeting,
                        'user' => $this->user,
                    ]);
    }
}
```

---

#### 68. SMS уведомления
**Описание**: SMS для важных конференций
**Интеграции**:
- Twilio
- SMS.ru
- SMS Aero

**Функции**:
- Отправка SMS только для high priority
- Настройка получателей
- Лимит SMS в месяц
- Статистика доставок

**Техническая реализация**:
```php
// Twilio
$client = new Twilio\Rest\Client($sid, $token);
$client->messages->create(
    $user->phone,
    [
        'from' => $twilio_number,
        'body' => "Напоминание: через {$minutes} мин. начнётся \"{$meeting->title}\"",
    ]
);
```

---

#### 69. Webhook уведомления
**Описание**: Отправка HTTP POST запросов на внешние системы
**Функции**:
- Настройка webhook URL
- Выбор событий для отправки
- Подпись запросов (HMAC)
- Retry при ошибке
- Логи отправок

**Техническая реализация**:
```php
// Webhook отправка
$client = new GuzzleHttp\Client();
$response = $client->post($webhook_url, [
    'json' => [
        'event' => 'meeting.started',
        'data' => [
            'meeting_id' => $meeting->id,
            'title' => $meeting->title,
            'timestamp' => now()->toIso8601String(),
        ],
    ],
    'headers' => [
        'X-Webhook-Signature' => hash_hmac('sha256', $payload, $secret),
    ],
]);
```

---

### 🔐 Безопасность (3 функции)

#### 70. Двухфакторная аутентификация (2FA)
**Описание**: Дополнительная защита аккаунта
**Методы**:
- TOTP (Google Authenticator, Authy)
- SMS код
- Email код
- Резервные коды

**Функции**:
- Включение/отключение 2FA
- Настройка TOTP приложения
- Генерация резервных кодов
- Обязательная 2FA для админов

**Техническая реализация**:
```php
// TOTP генерация
$totp = new TOTP($user->email, $secret);
$qrCode = $totp->getQrCodeUri();

// Проверка кода
if ($totp->verify($code)) {
    // Успешная аутентификация
}
```

**API**:
```
POST   /api/2fa/enable           # Включить 2FA
POST   /api/2fa/verify           # Подтвердить 2FA
POST   /api/2fa/disable          # Отключить 2FA
GET    /api/2fa/backup-codes     # Получить резервные коды
```

---

#### 71. Сессии и устройства
**Описание**: Управление активными сессиями
**Функции**:
- Просмотр активных сессий
- Информация об устройстве/IP
- Завершение сессий
- Автоматический logout при неактивности

**Техническая реализация**:
```sql
CREATE TABLE sessions (
    id BIGINT PRIMARY KEY,
    user_id BIGINT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    payload TEXT,
    last_activity TIMESTAMP,
    device_name VARCHAR(255),
    is_current BOOLEAN
);
```

**API**:
```
GET    /api/sessions               # Список сессий
DELETE /api/sessions/{id}          # Завершить сессию
DELETE /api/sessions/all           # Завершить все сессии
```

---

#### 72. Аудит действий пользователей
**Описание**: Полный лог всех действий в системе
**Что логируется**:
- Вход/выход
- Создание/редактирование/удаление
- Изменение ролей
- Блокировка пользователей
- Экспорт данных

**Функции**:
- Просмотр логов
- Фильтрация по пользователю/действию/дате
- Экспорт логов
- Автоматическая очистка старых логов (90 дней)

**Техническая реализация**:
```sql
CREATE TABLE audits (
    id BIGINT PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(100),
    model_type VARCHAR(255),
    model_id BIGINT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP
);
```

**API**:
```
GET    /api/audits                 # Список логов (только admin)
GET    /api/audits/export          # Экспорт логов
```

---

### 🎨 Интерфейс (3 функции)

#### 73. Тёмная тема
**Описание**: Альтернативная цветовая схема
**Функции**:
- Переключение светлая/тёмная
- Автоматическое переключение по времени суток
- Сохранение выбора в LocalStorage
- Поддержка системных настроек

**Техническая реализация**:
```javascript
// Tailwind CSS dark mode
if (localStorage.theme === 'dark' || 
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}
```

---

#### 74. Мультиязычность (i18n)
**Описание**: Поддержка нескольких языков
**Языки**:
- Русский (по умолчанию)
- English
- Español (планируется)
- Deutsch (планируется)

**Функции**:
- Переключение языка в профиле
- Автоматическое определение языка браузера
- Перевод всех интерфейсных элементов
- Перевод email уведомлений

**Техническая реализация**:
```javascript
// i18next
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: enTranslations },
        ru: { translation: ruTranslations },
    },
    lng: localStorage.getItem('language') || 'ru',
    fallbackLng: 'ru',
});
```

**Структура файлов**:
```
src/locales/
├── ru.json
├── en.json
└── es.json
```

---

#### 75. PWA (Progressive Web App)
**Описание**: Установка как приложение на устройство
**Функции**:
- Работа офлайн (Service Worker)
- Push уведомления
- Иконка на рабочем столе
- Полноэкранный режим
- Кэширование данных

**Техническая реализация**:
```json
// manifest.json
{
    "name": "ВКС Расписание",
    "short_name": "ВКС",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#3b82f6",
    "icons": [
        {
            "src": "/icon-192.png",
            "sizes": "192x192",
            "type": "image/png"
        }
    ]
}
```

```javascript
// Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('vks-cache').then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/static/js/main.js',
                '/static/css/main.css',
            ]);
        })
    );
});
```

---

## 📊 Итого

### Реализовано: 51 функция
### Планируется: 24 функции
### Всего: 75 функций

### Категории планируемых функций:
- 🎯 Шаблоны и организация: 4 функции
- 💬 Коммуникация: 3 функции
- 📎 Вложения: 3 функции
- 🔗 Интеграции: 5 функций
- 🔔 Дополнительные уведомления: 3 функции
- 🔐 Безопасность: 3 функции
- 🎨 Интерфейс: 3 функции

### Приоритет реализации:

**Высокий приоритет** (критично для пользователей):
1. ✅ Шаблоны конференций
2. ✅ Комментарии к конференциям
3. ✅ Email уведомления
4. ✅ Интеграция с Google Calendar
5. ✅ Тёмная тема

**Средний приоритет** (улучшение UX):
6. ✅ Избранные конференции
7. ✅ Загрузка файлов
8. ✅ Интеграция с Zoom
9. ✅ 2FA аутентификация
10. ✅ PWA поддержка

**Низкий приоритет** (дополнительные возможности):
11. ✅ Теги и категории
12. ✅ Чат участников
13. ✅ Slack/Telegram уведомления
14. ✅ Мультиязычность
15. ✅ История изменений

---

<div align="center">

**Планы на будущее: сделать систему ещё лучше! 🚀**

</div>
