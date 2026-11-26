#!/usr/bin/env bash
set -Eeuo pipefail

# This script is intentionally restricted to an ephemeral GitHub Actions runner.
# It creates and destroys an isolated Compose project and its named volumes.
if [[ "${GITHUB_ACTIONS:-}" != "true" || "${BCS_CI_RUNTIME_SMOKE:-}" != "1" ]]; then
  echo "Refusing to run outside the explicitly enabled GitHub Actions runtime job." >&2
  exit 2
fi

export COMPOSE_PROJECT_NAME="bcs-runtime-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
export DB_DATABASE="vks_schedule"
export DB_USERNAME="vks_user"
export DB_PASSWORD="ci-test-db-password"
export DB_ROOT_PASSWORD="ci-test-root-password"
export REDIS_PASSWORD="ci-test-redis-password"
export APP_KEY="base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
export APP_ENV="testing"
export APP_DEBUG="false"
export APP_URL="http://127.0.0.1"
export SITE_IP="127.0.0.1"
export LISTEN_IP="127.0.0.1"
export QUEUE_CONNECTION="database"
export CACHE_STORE="file"
export MAX_ENABLED="false"
export MAX_BOT_TOKEN=""
export MESSENGER="max"
export VKSBOT_AUTO="false"
export VKSBOT_EXPECTED="false"

cleanup() {
  docker compose down --volumes --remove-orphans
}
trap cleanup EXIT

wait_healthy() {
  local service="$1"
  local attempts="${2:-120}"
  local id status
  id="$(docker compose ps -q "$service")"
  if [[ -z "$id" ]]; then
    echo "No container found for service: $service" >&2
    docker compose ps
    return 1
  fi

  for ((i = 1; i <= attempts; i++)); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id")"
    if [[ "$status" == "healthy" || "$status" == "running" ]]; then
      echo "$service is $status"
      return 0
    fi
    if [[ "$status" == "unhealthy" || "$status" == "exited" || "$status" == "dead" ]]; then
      echo "$service entered state $status" >&2
      docker compose logs --no-color "$service"
      return 1
    fi
    sleep 5
  done

  echo "Timed out waiting for $service health" >&2
  docker compose logs --no-color "$service"
  return 1
}

echo "Starting isolated MySQL, Redis, Laravel and frontend containers..."
docker compose config --quiet
docker compose up -d --build mysql redis backend frontend
wait_healthy mysql 120
wait_healthy backend 120

echo "Exporting Laravel public assets and applying migrations to the disposable CI database..."
docker compose run --rm backend-assets
docker compose run --rm backend php artisan migrate --force --no-interaction

echo "Starting Nginx, queue worker and scheduler..."
docker compose up -d nginx queue scheduler
wait_healthy nginx 120

echo "Checking SPA response..."
curl --fail --silent --show-error http://127.0.0.1/ --output /tmp/bcs-runtime-index.html
grep -q '<html' /tmp/bcs-runtime-index.html

echo "Checking Laravel API through Nginx..."
curl --fail --silent --show-error http://127.0.0.1/api/health --output /tmp/bcs-runtime-health.json
grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' /tmp/bcs-runtime-health.json

echo "Checking uncached server-time endpoint..."
curl --fail --silent --show-error -D /tmp/bcs-runtime-time-headers.txt \
  'http://127.0.0.1/api/time?_=1730000000' --output /tmp/bcs-runtime-time.json
grep -qi 'cache-control:.*no-store' /tmp/bcs-runtime-time-headers.txt
grep -q '"server_time"' /tmp/bcs-runtime-time.json

echo "Checking Laravel writable storage and worker/scheduler boot..."
docker compose exec -T backend sh -lc 'test -d storage/framework/cache/data && test -d storage/framework/sessions'
docker compose exec -T queue sh -lc "ps -ef | grep '[q]ueue:work' >/dev/null"
docker compose exec -T scheduler php artisan schedule:list --no-interaction >/dev/null

echo "Docker runtime smoke checks passed: SPA, API, MySQL migrations, storage, queue and scheduler."
