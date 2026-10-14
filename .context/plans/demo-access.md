# Plan: Account-less demo access (ephemeral "demo" accounts)

Status: **draft, planned on 2026-10-14.** No code written yet. Decisions D1–D9 below are confirmed with the user; the two items at the end are non-blocking, to finalize during implementation.

## What this is (plain-language overview)

A "Try the demo" button on the landing page lets a visitor open the app **without signing up**. Clicking it creates a **throwaway account** that is pre-loaded with a representative slice of data (words, tags, saved practice configs, an in-progress session), so the visitor can navigate and use every current feature for a few minutes. When the time is up, the visitor is logged out and every change they made is deleted. Many visitors can do this at once, each in their own isolated sandbox.

Technically it is **not** account-less: it is an anonymous, ephemeral `users` row. The domain model already keys every datum off `userId` with `ON DELETE CASCADE`, and the codebase already has the two primitives this feature needs — a per-request token check in `protect` (ban/delete/`token_version`) and a nightly purge job (`scripts/purge.js`). So a demo session is a normal user row plus an `is_demo` flag and a `demo_expires_at` timestamp, wiped by the purge job.

## Goal

The owner can, from the admin panel, turn the demo **on or off** and tune **three caps** — session length, maximum words, maximum tags — with sensible defaults (15 minutes, 30 words, 5 tags), no deploy. A visitor on the landing page starts a pre-loaded demo in one click, uses every implemented feature, and is logged out when it expires with all their changes discarded. This scales to many simultaneous visitors because each gets a fresh clone of a template dataset.

## Decisions (made with the user on 2026-10-14)

| Topic | Decision |
|---|---|
| D1. What happens on expiry | **Throw away.** The demo user is deleted (cascade) and nothing is kept or migrated. No "sign up and keep your data" in this version; the design leaves room to add it later, but it is not built now. |
| D2. Where the gate lives | A **dedicated demo gate** in the admin panel, independent of the registration and login gates. On/off plus the three caps, all on the existing single-row `access_settings` table, managed with the existing `access.manage` permission (owner). **Off by default** — a deploy changes nothing until the owner turns it on. |
| D3. Caps | Duration, words, tags are all configurable in the admin panel with **defaults**: 15 minutes, 30 words, 5 tags. Words and tags are **limits on what the visitor creates on top of the seed** — the pre-loaded data does not count toward them. Enforced server-side. |
| D4. What is off-limits | **For now, nothing** — every implemented feature (words, tags, review, practice, saved configs/sessions, dashboard) is fully available for the demo duration. When later features land, these become off-limits (or heavily limited) for demo users: friendships, send/receive invitations for non-public tags, and any feature that uses a non-free external resource (e.g. LLM content generation). The plan records where those guards will go, but writes no code for them now. |
| D5. Seed data | **Placeholder now.** A small hand-written set so the feature can be exercised end-to-end. The user will author a comprehensive set later; the mechanism (template + clone, Slice 2) is content-agnostic so richer data is a data change, not a code change. |
| D6. Remaining-time UI | The visitor sees a **countdown clock on the Account page** (`/user`), alongside counters for **words left** and **tags left**. A **small indicator in the app header** (mobile and desktop) shows the demo state and remaining time. Exact layout/placement is defined during implementation. |
| D7. When caps are captured | The **duration and word/tag caps are captured at session start** and frozen on the demo's user row at bootstrap (`demo_expires_at`, `demo_word_limit`, `demo_tag_limit`). An admin change affects demos started afterward, not running ones — a running demo stays stable, and its limits stay bounded either way. |
| D8. Audit action | A single `access.demo_configure` audit row per Save, with old → new values for all four fields in its metadata (no separate enable/disable/limits actions). |
| D9. Tags-left counter source | Add `totalTags` to `calculateBasicUserMetrics` / `GET /api/users/getUserMetrics` (it currently returns `totalWords` only). The Account page computes words/tags left from these totals against the frozen limits. |

