# Полностью автономный запуск BCS на Linux Server

Это рекомендуемый вариант для работы без ручного входа в Windows. Docker Engine запускается как системная служба, а systemd поднимает проект при загрузке ОС.

1. Установите актуальный Docker Engine и Compose plugin.
2. Перенесите проект в `/opt/bcs`, подготовьте `.env` и проверьте права.
3. В BIOS/UEFI включите `Restore on AC Power Loss = Power On`.
4. Выполните от root:
   ```bash
   cd /opt/bcs
   chmod +x ops/linux/*.sh
   ./ops/linux/install-autostart.sh
   ```
Установщик копирует `bcs.service`, `bcs-watchdog.*` и `bcs-backup.*` в `/etc/systemd/system` (до этого systemd не видел бы unit-файлы), включает Docker и регистрирует службы/таймеры. Если в `.env` указаны `VKSBOT_EXPECTED=true` и `BOT_TOKENS`, отдельный профиль `bot` также запускается автоматически при старте и восстанавливается watchdog-проверкой.

5. Проверка:
   ```bash
   systemctl status docker bcs
   systemctl list-timers bcs-watchdog.timer bcs-backup.timer
   docker compose ps
   journalctl -u bcs -n 100 --no-pager
   tail -n 100 /var/log/bcs-watchdog.log
   ```

`bcs.service` запускает Compose после Docker и сети. Контейнеры с `restart: unless-stopped` автоматически возвращаются после перезапуска Docker/ОС. Watchdog раз в 5 минут поднимает остановленные сервисы и перезапускает unhealthy-приложения. Отдельный persistent systemd timer создаёт проверенный бэкап БД ежедневно и догоняет пропущенный запуск после простоя питания. Он намеренно не перезапускает MySQL только по healthcheck, чтобы не рисковать данными при долгом восстановлении.

Даже Linux-сервер не работает без электричества. Для непрерывности во время коротких отключений нужен UPS на сервер, коммутатор/роутер и модем; для долгих — резервное питание и резервный канал интернета. Настройте UPS на безопасное завершение ОС, если заряд критически низок. После возвращения питания BIOS и systemd поднимут систему автоматически.
