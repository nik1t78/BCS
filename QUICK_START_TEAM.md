# 🚀 Быстрый старт для команды

## 📋 Что нужно сделать за 10 минут

### Шаг 1: Запустите сервер (2 минуты)

```powershell
cd D:\BCS
npm install
npm run build
npm install -g serve
serve -s dist -l 3000
```

### Шаг 2: Откройте firewall (1 минута)

```powershell
netsh advfirewall firewall add rule name="ВКС Расписание" dir=in action=allow protocol=TCP localport=3000
```

### Шаг 3: Узнайте IP адрес (1 минута)

```powershell
ipconfig
# Запомните IPv4-адрес, например: 192.168.1.100
```

### Шаг 4: Создайте администратора (3 минуты)

1. Откройте `http://192.168.1.100:3000`
2. Зарегистрируйтесь с логином `admin`
3. Откройте консоль браузера (F12)
4. Выполните:

```javascript
const users = JSON.parse(localStorage.getItem('vks_users'));
const admin = users.find(u => u.login === 'admin');
admin.role = 'admin';
localStorage.setItem('vks_users', JSON.stringify(users));
location.reload();
```

### Шаг 5: Создайте пользователей (3 минуты)

1. Войдите как администратор
2. Перейдите в "Админ-панель"
3. Создайте пользователей для сотрудников

---

## 📧 Шаблон письма для сотрудников

```
Тема: Доступ к системе ВКС Расписание

Коллеги, добрый день!

Для планирования видеоконференций доступна новая система.

🔗 Адрес: http://192.168.1.100:3000

👤 Ваши данные для входа:
   Логин: [логин сотрудника]
   Пароль: [пароль сотрудника]

📖 Краткая инструкция:
1. Войдите в систему
2. Перейдите в "Мои конференции"
3. Нажмите "Создать конференцию"
4. Заполните форму и выберите участников
5. Готово!

При возникновении вопросов обращайтесь к IT-отделу.

С уважением,
Администрация
```

---

## ✅ Чек-лист запуска

- [ ] Сервер запущен (`serve -s dist -l 3000`)
- [ ] Firewall открыт (порт 3000)
- [ ] IP адрес известен
- [ ] Администратор создан
- [ ] Пользователи созданы
- [ ] Письма разосланы
- [ ] Система работает

---

## 🆘 Если что-то не работает

### Сервер не запускается

```powershell
# Проверьте что порт свободен
netstat -ano | findstr :3000

# Если порт занят, убейте процесс
taskkill /PID [номер_процесса] /F

# Запустите снова
serve -s dist -l 3000
```

### Сотрудники не могут подключиться

```powershell
# Проверьте firewall
netsh advfirewall firewall show rule name="ВКС Расписание"

# Проверьте доступность
Test-NetConnection -ComputerName 192.168.1.100 -Port 3000
```

### Потеряли доступ администратора

```javascript
// В консоли браузера (F12):
const users = JSON.parse(localStorage.getItem('vks_users'));
const admin = users.find(u => u.login === 'admin');
admin.role = 'admin';
localStorage.setItem('vks_users', JSON.stringify(users));
location.reload();
```

---

## 📞 Контакты поддержки

- **IT-отдел**: ext. 1234
- **Email**: support@yourcompany.com
- **Telegram**: @your_support_bot

---

<div align="center">

**Готово! Ваша система работает! 🎉**

</div>