## Design

### Data (migration — `users` columns + `access_settings` columns)

`users` gains four columns:

- `is_demo boolean NOT NULL DEFAULT false` — true for every demo account.
- `demo_expires_at timestamp` — `NULL` for normal users and for the template (below); the expiry instant for a live demo session.
- `demo_word_limit integer` — `NULL` for normal users; for a demo session, the **absolute** word cap (`seed words + configured max`), frozen at bootstrap (D7).
- `demo_tag_limit integer` — the same, for tags.

Semantics (one flag + one timestamp covers all three cases):

| `is_demo` | `demo_expires_at` | Meaning |
|---|---|---|
| `false` | `NULL` | normal account |
| `true` | `NULL` | the **template** user (clone source; never logs in, never expires, never purged) |
| `true` | set | a live **demo session** (rejected by `protect` after this instant, purged after it) |

`access_settings` (still one row, `id = 1`) gains four columns:

- `demo_enabled boolean NOT NULL DEFAULT false` — the gate (off by default, D2).
- `demo_duration_minutes integer NOT NULL DEFAULT 15`.
- `demo_max_words integer NOT NULL DEFAULT 30`.
- `demo_max_tags integer NOT NULL DEFAULT 5`.

Validation happens in the controller (and, optionally, a `CHECK` like the existing mode checks): duration ≥ 1, words/tags ≥ 0. **No cache**: the demo endpoint and the cap checks read the row on each request, exactly like the registration/login gates, so a change takes effect at once.

### Public status endpoint (Slice 0)

`GET /api/demo/status` (no login): `{ enabled: boolean }`. The landing page and the app's `/demo` page read it to show or hide the button, and to show a clear "the demo is off" message. If it fails, the caller acts as if the demo is off (the server enforces anyway).

### Demo bootstrap endpoint (Slice 1)

`POST /api/demo` (public, **rate-limited**):

1. Read `access_settings` (one primary-key read). If `demo_enabled` is false → 403 `{ code: "demo_disabled" }`.
2. Create a demo user in one transaction:
   - synthetic unique `name`, `username` (`demo-<uuid>`), `email` (`demo+<uuid>@ladu.invalid`); `password` stays `NULL` (demo never logs in with a password);
   - `languages = ['English', 'Spanish', 'German', 'Estonian']`, `nativeLanguage = 'English'` (so practice works out of the box); `uiLanguage` follows the request (or default);
   - `verified = true` (a demo is not a trust boundary; no email verification);
   - `termsAcceptedAt` / `termsVersion` written server-side, same as `registerUser`;
   - `isDemo = true`, `demoExpiresAt = now + demo_duration_minutes`;
   - `demoWordLimit = seedWordCount + demo_max_words`, `demoTagLimit = seedTagCount + demo_max_tags` (frozen here, D7).
3. Seed data (placeholder inline in Slice 1; cloned from the template in Slice 2 — see below).
4. Return `serializeLoginUser(user)` **plus** `isDemo: true`, `demoExpiresAt`, `demoWordLimit`, `demoTagLimit` (the frontend shows the remaining time and the limits).

**Rate limiting.** Anonymous visitors can mint demo accounts, so this endpoint is the one place the feature can hurt production. Reuse the throttling pattern already used by the public password-reset request (`admin-user-emails.md`): per-IP, short window, plus a cap on concurrent live demo accounts per IP. This is not optional.

### Expiry (Slice 1) — enforced at the server, not just by the token

`protect` (`backend/middleware/authMiddleware.ts`) already reloads the user and rejects deleted/banned/stale-`tv` tokens with 401. Add:

- select `isDemo` and `demoExpiresAt` in `userColumnsWithoutPassword`;
- after the existing checks, reject with 401 when `user.isDemo && user.demoExpiresAt && user.demoExpiresAt <= now`.

