# Не открывается по IP — пошаговая диагностика

Сайт доступен по адресу **`http://IP-сервера/` без порта** (nginx слушает 80).
Если по `http://10.48.4.235/` ничего не открывается, пройдите чек-лист сверху вниз.

## Шаг 1. Убедитесь, что код на сервере АКТУАЛЕН (самое частое!)

Если логи nginx показывают ошибку:

```
"limit_req_zone" directive is not allowed here in /etc/nginx/conf.d/default.conf:23
```

значит на сервере лежит **старая версия** `docker/nginx/default.conf` (из неё
директивы `limit_req_zone` не перенесены на уровень `http`). Обновите код и
перезапустите контейнер — файл монтируется с диска, пересборка образа не нужна:

```bash
git pull                          # или скопируйте свежий docker/nginx/default.conf
docker compose restart nginx      # nginx должен остаться Up
docker compose logs nginx --tail=20
```

Проверка локально перед рестартом (опционально):

```bash
docker run --rm -v "${PWD}/docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t
```

Другие типичные симптомы устаревшего кода:
- `Method Illuminate\Database\MySqlConnection::select_one does not exist` при
  `php artisan migrate` → старая миграция `fix_audit_logs_user_fk`; после
  обновления кода выполните `docker exec vks-backend php artisan migrate --force`
  ещё раз (незавершённая миграция откатится автоматически).
- `Access denied for user 'vks_user' ... using password: NO` → пароли в
  `docker-compose.yml` и `.env` не совпадают; синхронизируйте `DB_PASSWORD`
  (по умолчанию `vks_2026`) и пересоздайте БД при первом запуске
  (`docker compose down && docker compose up -d`).

## Шаг 2. Убедитесь, что контейнеры запущены

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

## Шаг 3. Проверьте, что сервер отдаёт сайт ЛОКАЛЬНО (на самом сервере)

```bash
curl -I http://localhost/
```

- `HTTP/1.1 200 OK` → nginx работает, проблема в сети/брандмауэре (Шаг 4).
- Ошибка соединения → nginx не запущен или порт занят (Шаг 2).

## Шаг 4. Брандмауэр на сервере — самое частое решение

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

## Шаг 5. Проверьте доступность с рабочего ПК

```bash
ping 10.48.4.235                  # вообще ли виден сервер
Test-NetConnection 10.48.4.235 -Port 80   # PowerShell Windows: открыт ли порт
telnet 10.48.4.235 80             # альтернатива
```

- Ping есть, порт 80 закрыт → брандмауэр (Шаг 4) или nginx слушает только
  `127.0.0.1` (см. Шаг 6).
- Ping нет → вы и сервер в разных сетях/VLAN, нужен сетевой администратор
  (маршрутизация между подсетями). Адрес `10.48.x.x` обычно корпоративная сеть —
  убедитесь, что ваш ПК в той же подсети или маршрутизируемой.

## Шаг 6. Переменная listen_ip в .env

По умолчанию `.env` содержит:

```
listen_ip=0.0.0.0        # доступ со всех интерфейсов — так и должно быть
```

Если там стоит `listen_ip=127.0.0.1`, сайт доступен ТОЛЬКО с самого сервера.
Исправьте на `0.0.0.0` и примените:

```bash
docker compose up -d nginx
```

## Шаг 7. Проверяйте именно HTTP, а не HTTPS

Проект работает по **http://**, браузер может сам «дописывать» https → ошибка.
Вводите адрес полностью: `http://10.48.4.235/` (именно `http://`, без порта).

Также попробуйте открыть в режиме инкогнито / другом браузере / с телефона по
Wi-Fi той же сети — чтобы исключить кэш DNS/браузера.

## Шаг 8. Сайт открывается, но страница пустая / ошибки в консоли

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
sudo ufw allow 80/tcp            # или firewall-cmd (Шаг 4)
curl -I http://localhost/        # должно быть 200
```

Если `curl -I http://localhost/` возвращает 200, а с вашего ПК порт 80 недоступен —
проблема 100% в брандмауэре сервера или маршрутизации сети (обратитесь к сетевому
администратору).
