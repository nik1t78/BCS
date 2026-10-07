# Настройка уведомлений через MAX

1. В мессенджере MAX найдите бота-конструктор **@masterbot**, команда `/newbot` (или «Создать бота»), получите токен вида `xxxxxxxx:ABC...`.
2. В `.env` рядом с docker-compose.yml:
   ```
   MESSENGER=max
   MAX_BOT_TOKEN=<токен>
   MAX_API_URL=https://max-api.mars.bos.ru   # по умолчанию
   BOT_NAME=<имя_бота>                      # например vks_bot
   ```
3. Перезапустите backend: `docker compose up -d --force-recreate backend queue`.
4. Пользователь открывает профиль в приложении → блок «Мессенджер MAX» → получает chat_id (пишет боту `/start`, backend берёт его из вебхука/или пользователь вводит вручную) → PUT `/api/max/link`.
5. Проверка: `docker compose exec backend php artisan tinker` → `app(MaxMessengerService::class)->sendChat(CHAT_ID,'test')`.
6. Вебхук (опционально, для ответов): `curl -X POST "$MAX_API_URL/setWebhook?access_token=$MAX_BOT_TOKEN" -d '{"url":"https://<домен>/api/max/webhook"}'`.
