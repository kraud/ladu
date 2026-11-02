# Plan: Test prune pass (I-10)

Status: **planned on 2026-11-02, not built.** Origin: deferred idea I-10 (`.context/backlog/deferred-ideas.md`), from the testing-policy discussion. The rules are in `.context/guides/testing-policy.md`. The evidence is in `.context/research/2026-11-test-inventory.md`.

Goal: remove the tests that the policy would not have added (detail tests, repeats across layers, API-rule checks in e2e, low-value meta tests), without losing the proof of any real rule. Product code does not change.

Working rules: one slice at a time, a plain-language overview before any file change, you review the list of tests to remove **before** I delete anything, the user commits (one commit for each slice).

## Baseline (measured 2026-11-02, all suites green)

| Workspace | Tests (runner) | Run time |
|---|---|---|
| frontend | 2,086 | 51 s |
| admin | 329 | 14 s |
| backend | 2,947 | 328 s |
| e2e | 196 | 173 s |

Success is not "fewer tests". Success is: less run time and less maintenance, the same proof of the rules. Slice 0 sets the numbers to compare against.

## Decisions (taken 2026-11-02)

| # | Decision |
|---|---|
| Q1 | **Safety guard: line coverage before and after.** Frontend and backend already have a coverage tool. Admin gets `@vitest/coverage-v8` as a dev dependency (same version as the frontend: `^3.2.7`). |
| Q2 | **Admin is in scope**, with the same rules as the frontend. |

## What counts as "remove"

Remove a test only when **all** of these are true:
1. It is a detail test (policy §3), or a repeat of a rule that a lower layer owns (policy §4).
2. The coverage guard shows no loss in code that is not styling. A loss in a file that holds only layout is fine.
3. You approved it on the list of its slice.

Keep, even if they look small: form-engine config tests, locale parity, licence-notice tests, and any test that names a past bug (policy §5).

A test that mixes behaviour and style: **edit it**. Remove the style assertion and keep the behaviour. A test whose only point is style: delete it.

## Slice 0: Baseline (no test removed)

Overview: before we remove anything, we record what we have, so that the gain and the loss can be shown.

1. Admin: add `@vitest/coverage-v8@^3.2.7` to `admin/package.json` (and the lockfile).
2. Run coverage for frontend, admin and backend. **Write the reports outside the repo** (the repo does not ignore `coverage/`): Vitest `--coverage.reportsDirectory=<scratchpad>/cov-before-<ws>` with the `json-summary` reporter; Jest `--coverageDirectory=<scratchpad>/cov-before-backend --coverageReporters=json-summary`.
3. Record, for each workspace, the tests and the run time of **each file** (Vitest `--reporter=json`, Jest `--json`, Playwright `--reporter=json`). This also shows which backend files make the 1,462 generated tests, and which files take the most time.
4. Add a "Baseline" section to the inventory record: the per-file top 15 by run time, and the top 15 by test count.
5. Write a small diff script in the scratchpad (not in the repo) that compares two `coverage-summary.json` files and lists the files whose line coverage fell.

Result: numbers in the inventory record; the admin dependency is the only change outside `.context/`.

## Slice 1: The e2e geometry specs (category 2)

Overview: four specs measure boxes in a real browser: `section-title-alignment`, `words-sidebar-layout`, `verb-radio-rows`, `field-affixes` (5 tests). The policy keeps responsive **structure** and drops pure geometry.

1. For each spec, find out if a Vitest test already proves the structure part. Known: `TranslationCard.test.tsx` has the phone and desktop verb-grid tests; `SidebarLayout.test.tsx` has the open and collapsed tests; `PageTitle.test.tsx` has the icon column test.
2. Where the structure part has no lower test, move **one** structure assertion to a Vitest test first.
3. Show you the list (spec, what it proves, where the lower test is). After your answer, delete the spec files.
4. Clean up: the `E2E_SHOT_DIR` screenshot lines in the specs that stay; docs that name these specs (`grep` the file names in `.context/` and `e2e/README.md`).

Expected: up to 4 spec files deleted, 5 tests.

## Slice 2: e2e checks of backend rules (category 5)

Overview: some e2e tests prove a rule of the API (403, 404, 401, "refused") that a backend integration test owns. They cost a browser run and add no proof.

Candidates (from the titles; each needs a check of its body):
`phase-2-noun-crud` "GET /api/words/:id for another user's word is refused" · `phase-5-5-saved-practice` "privacy: a second account … 404 for every id" · `admin-6-health` "the API refuses a request without a staff token" · `admin-9-stats` "the API answers staff only …" · `admin-13-badges` "only the owner may grant … the API answers 403" (the UI half stays) · `admin-8-staff` "an admin has no staff page, the API refuses it …" (the UI half stays) · `captcha-gate` "a direct API call with no token is refused" · `smoke` "protected endpoint rejects an unauthenticated request" · `oauth-0-harness` "token exchange rejects a mismatched PKCE verifier" (this tests our own test stub; decide).

