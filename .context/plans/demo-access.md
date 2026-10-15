# Plan: Account-less demo access (ephemeral "demo" accounts)

Status: **draft, planned on 2026-10-14, reviewed against the code on 2026-10-14.** **Slice 0 done on 2026-10-15** (branch `demo-setup`): migrations 0027 + 0028, the admin API, the admin Demo tab and `GET /api/access` `demo.enabled`; Jest, Vitest and the full Playwright run (141 passed, with `admin-14-demo-gate.spec.ts`) are green. **Slice 1 done on 2026-10-15** (same branch): `POST /api/demo`, the session and expiry in `protect`, the account restrictions, `/demo`, `/demo/ended`, the header countdown, the Account page for a demo, and the landing link; `demo-access-gate.spec.ts` is green (see "Slice 1 — what was built"). **Slice 2 done on 2026-10-15** (same branch): the template and its copy, the word/tag caps, the tag and social restrictions, the purge, the exclusions and the counters (see "Slice 2 — what was built"). The demo feature is complete; the template content is still the placeholder (D5). Decisions D1–D15 below are confirmed with the user (D15 added on 2026-10-15). The items at the end are non-blocking, to finalize during implementation. The review findings and how each one was resolved are in "Review log (2026-10-14)" at the end.

## What this is (plain-language overview)

A "Try the demo" button on the landing page lets a visitor open the app **without signing up**. The button opens a short start screen in the app. When the visitor clicks "Start the demo", the server creates a **throwaway account** that is pre-loaded with a representative slice of data (words, tags, practice progress, a saved practice config). The visitor can navigate and use the solo features for a few minutes. When the time is up, the visitor sees a "The demo has ended" page, and every change they made is deleted. Many visitors can do this at once, each in their own isolated sandbox.

Technically it is **not** account-less: it is an anonymous, ephemeral `users` row. The domain model already keys every datum off `userId` with `ON DELETE CASCADE`, and the codebase already has the two primitives this feature needs — a per-request token check in `protect` (ban/delete/`token_version`) and a nightly purge job (`scripts/purge.js`). So a demo session is a normal user row plus an `is_demo` flag and a `demo_expires_at` timestamp, wiped by the purge job.

## Goal

The owner can, from the admin panel, turn the demo **on or off** and tune **four caps** — session length, maximum words, maximum tags, maximum live demos — with sensible defaults (15 minutes, 30 words, 5 tags, 200 live demos), no deploy. A visitor on the landing page starts a pre-loaded demo in two clicks, uses every implemented solo feature, and is sent to a "demo ended" page when it expires, with all their changes discarded. This scales to many simultaneous visitors because each gets a fresh clone of a template dataset.

## Decisions (made with the user on 2026-10-14)

| Topic | Decision |
|---|---|
| D1. What happens on expiry | **Throw away.** The demo user is deleted (cascade) and nothing is kept or migrated. No "sign up and keep your data" in this version; the design leaves room to add it later, but it is not built now. |
| D2. Where the gate lives | A **dedicated demo gate** in the admin panel, independent of the registration and login gates. On/off plus the four caps (D3, D15), all on the existing single-row `access_settings` table, managed with the existing `access.manage` permission (owner). **Off by default** — a deploy changes nothing until the owner turns it on. |
| D3. Caps | Duration, words, tags are all configurable in the admin panel with **defaults**: 15 minutes, 30 words, 5 tags. Words and tags are **limits on what the visitor creates on top of the seed** — the pre-loaded data does not count toward them. Enforced server-side on **every** path that creates words or tags (create **and** clone, D11). |
| D4. What is off-limits | Every implemented **solo** feature (words, tags, review, practice, saved configs/sessions, dashboard) is fully available for the demo duration. **Off-limits now** (server refuses, UI hides): see D10. When later features land, these also become off-limits (or heavily limited) for demo users: friendships, send/receive invitations for non-public tags, and any feature that uses a non-free external resource (e.g. LLM content generation). |
| D5. Seed data | **Placeholder now.** A small hand-written set so the feature can be exercised end-to-end. The user will author a comprehensive set later; the mechanism (template + clone, Slice 2) is content-agnostic so richer data is a data change, not a code change. **No in-progress practice session in the seed** (its JSON snapshot holds word/translation ids and it expires after 7 days; see Review log B2). |
| D6. Remaining-time UI | The visitor sees a **countdown clock on the Account page** (`/user`), alongside counters for **words left** and **tags left**. A **small indicator in the app header** (mobile and desktop) shows the demo state and remaining time. Exact layout/placement is defined during implementation. |
| D7. When caps are captured | The **duration and word/tag caps are captured at session start** and frozen on the demo's user row at bootstrap (`demo_expires_at`, `demo_word_limit`, `demo_tag_limit`). An admin change affects demos started afterward, not running ones — a running demo stays stable, and its limits stay bounded either way. |
| D8. Audit action | A single `access.demo_configure` audit row per Save, with old → new values for all five fields in its metadata (no separate enable/disable/limits actions). |
| D9. Tags-left counter source | Add `totalTags` to `calculateBasicUserMetrics` / `GET /api/users/getUserMetrics` (it currently returns `totalWords` only). The Account page computes words/tags left from these totals against the frozen limits. |
| D10. Demo restrictions (now) | A demo user **cannot**: (a) link a Google account or change sign-in methods (`POST /api/auth/:provider/link`, `POST /api/auth/link`, `DELETE /api/auth/identities/:id`; the Sign-in methods block on `/user` is hidden); (b) give a tag any visibility other than **Private** (create, update, clone); (c) change `username` or `name`; (d) **follow** a tag (`POST /api/tags/:id/follow`). The server answers `403 { code: "demo_restricted" }`. Because demo tags are always Private, a real user can never see or follow a demo account's tags. |
| D11. Caps on clone paths | `POST /api/words/:id/clone` (+1 word) and `POST /api/tags/:id/clone` (+N words, +1 tag unless words-only) check the caps before they write. A clone that would pass a cap is refused as a whole (`demo_word_limit` / `demo_tag_limit`), never partly applied. |
| D12. `/demo` start screen | `/demo` is a page with a **Start the demo** button, not an automatic start. It shows the Terms note ("By starting the demo you accept the Terms", like registration). If a real (non-demo) session is open, it also warns "This logs you out of your account" and the button reads "Log out and start the demo". |
| D13. Expiry destination | On expiry (client countdown at zero, or a 401 for a demo session), the app clears the session and goes to a public **"The demo has ended"** page with **Sign up** and **Try again** — not to `/login`. |
| D15. Live demo cap | The global cap on **simultaneous** (live, not expired) demos is an **admin setting** (`demo_max_live`, 1–1000, default 200), not a code constant. A daily or rolling 24 h cap was considered and not chosen: one burst would block the demo for real visitors until the reset, and a count that survives the purge needs its own table. A rolling 24 h cap stays a later option if storage growth becomes a problem. The admin Demo tab shows "Running now: N of M demos". Read on each `POST /api/demo` (not frozen, unlike D7). |
| D14. Landing button | The landing "Try the demo" button is **always shown**; it makes no API call (the landing page and the API are on different origins and CORS is off). When the demo is off, `/demo` shows "The demo is off" with a link to sign up. |

