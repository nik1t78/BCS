# ⚡ ЗАВЕРШЕНИЕ МИГРАЦИИ НА API

## 📋 Что осталось сделать

Обновить 3 компонента для работы с API вместо localStorage:

1. ✅ Dashboard.tsx - готово
2. ✅ UserPanel.tsx - готово
3. ⏳ AdminPanel.tsx - нужно обновить
4. ⏳ Notifications.tsx - нужно обновить
5. ⏳ Profile.tsx - нужно обновить

---

## 🔧 ОБНОВЛЕНИЕ AdminPanel.tsx

### Шаг 1: Замените импорты

Откройте `src/components/AdminPanel.tsx` и замените:

```typescript
// Было:
import { getUsers, getMeetings, updateUser, deleteUser, toggleUserActive, changeUserRole, updateMeeting, deleteMeeting, generateId, addMeeting } from '../store';

// Стало:
import { getUsers, getMeetings, createUser, updateUser, deleteUser, toggleUserActive, changeUserRole, resetUserPassword, updateMeeting, deleteMeeting, createMeeting } from '../store-api';
import { generateId } from '../store';
```

### Шаг 2: Обновите useEffect

```typescript
// Было:
useEffect(() => {
  setUsers(getUsers());
  setMeetings(getMeetings());
}, []);

// Стало:
useEffect(() => {
  const loadData = async () => {
    const [usersData, meetingsData] = await Promise.all([
      getUsers(),
      getMeetings()
    ]);
    setUsers(usersData);
    setMeetings(meetingsData);
  };
  loadData();
}, []);
```

### Шаг 3: Обновите handleSaveUser

```typescript
// Было:
const handleSaveUser = (e: React.FormEvent) => {
  e.preventDefault();
  if (editingUser) {
    updateUser({ ...userForm, id: editingUser.id });
  } else {
    if (!userForm.name || !userForm.login || !userForm.password) {
      alert('Заполните обязательные поля');
      return;
    }
    if (users.find(u => u.login === userForm.login)) {
      alert('Логин уже используется');
      return;
    }
    const newUser = { ...userForm, id: generateId(), createdAt: new Date().toISOString() };
    const allUsers = getUsers();
    allUsers.push(newUser);
    localStorage.setItem('vks_users', JSON.stringify(allUsers));
  }
  setUsers(getUsers());
  setShowUserForm(false);
  setEditingUser(null);
  setUserForm(emptyUser);
};

// Стало:
const handleSaveUser = async (e: React.FormEvent) => {
  e.preventDefault();
  if (editingUser) {
    await updateUser(editingUser.id, userForm);
  } else {
    if (!userForm.name || !userForm.login || !userForm.password) {
      alert('Заполните обязательные поля');
      return;
    }
    await createUser(userForm);
  }
  const usersData = await getUsers();
  setUsers(usersData);
  setShowUserForm(false);
  setEditingUser(null);
  setUserForm(emptyUser);
};
```

### Шаг 4: Обновите handleDeleteUser

```typescript
// Было:
const handleDeleteUser = (id: string) => {
  if (id === user.id) { alert('Нельзя удалить свой аккаунт'); return; }
  if (confirm('Удалить пользователя?')) {
    deleteUser(id);
    setUsers(getUsers());
  }
};

// Стало:
const handleDeleteUser = async (id: string) => {
  if (id === user.id) { alert('Нельзя удалить свой аккаунт'); return; }
  if (confirm('Удалить пользователя?')) {
    await deleteUser(id);
    const usersData = await getUsers();
    setUsers(usersData);
  }
};
```

### Шаг 5: Обновите handleToggleActive

```typescript
// Было:
const handleToggleActive = (id: string) => {
  if (id === user.id) { alert('Нельзя заблокировать свой аккаунт'); return; }
  toggleUserActive(id);
  setUsers(getUsers());
};

// Стало:
const handleToggleActive = async (id: string) => {
  if (id === user.id) { alert('Нельзя заблокировать свой аккаунт'); return; }
  await toggleUserActive(id);
  const usersData = await getUsers();
  setUsers(usersData);
};
```

### Шаг 6: Обновите handleChangeRole

```typescript
// Было:
const handleChangeRole = (id: string, role: User['role']) => {
  changeUserRole(id, role);
  setUsers(getUsers());
};

// Стало:
const handleChangeRole = async (id: string, role: User['role']) => {
  await changeUserRole(id, role);
  const usersData = await getUsers();
  setUsers(usersData);
};
```

### Шаг 7: Обновите handleResetPassword

```typescript
// Было:
const handleResetPassword = () => {
  if (!passwordUserId) return;
  if (newPassword.length < 6) {
    alert('Пароль должен быть не менее 6 символов');
    return;
  }
  if (newPassword !== confirmPassword) {
    alert('Пароли не совпадают');
    return;
  }
  const userToUpdate = users.find(u => u.id === passwordUserId);
  if (userToUpdate) {
    updateUser({ ...userToUpdate, password: newPassword });
    setUsers(getUsers());
    setShowPasswordModal(false);
    setPasswordUserId(null);
    setNewPassword('');
    setConfirmPassword('');
    alert('Пароль успешно изменён');
  }
};

// Стало:
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
  setPasswordUserId(null);
  setNewPassword('');
  setConfirmPassword('');
  alert('Пароль успешно изменён');
};
```

