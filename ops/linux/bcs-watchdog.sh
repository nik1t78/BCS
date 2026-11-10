#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT_DIR="${BCS_PROJECT_DIR:-/opt/bcs}"
LOG_FILE="${BCS_LOG_FILE:-/var/log/bcs-watchdog.log}"
cd "$PROJECT_DIR"
exec 9>/run/lock/bcs-watchdog.lock
flock -n 9 || exit 0
log(){ printf '[%s] %s\n' "$(date --iso-8601=seconds)" "$*" | tee -a "$LOG_FILE"; }
if ! docker info >/dev/null 2>&1; then log 'Docker daemon unavailable'; exit 1; fi
docker compose up -d >>"$LOG_FILE" 2>&1 || { log 'compose up failed'; exit 1; }
if [[ -x "$PROJECT_DIR/ops/linux/start-optional-bot.sh" ]]; then BCS_PROJECT_DIR="$PROJECT_DIR" "$PROJECT_DIR/ops/linux/start-optional-bot.sh" >>"$LOG_FILE" 2>&1 || log 'optional bot start failed'; fi
for name in vks-backend vks-nginx vks-queue vks-scheduler vks-redis vks-bot; do
  if ! docker inspect "$name" >/dev/null 2>&1; then continue; fi
  state="$(docker inspect --format '{{.State.Status}}' "$name" 2>/dev/null || true)"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$name" 2>/dev/null || true)"
  if [[ "$name" == vks-bot && "$state" != running ]]; then
    log "vks-bot state=$state; starting optional bot"
    docker start "$name" >>"$LOG_FILE" 2>&1 || log 'vks-bot start failed'
  elif [[ "$state" == running && "$health" == unhealthy ]]; then
    log "$name unhealthy; restarting container"
    docker restart "$name" >>"$LOG_FILE" 2>&1 || log "restart failed: $name"
  fi
done
# Database is deliberately excluded from forced restarts on an unhealthy probe.
db_state="$(docker inspect --format '{{.State.Status}}' vks-mysql 2>/dev/null || true)"
db_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' vks-mysql 2>/dev/null || true)"
if [[ "$db_state" != running || "$db_health" == unhealthy ]]; then
  log "CRITICAL: MySQL state=$db_state health=$db_health; no forced restart"
fi
log 'watchdog completed'
