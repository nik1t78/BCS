# 🚀 ПОЛНАЯ ИНСТРУКЦИЯ ПО ПЕРЕХОДУ НА API

## 📋 Что нужно сделать

Для того чтобы все пользователи видели одни и те же данные (пользователей, конференции, уведомления), нужно переключить frontend с localStorage на API Laravel.

---

## ✅ ЧТО УЖЕ СДЕЛАНО

### 1. API клиент создан
**Файл:** `src/api/client.ts`

Содержит функции для работы с API:
- `authAPI` - авторизация (login, register, logout)
- `usersAPI` - управление пользователями
- `meetingsAPI` - управление конференциями
- `notificationsAPI` - управление уведомлениями
- `settingsAPI` - настройки
- `profileAPI` - профиль

### 2. Store с API создан
**Файл:** `src/store-api.ts`

Содержит async функции для работы с API вместо localStorage.

### 3. AuthPage обновлён
**Файл:** `src/components/AuthPage.tsx`

Теперь использует API для входа и регистрации.

---

## 🔄 ЧТО НУЖНО СДЕЛАТЬ

### ЭТАП 1: Настройка Backend (Laravel)

#### 1.1. Установите Laravel Sanctum

```powershell
cd D:\server\BCS-main
docker compose exec backend composer require laravel/sanctum
```

#### 1.2. Опубликуйте конфигурацию Sanctum

```powershell
docker compose exec backend php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
```

#### 1.3. Выполните миграции Sanctum

```powershell
docker compose exec backend php artisan migrate
```

#### 1.4. Настройте CORS

Следуйте инструкции из файла **CORS_SETUP.md**

**Кратко:**

1. Отредактируйте `backend/config/cors.php`:

```php
'paths' => ['api/*', 'sanctum/csrf-cookie'],
'allowed_methods' => ['*'],
'allowed_origins' => ['http://localhost:3000', 'http://10.48.4.235:3000'],
'allowed_headers' => ['*'],
'supports_credentials' => true,
```

2. Отредактируйте `backend/config/sanctum.php`:

```php
'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', 'localhost,localhost:3000,10.48.4.235:3000')),
```

3. Добавьте в `backend/.env`:

```env
SANCTUM_STATEFUL_DOMAINS=localhost,localhost:3000,10.48.4.235:3000
SESSION_DOMAIN=localhost
```

4. Очистите кэш:

```powershell
docker compose exec backend php artisan config:clear
docker compose exec backend php artisan cache:clear
```

5. Перезапустите backend:

```powershell
docker compose restart backend
```

#### 1.5. Проверьте API

```powershell
# Health check
curl http://localhost/api/health

# Должно вернуть:
# {"status":"ok","timestamp":"...","version":"1.0.0"}
```

---

### ЭТАП 2: Обновление Frontend компонентов

#### 2.1. Обновите Dashboard.tsx

Откройте `src/components/Dashboard.tsx` и замените:

**Импорты:**
```typescript
// Было:
import { getMeetings, getUsers } from '../store';

// Стало:
import { getMeetings, getUsers } from '../store-api';
```

**useEffect:**
```typescript
// Было:
useEffect(() => {
  setMeetings(getMeetings());
  const timer = setInterval(() => setCurrentTime(new Date()), 1000);
  return () => clearInterval(timer);
}, []);

// Стало:
useEffect(() => {
  const loadData = async () => {
    const meetings = await getMeetings();
    setMeetings(meetings);
  };
  loadData();
  
  const timer = setInterval(() => setCurrentTime(new Date()), 1000);
  const dataTimer = setInterval(loadData, 30000); // Обновляем каждые 30 секунд
  
  return () => {
    clearInterval(timer);
    clearInterval(dataTimer);
  };
}, []);
```

#### 2.2. Обновите UserPanel.tsx

Откройте `src/components/UserPanel.tsx` и замените:

**Импорты:**
```typescript
// Было:
import { getMeetings, addMeeting, updateMeeting, deleteMeeting, generateId, getUsers, addNotification } from '../store';

// Стало:
import { getMeetings, createMeeting, updateMeeting, deleteMeeting, getUsers } from '../store-api';
import { generateId } from '../store';
```

**handleSubmit:**
```typescript
// Было:
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  // ...
  if (editingMeeting) {
    updateMeeting({ ...formData, id: editingMeeting.id });
  } else {
    const newMeetingId = generateId();
    addMeeting({ ...formData, id: newMeetingId });
  }
  // ...
};

// Стало:
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  // ...
  if (editingMeeting) {
    await updateMeeting(editingMeeting.id, formData);
  } else {
    await createMeeting(formData);
  }
  
  // Перезагружаем данные
  const meetings = await getMeetings();
  setMeetings(meetings);
  // ...
};
```