The demo JWT stays a normal 30-day token (reuses `generateToken` unchanged); the row's `demo_expires_at` is the single source of truth. This means a replay or a clock-sync problem cannot extend a session: the expiry is fixed at bootstrap, and `protect` rejects the session at the next request once it passes. Changing the duration affects demos started afterward (D7). The frontend also reads `demoExpiresAt` to show a countdown and log out proactively.

For the same reason, `protect` **skips** the `last_seen_at` and `user_activity_days` writes for demo users: demo activity must not inflate the admin "active users" statistics, and the rows would be cascade-deleted on purge anyway.

### Caps enforcement (Slice 2)

Because the caps are "on top of the seed" (D3), the demo user's **absolute** limits are stored on its row at bootstrap (`demo_word_limit = seed words + max`, `demo_tag_limit = seed tags + max`, D7). Enforcement is then a pure count against a fixed number, with no per-request settings read and no need to distinguish seed rows from user-created rows:

- word create (`POST /api/words`, the route the Add-word form uses): if `req.user.isDemo`, `COUNT(words WHERE user_id) >= req.user.demoWordLimit` → `403 { code: "demo_word_limit" }`;
- tag create (`POST /api/tags`): the same against `demoTagLimit` → `403 { code: "demo_tag_limit" }`.

The check is one `COUNT(*)` on a small, per-user table — negligible. The seed is authored to leave room under the caps (the template uses fewer words/tags than the defaults), so a visitor always has headroom to add their own.

### Seed data: template user + clone (Slice 2)

A **template** user holds the curated dataset and is cloned per demo session. It is the content-agnostic piece that makes "a comprehensive set later" a data change only.

- `backend/scripts/seed-demo-template.ts` (idempotent, safe to re-run; `--reset` first deletes the template): creates the template user (`is_demo = true`, `demo_expires_at = NULL`, username `__demo_template__`) and inserts a **placeholder** set through the same service functions the app uses, so it is guaranteed valid against the current form/validation rules:
  - ~5 tags (one per part of speech, plus a "useful phrases" tag), private;
  - ~12–20 words across Noun/Verb/Adjective/Adverb, each with ≥2 full translations + grammatical cases, assigned to the tags;
  - a saved `practice_config` ("Jump in — mixed practice") and an in-progress `practice_session` so the visitor can resume one immediately;
  - seeded `exercise_performances` + `exercise_performance_cases` so the review table and mastery indicators show life (mixed mastery, last-4-attempts history).
- `POST /api/demo` then, instead of inline seeding, **clones the template** in the same transaction: `INSERT … SELECT` per table in dependency order (words → translations → translation_cases; tags → tag_words; exercise_performances → exercise_performance_cases; practice_configs; practice_sessions), re-pointing `user_id` to the new demo user and generating fresh UUIDs (`gen_random_uuid()`), correlating parent→child with a per-table `(old_id → new_id)` map captured via `RETURNING`. No id remapping leaks to the client; each demo is fully independent.

The template and all demo sessions are hidden from user-facing and staff-facing listings:

- `GET /api/users/searchUser` (future friend search) excludes `is_demo = true`;
- the admin users list and the stats endpoints (`statsController`: totals, signups, active users, languages) exclude `is_demo = true`;
- the nightly purge only ever deletes `is_demo = true AND demo_expires_at IS NOT NULL AND demo_expires_at < now`, so the template (NULL expiry) survives.

### Cleanup (Slice 2)

The nightly purge (`lib/userPurge.ts` → `scripts/purge.js`) gains a demo branch: `DELETE FROM users WHERE is_demo AND demo_expires_at < now`. The existing `ON DELETE CASCADE` removes words, translations, cases, tags, performances, configs, sessions, notifications, OAuth links, login history. **No audit row per demo** (the audit log is for admin accountability, not ephemeral-account lifecycle) — the job logs a count only, and returns it in `runPurge`'s result. The server-side `protect` check is the security boundary; the purge is only garbage collection for sessions abandoned mid-way.

