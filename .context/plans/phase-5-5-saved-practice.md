# Phase 5.5 — Saved practice configurations and sessions

*2026-09-30. **All slices 1–5 done (see §11).***

Phase 5 ([`phase-5-practice.md`](./phase-5-practice.md)) is done to Slice 8 (results screen) and its UI polish.
This phase adds a feature that Phase 5 did not plan: the user can **save practice configurations** and
**save practice sessions**, and use them again later. It needs backend changes. Phase 6 is unchanged.

## 1. Goals

- **Saved configuration:** name a set of settings (with or without pre-selected words) and start it again in one tap.
- **Saved session:** leave an unfinished session, keep it, and resume it later.
- Both are private. Only the owner sees them. No sharing.
- Solo loop stays complete without these features (design commandment 2).

## 2. Current state (from the code)

- The running session lives only in `sessionStorage` (`frontend/src/features/practice/sessionStore.ts`), one tab.
  The server does not know about it. Leaving `/practice` **parks** it; `ResumeSessionBanner` offers Resume or Dismiss.
  Dismiss deletes the session.
- The last-used settings live in `localStorage` (`remembered.ts`). No named settings exist.
- Backend exercise routes: `generate`, `answers`, `performances/:translationId/modifier`
  (`backend/routes/exerciseRoutes.js`). No table for saved configurations or sessions.
- The Leave dialog is in `ProgressHeader.tsx` (`practice:session.leaveDialog.*`).
- Latest migration: `0007_exercise_performance_integrity.sql`. This phase adds `0008`.

## 3. Decisions

| # | Decision | Reason |
|---|---|---|
| D1 | Store both on the server, in new tables. | The data must be available on other devices and survive a cleared browser. |
| D2 | No limit on configurations. Maximum **10** saved sessions. Expiry **7 days**. Both numbers are constants in one file. | User request; easy to change later. |
| D3 | A saved session stores the **full snapshot** (exercises + answers) as JSON. | Resume must show the same exercises. We cannot regenerate them. |
| D4 | The list of sessions returns a **summary** only. The full snapshot loads on resume. | The list stays light. |
| D5 | **Resume keeps the saved row.** The local session gets `savedId`. | User decision. |
| D6 | Configuration names are **unique per user, case-insensitive**. `409 { code: 'name_taken' }`. | User decision. |
| D7 | Expiry is checked on read and cleaned on write. No cron job. | Simple; no new infrastructure. |
| D8 | `word_ids` of a configuration has **no foreign key**. The server compares it with the words the user can still see and returns `missingCount`. | Words can be deleted later. The banner needs a count only. |
| D9 | Last save wins when two devices change the same session. | Sessions are private and single-user. |

## 4. Data model (migration `0008`)

**`practice_configs`**