**handleDelete:**
```typescript
// Было:
const handleDelete = (id: string) => {
  if (confirm('Удалить конференцию?')) {
    deleteMeeting(id);
    // ...
  }
};

// Стало:
const handleDelete = async (id: string) => {
  if (confirm('Удалить конференцию?')) {
    await deleteMeeting(id);
    const meetings = await getMeetings();
    setMeetings(meetings);
  }
};
```

**useEffect:**
```typescript
// Было:
useEffect(() => {
  const allMeetings = getMeetings();
  const myMeetings = allMeetings.filter(m => 
    m.organizerId === user.id || m.participants.includes(user.id)
  );
  setMeetings(myMeetings);
  setAllUsers(getUsers());
}, [user.id, showForm]);

// Стало:
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

#### 2.3. Обновите AdminPanel.tsx

Откройте `src/components/AdminPanel.tsx` и замените:

**Импорты:**
```typescript
// Было:
import { getUsers, getMeetings, updateUser, deleteUser, toggleUserActive, changeUserRole, updateMeeting, deleteMeeting, generateId, addMeeting } from '../store';

// Стало:
import { getUsers, getMeetings, createUser, updateUser, deleteUser, toggleUserActive, changeUserRole, resetUserPassword, updateMeeting, deleteMeeting, createMeeting } from '../store-api';
import { generateId } from '../store';
```

**Все функции сделайте async/await:**

```typescript
// handleSaveUser
const handleSaveUser = async (e: React.FormEvent) => {
  e.preventDefault();
  if (editingUser) {
    await updateUser(editingUser.id, userForm);
  } else {
    await createUser(userForm);
  }
  const users = await getUsers();
  setUsers(users);
  // ...
};

// handleDeleteUser
const handleDeleteUser = async (id: string) => {
  if (id === user.id) { alert('Нельзя удалить свой аккаунт'); return; }
  if (confirm('Удалить пользователя?')) {
    await deleteUser(id);
    const users = await getUsers();
    setUsers(users);
  }
};

// handleToggleActive
const handleToggleActive = async (id: string) => {
  if (id === user.id) { alert('Нельзя заблокировать свой аккаунт'); return; }
  await toggleUserActive(id);
  const users = await getUsers();
  setUsers(users);
};

// handleChangeRole
const handleChangeRole = async (id: string, role: string) => {
  await changeUserRole(id, role);
  const users = await getUsers();
  setUsers(users);
};

// handleResetPassword
const handleResetPassword = async () => {
  if (!passwordUserId) return;
  if (newPassword.length < 6) {
    alert('Пароль должен быть не менее 6 символов');
    return;
  }
  if (newPassword !== confirmPassword) {
    alert('Пароли не совпадают');
    return;
  }
  await resetUserPassword(passwordUserId, newPassword);
  setShowPasswordModal(false);
  alert('Пароль успешно изменён');
};

// handleSaveMeeting
const handleSaveMeeting = async (e: React.FormEvent) => {
  e.preventDefault();
  if (editingMeeting) {
    await updateMeeting(editingMeeting.id, meetingForm);
  } else {
    await createMeeting(meetingForm);
  }
  const meetings = await getMeetings();
  setMeetings(meetings);
  // ...
};

// handleDeleteMeeting
const handleDeleteMeeting = async (id: string) => {
  if (confirm('Удалить конференцию?')) {
    await deleteMeeting(id);
    const meetings = await getMeetings();
    setMeetings(meetings);
  }
};

// handleStatusChange
const handleStatusChange = async (id: string, status: string) => {
  const meeting = meetings.find(m => m.id === id);
  if (meeting) {
    await updateMeeting(id, { ...meeting, status });
    const meetings = await getMeetings();
    setMeetings(meetings);
  }
};
```

**useEffect:**
```typescript
// Было:
useEffect(() => {
  setUsers(getUsers());
  setMeetings(getMeetings());
}, []);

// Стало:
useEffect(() => {
  const loadData = async () => {
    const users = await getUsers();
    setUsers(users);
    
    const meetings = await getMeetings();
    setMeetings(meetings);
  };
  loadData();
}, []);
```

#### 2.4. Обновите Notifications.tsx

Откройте `src/components/Notifications.tsx` и замените:

**Импорты:**
```typescript
// Было:
import { getUserNotifications, markNotificationRead, markAllNotificationsRead, saveNotifications, getNotifications } from '../store';

// Стало:
import { getNotifications, markNotificationRead, markAllNotificationsRead, clearAllNotifications } from '../store-api';
```

**Все функции сделайте async/await:**

```typescript
// handleMarkRead
const handleMarkRead = async (id: string) => {
  await markNotificationRead(id);
  const notifications = await getNotifications();
  setNotifications(notifications.filter(n => n.userId === user.id));
};

