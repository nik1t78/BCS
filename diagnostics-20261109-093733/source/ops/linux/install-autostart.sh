#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ "$PROJECT_DIR" != /opt/bcs ]]; then
  echo "Для стандартной установки переместите проект в /opt/bcs (сейчас: $PROJECT_DIR) либо измените пути в unit-файлах." >&2
  exit 2
fi
if [[ "$EUID" -ne 0 ]]; then
  echo "Запустите установщик от root: sudo ./ops/linux/install-autostart.sh" >&2
  exit 3
fi

chmod +x "$PROJECT_DIR/ops/linux/"*.sh
# systemd не читает unit-файлы из каталога проекта автоматически —
# устанавливаем их в системный каталог до daemon-reload.
install -m 0644 "$PROJECT_DIR/ops/linux/bcs.service" /etc/systemd/system/bcs.service
install -m 0644 "$PROJECT_DIR/ops/linux/bcs-watchdog.service" /etc/systemd/system/bcs-watchdog.service
install -m 0644 "$PROJECT_DIR/ops/linux/bcs-watchdog.timer" /etc/systemd/system/bcs-watchdog.timer
install -m 0644 "$PROJECT_DIR/ops/linux/bcs-backup.service" /etc/systemd/system/bcs-backup.service
install -m 0644 "$PROJECT_DIR/ops/linux/bcs-backup.timer" /etc/systemd/system/bcs-backup.timer

systemctl enable docker.service
systemctl daemon-reload
systemctl enable --now bcs.service
systemctl enable --now bcs-watchdog.timer
systemctl enable --now bcs-backup.timer
systemctl --no-pager --full status bcs.service || true
systemctl list-timers bcs-watchdog.timer bcs-backup.timer
