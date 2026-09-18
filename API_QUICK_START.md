# ⚡ БЫСТРЫЙ СТАРТ: ПЕРЕХОД НА API

## 🎯 Что нужно сделать прямо сейчас

### Шаг 1: Настройте CORS в Laravel

```powershell
cd D:\server\BCS-main

# 1. Установите Sanctum
docker compose exec backend composer require laravel/sanctum

# 2. Опубликуйте конфигурацию
docker compose exec backend php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"

# 3. Выполните миграции
docker compose exec backend php artisan migrate
```

### Шаг 2: Отредактируйте файлы конфигурации

#### 2.1. Откройте `backend/config/cors.php`

Найдите и измените:

```php
'paths' => ['api/*', 'sanctum/csrf-cookie'],
'allowed_methods' => ['*'],
'allowed_origins' => ['http://localhost:3000', 'http://10.48.4.235:3000'],
'allowed_headers' => ['*'],
'supports_credentials' => true,
```

#### 2.2. Откройте `backend/config/sanctum.php`

Найдите и измените:

```php
'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', 'localhost,localhost:3000,10.48.4.235:3000')),
```

#### 2.3. Откройте `backend/.env`

Добавьте в конец файла:

```env
SANCTUM_STATEFUL_DOMAINS=localhost,localhost:3000,10.48.4.235:3000
SESSION_DOMAIN=localhost
```

### Шаг 3: Очистите кэш и перезапустите

```powershell
# Очистите кэш
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan cache:clear

# Перезапустите backend
docker compose restart backend
```

### Шаг 4: Обновите компоненты Frontend

Откройте каждый файл и замените импорты:

#### 4.1. Dashboard.tsx

```typescript
// Замените:
import { getMeetings, getUsers } from '../store';

// На:
import { getMeetings, getUsers } from '../store-api';
```

Измените useEffect:

```typescript
useEffect(() => {
  const loadData = async () => {
    const meetings = await getMeetings();
    setMeetings(meetings);
  };
  loadData();
  
  const timer = setInterval(() => setCurrentTime(new Date()), 1000);
  const dataTimer = setInterval(loadData, 30000);
  
  return () => {
    clearInterval(timer);
    clearInterval(dataTimer);
  };
}, []);
```

#### 4.2. UserPanel.tsx

```typescript
// Замените:
import { getMeetings, addMeeting, updateMeeting, deleteMeeting, generateId, getUsers, addNotification } from '../store';

// На:
import { getMeetings, createMeeting, updateMeeting, deleteMeeting, getUsers } from '../store-api';
import { generateId } from '../store';
```

Измените handleSubmit:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  // ...
  if (editingMeeting) {
    await updateMeeting(editingMeeting.id, formData);
  } else {
    await createMeeting(formData);
  }
  
  const meetings = await getMeetings();
  setMeetings(meetings);
  // ...
};
```

Измените handleDelete:

```typescript
const handleDelete = async (id: string) => {
  if (confirm('Удалить конференцию?')) {
    await deleteMeeting(id);
    const meetings = await getMeetings();
    setMeetings(meetings);
  }
};
```

Измените useEffect:

```typescript
useEffect(() => {
  const loadData = async () => {
    const allMeetings = await getMeetings();
    const myMeetings = allMeetings.filter(m => 
      m.organizerId === user.id || m.participants.includes(user.id)
    );
    setMeetings(myMeetings);
    
    const users = await getUsers();
    setAllUsers(users);
  };
  loadData();
}, [user.id, showForm]);
```

#### 4.3. AdminPanel.tsx

```typescript
// Замените:
import { getUsers, getMeetings, updateUser, deleteUser, toggleUserActive, changeUserRole, updateMeeting, deleteMeeting, generateId, addMeeting } from '../store';

// На:
import { getUsers, getMeetings, createUser, updateUser, deleteUser, toggleUserActive, changeUserRole, resetUserPassword, updateMeeting, deleteMeeting, createMeeting } from '../store-api';
import { generateId } from '../store';
```

Сделайте все функции async/await (см. полную инструкцию в API_MIGRATION_FULL.md)

#### 4.4. Notifications.tsx

```typescript
// Замените:
import { getUserNotifications, markNotificationRead, markAllNotificationsRead, saveNotifications, getNotifications } from '../store';

// На:
import { getNotifications, markNotificationRead, markAllNotificationsRead, clearAllNotifications } from '../store-api';
```

Сделайте все функции async/await (см. полную инструкцию в API_MIGRATION_FULL.md)

#### 4.5. Profile.tsx

```typescript
// Замените:
import { updateUser } from '../store';

// На:
import { updateProfile, changePassword } from '../store-api';
```

Измените handleSave:

```typescript
const handleSave = async () => {
  const updatedUser = await updateProfile({
    name: formData.name,
    phone: formData.phone,
    department: formData.department,
    position: formData.position,
  });
  
  if (updatedUser) {
    onUpdate();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }
};
```

### Шаг 5: Пересоберите проект

```powershell
npm run build
```

### Шаг 6: Запустите сервер

```powershell
serve -s dist -l 3000
```

### Шаг 7: Проверьте работу

1. Откройте http://localhost:3000
2. Войдите как admin / admin123
3. Создайте конференцию
4. Откройте второй браузер (или инкогнито)
5. Войдите как ivanov / user123
6. Проверьте что конференция видна

---

## 📋 Чек-лист

- [ ] Sanctum установлен
- [ ] CORS настроен
- [ ] Кэш очищен
- [ ] Backend перезапущен
- [ ] Dashboard.tsx обновлён
- [ ] UserPanel.tsx обновлён
- [ ] AdminPanel.tsx обновлён
- [ ] Notifications.tsx обновлён
- [ ] Profile.tsx обновлён
- [ ] Проект пересобран
- [ ] Сервер запущен
- [ ] Синхронизация работает

---

## 🛠️ Если что-то не работает

### Ошибка CORS

```powershell
# Проверьте конфигурацию
docker compose exec backend cat config/cors.php

# Очистите кэш
docker compose exec backend php artisan config:clear

# Перезапустите backend
docker compose restart backend
```

### Ошибка 401 Unauthorized

```powershell
# Проверьте токен в localStorage
# DevTools → Application → Local Storage → vks_auth

# Проверьте что токен передаётся в заголовке
# DevTools → Network → запрос → Headers → Authorization
```

### Данные не синхронизируются

```powershell
# Проверьте что все компоненты используют store-api.ts
# Проверьте логи API запросов в DevTools → Network
```

---

## 📚 Дополнительная информация

- **Полная инструкция:** API_MIGRATION_FULL.md
- **Настройка CORS:** CORS_SETUP.md
- **API клиент:** src/api/client.ts
- **Store с API:** src/store-api.ts

---

<div align="center">

## 🚀 ГОТОВО!

**Следуйте инструкции выше и система станет многопользовательской!**

</div>
