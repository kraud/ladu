# Saved practice: configurations and sessions

## Summary

On the Practice page, a learner can save a named set of settings (with words or tags) and start it again with one tap. A learner can also leave a practice session and resume it later, from the same device or another one. Both are private to the learner.

Live spec. It replaces a finished plan (archive record: `.context/archive/2026-09-saved-practice.md`). Built 2026-09-30, extended 2026-10-04 (tags on a configuration) and 2026-10-11 (change a saved configuration). All slices are done. Practice itself (parameters, exercise catalogue, answer checking) is in `.context/plans/phase-5-practice.md`.

Goal: a user can **save a configuration** (named settings, with or without chosen words) and start it again in one tap, and can **save a session** (leave it, resume it later). Both are private to the owner. No sharing. The solo loop works without them (design commandment 2).

Code map: backend `backend/services/practiceConfigService.ts`, `practiceSessionService.ts`, `services/exercises/{validateConfig,validateSession}.ts`, `controllers/practiceConfigController.ts`, `practiceSessionController.ts`, `routes/practiceRoutes.js` (mounted at `/api/practice`); frontend `frontend/src/features/practice/` (`configs.ts`, `savedSessions.ts`, `SaveConfigDialog.tsx`, `SavedConfigurations.tsx`, `SavedSessions.tsx`, `LeaveSessionDialog.tsx`, `sessionStore.ts`, `session.ts`); migrations `0008`, `0009`, `0018`.

## 1. Decisions

| ID | Decision | Reason or rejected option |
|---|---|---|
| S-1 | Both are stored on the server, in new tables. | Other devices, and a cleared browser. Rejected: only `localStorage`. |
| S-2 | No limit on configurations. At most **10** saved sessions. Expiry **7 days**. Both numbers are constants (`MAX_SAVED_SESSIONS`, `SESSION_TTL_DAYS`). | User request. |
| S-3 | A saved session stores the full snapshot (exercises and answers) as JSON. | Resume must show the same exercises; they cannot be regenerated. |
| S-4 | The sessions list returns a summary only. The snapshot loads on resume. | A light list. |
| S-5 | Resume keeps the saved row. The local session gets `savedId`. | User decision. |
| S-6 | Configuration names are unique per user, case-insensitive. `409 { code: 'name_taken' }`. | User decision. |
| S-7 | Expiry is checked on read and cleaned on write. No cron job. | No new infrastructure. |
| S-8 | `word_ids` has no foreign key. The server compares it with the words the user can still see and returns `missingCount`. | Words can be deleted later. |
| S-9 | Last save wins when two devices change the same session. | Sessions are private and single-user. |
| S-10 | A configuration may hold `tag_ids` (migration `0018`). On load, the client reads the tags again and takes the words live from them. If no tag can be read, it falls back to `word_ids` and shows the banner. | Words chosen by tag should follow the tag. |
| S-11 | Opening a saved configuration with "Change settings first" opens the set-up view as that configuration. Save is off until something differs from the baseline. The dialog offers Cancel, Save as copy (`POST`) and Update (`PUT`). | Rename-only editing (first build). |

## 2. Data

- `practice_configs`: `id`, `user_id` (cascade), `name` varchar(60) with unique index on `(user_id, lower(name))`, `description` varchar(200) null, `params` jsonb (the settings, with `strictnessTI`; validated on write by the generate validator), `word_ids` uuid[] null, `tag_ids` uuid[] null (no foreign key; request `tagIds` is de-duplicated, at most 20 valid ids, `null`, missing or `[]` mean none; error `invalid_tag_ids`), timestamps.
- `practice_sessions`: `id`, `user_id` (cascade, index `(user_id, updated_at)`), `snapshot` jsonb (the full `Session`), `summary` jsonb (`{ answered, correct, total, languages, partsOfSpeech, cardTypes }`, correct counts partial), `expires_at`, timestamps.

## 3. API

Mounted at `/api/practice`. Always filtered by `req.user.id`. Another user's row, a missing, expired or badly formed id: `404`, never 403.

| Route | Behaviour |
|---|---|
| `GET /configs` | Newest first. Each row has `missingCount`, computed with the same `visibleWordCondition` as practice. |
| `POST /configs` | `201`. 400 for bad settings, 409 `name_taken`. |
| `PUT /configs/:id` | Name, description, settings and words. 409 `name_taken` (the row's own name is allowed). |
| `GET /configs/:id/words` | The saved words the user can still see, in the saved order, as `WordSimpleBE`. A followed original is swapped for the user's copy (`words-list.md` W-12). |
| `DELETE /configs/:id` | `204`. |
| `GET /sessions` | Summaries of non-expired sessions, newest first. |
| `GET /sessions/:id` | The full snapshot. |
| `POST /sessions` | Body `{ snapshot }` only. `201`. In one transaction, behind a per-user advisory lock (`pg_advisory_xact_lock`): delete expired rows; if 10 remain, delete the one with the smallest `updated_at`; insert. |
| `PUT /sessions/:id` | Replace snapshot and summary; new 7-day expiry; not counted against the limit. |
| `DELETE /sessions/:id` | `204`. |

Errors: `400 invalid_snapshot`, `400 snapshot_too_large` (limit 1,000,000 bytes; `express.json({ limit: '1mb' })` applies to `/api/practice/sessions` only, before the global 100 KB parser). The server checks the parts it depends on (counts, summary values, view, current) and stores the rest as sent. "Oldest" is the smallest `updated_at`, so a session in use is never deleted.

## 4. Behaviour (frontend)

- `Session.savedId: string | null`. Old stored blobs read as `null`. The snapshot sent to the server has no `savedId`.
- **Save session and leave:** `savedId` set: `PUT`; null: `POST`. A `404` on `PUT` falls back to `POST`. A failed save keeps the user in the session with the reason shown. A session is never lost silently.
- **Leave session and delete:** clear the local session. With `savedId`, also `DELETE` the saved row. If that fails, the user still leaves; the row expires.
- **Finish:** with `savedId`, `DELETE` the saved row and unlink (`savedId: null`). A failed delete is ignored.
- **Resume from the list:** `GET /sessions/:id`, load with `savedId`. The row stays. If a session is parked in this tab, ask first (`replaceDialog`). Resume drops any words that came from Review. A snapshot that fails `isSession` counts as "not available".
- **Banner Dismiss:** clears the local copy only. A saved copy stays in the list.
- A saved session whose words were deleted: saving an answer returns 404, and the card's `unsaved` state lets the session finish.
- Leave dialog buttons: **Save session and leave** (default, blue), **Leave session and delete** (red), **Keep practicing** (outline).
- Load a configuration: the form restarts with the new settings (key change) and the URL follows. `wordsMissing` is computed at load time. A configuration whose words are all gone still loads its settings and shows the banner. It never falls back to "all words". The banner is dropped when the user removes the pre-selection.
- The save dialog is rendered by the page, outside the set-up `<form>`, so it can never submit that form.
- Texts are in `practice.json` in all four locales, written in STE100.

## 5. Known limits and traps

- Snapshot trust: the server stores a client blob. It must never use it to change other data. Performance rows are written only through `/exercises/answers`.
- Stored exercises carry a performance snapshot from save time. Accepted: the next answer save returns fresh data.
- After "Save session and leave", the "Session saved…" toast (bottom centre, 5 s) covers the next click target. The e2e session test takes about 15 s and is `test.slow()`. A real user meets the same overlay.
- Out of scope: sharing, reminders, automatic saving during a session.

## 6. Open items

None.