### Admin API and UI (Slice 0)

Reuses the access-gates machinery (`backend/controllers/admin/accessController.ts`, `backend/routes/admin/accessRoutes.js`, permission `access.manage`):

- `GET /api/admin/access` already returns the settings; extend it with the four demo fields.
- `PUT /api/admin/access/demo` (`{ enabled, durationMinutes, maxWords, maxTags, reason? }`) — one action, one audit row `access.demo_configure` (D8, metadata: old + new values).

Admin UI: `/access` (`admin/src/features/access/`) gains a third tab `?tab=demo` (extend `AccessSearch.tab` from `'registration' | 'login'` to include `'demo'`, and `validateAccessSearch`). The tab has an **Enable demo** switch and three number inputs (duration minutes, max words, max tags), a Save with confirm, and a note that the demo is independent of the registration/login gates. A warning when enabled and any cap is zero ("the visitor can see nothing / do nothing").

### Learner app (`frontend/`)

- `AuthUser` (`frontend/src/features/auth/types.ts`) and the session store (`frontend/src/stores/authStore.ts`, `RawUser`) gain `isDemo?`, `demoExpiresAt?`, `demoWordLimit?`, `demoTagLimit?`. `serializeLoginUser` and `serializeUser` (`backend/controllers/userController.ts`) add the four fields; `protect` already exposes them via `req.user`, so `GET /me` returns them too.
- New `frontend/src/features/demo/`: a `/demo` route (added to `frontend/src/app/router.tsx`) that calls `POST /api/demo`, sets the session through the same store flow the login mutation uses, and navigates into the app; on `demo_disabled` it shows a message and a link to sign up. A `useStartDemo` mutation mirrors the login mutation in `features/auth/api.ts` / `hooks.ts`.
- Demo affordances, shown only when `user.isDemo`:
  - a **small header indicator** (mobile and desktop) with the demo state and remaining time;
  - on the **Account page** (`frontend/src/features/account/pages/AccountPage.tsx`, route `/user`), a **countdown clock** plus counters for **words left** (`demoWordLimit − totalWords`) and **tags left** (`demoTagLimit − totalTags`); both totals come from `getUserMetrics` (add `totalTags`, D9);
  - a gentle countdown that logs out at zero; the existing 401 interceptor is the backstop for a server-side expiry.
- Translated strings in `frontend/public/locales/{en,es,de,ee}/*.json` for the badge and the "the demo is off" message (draft English; the user reviews the other languages once the feature is live — see "Details to finalize").

### Landing page

`landing/index.html` (the `.actions` block next to the "Open" button) gains a "Try the demo" button that deep-links to `https://app.ladu.com.ar/demo`. `landing/app.js` and the landing locale strings get the label. The button reads `GET /api/demo/status` and hides or disables itself when the demo is off (fail-closed if the call fails). Token handling stays on the app origin — no token in the landing page or in a URL.

## Slices (one at a time; each ends with something runnable)

| # | Slice | Ends with |
|---|---|---|
| 0 | **Admin settings + gate.** Migration (`users.is_demo`, `users.demo_expires_at`, four `access_settings` columns). Admin API read/write for the demo settings + audit. Admin `/access?tab=demo` tab. Public `GET /api/demo/status`. | Jest + Vitest; Playwright `admin-14-demo-gate.spec.ts` (owner flips the gate and tunes caps; the public status endpoint reflects it). |
| 1 | **Bootstrap + session + expiry, end-to-end with inline placeholder seed.** `POST /api/demo` (rate-limited) with a tiny inline seed (1–2 tags, a few words, a saved config). `protect` expiry check. `serializeLoginUser`/`serializeUser` + `AuthUser`/`RawUser` carry `isDemo`/`demoExpiresAt`. `/demo` route + `useStartDemo` + demo badge/countdown. Landing button. | Jest + Vitest; Playwright `demo-access.spec.ts` (landing → demo → see seed data → add a word → force expiry → 401 → login page). |
| 2 | **Template + clone + caps + purge.** `scripts/seed-demo-template.ts`; `POST /api/demo` clones the template instead of inline seeding. Word/tag cap enforcement. Purge deletes expired demo users. Exclude demo users from admin users list and stats. | Jest + Vitest; Playwright extends `demo-access.spec.ts` (rich seed shows up; exceeding the word/tag cap is refused; the purge test removes an expired demo). |

