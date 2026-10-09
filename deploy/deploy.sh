#!/usr/bin/env bash
# Деплой боевой версии BCS на сервер.
# Использовать: sudo bash deploy.sh /opt/bcs
set -euo pipefail

APP_DIR="${1:-/opt/bcs}"          # каталог с клонированным репозиторием BCS
PATCH_FILE="$(dirname "$0")/0001-feat-Outlook-vc.salutejazz.ru-fix.patch"

cd "$APP_DIR"

echo "==> 1. Обновляем main из GitHub..."
git fetch origin main
git checkout main
git reset --hard origin/main

echo "==> 2. Применяем патч с новыми фичами (Outlook-календарь, виджет залов, ВКС-ссылки и т.д.)..."
git am "$PATCH_FILE" || {
    echo "Патч уже применён или конфликтует — проверяем наличие коммита cee3519..."
    git log --oneline -5
}

echo "==> 3. Установка зависимостей..."
npm ci --omit=dev=false || npm install

echo "==> 4. Боевая сборка..."
export VITE_API_URL="https://salutejazz.ru/api"
npm run build

echo "==> 5. Перезапуск backend-сервера уведомлений (если настроен как systemd-сервис)..."
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q bcs; then
    sudo systemctl restart bcs-notifications.service || true
fi

echo "==> Готово! Статика лежит в $APP_DIR/dist — nginx должен отдавать её как root."
echo "Проверьте: curl -I http://localhost/ и обновите страницу у пользователей (Ctrl+F5)."
