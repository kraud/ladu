# Admin dashboard (plan, 2026-09-30 to 2026-10-01)

**Status:** done and rolled out (slices 1 to 9, including the Ansible purge cron and the backup scripts). The live spec is `.context/features/admin.md`.

**PRs:** #56 (`admin-dashboard`), #59 (`admin-private-links`), #60 (`admin-staff-and-audit`), #61 (`admin-overview-stats`), #66 and #67 (panel corrections).

**Decisions kept (IDs are in `features/admin.md` §1):**
- A-1, A-2: API in the backend, UI in the `admin/` workspace behind Cloudflare Access.
- A-3, A-4, A-5: staff accounts, country only, soft delete with 30 days.
- A-6: split by host in Caddy.
- A-8, A-9: `ops_events` for backups; `ADMIN_LINKS` secret for private links.
- A-10, A-11: temporary staff password; `user_activity_days` for active users.

**Plan versus built:**
- The plan sent `/api/*` to the backend on both hosts. The build sends only `/api/admin/*` on the admin hosts (A-6).
- The plan counted active users from `last_seen_at`. That cannot work, so a new table was added (A-11).
- "Practice sessions" in the stats became two numbers: saved sessions not expired, and practised translations.
- `GET /auth/me` was added. It was not in the plan.
- Account page, environment mark and `/access` tabs were added after slice 9.

**Traps:**
- The Ansible task that starts `edge` did not rebuild its image, so a changed Caddyfile never reached the proxy. Fixed with `build: always`.
- `deploy.sh` rollback must restart only `backend` and `web`, then `admin` as optional. An older release has no admin image.
- `backend/Dockerfile` and `frontend/Dockerfile` must `COPY admin/package.json`, because `npm ci` needs every workspace.
- The rollout runbook (Cloudflare Zero Trust, HCP variable `admin_access_emails`, secrets, `create-staff.js`) was one-time and is done. Operations now live in `.context/guides/infrastructure-guide/`.

**Old text:** `git log -- .context/plans/admin-dashboard.md`