### Шаг 8: Обновите handleSaveMeeting

```typescript
// Было:
const handleSaveMeeting = (e: React.FormEvent) => {
  e.preventDefault();
  if (editingMeeting) {
    updateMeeting({ ...meetingForm, id: editingMeeting.id });
  } else {
    addMeeting({ ...meetingForm, id: generateId(), organizerId: user.id });
  }
  setMeetings(getMeetings());
  setShowMeetingForm(false);
  setEditingMeeting(null);
  setMeetingForm(emptyMeeting);
};

// Стало:
const handleSaveMeeting = async (e: React.FormEvent) => {
  e.preventDefault();
  if (editingMeeting) {
    await updateMeeting(editingMeeting.id, meetingForm);
  } else {
    await createMeeting({ ...meetingForm, organizerId: user.id });
  }
  const meetingsData = await getMeetings();
  setMeetings(meetingsData);
  setShowMeetingForm(false);
  setEditingMeeting(null);
  setMeetingForm(emptyMeeting);
};
```

### Шаг 9: Обновите handleDeleteMeeting

```typescript
// Было:
const handleDeleteMeeting = (id: string) => {
  if (confirm('Удалить конференцию?')) {
    deleteMeeting(id);
    setMeetings(getMeetings());
  }
};

// Стало:
const handleDeleteMeeting = async (id: string) => {
  if (confirm('Удалить конференцию?')) {
    await deleteMeeting(id);
    const meetingsData = await getMeetings();
    setMeetings(meetingsData);
  }
};
```

### Шаг 10: Обновите handleStatusChange

```typescript
// Было:
const handleStatusChange = (id: string, status: Meeting['status']) => {
  const meeting = meetings.find(m => m.id === id);
  if (meeting) {
    updateMeeting({ ...meeting, status });
    setMeetings(getMeetings());
  }
};

// Стало:
const handleStatusChange = async (id: string, status: Meeting['status']) => {
  const meeting = meetings.find(m => m.id === id);
  if (meeting) {
    await updateMeeting(id, { ...meeting, status });
    const meetingsData = await getMeetings();
    setMeetings(meetingsData);
  }
};
```

---

## 🔧 ОБНОВЛЕНИЕ Notifications.tsx

### Шаг 1: Замените импорты

Откройте `src/components/Notifications.tsx` и замените:

```typescript
// Было:
import { getUserNotifications, markNotificationRead, markAllNotificationsRead, saveNotifications, getNotifications } from '../store';

// Стало:
import { getNotifications, markNotificationRead, markAllNotificationsRead, clearAllNotifications } from '../store-api';
```

### Шаг 2: Обновите useEffect

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

### Шаг 3: Обновите handleMarkRead

```typescript
// Было:
const handleMarkRead = (id: string) => {
  markNotificationRead(id);
  setNotifications(getUserNotifications(user.id));
};

// Стало:
const handleMarkRead = async (id: string) => {
  await markNotificationRead(id);
  const notifications = await getNotifications();
  setNotifications(notifications.filter(n => n.userId === user.id));
};
```

### Шаг 4: Обновите handleMarkAllRead

```typescript
// Было:
const handleMarkAllRead = () => {
  markAllNotificationsRead(user.id);
  setNotifications(getUserNotifications(user.id));
};

// Стало:
const handleMarkAllRead = async () => {
  await markAllNotificationsRead();
  const notifications = await getNotifications();
  setNotifications(notifications.filter(n => n.userId === user.id));
};
```

### Шаг 5: Обновите handleClearAll

```typescript
// Было:
const handleClearAll = () => {
  if (confirm('Очистить все уведомления?')) {
    const all = getNotifications().filter(n => n.userId !== user.id);
    saveNotifications(all);
    setNotifications([]);
  }
};

// Стало:
const handleClearAll = async () => {
  if (confirm('Очистить все уведомления?')) {
    await clearAllNotifications();
    setNotifications([]);
  }
};
```

---

## 🔧 ОБНОВЛЕНИЕ Profile.tsx

### Шаг 1: Замените импорты

Откройте `src/components/Profile.tsx` и замените:

```typescript
// Было:
import { updateUser } from '../store';

// Стало:
import { updateProfile, changePassword } from '../store-api';
```

### Шаг 2: Обновите handleSave

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

## ✅ ПОСЛЕ ОБНОВЛЕНИЯ

### Пересоберите проект:

```powershell
npm run build
```

### Запустите сервер:

```powershell
serve -s dist -l 3000
```

### Проверьте работу:

1. Откройте http://localhost:3000
2. Войдите как admin / admin123
3. Создайте конференцию с участниками
4. Откройте второй браузер (или инкогнито)
5. Войдите как ivanov / user123
6. Проверьте что конференция видна
7. Проверьте что пришло уведомление

---

## 🎯 РЕЗУЛЬТАТ

После обновления всех компонентов:

✅ Все пользователи видят одни и те же данные  
✅ Конференции синхронизированы в реальном времени  
✅ Уведомления работают автоматически  
✅ Данные хранятся в MySQL базе  
✅ Работает из любого браузера и компьютера  

---

<div align="center">

## 🚀 МИГРАЦИЯ ЗАВЕРШЕНА!

**Проект полностью серверный и готов к использованию!**

</div>
