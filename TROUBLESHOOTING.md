# Не открывается по IP — пошаговая диагностика

Сайт доступен по адресу **`http://IP-сервера/` без порта** (nginx слушает 80).
Если по `http://10.48.4.235/` ничего не открывается, пройдите чек-лист сверху вниз.

## Шаг 0. Убедитесь, что контейнеры запущены

```bash
cd /path/to/vks-schedule          # папка проекта на СЕРВЕРЕ 10.48.4.235
docker compose ps
```

Все сервисы (nginx, backend, mysql, redis, queue, scheduler) должны быть в статусе
`Up`. Если nginx нет или в статусе `Restarting`:

```bash
docker compose up -d              # поднять заново
docker compose logs nginx --tail=50   # смотреть ошибки
```

Типичная причина падения nginx: **порт 80 на сервере занят** другим веб-сервером
(apache2, системный nginx). Проверить и освободить:

```bash
sudo ss -tlnp | grep ':80 '
sudo systemctl stop apache2 && sudo systemctl disable apache2   # если мешает apache
docker compose up -d nginx
```

## Шаг 1. Проверьте, что сервер отдаёт сайт ЛОКАЛЬНО (на самом сервере)

```bash
curl -I http://localhost/
```

- `HTTP/1.1 200 OK` → nginx работает, проблема в сети/брандмауэре (Шаг 2).
- Ошибка соединения → nginx не запущен или порт занят (Шаг 0).

## Шаг 2. Брандмауэр на сервере — самое частое решение

Открыть порт 80:

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 80/tcp
sudo ufw reload

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload

# iptables
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
```

После этого проверьте с рабочего ПК:

```bash
curl -I http://10.48.4.235/
```

## Шаг 3. Проверьте доступность с рабочего ПК

```bash
ping 10.48.4.235                  # вообще ли виден сервер
Test-NetConnection 10.48.4.235 -Port 80   # PowerShell Windows: открыт ли порт
telnet 10.48.4.235 80             # альтернатива
```

- Ping есть, порт 80 закрыт → брандмауэр (Шаг 2) или nginx слушает только
  `127.0.0.1` (см. Шаг 4).
- Ping нет → вы и сервер в разных сетях/VLAN, нужен сетевой администратор
  (маршрутизация между подсетями). Адрес `10.48.x.x` обычно корпоративная сеть —
  убедитесь, что ваш ПК в той же подсети или маршрутизируемой.

## Шаг 4. Переменная listen_ip в .env

По умолчанию `.env` содержит:

```
listen_ip=0.0.0.0        # доступ со всех интерфейсов — так и должно быть
```

Если там стоит `listen_ip=127.0.0.1`, сайт доступен ТОЛЬКО с самого сервера.
Исправьте на `0.0.0.0` и примените:

```bash
docker compose up -d nginx
```

## Шаг 5. Проверяйте именно HTTP, а не HTTPS

Проект работает по **http://**, браузер может сам «дописывать» https → ошибка.
Вводите адрес полностью: `http://10.48.4.235/` (именно `http://`, без порта).

Также попробуйте открыть в режиме инкогнито / другом браузере / с телефона по
Wi-Fi той же сети — чтобы исключить кэш DNS/браузера.

## Шаг 6. Сайт открывается, но страница пустая / ошибки в консоли

```bash
docker compose logs backend --tail=50    # ошибки Laravel/php-fpm
docker compose exec backend php artisan migrate --force   # если база не инициализирована
```

Проверьте, что фронтенд собран (контейнер frontend-build отработал один раз):

```bash
docker compose run --rm frontend
docker volume inspect vks-schedule_frontend_build
```

## Итоговый быстрый набор команд на сервере

```bash
cd /path/to/vks-schedule
docker compose down
docker compose up -d --build
sudo ufw allow 80/tcp            # или firewall-cmd (Шаг 2)
curl -I http://localhost/        # должно быть 200
```

Если `curl -I http://localhost/` возвращает 200, а с вашего ПК порт 80 недоступен —
проблема 100% в брандмауэре сервера или маршрутизации сети (обратитесь к сетевому
администратору).
