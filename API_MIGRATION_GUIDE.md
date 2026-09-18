# 🔄 ПЕРЕХОД FRONTEND НА API LARAVEL

## 📋 Обзор

Сейчас frontend использует localStorage для хранения данных. Это означает что каждый пользователь видит только свои данные. Для полноценной многопользовательской системы нужно переключить frontend на работу с API Laravel.

## ✅ Что будет после перехода

✅ Все пользователи видят одних и тех же пользователей  
✅ Все видят все конференции  
✅ Уведомления синхронизированы в реальном времени  
✅ Данные хранятся в MySQL базе данных  
✅ Работает авторизация через токены  
✅ Работает из любой точки сети  

---

## 🚀 Пошаговая инструкция

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

#### 1.5. Проверьте API endpoints

```powershell
# Health check
curl http://localhost/api/health

# Должно вернуть:
# {"status":"ok","timestamp":"...","version":"1.0.0"}
```

---

### ЭТАП 2: Обновление Frontend

#### 2.1. API клиент уже создан

Файл `src/api/client.ts` уже содержит все необходимые функции для работы с API.

#### 2.2. Store с API уже создан

Файл `src/store-api.ts` содержит функции для работы с API вместо localStorage.

#### 2.3. Обновите AuthPage.tsx

Откройте файл `src/components/AuthPage.tsx` и замените импорты:

**Было:**
```typescript
import { login, register } from '../store';
```

**Стало:**
```typescript
import { login, register } from '../store-api';
```

Также измените функции на async/await:

**Было:**
```typescript
const handleLogin = (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setLoading(true);
  
  setTimeout(() => {
    const result = login(loginValue, password);
    if (result.success) {
      onLogin();
    } else {
      setError(result.error || 'Ошибка входа');
    }
    setLoading(false);
  }, 500);
};
```

**Стало:**
```typescript
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setLoading(true);
  
  try {
    const result = await login(loginValue, password);
    if (result.success) {
      onLogin();
    } else {
      setError(result.error || 'Ошибка входа');
    }
  } catch (error: any) {
    setError(error.message || 'Ошибка входа');
  } finally {
    setLoading(false);
  }
};
```

Аналогично обновите функцию `handleRegister`.

#### 2.4. Обновите Dashboard.tsx

Откройте файл `src/components/Dashboard.tsx` и замените импорты:

**Было:**
```typescript
import { getMeetings, getUsers } from '../store';
```

**Стало:**
```typescript
import { getMeetings, getUsers } from '../store-api';
```

Обновите useEffect:

**Было:**
```typescript
useEffect(() => {
  setMeetings(getMeetings());
  const timer = setInterval(() => setCurrentTime(new Date()), 1000);
  return () => clearInterval(timer);
}, []);
```

