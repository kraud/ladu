# Admin dashboard ("Ladu Admin")

Live spec. It replaces three finished plans (archive records: `.context/archive/2026-10-admin-dashboard.md`, `2026-10-admin-user-emails.md`, `2026-10-verified-badges.md`). Built 2026-09-30 to 2026-10-07. All parts are merged (PRs #56, #59, #60, #61, #62, #66, #67, #74) and rolled out. Operations (hosts, Access, secrets, cron): `.context/guides/infrastructure-guide/`.

Code map: API `backend/controllers/admin/`, `backend/routes/admin/`; helpers `backend/lib/{adminPermissions,staffAccounts,accountAccess,accountEmails,userPurge,badges,reservedNames,adminLinks}.ts`; middleware `backend/middleware/staffAuth.ts`; scripts `backend/scripts/{create-staff,purge}.js`; UI `admin/` (own workspace, Vite, port 5174, `npm run dev:admin`); migrations `0010` to `0015` and `0020`.

## 1. Decisions (all taken with the user)

| ID | Decision | Rejected alternative |
|---|---|---|
| A-1 | The admin API is in the existing backend under `/api/admin/*`. One place for the ban and delete rules. | A second backend (two copies of the schema and rules). |
| A-2 | The admin UI is a separate workspace `admin/`, served at `admin.` (prod data) and `admin-staging.` (staging data). Cloudflare Access protects the hosts. One subdomain level, because the free certificate covers `*.ladu.com.ar` only. | A route inside the app (one wrong guard exposes it); a manual static deploy (UI and API drift); a ready-made tool (needs production DB credentials outside). |
| A-3 | Separate staff accounts, not a role on learner accounts. Own secret `ADMIN_JWT_SECRET`, claim `aud: "admin"`, session 8 hours. | A role on `users`. |
| A-4 | Login location is the country only, from the `CF-IPCountry` header. No IP address is stored. | Storing the IP. |
| A-5 | Delete is soft with a 30-day grace, then a nightly purge. Email and username stay reserved in the grace period. | Hard delete at once. |
| A-6 | Split by host. On `app.` and `staging.`, Caddy answers 404 for `/api/admin/*`. On the admin hosts, Caddy sends only `/api/admin/*` to the backend, and any other `/api/*` is 404. | `/api/*` on both hosts. |
| A-7 | "Purge now" works only on an account that is already soft-deleted (two steps, two audit rows). | One-step purge. |
| A-8 | Backups are shown on the health page through a table `ops_events`. The backup scripts write one row per run. | Reading file times from B2. |
| A-9 | Links on the health page are the GitHub Environment secret `ADMIN_LINKS` (one JSON line, https only, all or nothing). The generic `FALLBACK_LINKS` apply when it is missing. The repo is public. | A database table with an edit screen. |
| A-10 | A new staff member gets a temporary password that an owner types or generates. Until the person sets their own, every admin route except `GET /auth/me` and `POST /auth/change-password` answers 403 `password_change_required`. | Invite by email. |
| A-11 | Active users come from a new table `user_activity_days` (one row per user per UTC day). `last_seen_at` cannot answer "who was active on day X". | Reading `last_seen_at`. |
| A-12 | Admin charts are plain HTML and CSS, no chart library. | A chart library. |
| A-13 | Email actions use a new permission `users.email`. Cooldown 5 minutes per user and email type, checked in `audit_log`. | Reusing `users.ban`. |
| B-1 | The badge is on the account, not on the tag. Many types, first type `official`. `type` is `varchar(32)`, no enum. | An enum; a badge on the tag. |
| B-2 | Only the owner grants badges (`badge.manage`). No public endpoint writes a badge. A revoke sets `revoked_at` and keeps the row. | Self-service requests (later). |
| B-3 | The badge is read from the DB on each request, not from the JWT. A revoke acts at once. A clone does not inherit a badge. | Badge in the token. |
| B-4 | Reserved names: normalize, then refuse a name that contains `ladu` or `official`, or equals `admin`, `staff`, `support`, `moderator` or `team`. An account with an active `official` badge is exempt. A name is checked only when it changes. | A full Unicode confusables list. |
| B-5 | The filter on `/tags` is the "Verified" checkbox. It sends `?badge=official`. | An "Author: Anyone / Official" select (the first build). |

## 2. Invariants

- A learner token never opens an admin route. `requireStaff(permission)` checks the token, loads the staff account, and checks the permission. Staff tokens carry `tv` (`staff_accounts.token_version`). A password change, reset or disable raises it.
- Every admin action runs in one transaction: lock the row (`FOR UPDATE`), check the state (409 if not allowed), change it, write the audit row. An email is sent after the commit, never before.
- Every admin action writes an `audit_log` row. A password, hash, token or link is never written to it. `audit_log.staff_id` is NULL for the system (the nightly job). The row keeps the email and username, because the user row can be gone.
- A banned user gets 403 at password login and 401 from `protect`. A deleted user gets "Invalid credentials" and 401. A Google login of a banned user redirects with `oauth_account_banned`. A deleted one keeps the generic `oauth_failed`.
- Restore does not bump `token_version`, so old sessions work again. A restored account that was banned stays banned.
- Staff rules: you cannot change your own role, disable yourself or reset your own password. The last active owner cannot be demoted or disabled. Every action that can remove an owner first locks all active owner rows in a fixed order. Passwords are 12 to 72 bytes.
- Reason is required for ban, delete, purge, staff disable and badge grant or revoke. It is optional for the others. The typed username is checked on the server too.
- `users.verified` means "email verified". The badge feature never uses the word "verified" in code or fields. The learner UI shows the word "Verified" only in the `/tags` checkbox.
- Statistics use UTC days. A week starts on Monday. "Users" means accounts that are not deleted. An account that was purged disappears from past counts (the page says so).
- Retention: `login_events` 90 days, `user_activity_days` 400 days. The nightly purge (cron 03:30 UTC, after the 03:00 backup) deletes both. `landing/privacy.html` says so.

## 3. Roles

| Role | Permissions |
|---|---|
| `owner` | all: `staff.manage`, `access.manage`, `users.purge`, `badge.manage`, and the rest |
| `admin` | `users.read`, `users.ban`, `users.delete`, `users.email`, `health.read`, `audit.read` |
| `support` | `users.read`, `users.ban`, `users.email`, `health.read` |
| `viewer` | `users.read`, `health.read` |

The map is in code (`lib/adminPermissions.ts`). A new permission goes in `PERMISSIONS`; the owner gets it by `[...PERMISSIONS]`. Mirror it in `admin/src/test/msw/handlers.ts` (`PERMISSIONS_BY_ROLE`).

## 4. Data

- `users`: `banned_at`, `ban_reason`, `token_version`, `deleted_at`, `deleted_by_staff_id`, `last_login_at`, `last_login_country`, `last_seen_at` (written by `protect`, at most once per hour).
- `login_events`: user, time, method (password or google), country.
- `user_activity_days`: one row per user per UTC day, written by `protect` at the first request of the day (`ON CONFLICT DO NOTHING`). History starts at deploy day, so windows that include the first day are `partial` and days before it have `count: null`.
- `staff_accounts`: `role`, `disabled_at`, `must_change_password`, `password_changed_at`, `token_version`. `audit_log`. `ops_events` (one row per backup or restore-test run).
- `user_badges`: `id`, `user_id` (cascade), `type`, `granted_at`, `revoked_at`, `granted_by` (staff, restrict). Partial unique index `(user_id, type) WHERE revoked_at IS NULL`. No extra index for the tag filter (checked with `EXPLAIN` on 60,000 tags). Look again at thousands of badge rows.

## 5. API

All under `/api/admin`, `requireStaff`. Auth: `POST /auth/login`, `GET /auth/me` (returns `permissions`, `environment`), `POST /auth/change-password`.

| Route | Permission |
|---|---|
| `GET /users` (search, `verified`, `status`, `method`, sort, pages, `pageSize` up to 100), `GET /users/:id` (`audit: null` without `audit.read`; `badges` for every role with `users.read`) | `users.read` |
| `POST /users/:id/{ban,unban,force-logout}` | `users.ban` |
| `POST /users/:id/{delete,restore}` | `users.delete` |
| `POST /users/:id/purge` | `users.purge` |
| `POST /users/:id/{resend-verification,send-password-reset}` | `users.email` |
| `POST /users/:id/badges` (`{type, reason}`), `POST /users/:id/badges/:type/revoke` (`{reason}`) | `badge.manage` |
| `GET /health` | `health.read` |
| `GET /stats` | `users.read` |
| `GET /audit`, `GET /audit/filters` | `audit.read` |
| staff: list, create, `role`, `disable`, `enable`, `reset-password` | `staff.manage` |

Details that code does not show at a glance:
- Health: the API answers 200 even if the DB is down (`database: "error"`, blocks null). "Overdue" shows when the last backup is older than 26 hours or the last restore test older than 8 days.
- Stats: signups for 30 days and 12 weeks (zero-filled in SQL), active users per day with rolling 7 and 30-day windows, users per language, saved sessions not expired, practised translations.
- Email actions: eligible account only. Verification: not verified and not deleted; reuse the existing `tokens` row, never rotate. Reset: has a password and not deleted (a Google-only account gets no button); a new `password_reset_tokens` row each time. Language is the user's `uiLanguage`. Second try inside 5 minutes: 429. The UI says "handed to the mail service", never "delivered" (`sendMail` never rejects, so delivery is unknown). Audit actions `user.resend_verification`, `user.send_password_reset`.
- The public `requestPasswordReset` answers 200 with the same message for an unknown, a throttled and a sent request. One email per account every 5 minutes (row lock). Code `backend/lib/accountEmails.ts` serves both flows.
- Badges: `TagSummary.author.badges` is `string[]` (active types, sorted). Banned and deleted authors show none and do not match the filter. `GET /api/tags?badge=` accepts a known type only; an empty value, other case, repeated value or unknown type gives 400. The condition is applied before `total`. The learner UI shows a seal (`VerifiedMark`) after the tag label on a Public tag of a badged author, and after "by <author>" on `/tag/:id`. It drops unknown types.
- Reserved names: normalize (NFKC, lowercase, remove accents, fold look-alike letters and digits, keep `a-z` only; `i`, `l`, `1`, `!`, `|` fold to one letter on both sides). Codes: `username_reserved`, `name_reserved`, `google_name_reserved`. Runs in `registerUser`, `signupComplete` (after the access gate) and `updateUser`. `updateUser` also trims the username and checks it case-insensitively.

## 6. Known defects and limits

- **Data leak (Major, older than the admin work).** `backend/middleware/errorMiddleware.js` returns `err.message` for every 500. A database error carries the SQL text and its parameters. Seen in a registration race: the answer held the password hash of the account being registered. Also, registration checks "email in use" and then inserts, so two requests at the same moment give a 500 and not the normal 400. Not fixed.
- Access is checked at Cloudflare, not at the VPS. Traffic with the host name `admin.` through another Cloudflare account would skip Access, and the staff login is then the only lock. Possible fix: check `Cf-Access-Jwt-Assertion` in Caddy or the backend.
- No rate limit on staff login or on the password-change check. No "sign out everywhere" button for staff.
- A failed purge job has no alert (the log file only). A Healthchecks.io ping is a possible step.
- The reserved-name table is small. Only the exact words are refused (`Admin1` is allowed). `ladu` is also an Estonian word, so a real name that contains it is refused (the owner can grant `official` first). Existing accounts are not scanned.
- In a Drizzle SELECT list, `${users.id}` inside a raw `sql` subquery loses its table name. Write `"users"."id"`.
- e2e: the OAuth specs need the backend that Playwright starts. They fail when `npm run dev` already runs a backend on `:5001`. Several specs build ids from `Date.now()` and can clash on four workers (`oauth-1-schema-guard` was fixed with a random id; `admin-6-health`, `oauth-2` to `oauth-5`, `phase-1-auth`, `phase-2-noun-crud`, `phase-3-5-dashboard`, `phase-3-9-theme` were not checked).

## 7. Open items

1. Users cannot delete their own account (GDPR). The delete logic can be shared with the admin delete. Own slice.
2. Review of the ES, DE and EE texts for the badge copy, the "Verified" checkbox, the empty state and the three reserved-name messages. The first translations are the assistant's.
3. A second badge type needs a backend value that means "any badge" (or a select again), a locale string and an icon. No migration.
4. Later, not planned: popularity counts (follows and copies), self-service badge requests, badges on other content, showing the UptimeRobot status on the health page.
5. Impersonation ("log in as the user") is out of scope on purpose.
