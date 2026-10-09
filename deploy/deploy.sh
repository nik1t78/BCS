#!/usr/bin/env bash
# Деплой боевой версии BCS на сервер. Использовать: sudo bash deploy.sh /opt/bcs
set -euo pipefail

APP_DIR="${1:-/opt/bcs}"   # каталог с клонированным репозиторием BCS
PATCH_FILE="$(dirname "$0")/0001-feat-Outlook-vc.salutejazz.ru-fix.patch"

cd "$APP_DIR"

echo "==> 1. Обновляем main из GitHub..."
git fetch origin main
git checkout main
git reset --hard origin/main

echo "==> 2. Применяем патч (Outlook-календарь, ФИО, виджет свободных залов, авто-ВКС, бейдж уведомлений, скрытие нулей)..."
git am "$PATCH_FILE" || echo "Патч, вероятно, уже применён — проверьте git log --oneline -3 (нужен коммит 'feat: Outlook-календарь...')"

echo "==> 3. Зависимости..."
npm ci || npm install

echo "==> 4. Боевая сборка..."
VITE_API_URL="https://salutejazz.ru/api" npm run build

echo "==> Готово! Статика в $APP_DIR/dist (nginx root). Перезапустите backend при необходимости."
