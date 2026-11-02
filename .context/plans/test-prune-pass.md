# Plan: Test prune pass (I-10)

Status: **Slices 0, 2, 3 and 4 done on 2026-11-02; the decision gate passed (Q4). Next: Slice 7 (close). Not run: Slices 1, 5, 6.** Origin: deferred idea I-10 (`.context/backlog/deferred-ideas.md`), from the testing-policy discussion. The rules are in `.context/guides/testing-policy.md`. The evidence is in `.context/research/2026-11-test-inventory.md`.

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
| Q3 | **Slice 0 first, then decide.** The totals are normal for the size of the project (ratio 0.74 to 1.15), and the git history shows little cost from the layout tests (`button` and `input` tests changed once; the geometry specs were added with layout work and rarely edited). So only Slice 0 is committed. At the **decision gate** after Slice 0, you choose which of Slices 1 to 6 to do, from the per-file data. Slices 4, 5 and 6 are optional. |
| Q4 | **Decision at the gate (2026-11-02): run Slices 2, 3 and 4, in that order.** Slices 1, 5 and 6 are **not run** (small or unmeasured gain; Slice 1 may remove regression tests; Slice 6 has the highest risk). They stay in this plan as notes; they come back only if the user asks. The backend speed idea is saved as deferred idea I-11. |

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

### Decision gate (after Slice 0)

Show you, from the Slice 0 data: the files that take most of the run time of each suite, the source of the generated backend tests, and the coverage overlap between layers. Then you choose the slices to run. Questions to answer at the gate, with the Slice 0 data (full tables in the inventory record, "Baseline"):
- **Is the 328 s of the backend suite caused by a few files?** Partly: 8 files take 53% (`tags` 49 s, `dictionary` 32 s, `exercises` 21 s…). But the cost is per test, not per assertion: about 0.2 s for each database test (cleanup 59 ms, plus a `bcrypt` register and login at 72 ms for each hash). Removing a database test saves about 0.2 s. A speed fix (a cheaper hash in the test environment, a lighter cleanup) is a separate idea and a product-code change.
- **Do the layout and style tests (Slice 5) cost run time or noise?** The git history says little. The 4 geometry e2e specs take 21 s of 630 s (3%).
- **Does the coverage data show clear duplicates between component and page tests (Slice 6)?** Not decided by Slice 0 alone: coverage is 93 to 96% lines in all three workspaces. The overlap is found pair by pair, in the slice. If the first pair shows no clear duplicates, drop Slice 6.
- **Where is the e2e time?** The 11 autocomplete specs take 249 s of 630 s (40%) and `language-french-forms` takes 79 s (12.5%). Slice 4 (autocomplete) is the one slice with a measured gain.
- **The test count is misleading.** `onboardingPool.test.js` makes 1,193 of the 2,947 backend tests in 0.6 s. Use run time, not test count, to judge a slice.

## Slice 1: The e2e geometry specs (category 2)

Overview: four specs measure boxes in a real browser: `section-title-alignment`, `words-sidebar-layout`, `verb-radio-rows`, `field-affixes` (5 tests). The policy keeps responsive **structure** and drops pure geometry. The policy also keeps **regression tests** (§5), and these specs were added with layout fixes. So check that first.

0. **Regression check.** For each spec, read the commit that added it (`git log --diff-filter=A -- <spec>`). If the commit fixed a reported bug, keep the spec, or move one structure assertion to a lower test. If the commit only added a layout feature, it can go.
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

## Slice 4: Autocomplete repeats (category 3) (optional: decided at the gate)

Overview: autocomplete is tested at four layers: backend unit (111 static tests in the lexicon selectors), backend integration (`dictionary.test.js`, 131), frontend (`TranslationCard`, `autocomplete/hooks`), and e2e (10 specs, 57 tests).

1. Build an **owner table**, one row for each rule (a lexicon fill rule, a fallback, the homograph rule, the 502 on a failing Ekilex, the type-ahead list, the draft from "Start from a word"). For each rule: the layer that owns it, and every other test that repeats it.
2. Target shape (policy §4): the lexicon selectors own the language data; `dictionary.test.js` has one case for each route behaviour (found, partial, not-found, 502) and each part of speech, not one for each word; frontend tests own the fill and the type-ahead behaviour; e2e has **one** spec (type, pick, fill, save, in one language) and one for "Start from a word".
3. Show you the table with the tests to remove for each rule. Delete after your answer.

This slice removes the most tests. It runs after Slices 1 to 3, so that the coverage guard is already proven.

## Slice 5: Layout and style assertions (category 1) (optional: decided at the gate; the weakest evidence)

Overview: about 170 lines assert classes, styles or boxes (frontend 144, e2e 15, admin 11).

1. Take the files in the order of the inventory (most assertions first): `TranslationCard`, `ReviewTable`, `FieldRenderer`, `TagWordsTable`, `PreselectedWords`, admin `ColumnChart`, then the rest.
2. For each assertion, label it: **structure** (hidden on a phone, stacked, scrolls, present or not: keep), or **style** (px, radius, colour, alignment, spacing: remove).
3. UI primitives: `button.test.tsx` and `input.test.tsx` test pixel sizes and the radius. Keep only what they say about behaviour (disabled, `aria-invalid`), tested by role or attribute, not by class.
4. Show you the list for each batch of files. Edit or delete after your answer.