| Column | Type | Note |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users, cascade | |
| `name` | varchar(60) NOT NULL | Unique index on `(user_id, lower(name))` |
| `description` | varchar(200) NULL | |
| `params` | jsonb NOT NULL | The settings, including `strictnessTI`. Validated on write. |
| `word_ids` | uuid[] NULL | Pre-selected words. NULL = none. |
| `tag_ids` | uuid[] NULL | **Added 2026-10-04 (migration `0018`).** The tags the words were chosen by (Practice's tag picker). NULL = not chosen by tag. No foreign key (a tag can be deleted later). `word_ids` still holds the words at save time. Request: `tagIds` — de-duplicated, at most 20 valid ids, `null` / missing / `[]` = none; error code `invalid_tag_ids`. On load the client reads the tags again and takes the words live from them; if no tag can be read it falls back to `word_ids` and shows the banner. |
| `created_at`, `updated_at` | timestamptz | |

**`practice_sessions`**

| Column | Type | Note |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users, cascade | Index on `(user_id, updated_at)` |
| `snapshot` | jsonb NOT NULL | The full `Session` (see `session.ts`) |
| `summary` | jsonb NOT NULL | answered, total, languages, word types, card types |
| `expires_at` | timestamptz NOT NULL | |
| `created_at`, `updated_at` | timestamptz | |

## 5. API (all private, always filtered by `req.user.id`)

Mounted at `/api/practice`. Another user's row gives 404, never 403.

| Method + path | Action |
|---|---|
| `GET /configs` | List, newest first. Each row has `missingCount`. |
| `POST /configs` | Create. 400 bad settings, 409 `name_taken`. |
| `PUT /configs/:id` | Edit name, description, and settings/words. 409 `name_taken` (the row's own name is allowed). |
| `GET /configs/:id/words` | The saved words the user can still see, in the saved order, in the Review row shape (`WordSimpleBE`). Added in Slice 2: the set-up screen needs labels and flags, and a long ID list does not fit in a URL. |
| `DELETE /configs/:id` | Delete. |
| `GET /sessions` | Summaries of non-expired sessions, newest first. |
| `GET /sessions/:id` | The full snapshot. 404 if expired or not the user's. |
| `POST /sessions` | Create. Body `{ snapshot }`; the summary is built by the server. In one transaction: delete expired rows; if 10 remain, delete the oldest; insert. |
| `PUT /sessions/:id` | Replace snapshot and summary. Set a new 7-day `expires_at`. Not counted against the limit. 404 if gone. |
| `DELETE /sessions/:id` | Delete. |

## 6. Session behaviour (frontend)

- `Session` gets a new field `savedId: string | null`. `isSession` in `sessionStore.ts` stays tolerant of old blobs.
- **Save session and leave:** `savedId` set → `PUT`. `savedId` null → `POST`.
  If the `PUT` returns 404 (expired, evicted, or deleted on another device), fall back to `POST`.
  If the save fails, the user **stays** in the session and sees an error. The session is never lost silently.
- **Leave session and delete:** clear the local session. If `savedId` is set, also `DELETE` the saved row.
  If that call fails, the user still leaves; the row expires by itself.
- **Finish (results screen):** if `savedId` is set, `DELETE` the saved row.
- **Resume from the list:** `GET /sessions/:id`, then load it into the store with `savedId`. The saved row stays.
- **Banner Dismiss:** session with `savedId` → hide the banner and drop the local copy; the saved row stays in the list.
  Session without `savedId` → delete it, as today.
- A saved session whose words were deleted later: saving an answer returns 404. The card already has an
  `unsaved` state for this, so the session still finishes. No extra work.

## 7. UI

- **Settings form:** a **Save configuration** button next to Start session. It opens a dialog: name (required), description (optional).
- Under the form, two lists: **Saved configurations** and **Saved sessions**.
  - Configuration row: name, description, summary of settings, word count. One tap loads settings + words into the form. Edit and delete actions.
  - Session row: progress, languages, word types, expiry date. Resume and delete actions.
- **Missing words banner** (small, no details) when a loaded configuration has `missingCount > 0`.
  A configuration whose words are all gone still loads its settings.
- **Leave dialog:** three buttons: **Save session and leave** (blue), **Leave session and delete** (red), Cancel.
  The old "Leave" label is replaced.
- All text in the 4 locale files (`en`, `es`, `de`, `ee`), under `practice.json`. Copy uses STE100.

## 8. Slices

Each slice starts with a plain-language overview, ends with something runnable, and stops for review.

| Slice | Content | Verification |
|---|---|---|
| 1 | **Backend configurations:** migration `0008` (configs table), service, controller, validation (reuse the generate validator), routes. | Jest: CRUD, ownership (404), unique name (create + edit + case), invalid settings, `missingCount`. |
| 2 | **Frontend configurations:** API + query hooks, save dialog, list (load / edit / delete), missing-words banner, locales. | Vitest: dialog, `name_taken` error, load into form, banner. |
| 3 | **Backend sessions:** migration (sessions table), endpoints, limit and expiry logic. | Jest: limit of 10 evicts the oldest, expired rows hidden and cleaned, `PUT` refreshes expiry, ownership, `PUT` on a missing row gives 404. |
| 4 | **Frontend sessions:** `savedId`, 3-button Leave dialog, saved-sessions list, resume, delete, banner rule, finish cleanup. | Vitest: each Leave path, 404 fallback to `POST`, failed save keeps the user in the session, banner Dismiss both cases. |
| 5 | **Close-out:** Playwright spec `phase-5-5-saved-practice.spec.ts`, docs (`.context/README.md`, `new-repo-build-plan.md`, this file's status). | `npm run test:e2e` green (required gate). |

## 9. Risks

- **Snapshot size.** 100 exercises as JSON is small (tens of KB). Limit of 10 per user keeps it bounded. Set a body-size check on `POST/PUT` sessions.
- **Snapshot trust.** The server stores a blob from the client. Validate its shape (the same checks as `isSession`) and its size. Never use it to change other data. Performance rows are always written through `/exercises/answers`.
- **Stale performance data.** The stored exercises carry a performance snapshot from the save time. Accepted: the next answer save returns fresh data.

## 10. Out of scope

- Sharing configurations or sessions.
- Scheduled reminders for saved sessions.
- Automatic saving while a session runs (only an explicit save).

## 11. Progress record

**Slice 1 — backend configurations (done 2026-09-30).**
- Migration `0008_practice_configs.sql`; table `practiceConfigs` in `backend/src/db/schema.ts`.
- `services/exercises/validateConfig.ts` (pure; reuses `validateGenerateRequest`), `services/practiceConfigService.ts`,
  `controllers/practiceConfigController.ts`, `routes/practiceRoutes.js`, mounted at `/api/practice` in `app.js`.
- `visibleWordCondition` in `exerciseService.ts` is now exported, so `missingCount` uses the same "visible word" rule as practice.
- Wire notes for slice 2: create returns `201`; delete returns `204`; a bad or unknown id returns `404`; `params` holds `strictnessTI` (default 2).
- Tests: `tests/practiceConfigs.test.js` (22) and `tests/unit/exercisesConfigValidate.test.js` (12).
  Backend total: 23 suites, 466 tests, all pass. `tsc` and `eslint` clean.

**Slice 2 — frontend configurations (done 2026-09-30).**
- Backend addition: `GET /api/practice/configs/:id/words` (see §5). `simplifyWord` is now exported from `wordController.ts`. 4 more Jest tests.
- New: `features/practice/configs.ts` (pure: `configToParams`, `narrowToPickable`; stored settings go through the URL validation round trip),
  `keys.ts`, `SaveConfigDialog.tsx` (create + edit), `SavedConfigurations.tsx` (list, load, edit, delete).
  Changed: `api.ts`, `hooks.ts` (`useConfigs` + 3 mutations + `useLoadConfigWords`), `errors.ts`, `types.ts`, `ParametersForm.tsx`
  (Save configuration button, `onSaveConfig` prop), `PracticePage.tsx`; `configs` block in the 4 `practice.json` files.
- Decisions taken:
  - The save dialog is rendered by the page, outside the set-up `<form>`, so it can never submit that form.
  - Edit changes name and description only. To change the settings of a saved configuration, save a new one and delete the old one.
    A future "update with the current settings" action is possible but not planned.
  - Load: the form restarts with the new settings (key change) and the URL follows. The words come from the new endpoint.
    `wordsMissing` is computed at load time (`wordIds.length > words.length`), not from the list's `missingCount`.
    A configuration whose words are all gone still loads its settings and shows the banner. It never falls back to "all words".
  - The banner is dropped when the user removes the pre-selection.
- Tests: `configs.test.ts` (7), `PracticePage.configs.test.tsx` (20); `makePracticeHandlers` now also fakes the four config endpoints
  (`makeConfig`, `makeConfigWord`). Frontend total: 111 files, 1253 tests, all pass. `tsc -b` and `eslint` clean.

**Slice 3 — backend sessions (done 2026-09-30).**
- Migration `0009_practice_sessions.sql`; table `practiceSessions` in `backend/src/db/schema.ts` (index `(user_id, updated_at)`).
- `services/exercises/validateSession.ts` (pure: `validateSessionRequest`, `summarizeSnapshot`, constants `MAX_SAVED_SESSIONS = 10`,
  `SESSION_TTL_DAYS = 7`, `MAX_SNAPSHOT_BYTES = 1_000_000`), `services/practiceSessionService.ts`,
  `controllers/practiceSessionController.ts`; routes added to `routes/practiceRoutes.js`.
- Wire notes for slice 4: the body is `{ snapshot }` only. The response has `{ id, summary, snapshot, createdAt, updatedAt, expiresAt }`
  (`GET /sessions` has no `snapshot`). Create returns `201`, update `200`, delete `204`. A missing, expired, foreign or badly-formed id is `404`,
  so the frontend falls back from `PUT` to `POST` on `404`. Errors: `400 invalid_snapshot`, `400 snapshot_too_large`.
  `summary` = `{ answered, correct, total, languages, partsOfSpeech, cardTypes }` (correct counts partial).
- Decisions taken:
  - The server validates the parts it depends on (counts, values the summary reads, view, current) and the size. It stores the rest as sent.
  - "Oldest" means the smallest `updated_at`, so an update makes a session young again (a session in use is never the one deleted).
  - `create` and `update` run in a transaction behind a per-user advisory lock (`pg_advisory_xact_lock`), so parallel saves cannot pass the limit.
    Expired rows of the user are deleted at the start of both.
  - `app.js`: `express.json({ limit: '1mb' })` for `/api/practice/sessions` only, registered before the global parser (default 100 KB).
  - The saved session has no link to the local session yet: `savedId` is a slice 4 concern (frontend only).
- Tests: `tests/practiceSessions.test.js` (26) and `tests/unit/exercisesSessionValidate.test.js` (19), including 15 parallel saves and body sizes.

**Slice 4 — frontend sessions (done 2026-09-30).**
- No backend change and no migration in this slice.
- New: `savedSessions.ts` (pure + api: `toSnapshot`, `saveOrUpdateSession` with the `404` → `POST` fallback, `fromSavedSession`,
  `MAX_SAVED_SESSIONS` / `SESSION_TTL_DAYS` for the hint text), `LeaveSessionDialog.tsx`, `SavedSessions.tsx`.
  Changed: `session.ts` (`savedId` on `Session`; `isSession` moved here from the store), `sessionStore.ts` (`load`, `setSavedId`,
  old stored blobs read as `savedId: null`), `api.ts`, `hooks.ts` (`useSavedSessions`, `useSaveSession`, `useDeleteSavedSession`,
  `useLoadSavedSession`), `keys.ts` (`practiceKeys.sessions`), `errors.ts`, `types.ts`, `ProgressHeader.tsx` (the old confirm dialog is gone),
  `SessionView.tsx` (finish cleanup), `PracticePage.tsx`; `session.leaveDialog` and new `sessions` blocks in the 4 `practice.json` files.
- Decisions taken:
  - Leave dialog buttons: **Save session and leave** (default, blue), **Leave session and delete** (destructive, red), **Keep practicing** (outline).
    The old `leaveDialog.confirm` key is removed.
  - A failed save keeps the dialog open with the reason. A failed delete of the saved copy is ignored: the user still leaves.
  - Finish deletes the saved copy and unlinks the session (`savedId: null`); a failed delete is ignored (the copy expires).
  - The banner needed no change: "Dismiss" only clears the local copy, so a saved copy stays in the list, and an unsaved one was never on the server.
  - Resuming from the list while a session is parked in this tab asks first (`replaceDialog`), because the parked session would be lost.
    Resuming also drops any words that came from Review.
  - The snapshot sent to the server has no `savedId`. On resume the session takes the current user's id and the row's id. A snapshot that fails
    `isSession` is treated as "not available". Answers stuck in `saving` are already handled by `recoverInterruptedSaves()` when the view opens.
  - The list shows progress, correct count, flags, word types and the expiry date (`Intl.DateTimeFormat` with `htmlLangByI18nCode`).
    Rows have no name; their accessible names carry the counts (`Resume session with 1 of 2 answered`).
- Tests: `savedSessions.test.ts` (7), 4 in `sessionStore.test.ts`, `PracticePage.sessions.test.tsx` (23); `makePracticeHandlers` now also fakes the five
  session endpoints (`makeSavedSession`); two older tests use the new button label. Frontend total: 113 files, 1286 tests, all pass. `tsc -b` and `eslint` clean.

**Slice 5 — close-out (done 2026-09-30).**
- `e2e/tests/phase-5-5-saved-practice.spec.ts` (5 tests, serial, one account with six nouns) with the shared helpers in `e2e/fixtures/practice.ts`
  and a new DB helper `expirePracticeSessions(email)` in `e2e/fixtures/db.ts`.
- What the spec covers: (1) configurations — save the settings on screen with name and description, a duplicate name in another letter case is
  refused, a fresh visit starts from the defaults and one tap on the row fills the form (URL follows), edit renames and keeps the settings,
  delete asks first; (2) a configuration with words — from Review select Apple and Banana, save, delete Banana through the API, loading shows
  "Some words are missing" on the row and the banner, "Practice with 1 selected word", and the session has exactly 1 exercise, from Apple;
  (3) sessions — answer a card, "Save session and leave", the list shows "1 of 3 answered" and the server has the summary; resume opens the same
  card with the answer kept; leaving again updates the SAME saved row (same id, 1 row, `answered: 2`); finishing the resumed session removes the
  row; "Leave session and delete" saves nothing; (4) limits — 11 sessions saved through the API leave 10 and the first one is gone, the list
  shows 10, a delete from the list gives 9, and after the expiry is moved to the past in the database the API list is empty and the UI says so;
  (5) privacy — a second account sees no configurations or sessions and gets `404` for read, update and delete of the owner's session and for
  the words and delete of the owner's configuration; the owner's rows are still there.
- Finding (not changed): after "Save session and leave" the "Session saved…" toast (bottom centre, 5 s) covers the next click target, so
  Playwright waits for it to close. The session test therefore takes about 15 s and is marked `test.slow()`. A real user meets the same overlay for up to 5 s.
- Gate results: backend 25 suites / 517 tests, frontend 113 files / 1286 tests, e2e: the 5 Phase 5.5 tests pass. See the Phase 5 close-out note for the
  8 failing `oauth-*` specs in the full e2e run.