## Design

### Data (migration — `users` columns + `access_settings` columns)

`users` gains four columns:

- `is_demo boolean NOT NULL DEFAULT false` — true for every demo account.
- `demo_expires_at timestamp` — `NULL` for normal users and for the template (below); the expiry instant for a live demo session.
- `demo_word_limit integer` — `NULL` for normal users; for a demo session, the **absolute** word cap (`seed words + configured max`), frozen at bootstrap (D7).
- `demo_tag_limit integer` — the same, for tags.

A partial index `users_demo_expires_idx ON users (demo_expires_at) WHERE is_demo` serves the global live-demo count and the purge.

Semantics (one flag + one timestamp covers all three cases):

| `is_demo` | `demo_expires_at` | Meaning |
|---|---|---|
| `false` | `NULL` | normal account |
| `true` | `NULL` | the **template** user (clone source; never logs in, never expires, never purged) |
| `true` | set | a live **demo session** (rejected by `protect` after this instant, purged after it) |

`access_settings` (still one row, `id = 1`) gains five columns (four in migration 0027, `demo_max_live` in 0028):

- `demo_enabled boolean NOT NULL DEFAULT false` — the gate (off by default, D2).
- `demo_duration_minutes integer NOT NULL DEFAULT 15`.
- `demo_max_words integer NOT NULL DEFAULT 30`.
- `demo_max_tags integer NOT NULL DEFAULT 5`.
- `demo_max_live integer NOT NULL DEFAULT 200` — the most live demos at one time (D15).

Validation in the controller, mirrored by `CHECK` constraints like the existing mode checks: `1 ≤ duration ≤ 1440` (one day), `0 ≤ words ≤ 500`, `0 ≤ tags ≤ 50`, `1 ≤ live ≤ 1000`. The upper bounds stop a typo (e.g. 15000 minutes) from making long-lived anonymous accounts. **No cache**: the demo endpoint reads the row on each request, exactly like the registration/login gates (`getAccessSettings` in `lib/accessGate.ts`), so a change takes effect at once.

### Public status (Slice 0) — extend `GET /api/access`

The public `GET /api/access` (`backend/controllers/accessController.ts`) already feeds the gate banners in the learner app. It gains `demo: { enabled: boolean }`. No new status endpoint. The app's `/demo` page reads it to show the start button or the "The demo is off" message. If the call fails, `/demo` acts as if the demo is off (the server enforces anyway). The landing page does **not** call it (D14).

### Demo bootstrap endpoint (Slice 1)

`POST /api/demo` (public, **rate-limited**, see below):

