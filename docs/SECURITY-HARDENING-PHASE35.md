# Phase 35 — Security hardening

## What changed

- Public permanent links (/api/m/{id}) return 404 for private meetings unless the request carries a valid Laravel signature. The QR endpoint issues a signed permanent link only after its normal meeting-access check. Public meetings keep the existing short permanent-link behavior.
- Attachment downloads now use the authenticated API endpoint /api/attachments/{id}/download.
- Direct HTTP access to /storage/attachments/ is denied by Nginx, including for files uploaded before this phase.
- Nginx access logs no longer record request URI/query strings, preventing leakage of bearer credentials in TV, calendar, SSE and signed-link URLs.
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
- Existing QR codes for private meetings that contain the old unsigned /api/m/{id} URL must be regenerated from the QR endpoint after deployment. Newly generated private QR codes use signed permanent URLs.
- Existing accounts, meetings, rooms, history, and Docker volumes are not modified.
- Refresh tokens older than the configured lifetime will require users to sign in again. Existing access tokens continue to follow the configured Sanctum expiration.
- This phase does not deploy to production or modify .env on a running server.

## Dependency audit findings

The first audit run against the repository's existing lockfiles reported 14 npm advisories (1 high, 12 moderate, 1 low) and 8 Composer advisories affecting 5 packages. The high npm finding affects the locked Vite version; Composer findings include Laravel/Symfony components. The audit steps remain visible but non-blocking so they do not suppress syntax, regression, type-check and build tests. These dependency updates are intentionally not forced in this phase: lockfile upgrades need a separate reviewed change and full build/runtime validation. Do not interpret a passing CI run as a clean dependency audit.

## Verification

CI runs backend/tests/security-hardening-smoke.php for public/private permanent-link policy and explicit/legacy refresh-token expiry boundaries. The complete CI workflow also runs PHP syntax checks, existing regression smoke tests, frontend lint/type-check/build, dependency audits, and the VKS bot syntax checks.

Runtime verification is still required on the target Docker environment for:
- unsigned private permanent links returning 404 and signed private QR links redirecting correctly;
- authorized users downloading attachments and unauthorized users receiving 403;
- direct /storage/attachments/... requests returning 404;
- public registration returning 403 by default;
- refresh token expiry and re-login behavior;
- the full meeting creation/editing and VKS join flow.
