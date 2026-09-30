# Plan: Ladu admin dashboard ("Ladu Admin")

Status: approved on 2026-09-30. Slices 1 (data capture) and 2 (staff auth) are done. Slices 3–9 are not started.

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
- Slice 1 leftover: `landing/privacy.html` still needs the line about the login country. Do this before slice 7 (deploy).

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