1. Read `access_settings` (one primary-key read). If `demo_enabled` is false → 403 `{ code: "demo_disabled" }`.
2. Check the **global live-demo cap**: `COUNT(users WHERE is_demo AND demo_expires_at > now())` ≥ `demo_max_live` (D15; `countLiveDemos` in `lib/demo.ts`) → 503 `{ code: "demo_busy" }` ("Too many demos are running. Try again in a few minutes.").
3. Create a demo user in one transaction:
   - synthetic unique `name` ("Demo"), `username` (`demo-<uuid>`), `email` (`demo+<uuid>@ladu.invalid`); `password` stays `NULL` (demo never logs in with a password);
   - `uiLanguage` from the request body (the `/demo` page sends the current i18n language as a label, like login does: `labelByI18nCode`), else `'English'`;
   - `nativeLanguage` = the language that matches `uiLanguage`; `languages` = all four, with that language first (commandment 4: no hardcoded English);
   - `verified = true` (a demo is not a trust boundary; no email verification);
   - `termsAcceptedAt` / `termsVersion` from `termsAcceptance()` (`lib/terms.ts`) — valid because `/demo` shows the Terms note before the click (D12);
   - `isDemo = true`, `demoExpiresAt = now + demo_duration_minutes`;
   - `demoWordLimit = seedWordCount + demo_max_words`, `demoTagLimit = seedTagCount + demo_max_tags` (frozen here, D7).
4. Seed data (placeholder inline in Slice 1; cloned from the template in Slice 2 — see below).
5. Return `serializeLoginUser(user)` **plus** `isDemo: true`, `demoExpiresAt`, `demoWordLimit`, `demoTagLimit` (the frontend shows the remaining time and the limits).

**Rate limiting.** Anonymous visitors can mint demo accounts, so this endpoint is the one place the feature can hurt production. The codebase has **no** per-IP limiter today (the password-reset throttle is per account, in the DB). So this plan adds two layers:

- **Per IP, in memory**: a small fixed-window limiter (a `Map` keyed by `req.ip`, or the `express-rate-limit` package with its memory store — choose during Slice 1) with `DEMO_STARTS_PER_IP` per hour (default 5) → 429 `{ code: "demo_rate_limited" }`. `req.ip` is the real client IP: the edge Caddy trusts the Cloudflare ranges (`deploy/caddy-config/trusted_proxies.caddy`) and Express has `trust proxy 1`. Memory is enough because the backend is one container; it resets on restart, which is acceptable. **IPs are never written to the DB or to logs** (the codebase stores country only), so the privacy page does not change.
- **Global, in the DB**: the live-demo count above against the admin setting `demo_max_live` (default 200, D15). It bounds load and storage even against many IPs.

The per-IP limit is a code constant in Slice 1 (not an admin setting); moving it to the admin panel is a later option.

### Expiry (Slice 1) — enforced at the server, not just by the token

`protect` (`backend/middleware/authMiddleware.ts`) already reloads the user and rejects deleted/banned/stale-`tv` tokens with 401. Add:

- select `isDemo`, `demoExpiresAt`, `demoWordLimit` and `demoTagLimit` in `userColumnsWithoutPassword` (the cap checks read the limits from `req.user`; `GET /me` then returns them, which the app needs);
- after the existing checks, reject with 401 when `user.isDemo && user.demoExpiresAt && user.demoExpiresAt <= now`. The template (`demoExpiresAt` NULL) has no token, so this branch never sees it.

The demo JWT stays a normal 30-day token (reuses `generateToken` unchanged); the row's `demo_expires_at` is the single source of truth. A replay or a clock-sync problem cannot extend a session: the expiry is fixed at bootstrap, and `protect` rejects the session at the next request once it passes. Changing the duration affects demos started afterward (D7).

For the same reason, `protect` **skips** the `last_seen_at` and `user_activity_days` writes for demo users: demo activity must not inflate the admin "active users" statistics, and the rows would be cascade-deleted on purge anyway.

### Restrictions (Slice 1 for account/OAuth, Slice 2 for tags) — D10

One helper, e.g. `assertNotDemo(req, res)` in a new `backend/lib/demo.ts`, throws `403 { code: "demo_restricted" }`. It is called by:

- OAuth: `startLink` (`POST /api/auth/:provider/link`), `deleteIdentity` (`DELETE /api/auth/identities/:id`). `POST /api/auth/link` is public (it finishes a link from a pending token): it refuses when the target user is a demo.
- `updateUser`: refuses when `username` or `name` changes for a demo (languages, UI language and theme stay editable).
- `followTag`.
- `createTag` / `updateTag` / `cloneTag`: refuse any `visibility` other than `Private` for a demo.
- `requestPasswordReset`: for a demo account, answers the same generic 200 but sends nothing (no mail to `@ladu.invalid`).

The UI hides the same affordances when `user.isDemo` (Sign-in methods block, username/name fields, the Follow button, the visibility choice in the tag form). The server check is the boundary; the UI only avoids dead buttons.

### Caps enforcement (Slice 2)

Because the caps are "on top of the seed" (D3), the demo user's **absolute** limits are stored on its row at bootstrap (D7). Enforcement is then a pure count against a fixed number, with no per-request settings read and no need to distinguish seed rows from user-created rows. One helper in `lib/demo.ts`, `assertDemoRoom(tx, user, { words: n, tags: m })`:

