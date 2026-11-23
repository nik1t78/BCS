# Phase 35 — Security hardening

## What changed

- Public permanent links (/api/m/{id}) return 404 for private meetings. Public meetings keep the existing permanent-link behavior.
- Attachment downloads now use the authenticated API endpoint /api/attachments/{id}/download.
- Direct HTTP access to /storage/attachments/ is denied by Nginx, including for files uploaded before this phase.
- Uploads are limited to PDF, Office documents, TXT, CSV and common raster images, with a 10 MB maximum. Filenames are normalized before being stored.
- Attachment listing, downloading and deletion check access to the related meeting. Only the uploader, meeting organizer or administrator may delete an attachment.
- Public self-registration is disabled by default. Administrators continue to create employee accounts in the admin panel.
- Refresh tokens are single-use, expire after 30 days by default, and are consumed under a database row lock to prevent concurrent reuse.
- Legacy refresh tokens without expires_at are evaluated from created_at; tokens older than the configured lifetime require a fresh login.
- CI now runs composer audit, npm audit and security regression smoke tests.

## Configuration

The following optional variables are supported in backend/.env:

- BCS_PUBLIC_REGISTRATION=false — default; set to true only if public self-registration is intentionally required.
- BCS_REFRESH_TOKEN_TTL_DAYS=30 — refresh-token lifetime in days (minimum 1).

After changing configuration on a local/staging instance, refresh Laravel's cached configuration using the normal deployment procedure (php artisan optimize:clear, then rebuild the config cache if the deployment uses it).

## Compatibility and rollout notes

- No database migration is added. The existing personal_access_tokens.expires_at column is used.
- Existing attachment files remain in their current storage location; the new authenticated download endpoint serves them without moving or deleting data.
- Direct links to /storage/attachments/... intentionally stop working. Any client that displayed such a URL must use the download_url returned by the attachment API.
- Existing accounts, meetings, rooms, history, and Docker volumes are not modified.
- Refresh tokens older than the configured lifetime will require users to sign in again. Existing access tokens continue to follow the configured Sanctum expiration.
- This phase does not deploy to production or modify .env on a running server.

## Verification

CI runs backend/tests/security-hardening-smoke.php for public/private permanent-link policy and explicit/legacy refresh-token expiry boundaries. The complete CI workflow also runs PHP syntax checks, existing regression smoke tests, frontend lint/type-check/build, dependency audits, and the VKS bot syntax checks.

Runtime verification is still required on the target Docker environment for:
- private meeting permanent links returning 404;
- authorized users downloading attachments and unauthorized users receiving 403;
- direct /storage/attachments/... requests returning 404;
- public registration returning 403 by default;
- refresh token expiry and re-login behavior;
- the full meeting creation/editing and VKS join flow.
