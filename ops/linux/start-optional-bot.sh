#!/usr/bin/env bash
set -Eeuo pipefail
cd "${BCS_PROJECT_DIR:-/opt/bcs}"
ENV_FILE="${BCS_ENV_FILE:-.env}"
[[ -f "$ENV_FILE" ]] || exit 0
if grep -Eq '^[[:space:]]*VKSBOT_EXPECTED[[:space:]]*=[[:space:]]*true[[:space:]]*$' "$ENV_FILE" \
  && grep -Eq '^[[:space:]]*BOT_TOKENS[[:space:]]*=[[:space:]]*[^[:space:]#].*$' "$ENV_FILE"; then
  docker compose --profile bot up -d vks-bot
fi