- `POST /api/words`: `words + 1 > demoWordLimit` → `403 { code: "demo_word_limit" }`;
- `POST /api/words/:id/clone`: the same (+1 word);
- `POST /api/tags`: `tags + 1 > demoTagLimit` → `403 { code: "demo_tag_limit" }`;
- `POST /api/tags/:id/clone`: `+N` words (the source tag's word count) and `+1` tag unless it is a words-only clone; refused as a whole if either passes (D11).

The check is one `COUNT(*)` on a small, per-user table — negligible. Two parallel requests can each pass the count and overshoot by a few rows; that is accepted (still bounded). If it must be exact, take `SELECT … FOR UPDATE` on the demo's `users` row first. The seed is authored to leave room under the caps.

### Seed data: template user + clone (Slice 2)

A **template** user holds the curated dataset and is cloned per demo session. It is the content-agnostic piece that makes "a comprehensive set later" a data change only.

- `backend/scripts/seed-demo-template.ts` (idempotent, safe to re-run; `--reset` first deletes the template): creates the template user (`is_demo = true`, `demo_expires_at = NULL`, username `__demo_template__`) and inserts a **placeholder** set through the same service/validation functions the app uses, so it is valid against the current form rules (check during Slice 2 which create logic is in `services/` and which is still in the controllers; move it out if needed):
  - ~5 tags (one per part of speech, plus a "useful phrases" tag), **Private**;
  - ~12–20 words across Noun/Verb/Adjective/Adverb, each with ≥2 full translations + grammatical cases, assigned to the tags;
  - a saved `practice_config` ("Jump in — mixed practice");
  - seeded `exercise_performances` + `exercise_performance_cases` so the review table and mastery indicators show life (mixed mastery, last-4-attempts history).
  - **No `practice_session`** (D5).
- The script runs like `scripts/purge.js` (`tsx/cjs`), locally and in the container: `docker exec backend-prod node scripts/seed-demo-template.js`. Add the command to the infrastructure guide. Until the template exists, `POST /api/demo` answers 503 `{ code: "demo_unavailable" }` and logs an error.

**The clone** (`cloneDemoTemplate(tx, demoUserId)` in `lib/demo.ts`), inside the bootstrap transaction:

1. Read all template rows (they are few): words, translations, translation_cases, tags, tag_words, exercise_performances, exercise_performance_cases, practice_configs.
2. **Generate the new ids in JS** (`crypto.randomUUID()`) and build one `old id → new id` map per table. (`INSERT … SELECT … RETURNING` cannot return the source id, so the map cannot come from RETURNING.)
3. Batch-insert each table in dependency order with the mapped ids and `user_id`/`author_id` = the demo user:
   - `words`: `is_cloned = false`, `source_word_id = NULL`, `original_creator_id = NULL`. The copies are the demo's **own** words, not clones of the template (else the "own copy" logic — `notHiddenByOwnCopy`, "Open your copy" — would treat them as followed words). Do **not** reuse `cloneWordsForUser`: it sets those three fields and copies only the recipient's progress.
   - `tags`: `visibility = 'Private'`, `source_tag_id = NULL`.
   - `practice_configs`: remap the `word_ids` and `tag_ids` arrays through the maps.
   - `exercise_performances` / `exercise_performance_cases`: remap `word_id`, `translation_id`, `exercise_performance_id`, and **shift every date forward** by `shift = now − (newest date in the template's performances) − 1 day`. Without the shift, the forgetting curve makes every seed word look "forgotten" some weeks after the seed was written.
4. `created_at`/`updated_at` are new (`now`), so the seed sorts as recent in the word list.

The template and all demo sessions are hidden from user-facing and staff-facing listings:

- the admin users list and the stats endpoints (`statsController`: totals, signups, active users, languages) exclude `is_demo = true`;
- `GET /api/users/searchUser` excludes `is_demo = true` now (one condition), and the **future** user-search and friend features must keep that rule (recorded under "Later features" below);
- the nightly purge only ever deletes `is_demo = true AND demo_expires_at IS NOT NULL AND demo_expires_at < now`, so the template (NULL expiry) survives.

### Cleanup (Slice 2)

The nightly purge (`lib/userPurge.ts` → `scripts/purge.js`) gains a demo branch: `DELETE FROM users WHERE is_demo AND demo_expires_at IS NOT NULL AND demo_expires_at < now`. The existing `ON DELETE CASCADE` removes words, translations, cases, tags, performances, configs, sessions, notifications, OAuth links, login history. **No audit row per demo** (the audit log is for admin accountability, not ephemeral-account lifecycle; this is different from `hardDeleteUser`, which writes `user.purge`) — the job logs a count only, and returns it in `runPurge`'s result (`purgedDemos`). Expired demos can stay up to ~24 h until the next run; the global cap counts only **live** demos, so they do not block new ones. The server-side `protect` check is the security boundary; the purge is only garbage collection.

### Admin API and UI (Slice 0)

Reuses the access-gates machinery (`backend/controllers/admin/accessController.ts`, `backend/routes/admin/accessRoutes.js`, permission `access.manage`):

- `GET /api/admin/access` already returns the settings; extend it with the `demo` block (five fields) and `counts.liveDemos` (the demos running now).
- `PUT /api/admin/access/demo` (`{ enabled, durationMinutes, maxWords, maxTags, maxLive, reason? }`, all five required) — one action, one audit row `access.demo_configure` (D8, metadata: old + new values).

Admin UI: `/access` (`admin/src/features/access/`) gains a third tab `?tab=demo` (extend `AccessSearch.tab` in `search.ts` from `'registration' | 'login'` to include `'demo'`, and `validateAccessSearch`). The tab has an **Off / On** control (the same `SegmentedControl` as the other gates), "Running now: N of M demos", and four number inputs (duration minutes, max words, max tags, max live demos) with the bounds above, a Save with confirm, and a note that the demo is independent of the registration/login gates. A warning when enabled and a word or tag cap is zero ("visitors can look, but cannot add words/tags").

### Learner app (`frontend/`)

- `SessionUser` / `RawUser` (`frontend/src/stores/authStore.ts`, through `toSessionUser`) and `AuthUser` (`frontend/src/features/auth/types.ts`) gain `isDemo?`, `demoExpiresAt?`, `demoWordLimit?`, `demoTagLimit?`. `serializeLoginUser` and `serializeUser` (`backend/controllers/userController.ts`) add the four fields; `protect` exposes them via `req.user`, so `GET /me` returns them too.
- New `frontend/src/features/demo/`:
  - `/demo` (public route in `frontend/src/app/router.tsx`): reads `GET /api/access`; shows the start screen (D12) or "The demo is off" + sign-up link. The button calls `useStartDemo` (mirrors the login mutation in `features/auth/api.ts` / `hooks.ts`), sets the session through the same store flow, and navigates to the dashboard. When a non-demo session is open, it shows the log-out warning (D12). When a **demo** session is still live, `/demo` sends the visitor straight into the app. Errors map to messages: `demo_disabled`, `demo_busy`, `demo_rate_limited`, `demo_unavailable`.
  - `/demo/ended` (public route): "The demo has ended" + **Sign up** + **Try again** (D13).
- Expiry: a countdown (in the header indicator) clears the session and navigates to `/demo/ended` at zero. The 401 handler (`api/client.ts` → `app/Providers.tsx`) checks whether the cleared session was a demo: if yes, it goes to `/demo/ended`, not `/login`.
- Demo affordances, shown only when `user.isDemo`:
  - a **small header indicator** (mobile and desktop) with the demo state and remaining time;
  - on the **Account page** (`frontend/src/features/account/pages/AccountPage.tsx`, route `/user`), a **countdown clock** plus counters for **words left** (`demoWordLimit − totalWords`) and **tags left** (`demoTagLimit − totalTags`); both totals come from `getUserMetrics` (add `totalTags`, D9);
  - hidden for a demo (D10): Sign-in methods block, username/name editing, the Follow button, the tag visibility choice;
  - the cap errors (`demo_word_limit`, `demo_tag_limit`) and `demo_restricted` show a clear toast.
- Translated strings in `frontend/public/locales/{en,es,de,ee}/*.json` (draft English; the user reviews the other languages once the feature is live — see "Details to finalize").

### Landing page

`landing/index.html` (the `.actions` block next to the "Open" button) gains a "Try the demo" link to `https://app.ladu.com.ar/demo`, built through the same link helper in `landing/app.js` that adds `?lng=` / `&theme=`. `landing/app.js` gets the label in its `STRINGS` table. **No API call** (D14). Token handling stays on the app origin — no token in the landing page or in a URL.

### Later features (record only, no code now)

- Friendships, tag-share invitations, and any paid external resource (e.g. LLM): refuse for demo users with the same `assertNotDemo` helper.
- Future user search / friend search / profiles: exclude `is_demo = true` (template and sessions). A real user must never find, follow, or befriend a demo account.

## Slices (one at a time; each ends with something runnable)

| # | Slice | Ends with |
|---|---|---|
| 0 ✅ | **Admin settings + gate.** Migration (all four `users` columns + the partial index, and the five `access_settings` columns with their `CHECK`s; migrations 0027 + 0028). Admin API read/write for the demo settings + audit. Admin `/access?tab=demo` tab. `GET /api/access` returns `demo.enabled`. | Jest + Vitest; Playwright `admin-14-demo-gate.spec.ts` (owner flips the gate and tunes caps; `GET /api/access` reflects it). |
| 1 ✅ | **Bootstrap + session + expiry + account restrictions, end-to-end with inline placeholder seed.** `POST /api/demo` (per-IP limiter + global cap) with a tiny inline seed (1–2 tags, a few words, a saved config). `protect` expiry check + skipped activity writes. Account/OAuth restrictions (D10 a, c) and the silent password-reset skip. `serializeLoginUser`/`serializeUser` + `RawUser`/`AuthUser`. `/demo` start screen, `/demo/ended`, `useStartDemo`, header indicator + countdown, demo-aware 401 handling. Landing link. | Jest + Vitest; Playwright `demo-access-gate.spec.ts` (landing link → `/demo` → start → see seed data → add a word → force expiry in the DB → next request → `/demo/ended`; a logged-in user sees the log-out warning). |
| 2 ✅ | **Template + clone + caps + tag restrictions + purge.** `scripts/seed-demo-template.ts`; `POST /api/demo` clones the template instead of inline seeding (id maps, array remap, date shift). Word/tag caps on create **and** clone. Tag restrictions (D10 b, d). Purge deletes expired demo users. Exclude demo users from the admin users list, stats and `searchUser`. `totalTags` + Account page counters. | Jest + Vitest; Playwright extends `demo-access-gate.spec.ts` (rich seed shows up with recent mastery; exceeding the word/tag cap is refused; Follow and Public visibility are not offered). The purge is tested in Jest (`runPurge` removes an expired demo, keeps a live one and the template). |

Slice 0 changes no learner-facing behaviour (the gate is off by default); Slice 1 is the thin vertical slice that proves the whole loop; Slice 2 hardens and scales it.

## Files that change (summary)

- **Backend:** `backend/src/db/schema.ts` + a migration; `backend/middleware/authMiddleware.ts`; `backend/controllers/userController.ts` (serializers, `updateUser`, `requestPasswordReset`, `getUsersBy`) and `backend/controllers/metricController.ts` (add `totalTags`); `backend/controllers/accessController.ts` (`demo.enabled`); `backend/controllers/oauthController.ts` (link/unlink guards); `backend/controllers/wordController.ts` (`setWord`, `cloneWord` caps); `backend/controllers/tagController.ts` (create/update/clone caps + visibility, `followTag`); new `backend/lib/demo.ts` (restriction + cap helpers, template clone, rate limiter); new `backend/controllers/demoController.ts` and `backend/routes/demoRoutes.js` (mounted in `backend/app.js` as `/api/demo`); `backend/controllers/admin/accessController.ts` + `backend/routes/admin/accessRoutes.js`; `backend/controllers/admin/statsController.ts` and `backend/controllers/admin/userController.ts` (exclude demo); `backend/lib/userPurge.ts`; `backend/scripts/purge.js`; new `backend/scripts/seed-demo-template.ts` (+ a `.js` runner like `purge.js`); tests.
- **Admin:** `admin/src/features/access/` (`pages/AccessPage.tsx`, `search.ts`, `api.ts`, `hooks.ts`, `types.ts`) + tests.
- **Learner app:** `frontend/src/features/demo/` (new); `frontend/src/stores/authStore.ts`; `frontend/src/features/auth/types.ts` (+ `api.ts`/`hooks.ts`); `frontend/src/app/router.tsx`; `frontend/src/api/client.ts` / `frontend/src/app/Providers.tsx` (demo-aware 401); `frontend/src/components/layout/AppShell.tsx` / `AppHeader.tsx`; `frontend/src/features/account/` (counters, hidden blocks); the tag form and Follow button (hidden for demo); the 4 locale JSONs; tests.
- **Landing:** `landing/index.html`, `landing/app.js`.
- **e2e:** `e2e/tests/admin-14-demo-gate.spec.ts` (named `-gate`: it changes the global `access_settings` row, so the Playwright config runs it as its own chained project after every other spec), `e2e/tests/demo-access-gate.spec.ts` (it needs the demo **on**, so it is a `-gate` spec: Review log S1-5), and helpers in `e2e/fixtures/db.ts` (set demo settings, seed the template, force `demo_expires_at` into the past).
- **Docs:** this plan's status notes; the infrastructure guide (seed-template command, purge output); `landing/privacy.html` — **no change expected**: demo accounts are synthetic and deleted, and IPs are only held in memory for the rate limit (confirm with the user before Slice 1 ships).

## Risks and how the plan answers them

- **Abuse / resource exhaustion.** Anonymous free accounts are a bot vector. Per-IP in-memory limit + a global cap on live demos on `POST /api/demo`, hard caps on words/tags on every create and clone path, and a bounded duration (≤ 1 day). The nightly purge bounds storage.
- **A replay or clock skew extending a session.** `demo_expires_at` is checked server-side on every request, not just in the token.
- **Demo data leaking into the real product.** Demo tags are always Private, demos cannot follow, cannot change username/name, cannot link Google, and are excluded from `searchUser`, the admin user list and stats (D10).
- **A real identity stuck on a demo.** OAuth linking is refused for demo users, so no real Google account is ever attached to a row that is about to be deleted.
- **Demo activity inflating admin metrics.** `protect` skips `last_seen_at` / `user_activity_days` for demo users; demo never writes `login_events` (it bypasses login).
- **Seed data drifting from the form rules.** The template is inserted through the app's own validation, and cloned per session — a broken template fails loudly in the e2e gate, not in production.
- **Lockout / gate misconfiguration.** The demo gate is independent of the registration/login gates; a cap of 0 is warned about in the admin page.

## Details to finalize during implementation (non-blocking)

1. **Placement of the header indicator** (mobile vs desktop, D6), and whether the login and registration pages also get a "Try the demo" link.
2. **Wording.** Draft the demo badge, countdown, start screen, "the demo is off", "the demo has ended", and the error strings in English; the user reviews the ES/DE/EE translations once the feature is live.
3. ~~**Limiter implementation**~~ — decided 2026-10-15: a hand-written fixed-window `Map` in `lib/demo.ts` (no new dependency). `DEMO_STARTS_PER_IP` defaults to 5/hour and can be set by an environment variable (Review log S1-1).
4. ~~**Exact cap counting**~~ — decided 2026-10-15: lock the demo's `users` row (`FOR UPDATE`) before the count (Review log S2-5).

## Review log (2026-10-14)

The plan was checked against the code. Severity: **Blocker** = cannot work as written; **Major** = works but has a security or data hole; **Moderate** = a wrong assumption, contained fix; **Minor** = not breaking.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| B1 | Blocker | The landing page (apex) and the API (`app.`) are different origins; CORS is off in production, so a fail-closed status call always hides the button. | D14: the button is always shown; `/demo` handles "off". |
| B2 | Blocker | `practice_sessions.snapshot` holds template word/translation ids and the row expires 7 days after seeding; `practice_configs.word_ids`/`tag_ids` hold template ids; `INSERT … SELECT … RETURNING` cannot give an old→new id map. | D5: no session in the seed. The clone generates ids in JS and remaps the config arrays. |
| B3 | Blocker | No per-IP throttle exists to reuse (password reset is per account), and a per-IP count of live demos would store IPs, which the codebase never does. | In-memory per-IP limiter + a global DB cap on live demos; no IP stored. |
| M1 | Major | Word and tag **clone** endpoints create rows without passing the caps (one tag clone can add hundreds of words). | D11. |
| M2 | Major | A demo could link a real Google account; after expiry that Google sign-in is stuck on a dead row until the purge. | D10 (a). |
| M3 | Major | A demo could publish Public tags, follow real tags (inflating `followerCount`), and take real usernames. | D10 (b, c, d). |
| M4 | Major | Template copies built with `cloneWordsForUser` semantics would be marked as clones of the template and be treated as followed words. | Clone sets `is_cloned = false` and NULL source fields. |
| Mo1 | Moderate | `protect` must also select `demoWordLimit` / `demoTagLimit` for the cap checks. | Design updated. |
| Mo2 | Moderate | Seeded performance dates age, so the seed looks "forgotten" after some weeks. | Dates are shifted at clone time. |
| Mo3 | Moderate | `/demo` would silently replace an open real session (one `ladu.session` key). | D12. |
| Mo4 | Moderate | Expiry 401 went to `/login`, which a visitor never needs. | D13. |
| m1 | Minor | Slice 0 called "read-only" (it has a migration and a write); its migration list missed the two limit columns. | Slice table fixed. |
| m2 | Minor | A new status endpoint duplicates the public `GET /api/access`. | Extend `GET /api/access`. |
| m3 | Minor | Terms acceptance was recorded without a Terms note shown. | D12 start screen shows the note. |
| m4 | Minor | Hardcoded English native language goes against commandment 4. | Follows the UI language. |
| m5 | Minor | No upper bound on duration; the zero-cap warning text was wrong. | Bounds + new warning text. |
| m6 | Minor | Parallel creates can overshoot a cap slightly. | Recorded, decide in Slice 2. |
| m7 | Minor | "Details to finalize" named a login/registration link not in the Design; "uiLanguage follows the request" was vague. | Both made explicit. |
| m8 | Minor | Expired demos wait up to 24 h for the purge. | Accepted; the global cap counts live demos only. |

## Review log — Slice 1 start (2026-10-15)

The Slice 1 design was checked against the code before any change.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| S1-1 | Moderate | The per-IP limit (5/hour) stops Jest and Playwright, which start every demo from one IP. | `DEMO_STARTS_PER_IP` comes from an environment variable (default 5); the e2e backend sets a high value; Jest resets the counter between tests. |
| S1-2 | Moderate | `updateUser` returns the shared column list (`userController.ts`), which has no demo fields; the app writes that answer into the session, so a profile save drops `isDemo`. | The demo fields are added to `serializeUser` and to the `updateUser` answer, not to the shared list (which `searchUser` uses for other users). |
| S1-3 | Moderate | The 401 interceptor (`api/client.ts`) clears the session before it calls the handlers, so a handler cannot know the session was a demo. | The interceptor reads `isDemo` before it clears, and passes it to the handlers. |
| S1-4 | Minor | `uiLanguage` default `'en'`: the code stores labels (`'English'`). | Labels for `uiLanguage`, `nativeLanguage` and `languages`. |
| S1-5 | Minor | The demo e2e spec turns the demo on (global row), so it must be a `-gate` spec. | Named `demo-access-gate.spec.ts`. |

## Slice 1 — what was built (2026-10-15)

Differences from the design above, and choices made during the slice:

- **Seed:** `backend/lib/demoSeed.ts` — 5 nouns in the four languages, 2 Private tags, 1 saved practice config (checked with `validateConfigRequest`). Slice 2 replaces it with the template clone.
- **Live cap:** the count and the insert run under one Postgres advisory lock, so parallel starts cannot pass `demo_max_live` (decision 4 of "Details to finalize" is settled for the live cap; the word/tag caps are Slice 2).
- **Account page of a demo:** besides the hidden Sign-in methods, the username and email rows are hidden too (they are synthetic), and the card says "Demo account" instead of `@username`. The edit form replaces name, username, email and sign-in methods with one line.
- **Log-out of a demo** goes to `/demo/ended`, like an expiry (D13).
- **Header badge** (D6): "⏱ Demo m:ss" before the avatar, on every size (below 480px only the clock); it links to `/user` and owns the expiry timer (one `setTimeout` at `demoExpiresAt`, at once after a reload).
- **Strings:** a new `demo` namespace, English drafts in all four locales (to review once live, "Details to finalize" 2). The landing label `tryDemo` is translated in `landing/app.js`.
- **e2e:** the landing page is not served in e2e, and `APP_ORIGIN` is fixed to production, so the landing link is checked by the landing node tests (`landing/scripts/demo-link.test.mjs`); `demo-access-gate.spec.ts` starts at `/demo`. The per-IP limit is tested in Jest only (all e2e demos come from one IP).

## Review log — Slice 2 start (2026-10-15)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| S2-1 | Major | The social routes are mounted now (`POST /api/friendships`, accept/decline; `POST /api/tags/:id/share`, `/api/tag-shares/:id/accept|decline`). The plan defers them (D4), so a demo could send friend requests and shared tags to any user id. No app code calls them. | `assertNotDemo` on create/accept/decline of friendships and tag shares (Slice 2 step 1). |
| S2-2 | Major | `POST /api/notifications` has no authorization: any signed-in user can notify any user ids with any text (pre-existing; a demo makes it anonymous). No app caller; §8.1 says notification rows are made server-side. | The route, its controller function and its tests are removed (Slice 2 step 1). |
| S2-3 | Moderate | "The template is inserted through the app's validation" does not hold: the backend checks only "≥ 2 translations"; case names and form rules are checked in the browser only. | Template content is a JSON data file; Jest checks languages, parts of speech, case names, tag references and the practice config. The e2e shows the words in the UI. |
| S2-4 | Moderate | Without a seeded template, `POST /api/demo` answers 503 `demo_unavailable` in staging and production. | The seed command goes in the infrastructure guide; the e2e setup seeds the template. |
| S2-5 | Minor | Parallel creates can pass a word/tag cap slightly ("Details to finalize" 4). | Lock the demo's `users` row (`FOR UPDATE`) before the count. |
| S2-6 | Minor | The tag clone dialog offers a visibility choice. | For a demo, the app sends Private and hides the choice (part of D10 b). |

## Slice 2 — what was built (2026-10-15)

Differences from the design above, and choices made during the slice:

- **Template content** is a data file, `backend/scripts/demo-template/data.json` (placeholder: 14 words in Noun/Verb/Adjective/Adverb, all four languages; 5 tags; 2 practice configs, one with its own word and tag lists; practice history as answers + days ago). Jest checks it against the app's own case enums (`frontend/src/ts/enums.ts`) and the exercise catalogue (Review log S2-3). The seed computes each case's knowledge from the answers with the engine's `applyAnswer`.
- **Seed:** `lib/demoTemplate.ts` `seedDemoTemplate` + `scripts/seed-demo-template.js` (`npm run demo:template -w backend`, `--reset`). The e2e start-up runs it. Each environment must run it once (S2-4; infrastructure guide 02).
- **Copy:** `cloneDemoTemplate` in the demo start transaction; 503 `demo_unavailable` and a rollback when there is no template. The newest history date becomes one day ago, the gaps stay. `lib/demoSeed.ts` (Slice 1 placeholder) was removed.
- **Caps:** `assertDemoRoom` locks the demo's row, then counts (S2-5), on word create/clone and tag create/clone (a clone that does not fit is refused whole).
- **Social:** friendships and tag shares (create, accept, decline) refuse a demo (S2-1); `POST /api/notifications` was removed for everyone (S2-2).
- **Exclusions:** the admin statistics also leave out demo-owned content (words, translations, tags, saved sessions, practised translations), not only the accounts: each demo copies the template.
- **Metrics:** every tag mutation now refreshes the user metrics (`totalTags`; a tag copy also adds words). Recorded in the invalidation graph (`frontend/src/app/query-client.ts`).
- **e2e:** `demo-access-gate.spec.ts` checks the copy, the counters, the word cap (API) and the tag cap (UI message), and that a demo sees no visibility choice and no Follow. The purge is tested in Jest only (a nightly job).
- **Still open:** the real template content (D5) and the review of the ES/DE/EE drafts in `demo.json` ("Details to finalize" 2).