// handleMarkAllRead
const handleMarkAllRead = async () => {
  await markAllNotificationsRead();
  const notifications = await getNotifications();
  setNotifications(notifications.filter(n => n.userId === user.id));
};

// handleClearAll
const handleClearAll = async () => {
  if (confirm('Очистить все уведомления?')) {
    await clearAllNotifications();
    setNotifications([]);
  }
};
```

**useEffect:**
```typescript
// Было:
useEffect(() => {
  setNotifications(getUserNotifications(user.id));
}, [user.id]);

// Стало:
useEffect(() => {
  const loadNotifications = async () => {
    const notifications = await getNotifications();
    setNotifications(notifications.filter(n => n.userId === user.id));
  };
  loadNotifications();
  
  // Обновляем каждые 30 секунд
  const timer = setInterval(loadNotifications, 30000);
  return () => clearInterval(timer);
}, [user.id]);
```

#### 2.5. Обновите Profile.tsx

Откройте `src/components/Profile.tsx` и замените:

**Импорты:**
```typescript
// Было:
import { updateUser } from '../store';

// Стало:
import { updateProfile, changePassword } from '../store-api';
```

**handleSave:**
```typescript
// Было:
const handleSave = () => {
  const updatedUser = {
    ...user,
    name: formData.name,
    phone: formData.phone,
    department: formData.department,
    position: formData.position,
  };
  updateUser(updatedUser);
  onUpdate();
  setSaved(true);
  setTimeout(() => setSaved(false), 3000);
};

// Стало:
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

---

### ЭТАП 3: Тестирование

#### 3.1. Запустите backend

```powershell
cd D:\server\BCS-main
docker compose up -d
```

#### 3.2. Запустите frontend

```powershell
npm run dev
```

#### 3.3. Проверьте авторизацию

1. Откройте http://localhost:3000
2. Попробуйте войти как admin / admin123
3. Проверьте что токен сохраняется в localStorage (DevTools → Application → Local Storage)

#### 3.4. Проверьте синхронизацию

1. Откройте два браузера (или браузер + инкогнито)
2. Войдите как admin в первом браузере
3. Войдите как ivanov во втором браузере
4. Создайте конференцию как admin
5. Проверьте что конференция видна во втором браузере (может потребоваться обновление страницы)

#### 3.5. Проверьте уведомления

1. Создайте конференцию с участниками
2. Войдите как участник
3. Проверьте что пришло уведомление

---

### ЭТАП 4: Production настройка

#### 4.1. Обновите API_BASE_URL

Откройте файл `src/api/client.ts` и измените:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost/api';
```

#### 4.2. Создайте .env файл для frontend

Создайте файл `.env` в корне frontend:

```env
VITE_API_URL=http://10.48.4.235/api
```

Для production:

```env
VITE_API_URL=https://api.vks.yourcompany.com
```

#### 4.3. Пересоберите frontend

```powershell
npm run build
```

---

## 🛠️ Решение проблем

### Проблема: API не отвечает

**Решение:**
1. Проверьте что backend запущен: `docker compose ps`
2. Проверьте логи: `docker compose logs backend`
3. Проверьте CORS настройку

### Проблема: 401 Unauthorized

**Решение:**
1. Проверьте что токен передаётся в заголовке `Authorization: Bearer {token}`
2. Проверьте что Sanctum настроен
3. Перезапустите backend

### Проблема: Данные не синхронизируются

**Решение:**
1. Проверьте что все компоненты используют `store-api.ts`
2. Проверьте что нет использования `localStorage` напрямую
3. Проверьте логи API запросов в DevTools (Network tab)

### Проблема: Ошибки CORS

**Решение:**
1. Проверьте `backend/config/cors.php`
2. Добавьте адрес frontend в `allowed_origins`
3. Очистите кэш: `php artisan config:clear`
4. Перезапустите backend: `docker compose restart backend`

---

## 📊 Статус миграции

### ✅ Готово:
- API клиент (`src/api/client.ts`)
- Store с API (`src/store-api.ts`)
- CORS настройка (документация)
- AuthPage обновлён

### 🔄 В процессе:
- Обновление компонентов на async/await

### ⏳ Осталось:
- Тестирование
- Production настройка
- Документация для пользователей

---

## 🎯 Следующие шаги

1. **Завершите обновление компонентов** - замените все импорты на `store-api.ts`
2. **Настройте CORS в Laravel** - следуйте инструкции из CORS_SETUP.md
3. **Протестируйте систему** - проверьте все функции
4. **Настройте production** - обновите URL и пересоберите

---

<div align="center">

## 🚀 ПЕРЕХОД НА API В ПРОЦЕССЕ!

**Следуйте инструкции выше для завершения миграции!**

</div>