## Slice 6: Component tests that repeat page tests (category 4) (optional: dropped unless the coverage data shows clear duplicates)

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
| 1 | 0 | Minor | The first inventory counted only `it(` calls (3,854). The runners count 5,598. | Corrected in the inventory record. |
| 2 | 0 | Minor | The e2e test `phase-2-noun-crud` "GET /api/words/:id for another user's word is refused" looked like an API check. Its body is a browser flow (notice and redirect). | Kept. Title changed to "another user's word page shows a notice and returns to the dashboard". |
| 3 | 2 | Minor | Removing the `phase-5-5` privacy test left `other` and `configId` written but never read; `captcha-gate` left `blockedEmail` unused. | Removed with the tests. `tsc --noUnusedLocals` is clean for the edited files. |
| 4 | 2 | Minor | `tsc --noUnusedLocals` reports `SIGNED_NAME` unused in `language-french-forms.spec.ts` (line 423). Not from this pass. | Not changed. The user decides. |
| 5 | 2 | Result | Removed 4 e2e tests (`admin-6`, `admin-9`, `phase-5-5`, `captcha-gate`) and the API half of 2 (`admin-13`, `admin-8`). Every rule has a backend owner test (listed in the slice review). No backend test needed adding. `npm run test:e2e`: 192 passed in 171 s. Frontend and backend coverage cannot change (e2e files only). | Done. |
| 6 | 3 | Result | Removed `frontend/src/test/smoke.test.ts`, 3 of 5 tests in `backend/tests/sanity.test.js` (kept `GET /` and `GET /api/health`: the e2e boot check and the Docker health check use them), `e2e/tests/smoke.spec.ts` (3) and `e2e/tests/oauth-0-harness.spec.ts` (5). Kept `snapshots.test.js` (the only shape test of Word, Tag and ExercisePerformance). Updated `e2e/README.md` and `features/oauth-login-strategy.md`. Result: admin 329, frontend 2,085, backend 2,944, e2e 184 tests, all green; coverage diff: no file lost covered lines (frontend 95.24%, backend 93.26%, admin 96.36%, all unchanged). | Done. |
| 7 | 3 | Minor | Two coverage runs of the frontend each failed one test by timeout: `onboarding.test.tsx` "keeps Next off until the step is complete…" (5.1 s) and `ReviewPage.test.tsx` "a selection survives a change of page, and back" (5.4 s). The Vitest default limit is 5 s. These tests take 4 to 5 s alone (many `userEvent` clicks in jsdom), so extra load can push them over. Not caused by the prune. | The coverage runs of this plan now use `--testTimeout=30000` (a flag in the scratch script; no repo change). The slow tests are not changed. The user decides if they get a larger limit or fewer clicks. |
| 8 | 4 | Result | Autocomplete e2e: 58 tests (the runner count; the static count said 57) became 21 in the same 11 files: 15 at first, then 6 restored after the review in row 10. Kept: DE noun, adjective and prepositions; ES verb, noun and gendered adjective; EN noun, modal verb, adjective and adverb; ET verb, adjective, adverb, conjunction and preposition; FR verb, "se laver", noun and adjective; the "See" pick; DE save and reload; the English start. Removed 37; every removed rule has an owner in `backend/tests/dictionary.test.js`, the lexicon unit tests, `TranslationCard.test.tsx`, `AutocompleteRow.test.tsx`, the form config tests, `StartFromWord.test.tsx` or `AddWordPage.test.tsx` (matched by test title; the bodies were read for some, not all). Header comments of the 11 specs updated. `guides/add-language.md` asks for one noun and one verb in e2e for a new language. `npm run test:e2e`: 147 passed in 144 s (was 171 s). Autocomplete e2e: 249 s to 100 s of summed time. | Done. |
| 9 | 4 | Minor | `plans/french-pronominal-type-ahead.md` plans new e2e cases in `autocomplete-j-french-lexicon.spec.ts` (type `se la`, pick "se laver", check the list). Under the policy, the backend route test and the frontend type-ahead test own that list; one e2e case is enough. | Not changed here. Read the plan against the policy when it is built. |
| 10 | 4 | Major | **Review after Slice 4 (the user asked to confirm that the coverage is the same): it is not the same.** The logic of each side stays covered, but the whole chain (real backend answer, real form field, save) is no longer run for every language and part of speech. Two statements of mine were wrong: "one seam test for each language and part of speech" (the kept list had gaps), and the use of the line-coverage diff as a guard (the e2e suite has no coverage tool, so it proves nothing for Slices 2 and 4). Measured on 2026-11-02 with a throwaway script (backend selector tables against the frontend form configs, EN, ES, DE, FR): 202 backend case names, 191 have a form field, 11 do not (Spanish verb conditional and imperative: deliberate, the form never shows them). No drift today. Estonian, values and formats were not checked. No test compares the two name lists, so a rename on one side only would pass the unit and integration suites. | The user chose option C: restore 6 whole-chain tests (ES noun, ES gendered adjective, EN modal verb, EN adjective with the adverb, FR noun, FR adjective). **Cells still without a whole-chain test:** ES adverb, conjunction and reflexive fill (and the ES reflexivity save); EN conjunction; DE adverb and conjunction; ET noun; FR conjunction. A contract test (every backend case name has a frontend field, except the 11 known extras) was offered and not chosen. |
