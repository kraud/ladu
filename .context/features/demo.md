# Demo access

## Summary

A visitor can click "Try the demo" on the landing page and use Ladu without signing up. The server makes a throwaway account that is already filled with sample words, tags, practice progress and a saved practice configuration. The visitor can use every solo feature for a few minutes (15 by default). When the time ends, the app shows "The demo has ended" and the account and all its data are deleted. The owner turns the demo on or off and sets the limits in the admin panel, with no deploy.

Live spec. It replaces a finished plan (archive record: `.context/archive/2026-10-demo-access.md`). Built 2026-10-15 (slices 0 to 5, branch `demo-setup`, PR #89), with French added in PR #110. Gates: `e2e/tests/demo-access-gate.spec.ts` and `admin-14-demo-gate.spec.ts` (both `-gate` specs).

Code map: backend `backend/lib/demo.ts` (`assertNotDemo`, `assertDemoRoom`, `countLiveDemos`, `cloneDemoTemplate`, the per-IP limit), `lib/demoStats.ts`, `lib/demoTemplate.ts`, `controllers/demoController.ts`, `scripts/seed-demo-template` (the template, with `--reset`), `middleware/authMiddleware.ts` (`protect` checks the expiry), `lib/userPurge.ts`; migrations `0027` and `0028` (user columns and `access_settings` columns) and the `demo_starts` and `demo_refusals` tables; frontend `frontend/src/features/demo/` (`/demo`, `/demo/ended`, `DemoIntro`, the countdown); admin `admin/src/features/access/` (the Demo tab).

Technically the demo is not account-less. It is an anonymous, short-lived `users` row (`is_demo = true`). The model already keys all data to `userId` with `ON DELETE CASCADE`, and `protect` and the nightly purge already exist.

## 1. Decisions (taken with the user on 2026-10-14 and 2026-10-15)

| ID | Decision |
|---|---|
| D1 | On expiry the demo user is **deleted** (cascade). Nothing is kept. No "sign up and keep your data" in this version. |
| D2 | A dedicated demo gate in the admin panel (Access, Demo tab), separate from the registration and login gates. On or off plus four caps, all on the single-row `access_settings`, with the `access.manage` permission. **Off by default.** |
| D3 | Caps with defaults: duration 15 minutes, words 30, tags 5. They limit what the visitor creates **on top of the seed**. Enforced server-side on every path that creates words or tags, clones included. |
| D4 | All implemented solo features are available (words, tags, review, practice, saved configurations and sessions, dashboard). Restrictions: see D10. Friendships, invitations and any paid resource also refuse demo users when they are built. |
| D5 | The seed is a placeholder set now (a small hand-written set). Replacing it is a data change, not a code change. **No saved practice session** in the seed (its snapshot holds ids). |
| D6 | The visitor sees a countdown on the Account page with "words left" and "tags left", and a small indicator in the header. |
| D7 | The duration and the caps are frozen on the user row at start (`demo_expires_at`, `demo_word_limit`, `demo_tag_limit`). An admin change affects demos started afterwards. |
| D8 | One audit action `access.demo_configure` per save, with old and new values of the five fields. |
| D9 | `getUserMetrics` returns `totalTags` too, so the Account page can compute "tags left". |
| D10 | A demo user cannot: link Google or change sign-in methods; give a tag any visibility except Private; change `username` or `name`; follow a tag; reset a password by mail (the route answers the generic 200 and sends nothing). The server answers 403 `demo_restricted`; the UI hides the same buttons. |
| D11 | `POST /api/words/:id/clone` and `POST /api/tags/:id/clone` check the caps before they write. A clone that would pass a cap is refused as a whole (`demo_word_limit`, `demo_tag_limit`). |
| D12 | `/demo` is a page with a Start button, not an automatic start. It shows the Terms note. If a real session is open, it warns "This logs you out of your account". |
| D13 | On expiry (the countdown at zero, or a 401 for a demo session) the app clears the session and goes to a public "The demo has ended" page with Sign up and Try again, not to `/login`. |
| D14 | The landing "Try the demo" button is always shown and makes no API call (the landing and the API are on different origins). When the demo is off, `/demo` says so and links to sign-up. |
| D15 | The cap on simultaneous demos is an admin setting (`demo_max_live`, 1 to 1,000, default 200). A daily cap was rejected: one burst would block real visitors until the reset. |
| D16 | `/demo` has two steps: a description, then the language tiles with Start and the Terms note. The picked languages decide which languages the demo account has. |
| D17 | At copy time each template configuration keeps only the picked languages in `params.languages`. A configuration that is no longer valid is not copied. |
| D18 | After Start, a full-screen transition shows the outline logo and 3 short lines in the UI language (about 3 s), then fades to the dashboard. |
| D19, D20 | The Demo tab shows the demo accounts now in the database (live and expired-not-yet-purged) and a usage banner: starts over 24 h, 7 d, 30 d and in total; engagement averages; cap hits; refused starts. |

## 2. Contract

- **Status:** `GET /api/access` has `demo: { enabled }`. If the call fails, `/demo` acts as off.
- **Start:** `POST /api/demo` (public). Order: gate (403 `demo_disabled`), languages, captcha (`features/captcha.md`), the per-IP limit (5 an hour by default, in memory, 429 `demo_rate_limited`), the live cap (503 `demo_busy`), then one transaction: create the user (synthetic `name`, `username` `demo-<uuid>`, `email` `demo+<uuid>@ladu.invalid`, no password, `verified`, Terms accepted, `uiLanguage` from the body, the picked languages), copy the template, freeze the limits. Answer: the login user plus `isDemo`, `demoExpiresAt`, `demoWordLimit`, `demoTagLimit`. Without a template: 503 `demo_unavailable`.
- **Expiry:** `protect` rejects a demo session with 401 once `demo_expires_at` has passed. The JWT stays a normal token; the row is the single source of truth. `protect` skips the `last_seen_at` and `user_activity_days` writes for a demo, so demos do not inflate the admin statistics.
- **Caps:** `assertDemoRoom(tx, user, { words, tags })` counts against the frozen absolute limits (seed plus the allowed extra). Two parallel requests can overshoot by a few rows. That is accepted.
- **Template:** a user with `is_demo = true` and `demo_expires_at` NULL (username `__demo_template__`), made by `seed-demo-template` through the app's own services. The clone generates new ids in JS and maps old to new per table. The copies are the demo's **own** words (`is_cloned = false`, no source), not clones, so `notHiddenByOwnCopy` does not treat them as followed words. Do not reuse `cloneWordsForUser`. Performance dates are shifted forward so the seed does not look forgotten. Tags are Private.
- **Hidden from lists:** the admin users list and statistics, and `GET /api/users/searchUser`, exclude `is_demo`. A future user or friend search must keep that rule.
- **Cleanup:** the nightly purge deletes `is_demo AND demo_expires_at < now` (the template survives, because its expiry is NULL). It writes the final counts to `demo_starts` before it deletes the user.
- **Statistics:** `demo_starts` has one row per successful start (`user_id` `ON DELETE SET NULL`, no IP, no personal data), so stats over a week or a month survive the purge. `demo_refusals (day, code, count)` counts refused starts, one upsert each (bounded by days times codes). `captcha_failed` is a counted refusal.
- **Admin API** (`access.manage`): `PUT /api/admin/access/demo` `{ enabled, durationMinutes, maxWords, maxTags, maxLive, reason? }` (all required); `GET /api/admin/access` has the `demo` block and `counts.liveDemos`; `GET /api/admin/access/demo/users` (the newest 200) and `GET /api/admin/access/demo/stats`.

## 3. Traps

- The template and the demos are hidden everywhere; a new feature that lists users must exclude `is_demo`.
- The e2e database keeps an older template ("already there"). A French demo e2e needs a reseed with `--reset` first. The local dev template needs the same.
- The gate specs change global state and run chained, last.
- The per-IP limit is in memory: a restart clears it. Moving it to the database is an idea (`research/deferred-ideas.md`, I-4).

## 4. Open items

Closed 2026-11-02 (confirmed by the user): the ES, DE and EE review, and the rollout (the template seeded per environment, the demo turned on). The template is still the placeholder set (D5); the user accepts that for now. Replacing it is a data change.
