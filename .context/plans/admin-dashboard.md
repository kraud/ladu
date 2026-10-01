# Plan: Ladu admin dashboard ("Ladu Admin")

Status: approved on 2026-09-30. Slices 1 (data capture), 2 (staff auth), 3 (admin UI skeleton), 4 (users list and detail), 5 (actions), 6 (health page) and 7 (deploy) are done and rolled out. Slice 8 (staff and audit) is done and deployed. Slice 9 (overview statistics) is merged to `main` (PR #61). The user emails (resend verification, send password reset) are merged to `main` (PR #62). Next: `.context/plans/access-gates.md` (PR 1, the registration gate, is merged to `main`; PR 2, the login gate, is built on branch `admin-login-gate`).

Slice 1 notes:
- Migration `0010_admin_data_capture.sql`. Helper: `backend/lib/accountAccess.ts`. Tests: `backend/tests/accountAccess.test.js`.
- A banned user gets 403 at password login and 401 from `protect`. A deleted user gets "Invalid credentials" at login and 401 from `protect`.
- Banned or deleted Google logins redirect with the generic `oauth_failed` code. A dedicated message needs a frontend change (a later slice).
- `deleted_by_staff_id` has no foreign key yet. Slice 2 adds it with `staff_accounts`.

Slice 2 notes:
- Migration `0011_staff_accounts_and_audit_log.sql`. Code: `lib/adminPermissions.ts`, `lib/staffAccounts.ts`, `middleware/staffAuth.ts`, `controllers/admin/authController.ts`, `routes/admin/`, `scripts/create-staff.js`. Tests: `backend/tests/adminAuth.test.js`.
- `create-staff` is a `.js` file that loads `tsx/cjs`, because the production image has no build step.
- Added `GET /api/admin/auth/me` (not in the original plan) so the admin UI can check a saved session.
- `ADMIN_JWT_SECRET` is read lazily. Without it the server starts and admin login returns 503. Slice 7 must add it to the staging and production env files and to `deploy.yml`.
- There is no rate limit on staff login. Cloudflare Access (slice 7) is the second lock.

Slice 3 notes:
- New workspace `admin/` (Vite, React 18, TanStack Router + Query, Tailwind v4, zustand, axios). Dev port `:5174`, proxy `/api` to `:5001`. Run it with `npm run dev:admin`. Tests: `npm test -w admin` (Vitest + MSW).
- Own palette (`admin/src/styles.css`) and only three copied UI primitives (Button, Input, Label). No i18n, no Sentry, no toasts.
- Session stored under `ladu-admin.session`. The app calls `GET /api/admin/auth/me` on start. A 401 clears the session and goes to `/login`.
- `backend/Dockerfile` and `frontend/Dockerfile` now also `COPY admin/package.json`, because `npm ci` needs every workspace's `package.json`.
- Not done yet: the root `build` script and `deploy.yml` do not build `admin/` (slice 7). No Playwright spec yet (slice 4).

Slice 4 notes:
- API: `GET /api/admin/users` (search, `verified`, `status`, `method`, sort, page numbers, `pageSize` up to 100) and `GET /api/admin/users/:id`. Both need `users.read`. Code: `backend/controllers/admin/userController.ts`, `backend/routes/admin/userRoutes.js`. Tests: `backend/tests/adminUsers.test.js`.
- The detail response has `audit: null` for roles without `audit.read`, and `audit: []` when a permitted role has no entries yet. The UI shows the section only when it is not `null`.
- UI: `admin/src/features/users/`. The list keeps search, filters, sort and page in the URL.
- e2e: `e2e/tests/admin-4-users.spec.ts`. `playwright.config.ts` now also starts the admin Vite server on `:5174` and gives the backend an `ADMIN_JWT_SECRET`. `e2e/fixtures/db.ts` has the staff and user seed helpers (`e2e` now depends on `bcryptjs`).
- `.github/workflows/ci.yml`: lint and typecheck include `admin`, and there is a new `admin` job (Vitest + build).
- Lesson: in a Drizzle SELECT list, `${users.id}` inside a raw `sql` subquery loses its table name. Write `"users"."id"` there (see `hasGoogle`).
- Known e2e caveat: the OAuth specs need the backend that Playwright starts itself (it sets the stub issuer). They fail when `npm run dev` already runs a backend on `:5001`.

Slice 5 notes:
- Migration `0012_audit_log_system_actor.sql`: `audit_log.staff_id` is now optional. NULL means "System" (the nightly job).
- New permission `users.purge` (owner only). `POST /api/admin/users/:id/{ban,unban,force-logout,delete,restore,purge}`. Ban, unban and force logout need `users.ban`; delete and restore need `users.delete`. Code: `backend/controllers/admin/userController.ts`, `backend/lib/userPurge.ts`, `backend/scripts/purge.js`. Tests: `adminUserActions.test.js`, `purge.test.js` (runs the real script against the test DB).
- Decisions made with the user: "Purge now" works only on an account that is already soft-deleted (two steps, two audit rows). A reason is required for ban, delete and purge, and optional for the others.
- Each action runs in one transaction: lock the row (`FOR UPDATE`), check the state (409 if not allowed), change it, write the audit row. The typed username is checked on the server as well as in the UI. `users.ban_reason` holds the ban reason; unban clears it.
- Restore does not bump `token_version`, so old sessions work again. A restored account that was also banned stays banned.
- `GET /auth/me` and the login response now include `permissions`. The UI shows only the buttons a role may use (`useCan`). A session saved before this change is dropped once.
- `deploy/ansible/roles/purge`: cron at 03:30 UTC for staging and prod (after the 03:00 backup). **Not applied yet:** run the Ansible playbook to install it. The operator guide (`.dev-context/infrastructure-guide/01-architecture-overview.md`) lists it.
- "Resend verification email" and "Send password reset" were not in slice 5. They are built and merged (PR #62): see `.context/plans/admin-user-emails.md` (permission `users.email`). A failed purge job has no alert: the log file is the only trace (a Healthchecks.io ping is a possible later step).

Slice 6 notes:
- `GET /api/admin/health` (`health.read`, all roles). Code: `backend/controllers/admin/healthController.ts`. Tests: `backend/tests/adminHealth.test.js`. UI: `admin/src/features/health/`. Links to the external tools are in `admin/src/features/health/links.ts` (public front pages; replace them with your direct project addresses).
- Each environment's admin shows its own backend (`ENVIRONMENT` and `GIT_SHA` from the container). `admin.` shows prod, `admin-staging.` shows staging. The link list has the public `/api/health` address of both.
- If the database does not answer, the API still returns 200 with `database: "error"`, and the database and backup blocks are null.
- Decision made with the user: backups are reported through a new `ops_events` table (migration `0013_ops_events.sql`). `deploy/scripts/record-event.sh` is sourced by `backup.sh` and `restore-test.sh`; it writes one row per run, success or failure, as the DB superuser. The backup Ansible role syncs the new file. A failed write only warns. The SQL path was tested against the local Postgres container. The full scripts cannot run here (they need the VPS, B2 and Docker Compose paths).
- **Not applied yet:** run the Ansible playbook so the VPS gets the new scripts. The health page shows "None recorded" for backups until the first nightly run after that. Staging never shows a backup (only prod is backed up).
- The page warns ("Overdue") when the last backup is older than 26 hours, or the last restore test older than 8 days.

Slice 7 notes (deploy):
- New: `admin/Dockerfile`, `admin/Caddyfile`, `deploy/terraform/access.tf`. Changed: `deploy/compose/app.yml` (service `admin`, container `admin-<env>`), `deploy/caddy/Caddyfile` and its local mirror, `deploy/scripts/deploy.sh`, `deploy/terraform/dns.tf` and `variables.tf`, `.github/workflows/ci.yml` and `deploy.yml`, `landing/privacy.html`, the operator guide.
- Hosts: `admin.ladu.com.ar` (prod data) and `admin-staging.ladu.com.ar` (staging data). One subdomain level, because the free Cloudflare certificate covers `*.ladu.com.ar` only.
- Decision made with the user: **split by host**. On `app.` and `staging.`, Caddy answers 404 for `/api/admin/*`. On the admin hosts, Caddy sends only `/api/admin/*` to the backend, and any other `/api/*` path is 404. So the admin API is reachable only behind Cloudflare Access. (The first plan text said `/api/*` on both hosts.)
- `deploy.sh`: the rollback now restarts only `backend` and `web`, then `admin` as an optional step. A release from before the dashboard has no `ladu-admin` image, and `compose up -d` would fail as a whole and leave the broken release running. A new check runs inside `admin-<env>` (`docker exec ... wget`), because the admin host is behind Access. A failed admin check warns and does not roll back.
- `access.tf`: one Access policy (emails from the HCP variable `admin_access_emails`) and one application per host, session 8 hours. The DNS records must be proxied (Access works only on proxied hostnames).
- `privacy.html` now mentions the login country, the 90-day login list, staff access with an action log, and the 30-day deletion grace.
- Tested locally (full stack with `docker-compose.local.yml`): all four images build (this also proves the `COPY admin/package.json` lines); `create-staff.js` and `purge.js` run inside the production-mode container; the routing of both hosts (see the decision above); cache and security headers; a browser login through Caddy to the health page. The production Caddyfile passes `caddy validate` with the real edge image; `terraform validate` and `fmt` pass. **Not tested:** `terraform plan` or `apply` (needs the HCP workspace), real Cloudflare Access, the GitHub workflows, `deploy.sh` on the VPS.
- Private links on the health page (after the rollout): the repo is public, so the real addresses of Sentry, Healthchecks, Netcup and so on are not in it. They are the GitHub Environment secret `ADMIN_LINKS` (one line of JSON), written into each `.env` by `deploy.yml`, checked by `backend/lib/adminLinks.ts` (https only, all-or-nothing), and sent in the `GET /api/admin/health` response (`links`, `linksStatus`). The page shows them instead of the generic `FALLBACK_LINKS` in `admin/src/features/health/links.ts`, which stay as the fallback when the secret is missing or invalid, and when the API is down. Decision made with the user (the alternative was a database table with an edit screen, which could be built in slice 8). How to set it: operator guide, `06-secrets-and-access.md`.
- Found while writing the runbook: the Ansible task that starts `edge` did not rebuild its image, and the Caddyfile is copied into that image. After the first run, a changed Caddyfile would never reach the proxy. Fixed with `build: always` in `deploy/ansible/roles/platform/tasks/main.yml`. Without this change, step 5 of the runbook would not make the admin hosts live.
- Known limit: Access is checked at Cloudflare, not at the VPS. The VPS firewall only allows Cloudflare's addresses, but any Cloudflare customer's traffic comes from those addresses. Someone who sends requests with the host name `admin.ladu.com.ar` through their own Cloudflare account would skip Access. The staff login is then the only lock. A possible later step: check the `Cf-Access-Jwt-Assertion` header in Caddy or in the backend.

Rollout runbook (do these in this order; the first step must come first):
1. **One-time Cloudflare setup (dashboard):** enable Zero Trust on the account and choose a team name; check that "One-time PIN" is an enabled login method; add the permission **Access: Apps and Policies: Edit** (account level) to the Terraform API token.
2. **HCP Terraform:** set the workspace variable `admin_access_emails` (for example `["you@example.com"]`). Run `terraform plan`, read it, then `terraform apply`. Expect: 4 DNS records, 1 policy, 2 applications. At this point the hostnames exist and are protected, but nothing answers behind them yet.
3. **GitHub:** add the Environment secret `ADMIN_JWT_SECRET` to `staging` and to `production`, with a different random value in each (`openssl rand -hex 32`).
4. **Merge to `main`:** the pipeline builds `ladu-admin`, starts `admin-staging` and `admin-prod`, and writes the secret into each `.env`. The landing image with the new privacy text is pushed as `latest`.
5. **Ansible:** `ansible-playbook site.yml` (the `platform` role copies the new Caddyfile and reloads Caddy; Caddy gets the two certificates by DNS-01; the landing image is pulled; the `backup` role syncs the new scripts; the `purge` role installs the cron job). From this moment the admin hosts are live, behind Access.
6. **First owner:** `docker exec -it backend-prod node scripts/create-staff.js you@example.com "Your Name"`, and the same for `backend-staging`.
7. **Check:** open `https://admin-staging.ladu.com.ar`: you must see the Cloudflare login first, then the staff login. Then check that `https://app.ladu.com.ar/api/admin/auth/me` answers 404, and that `https://admin.ladu.com.ar/api/admin/auth/me` (in a private window, without an Access login) shows the Cloudflare login and not a JSON answer.

Slice 8 notes (staff management and the audit log viewer):
- Migration `0014_staff_password_change.sql` (adds columns only): `staff_accounts.must_change_password`, `password_changed_at`, `token_version`.
- Decision made with the user: a new staff member gets a **temporary password** that an owner types (or generates). Until the person sets their own, every admin route except `GET /auth/me` and `POST /auth/change-password` answers 403 with `code: "password_change_required"` (`requireStaff`, option `allowMustChangePassword`). The UI sends the person to `/account/password` and hides the other links.
- Staff tokens now carry `tv` (`staff_accounts.token_version`). A password change, a reset or a disable raises it, so older tokens stop working at once. Old tokens without `tv` count as 0, so nobody is signed out by the deploy. `change-password` answers with a new token, so the current device stays signed in.
- Staff API (owner only, `staff.manage`): list, create, `role`, `disable` (reason required), `enable`, `reset-password`. Audit actions: `staff.create`, `staff.role_change`, `staff.disable`, `staff.enable`, `staff.password_reset`, `staff.password_change`. No password, hash or token is ever written to the audit log (an e2e check proves it).
- Rules: you cannot change your own role, disable yourself, or reset your own password. The **last active owner** cannot be demoted or disabled. Every action that can remove an owner first locks all active owner rows in a fixed order, so two owners acting on each other at the same moment cannot leave zero owners. A deterministic test holds a lock on a third owner and checks that the request waits (a race test alone cannot prove a lock: the window is too short). Passwords: 12 to 72 bytes (bcrypt reads only 72).
- Audit API (`audit.read`: admin and owner): `GET /api/admin/audit` (filters `staff` (an id or `system`), `action`, `from` (included), `to` (not included), pages) and `GET /api/admin/audit/filters`. The UI converts the picked days to exact times in the person's own time zone.
- Admin app: `/staff`, `/audit`, `/account/password`, header links by permission. A role without the permission is sent to the overview; the server refuses the API calls too.
- `create-staff.js` is for the first owner only and sets no temporary-password flag.
- Tests: Jest `adminStaff`, `adminPasswordChange`, `adminAudit`; Vitest for the three pages; Playwright `admin-8-staff.spec.ts` (two browser windows).
- Known small gaps: a staff member's own sessions on other devices end when they change their password (by design), but there is no "sign out everywhere" button. There is no rate limit on the staff login or on the password-change check (Cloudflare Access is the first lock).

Slice 9 notes (overview statistics):
- **The plan's idea for active users did not work, and was changed (decision made with the user).** `users.last_seen_at` holds one value per user, overwritten each time, so it cannot answer "how many users were active on 12 September?". A new table `user_activity_days` (migration `0015_user_activity_days.sql`) holds one row for each user for each UTC day. `protect` writes the row at the first request of each UTC day (`ON CONFLICT DO NOTHING`), next to the hourly `last_seen_at` update. One threshold serves both: the later of "an hour ago" and "the start of today (UTC)", so a day change inside the hour (23:50, then 00:10) is still recorded. If recording fails, the request still succeeds and `last_seen_at` is left alone, so the next request tries again.
- History starts on the day this is deployed (no backfill: `last_seen_at` keeps only the last day, so a backfill would invent a decline). The first day is incomplete: users already seen earlier that day have no row. The API marks every window that includes the first day as `partial`, and days before the first row have `count: null`. The UI draws partial values lighter and says why.
- The nightly purge deletes activity rows older than 400 days (`ACTIVITY_RETENTION_DAYS`). `landing/privacy.html` says so.
- `GET /api/admin/stats` (`users.read`, every role): totals, signups for each of 30 days and 12 weeks (zero-filled in SQL), active users for each of 30 days with rolling 7-day and 30-day windows, and users for each language. Code: `backend/controllers/admin/statsController.ts`. All days and weeks are UTC; a week starts on Monday. No personal data is in the answer.
- "Users" means accounts that are not deleted. Signups count every account that still exists, so an account that was purged disappears from the past counts (the page says so). "Practice sessions" in the plan became two honest numbers: saved sessions that have not expired, and practised translations (rows of `exercise_performances`), because the database keeps no record of every session played.
- Admin app: the home page `/` is now the overview. Three charts (new accounts, active users, languages) in plain HTML and CSS, with no chart library. They follow the data-visualization rules: one series and one color (the admin accent, checked with the palette validator), thin marks, a tooltip on hover and focus, the newest value written on its column, a table view for every chart, and the old numbers stay on the page, dimmed, while it reloads. Month and weekday names are written out, because `Intl` gives "Sept" or "Sep" depending on the browser.
- Found by looking at the page at phone width: the header overflowed since slice 8 (now it wraps), and two x-axis labels ran together (a label closer than n points to the last one is now dropped).
- Tests: Jest `adminStats` and `activityDays` (a fixed clock replaces `Date`), `purge`; Vitest for the chart components and the page; Playwright `admin-9-stats.spec.ts`. The e2e spec reads the API before it seeds, and asserts only what its own rows add, because other specs create users at the same time.

Account page and header cleanup (cosmetic slice, after slice 9):
- New page `/account` (`admin/src/features/auth/pages/AccountPage.tsx`): name, email and role from the session, with "Change password" and "Sign out". The header keeps the name and the role badge and gains an "Account" link as its last item; the "Change password" link and the "Sign out" button left the header. `useSignOut` (`features/auth/hooks.ts`) holds the logout + navigate pair both places used to repeat.
- The "Account" link sits outside the `mustChange` test in the header, and `_protected.beforeLoad` allows `/account` as well as `/account/password`, so a temporary password keeps a way to sign out.
- The header title "Ladu Admin" is a link to the overview. `/access` is grouped into a "Registration" section (gate + invite list) and a "Login" section (gate + allowed accounts + "Sign everyone out"): the two group headings are `h2` and the card headings are `h3`, so the region names the tests and the e2e specs scope queries with do not change.
- The learner banner (`frontend/src/features/access/components/AccessBanner.tsx`) carries `mb-4`, so it no longer sits against the "Continue with Google" button on the login and register pages.

## Context

Today, the only way to see production data is SSH to the VPS, then `psql` as `ladu_admin` on `ladu_prod`. There is no admin role, no ban flag, no last-login record, no audit log, and no account deletion endpoint. The support tool must let us:
- see who is registered, and some facts about each account
- ban or delete accounts
- see the health of the deployment
- give access to other people later, with basic permissions

This document explains where the tool lives, what a support tool usually does, and a slice order.

What exists now (on 2026-09-30):
- **Backend:** Express + Drizzle + Postgres, with a stateless JWT (30 days). The `protect` middleware (`backend/middleware/authMiddleware.ts:27`) loads the user from the DB on each request. This is good: a ban can take effect on the next request.
- **`users` table** (`backend/src/db/schema.ts:58`): has `created_at`. It does not have `last_login_at`, login country, a ban flag, or a role.
- **Foreign keys** already cascade on user delete: words, tags, friendships, practice data, tokens, OAuth identities. Only `words.original_creator_id` is set to NULL. A hard delete is therefore already safe at DB level.
- **Health:** `GET /api/health` (`backend/app.js:43`) returns DB status and the commit SHA. Other health data is in external tools: UptimeRobot, Sentry, Healthchecks.io, the B2 backups, and the Netcup panel.
- **Hosting:** one VPS, a Caddy `edge` container, and Cloudflare DNS through Terraform. The hosts are `app.`, `staging.` and the apex (landing page). There is no `admin.` host.

## Decisions (made on 2026-09-30)

| Topic | Decision |
|---|---|
| Location | Separate frontend on the `admin.` subdomain. The admin API is in the existing backend, under `/api/admin/*`. |
| Admin accounts | Separate staff accounts, not a role on normal users |
| Login location | Country only, from the `CF-IPCountry` header. We do not store IP addresses. |
| Account delete | Soft delete with a 30-day grace period, then a purge |

---

## 1. Where the admin tool lives

A tool like this has two parts:
- **The admin API**, which reads and changes data.
- **The admin UI**, the web pages you use.

These two parts can live in different places, so we look at them one at a time.

### 1a. Admin API → in the **existing backend**, under `/api/admin/*`
- The data is in the same Postgres, and the rules for ban and delete must be in one place.
- A second backend would need two copies of the schema and the business rules, kept in sync. That is a common source of bugs.
- The admin API gets its **own router and its own auth middleware**. A normal user token can never open an admin route.

### 1b. Admin UI: the options we compared

| Option | What it is | Good | Bad |
|---|---|---|---|
| A. `/admin` route inside the app | New pages in `frontend/`, at `app.ladu.com.ar/admin` | Fastest to start. Reuses all components. | Admin code and user code mix. One wrong route guard can expose admin pages. It is hard to put an extra security gate on one path. |
| **B. `admin.` subdomain, separate frontend (chosen)** | New workspace `admin/` (Vite + React, same stack), served at `admin.ladu.com.ar` and calling the same backend | Clean separation. **Cloudflare Access** can protect the full subdomain. It deploys in lockstep with the backend through the same pipeline. | We must add one workspace, one container, one Caddy block and one DNS record. We copy or share some UI components. |
| C. Separate deploy, like the landing page | Static site that we deploy by hand with Ansible | — | Not a good fit. The admin UI depends on the admin API version. A manual deploy lets the UI and the API drift apart. The landing page can use a manual deploy because it has no API. |
| D. Off-the-shelf tool (Retool, AdminJS, Appsmith, Metabase) | A ready-made admin UI that connects to the DB or the API | Fast to set up for tables. | It needs production DB credentials in an external service, or an extra container on a 4 GB VPS. The ban and delete logic would be outside our code. |

**What is Cloudflare Access?** It is part of Cloudflare Zero Trust, and it is free for up to 50 users. All traffic to `admin.` already goes through Cloudflare. With Access on, Cloudflare shows its own login screen first, for example a one-time code sent to an allowed email address. Only after that login does the request reach the VPS.
- An attacker who does not know an allowed email address cannot even load the admin page.
- It is a **second lock**. The admin login in our own code stays the first lock.
- Terraform can manage it with the Cloudflare provider we already use.

**Deploy flow.** The `admin` image is built in `deploy.yml` like `web`. It is tagged with the commit SHA and deployed to staging and then to production with `app.yml`.
- Proposed hosts: `admin.ladu.com.ar` (prod) and `admin-staging.ladu.com.ar` (staging).
- On both hosts, Caddy sends `/api/*` to the backend of that environment.

---

## 2. Admin accounts and permissions

### Separate staff accounts, not a role on normal users

**Why separate accounts:**
- A support person does not need a vocabulary account.
- If someone steals a learner's 30-day token, it cannot open admin routes.
- Staff accounts can have stricter rules: a short session (for example 8 hours), and 2FA later.

**Tables (new):**
- `staff_accounts`: id, email, name, password_hash, role, disabled_at, last_login_at, created_at.
- `audit_log`: id, staff_id, action (for example `user.ban`), target_type, target_id, reason, metadata (jsonb), created_at. **Every admin action writes one row.** This is the most important feature of a support tool. It shows who did what, and when.

**Tokens:**
- The admin JWT uses its own secret (`ADMIN_JWT_SECRET`) and the claim `aud: "admin"`.
- A new middleware, `requireStaff(permission)`, checks the token, loads the staff account, and checks the permission.

**Permissions:**
- Roles are fixed in code, in one map from role to permission list. There is no permission editor UI yet. It would add complexity that we do not need now.

  | Role | Permissions |
  |---|---|
  | `owner` | all, including `staff.manage` |
  | `admin` | `users.read`, `users.ban`, `users.delete`, `health.read`, `audit.read` |
  | `support` | `users.read`, `users.ban`, `health.read` |
  | `viewer` | `users.read`, `health.read` |

- Later, if necessary, we can move this map to DB tables without a change to the routes. Each route asks only "does this person have `users.ban`?".

**First account ("bootstrapping"):** nobody can log in before the first staff account exists. A CLI script, `backend/scripts/create-staff.ts`, creates the first `owner`. You run it once over SSH (`docker compose exec backend-prod ...`). After that, the owner creates other staff in the UI.

---

## 3. Features

### Users
- **List:** search by email, username or name. Sort and filter by registration date, last login, verified or not, banned or not, deleted or not, and login method (password or Google).
- **Detail page:**
  - profile and UI language
  - registration date, last login, last seen, last login country
  - login method, and linked Google identity
  - counts: words, translations, tags, friends, practice sessions
  - recent login history
  - audit history for this account
- **Actions** (each asks for a reason and writes to the audit log):
  - **Ban / unban.**
    - Set `banned_at` and `ban_reason`.
    - `protect` rejects banned users on the next request. Login and Google login reject them too.
  - **Delete (soft delete, 30-day grace).**
    - The first step sets `users.deleted_at` and `deleted_by_staff_id`.
    - From that moment:
      - `protect`, login and Google login treat the account as gone.
      - Public or social queries (tags shared later, friends later) hide the account.
      - The email and username stay reserved, so nobody can register them during the grace period.
    - **Restore:** during the 30 days, an `admin` can remove `deleted_at`. The account then comes back unchanged.
    - **Purge:**
      - A nightly job hard-deletes accounts with `deleted_at` older than 30 days. The existing FK cascades remove the data.
      - An `owner` can also select **"Purge now"**, for example for a GDPR request.
    - The UI asks you to type the username to confirm a delete or a purge.
    - Each step (delete, restore, purge) writes an audit row. The row keeps the email and username, because the user row is gone after the purge.
    - **Where the nightly job runs:** a host cron job, installed by Ansible like the backup job. It runs `docker compose exec backend-prod node scripts/purge.js`. The same script also deletes `login_events` older than 90 days. We do not add a scheduler to the backend.
  - **Force logout.**
    - Add `token_version` to `users` and put it in the JWT.
    - `protect` compares the two values. A bump makes all old tokens invalid.
  - **Resend verification email, send password reset.** These reuse the existing controllers.
  - **Not in scope: impersonation** ("log in as the user"). It is powerful but risky, and we do not need it now.

### Platform overview
- Totals: users, verified users, words, and practice sessions.
- Signups per day and per week.
- Active users per day, week and month (from `last_seen_at`).
- How many users use each language.

### Health
- For prod and staging:
  - result of `/api/health`
  - the deployed commit SHA
  - backend uptime
- **DB:** size, row counts of the main tables, and migration version.
- **Backups:** time of the last nightly backup, and the last restore-test result.
  - The backup scripts write one row into a small `ops_events` table (or the admin API reads the time of the newest file in B2).
- **External tools:** links to Sentry, UptimeRobot, Cloudflare, Netcup, GitHub Actions and Healthchecks.io.
  - Later, we can show the UptimeRobot status on the page through its read-only API key.
- **Not included now:** CPU, RAM and disk graphs. They need a metrics agent (Grafana Cloud + node_exporter is already a "stretch task" in `.dev-context/deployment-strategy.md`). The Netcup panel shows them now.

### Staff and audit
- **Staff page** (owner only): create staff, change role, disable.
- **Audit log page:** filter by staff member, action and date.

---

## 4. Data we must start to collect

Old users have no values for these fields until they log in again. Start this slice early.

- `users.last_login_at`, `users.last_login_country`: written by the password login and the Google login.
- `users.last_seen_at`: written by `protect`, **at most once per hour** for each user, so it does not add a DB write to every request.
- `login_events` table: user_id, created_at, method (password or google), country.
  - It gives the login history.
  - Keep 90 days; the nightly job deletes older rows.
- **Location:** Cloudflare adds the `CF-IPCountry` header to each request for free. We store **only the country code, not the IP address.**
  - A country code is enough for support.
  - It is much less sensitive under GDPR.
  - We must still add one line to `landing/privacy.html`.
  - In local dev, the header is not there, so the value is NULL.
- `users.banned_at`, `users.ban_reason`, `users.token_version`, `users.deleted_at`, `users.deleted_by_staff_id`.

**Related gap:** users cannot delete their own account now. Under GDPR, users usually must be able to do this. We can do this in a separate slice later. The delete logic can be shared with the admin delete.

---

## 5. Slices (one at a time, each ends with something you can run)

| # | Slice | Ends with |
|---|---|---|
| 1 | **Data capture.** Migration for the new `users` columns and `login_events`. Write them on login and in `protect`. Enforce `banned_at`, `deleted_at` and `token_version`. | Jest tests. You can see the values in `psql`. |
| 2 | **Staff auth.** Migration for `staff_accounts` and `audit_log`. The `create-staff` script. `POST /api/admin/auth/login`. The `requireStaff(permission)` middleware and the role map. | Jest tests. You can log in with curl. |
| 3 | **Admin UI skeleton.** New `admin/` workspace (Vite, React, TanStack Router and Query, shadcn, Tailwind). Login page, layout, and a Vite dev proxy to `:5001`. | You run it locally and log in. |
| 4 | **Users list and detail** (read-only). `GET /api/admin/users` (paginated) and `GET /api/admin/users/:id`, with counts. | Playwright spec: log in, search, open a user. |
| 5 | **Actions.** Ban, unban, force logout, soft delete, restore and purge now, all with the audit log. Add the `purge.js` script and its Ansible cron job. | Playwright spec: ban a user, then that user's session fails. Soft-delete the user, then restore it. Jest test: `purge.js` removes only accounts older than 30 days. |
| 6 | **Health page.** `GET /api/admin/health` (DB, SHA, uptime, DB size, row counts, last backup), plus the external links. | Playwright spec. |
| 7 | **Deploy.** Explained step by step, like the deployment work: `admin` Dockerfile, a new service in `app.yml`, a Caddy host block, and a build and deploy job in `deploy.yml`. Terraform adds the DNS records and the **Cloudflare Access** application. | You open `admin.` in prod through Cloudflare Access. |
| 8 | **Staff management and audit log viewer.** | Playwright spec. |
| 9 | **Overview statistics.** Signups, active users, languages. | Playwright spec. |

**Files that change:**
- `backend/src/db/schema.ts` and new migrations in `backend/src/db/migrations/`
- `backend/middleware/authMiddleware.ts`
- `backend/controllers/userController.ts` and `oauthController.ts` (for the login capture)
- `backend/app.js` (mount `/api/admin`)
- new: `backend/routes/admin/*`, `backend/controllers/admin/*`, `backend/middleware/staffAuth.ts`, `backend/scripts/create-staff.ts`, `backend/scripts/purge.js`
- new workspace `admin/`, added to the root `package.json` workspaces
- `deploy/compose/app.yml`, `deploy/caddy/Caddyfile`, `deploy/terraform/dns.tf` and a new `access.tf`, `.github/workflows/deploy.yml`, an Ansible role or task for the purge cron job
- docs: a new `.context/` spec file, `.dev-context/infrastructure-guide/` updates, `landing/privacy.html`

**Code to reuse:**
- the `protect` pattern (`authMiddleware.ts`) and `generateToken` (`userController.ts:111`)
- the Drizzle `db` (`backend/src/db/index.ts`)
- the frontend axios client pattern (`frontend/src/api/client.ts`)
- the shadcn components (`frontend/src/components/ui/`)
- the Playwright setup in `e2e/`
- the Ansible `backup` role, as the model for the purge cron job

## Verification (for each slice)
- Backend: Jest tests for each new route. Include the permission cases: `viewer` cannot ban, and a user token is rejected on `/api/admin/*`.
- `npm run test:e2e` is green, with one admin spec per slice.
- After slice 7: confirm that `admin.` without a Cloudflare Access login shows the Access page, and that the admin API rejects requests without a staff token.
