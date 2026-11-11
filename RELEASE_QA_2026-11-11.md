# BCS — release QA report (2026-11-11)

## Included in this candidate
- Laravel 12 backend and React/Vite frontend source.
- Docker Compose stack: frontend builder, nginx, PHP-FPM backend, MySQL, Redis, queue worker, scheduler, optional SaluteJazz browser bot.
- Windows startup/watchdog/backup-copy scripts and Linux systemd/timer scripts.
- VKS management workspace and approval-request API/UI.
- Database migration for `meeting_approval_requests`.
- Runtime entrypoint recreates Laravel writable cache/session/view/log directories on every backend/worker/scheduler start.

## Repairs in this pass
- Approval review now uses a DB transaction and `SELECT ... FOR UPDATE` row lock. Concurrent reviewers cannot overwrite one another's decision.
- Workbench refresh callback is memoized and correctly declared as a React effect dependency.

## Checks completed in this environment
- `php -l` on all 121 backend PHP files: PASS.
- YAML parse of `docker-compose.yml`: PASS; 9 services found.
- ZIP integrity (`testzip`): PASS.

## Checks not executable here — do not treat as passed
- Docker image builds and Compose runtime: Docker CLI/daemon unavailable.
- Laravel boot, route:list, migration against MySQL, authentication, queue and scheduler runtime: `backend/vendor` is not present.
- React/Vite build and TypeScript check: node_modules in the input archive was incomplete; offline dependency restore failed because npm cache did not contain `zip-stream`. The Docker frontend build performs a clean `npm ci` from package-lock and needs registry access.
- Live SaluteJazz/browser-bot flow and real notifications.
- End-to-end create/edit/postpone/calendar/recurrence/time-zone and free-room tests against a running database.
- Backup restore drill. Backup command verifies gzip CRC and SHA-256 metadata; a real restore into a disposable database still must be tested by the operator.

## Safe deployment procedure
1. Stop before deployment if there is no recent verified database backup and a separate copy outside the host.
2. Copy the existing `.env` and preserve the existing MySQL data directory/volume. Never run `docker compose down -v` and never delete `docker/mysql/data`.
3. Test this archive in a separate directory and with a cloned database first.
4. Run `docker compose config` and `docker compose up -d --build`.
5. Run `docker compose run --rm backend-assets` after backend image rebuild if public assets need refresh.
6. Run `docker compose exec backend php artisan migrate --force` only after confirming the backup and reviewing pending migrations.
7. Check `docker compose ps`, backend/nginx/queue/scheduler logs, login, VKS create/edit/postpone, room availability, notifications and backup/restore.
8. Configure `ops/windows/backup-destination.txt` to a separate disk/NAS before relying on off-host backup copies. Empty destination intentionally disables off-host copy.

## Functional notes
- Approval requests are a workflow for reviewing proposed meetings; approval does not itself create a calendar meeting. The organizer still creates the actual meeting after approval.
- The organizer assistant currently uses local deterministic hints; it is not an external generative AI service.
- Equipment display reads the existing room `equipment` field; it is not a separate inventory/maintenance module.
- Browser bot is optional and must be enabled/configured explicitly; it is not started when no bot token is configured.