**Стало:**
```typescript
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

#### 2.5. Обновите UserPanel.tsx

Откройте файл `src/components/UserPanel.tsx` и замените импорты:

**Было:**
```typescript
import { getMeetings, addMeeting, updateMeeting, deleteMeeting, generateId, getUsers, addNotification } from '../store';
```

**Стало:**
```typescript
import { getMeetings, createMeeting, updateMeeting, deleteMeeting, getUsers } from '../store-api';
import { generateId } from '../store'; // generateId остаётся в старом store
```

Обновите функции:

**Было:**
```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  // ...
  if (editingMeeting) {
    updateMeeting({ ...formData, id: editingMeeting.id });
  } else {
    const newMeetingId = generateId();
    addMeeting({ ...formData, id: newMeetingId });
    // ...
  }
};
```

**Стало:**
```typescript
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
};
```

Аналогично обновите `handleDelete`.

#### 2.6. Обновите AdminPanel.tsx

Откройте файл `src/components/AdminPanel.tsx` и замените импорты:

**Было:**
```typescript
import { getUsers, getMeetings, updateUser, deleteUser, toggleUserActive, changeUserRole, updateMeeting, deleteMeeting, generateId, addMeeting } from '../store';
```

**Стало:**
```typescript
import { getUsers, getMeetings, createUser, updateUser, deleteUser, toggleUserActive, changeUserRole, resetUserPassword, updateMeeting, deleteMeeting, createMeeting } from '../store-api';
import { generateId } from '../store';
```

Обновите все функции на async/await.

#### 2.7. Обновите Notifications.tsx

Откройте файл `src/components/Notifications.tsx` и замените импорты:

**Было:**
```typescript
import { getUserNotifications, markNotificationRead, markAllNotificationsRead, saveNotifications, getNotifications } from '../store';
```

**Стало:**
```typescript
import { getNotifications, markNotificationRead, markAllNotificationsRead, clearAllNotifications } from '../store-api';
```

Обновите все функции на async/await.

#### 2.8. Обновите Profile.tsx

Откройте файл `src/components/Profile.tsx` и замените импорты:

**Было:**
```typescript
import { updateUser } from '../store';
```

**Стало:**
```typescript
import { updateProfile, changePassword } from '../store-api';
```

Обновите функции сохранения.

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
3. Проверьте что токен сохраняется в localStorage

#### 3.4. Проверьте синхронизацию

1. Откройте два браузера (или браузер + инкогнито)
2. Войдите как admin в первом браузере
3. Войдите как ivanov во втором браузере
4. Создайте конференцию как admin
5. Проверьте что конференция видна во втором браузере

#### 3.5. Проверьте уведомления

1. Создайте конференцию с участниками
2. Войдите как участник
3. Проверьте что пришло уведомление

---

### ЭТАП 4: Production настройка

#### 4.1. Обновите API_BASE_URL

Откройте файл `src/api/client.ts` и измените:

**Было:**
```typescript
const API_BASE_URL = 'http://localhost/api';
```

**Стало:**
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

## 📊 Статус миграции

### ✅ Готово:
- API клиент (`src/api/client.ts`)
- Store с API (`src/store-api.ts`)
- CORS настройка (документация)

### 🔄 В процессе:
- Обновление компонентов на async/await

### ⏳ Осталось:
- Тестирование
- Production настройка
- Документация для пользователей

---

## 🛠️ Решение проблем

### Проблема: API не отвечает

**Решение:**
1. Проверьте что backend запущен: `docker compose ps`
2. Проверьте логи: `docker compose logs backend`
3. Проверьте CORS настройку

### Проблема: 401 Unauthorized

**Решение:**
1. Проверьте что токен передаётся
2. Проверьте что Sanctum настроен
3. Перезапустите backend

### Проблема: Данные не синхронизируются

**Решение:**
1. Проверьте что все компоненты используют `store-api.ts`
2. Проверьте что нет использования `localStorage` напрямую
3. Проверьте логи API запросов в DevTools

### Проблема: Ошибки CORS

**Решение:**
1. Проверьте `backend/config/cors.php`
2. Добавьте адрес frontend в `allowed_origins`
3. Очистите кэш: `php artisan config:clear`

---

## 📋 Чек-лист миграции

### Backend:
- [ ] Laravel Sanctum установлен
- [ ] CORS настроен
- [ ] API endpoints работают
- [ ] База данных настроена
- [ ] Миграции выполнены

### Frontend:
- [ ] API клиент создан
- [ ] Store с API создан
- [ ] AuthPage обновлён
- [ ] Dashboard обновлён
- [ ] UserPanel обновлён
- [ ] AdminPanel обновлён
- [ ] Notifications обновлён
- [ ] Profile обновлён
- [ ] Все компоненты используют async/await

### Тестирование:
- [ ] Авторизация работает
- [ ] Синхронизация работает
- [ ] Уведомления работают
- [ ] CRUD операции работают
- [ ] Работает из разных браузеров
- [ ] Работает по IP адресу

### Production:
- [ ] API_BASE_URL настроен
- [ ] .env файл создан
- [ ] Frontend пересобран
- [ ] Backend настроен
- [ ] SSL сертификаты установлены
- [ ] Firewall настроен

---

## 🎯 Следующие шаги

1. **Завершите обновление компонентов** - замените все импорты на `store-api.ts`
2. **Протестируйте систему** - проверьте все функции
3. **Настройте production** - обновите URL и пересоберите
4. **Обучите пользователей** - создайте инструкцию

---

<div align="center">

## 🚀 ПЕРЕХОД НА API ЗАВЕРШЁН!

**Теперь система полностью многопользовательская!**

</div>
