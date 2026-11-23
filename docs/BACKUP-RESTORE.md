# Проверка и восстановление резервной копии BCS

## Что уже автоматизировано

- Laravel Scheduler создаёт ежедневные резервные копии в 02:30 и дополнительные еженедельные копии.
- \`db:backup\` использует \`mysqldump/mariadb-dump\`, потоковое gzip-сжатие и проверку целостности архива.
- Для каждой копии сохраняется JSON с размером, SHA-256 и временем проверки.
- Ротация ежедневных копий ограничена 14 файлами; недельный запуск хранит 8 копий.
- Windows-скрипт \`ops/windows/Copy-BCS-Backups.ps1\` копирует архивы во внешнюю папку только после сверки SHA-256.
- Каталог копий находится в отдельном Docker volume \`db_backups\`.

## Безопасная проверка восстановления

Проверяйте восстановление только в отдельную тестовую БД. Следующий пример создаёт новую БД с уникальным именем и не меняет \`DB_DATABASE\`, рабочую БД, \`.env\` или Docker volumes.

1. Посмотрите имена резервных копий:

\`\`\`powershell
docker compose exec backend sh -lc 'ls -lh /var/www/html/storage/app/backups/backup-*.sql.gz'
\`\`\`

2. Укажите точное имя архива:

\`\`\`powershell
$Backup = "backup-2026-11-23_02-30-00.sql.gz"
\`\`\`

3. Проверьте архив до импорта:

\`\`\`powershell
docker compose exec backend sh -lc "gzip -t /var/www/html/storage/app/backups/$Backup"
docker compose exec backend sh -lc "sha256sum /var/www/html/storage/app/backups/$Backup"
\`\`\`

Сверьте SHA-256 с полем \`sha256\` в одноимённом файле \`$Backup.json\`. Если метаданные отсутствуют или хэш отличается, архив не использовать.

4. Создайте изолированную тестовую БД:

\`\`\`powershell
docker compose exec -T mysql sh -lc 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; mysql -uroot -e "CREATE DATABASE vks_restore_check_20261123 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"'
\`\`\`

5. Импортируйте архив именно в тестовую БД:

\`\`\`powershell
docker compose exec -T backend sh -lc "gzip -dc /var/www/html/storage/app/backups/$Backup" | docker compose exec -T mysql sh -lc 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; mysql -uroot vks_restore_check_20261123'
\`\`\`

6. Проверьте, что таблицы появились:

\`\`\`powershell
docker compose exec mysql sh -lc 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; mysql -uroot -e "SHOW TABLES FROM vks_restore_check_20261123;"'
\`\`\`

Для проверки содержимого можно отдельно посчитать записи в ключевых таблицах:

\`\`\`powershell
docker compose exec mysql sh -lc 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; mysql -uroot -e "SELECT COUNT(*) AS meetings_count FROM vks_restore_check_20261123.meetings; SELECT COUNT(*) AS users_count FROM vks_restore_check_20261123.users;"'
\`\`\`

Если проверка не прошла, оставьте тестовую БД для диагностики и не переключайте приложение на неё.

## Восстановление рабочей БД

Восстановление поверх рабочей базы — отдельная аварийная операция. Перед ней обязательно:
- получить явное разрешение ответственного администратора;
- сделать дополнительный свежий дамп текущей рабочей БД и проверить его;
- согласовать окно простоя;
- остановить запись новых данных и фоновые задачи;
- проверить целевой архив и выполнить восстановление с контролем результата;
- сохранить исходную копию до подтверждения работоспособности приложения.

В этом проекте нет автоматической команды, которая перезаписывает рабочую БД из архива. Это намеренная защита от случайной потери конференций, пользователей и истории. Не используйте \`migrate:fresh\`, \`db:wipe\` и не удаляйте Docker volumes для восстановления.