For each candidate: name the backend test that owns the rule (file and test title). If there is none, **add the backend test first** (this is a gain, not a loss), then remove the e2e part. Show you the table; delete after your answer.

## Slice 3: Low-value meta tests (category 6)

Overview: tests that prove the tool runs, not a rule of Ladu.

Candidates: `frontend/src/test/smoke.test.ts` ("runs Vitest") · `backend/tests/sanity.test.js` (5 tests; the database check is also proven by every other backend test) · `backend/tests/snapshots.test.js` and its `.snap` (data-shape snapshots) · `e2e/tests/smoke.spec.ts` (3 tests: the harness boots; keep the first one only if no other spec fails fast when the stack is down).

Keep: locale parity (`lib/locales.test.ts`) and the two `third-party-notices.test.ts`.

Show you the list. Check each: does a snapshot protect a response shape that no other test asserts? If yes, replace it with one explicit assertion, then delete the snapshot.

## Slice 4: Autocomplete repeats (category 3)

Overview: autocomplete is tested at four layers: backend unit (111 static tests in the lexicon selectors), backend integration (`dictionary.test.js`, 131), frontend (`TranslationCard`, `autocomplete/hooks`), and e2e (10 specs, 57 tests).

1. Build an **owner table**, one row for each rule (a lexicon fill rule, a fallback, the homograph rule, the 502 on a failing Ekilex, the type-ahead list, the draft from "Start from a word"). For each rule: the layer that owns it, and every other test that repeats it.
2. Target shape (policy §4): the lexicon selectors own the language data; `dictionary.test.js` has one case for each route behaviour (found, partial, not-found, 502) and each part of speech, not one for each word; frontend tests own the fill and the type-ahead behaviour; e2e has **one** spec (type, pick, fill, save, in one language) and one for "Start from a word".
3. Show you the table with the tests to remove for each rule. Delete after your answer.

This slice removes the most tests. It runs after Slices 1 to 3, so that the coverage guard is already proven.

## Slice 5: Layout and style assertions (category 1)

Overview: about 170 lines assert classes, styles or boxes (frontend 144, e2e 15, admin 11).

1. Take the files in the order of the inventory (most assertions first): `TranslationCard`, `ReviewTable`, `FieldRenderer`, `TagWordsTable`, `PreselectedWords`, admin `ColumnChart`, then the rest.
2. For each assertion, label it: **structure** (hidden on a phone, stacked, scrolls, present or not: keep), or **style** (px, radius, colour, alignment, spacing: remove).
3. UI primitives: `button.test.tsx` and `input.test.tsx` test pixel sizes and the radius. Keep only what they say about behaviour (disabled, `aria-invalid`), tested by role or attribute, not by class.
4. Show you the list for each batch of files. Edit or delete after your answer.

## Slice 6: Component tests that repeat page tests (category 4)

Overview: a component test and a page test often make the same user action against the same MSW call. This is the riskiest slice, so it is last.

1. Start with the pairs the inventory names: `TagWordsTable` (41) and `TagViewPage` (44); then the review table and the review page; then practice (`SessionView`, `ResultsView`, `PracticePage.*`); then words.
2. For each pair, compare the titles and the MSW calls. A component test is a candidate when the page test already makes the same action and checks the same result.
3. Use the coverage guard for each pair, not only at the end of the slice.
4. Show you the list for each pair. Remove after your answer.

Also decide here, with the Slice 0 numbers: if a few backend files take most of the 328 s (for example password hashing in auth tests), a speed fix is a **separate** idea (add it to `deferred-ideas.md`). It is not part of this pass.

## Slice 7: Close

1. Run all suites and the e2e gate, and the coverage diff against the Slice 0 baseline.
2. Add an "After" section to the inventory record: tests, run time, coverage, and the number removed for each category.
3. If a rule of the policy changed during the pass, change the policy.
4. Write the archive record (`.context/archive/2026-11-test-prune-pass.md`, 30 lines or fewer), delete this plan, and remove I-10 from the deferred ideas with a history line.

## Verification for each slice

- `npm test -w frontend`, `npm test -w admin` and `npm test` (backend) are green. Do not pipe the commands through `tail` or `head`; read the exit code.
- After a slice that touches e2e: `npm run test:e2e` is green.
- The coverage diff lists no fall in a file that holds logic. Each fall is explained in the slice's log line.
- `git status` shows only test files, `.snap` files, `.md` files and (Slice 0) the admin dependency. No product code.
- At the end of the slice, I suggest a commit message with the numbers (tests removed, time saved).

## Review log

| # | Slice | Severity | Finding | Resolution |
|---|---|---|---|---|
| | | | (filled while the slices run) | |