Slice 0 is independent and read-only; Slice 1 is the thin vertical slice that proves the whole loop; Slice 2 hardens and scales it.

## Files that change (summary)

- **Backend:** `backend/src/db/schema.ts` + a migration; `backend/middleware/authMiddleware.ts`; `backend/controllers/userController.ts` and `backend/controllers/metricController.ts` (add `totalTags`); new `backend/controllers/demoController.ts` and `backend/routes/demoRoutes.js` (mounted in `backend/app.js` as `/api/demo`); `backend/controllers/admin/accessController.ts` + `backend/routes/admin/accessRoutes.js`; `backend/lib/userPurge.ts`; `backend/scripts/purge.js`; new `backend/scripts/seed-demo-template.ts`; the word- and tag-create controllers for the caps; tests.
- **Admin:** `admin/src/features/access/` (`AccessPage.tsx`, `search.ts`, `api.ts`, `hooks.ts`, `types.ts`) + tests.
- **Learner app:** `frontend/src/features/demo/` (new); `frontend/src/stores/authStore.ts`; `frontend/src/features/auth/types.ts` (+ `api.ts`/`hooks.ts` if the login mutation is the mirror); `frontend/src/app/router.tsx`; `frontend/src/components/layout/AppShell.tsx` / `AppHeader.tsx`; the 4 locale JSONs; tests.
- **Landing:** `landing/index.html`, `landing/app.js`, landing locale strings.
- **e2e:** `e2e/tests/admin-14-demo-gate.spec.ts` (named `-gate`: it changes global access state and must run last, like the other gate specs), `e2e/tests/demo-access.spec.ts`, and seed helpers in `e2e/fixtures/db.ts`.
- **Docs:** this plan's status notes; `landing/privacy.html` **only if** a new fact about visitors is stored — demo accounts are synthetic and are deleted, so likely no change (confirm with the user).

## Risks and how the plan answers them

- **Abuse / resource exhaustion.** Anonymous free accounts are a bot vector. Rate-limit + per-IP concurrency cap on `POST /api/demo`, and hard caps on words/tags. The 15-minute default and the nightly purge bound storage.
- **A replay or clock skew extending a session.** `demo_expires_at` is checked server-side on every request, not just in the token.
- **Demo data leaking into the real product.** Demo users are excluded from `searchUser`, admin user list and stats, and cannot publish public tags (guard added in Slice 2 alongside the caps; the future social guards reuse the same `is_demo` check).
- **Demo activity inflating admin metrics.** `protect` skips `last_seen_at` / `user_activity_days` for demo users; demo never writes `login_events` (it bypasses login).
- **Seed data drifting from the form rules.** The template is inserted through the same service functions the app uses, and re-cloned per session — a broken template fails loudly in the e2e gate, not in production.
- **Lockout / gate misconfiguration.** The demo gate is independent of the registration/login gates; a cap of 0 is warned about in the admin page.

## Details to finalize during implementation (non-blocking)

1. **Placement of the demo entry and the header indicator.** The "Try the demo" link on login/registration and the header indicator have mobile-vs-desktop placement differences to settle during implementation (D6).
2. **Wording.** Draft the demo badge, countdown and "the demo is off" strings in English; the user reviews the ES/DE/EE translations once the feature is live.
