# Test inventory (2026-11-02)

Evidence for `.context/guides/testing-policy.md`. It is the input of the prune plan (`.context/plans/test-prune-pass.md`). Nothing here is a task.

## Method

- **Static count ("grep"):** one `it(` or `test(` call is 1 test. A row of `it.each`, or a test made in a loop, counts as 1. The groups, the largest files and the findings below use this count.
- **Runner count:** the number that the test runner prints after a full run on 2026-11-02 (all suites green). It is higher than the static count because of generated tests. The totals table shows both. Use the runner count for "how many tests"; use the static count to compare files.
- Source lines are all `.ts`, `.tsx` and `.js` lines that are not tests (migrations excluded).
- Titles were read from the files. Only the runner counts and the run times come from a run.

## Totals

| Workspace | Tool | Files | Tests (static) | Tests (runner) | Run time | Test lines | Source lines | Test lines / source lines |
|---|---|---|---|---|---|---|---|---|
| frontend | Vitest + MSW | 144 | 1,820 | **2,086** | 51 s | 26,888 | 33,306 | 0.81 |
| backend | Jest + supertest + Postgres | 74 | 1,485 | **2,947** | 328 s | 20,824 | 18,054 | 1.15 |
| e2e | Playwright | 47 | 199 | **196** | 173 s | 8,854 | 1,613 (helpers) | — |
| admin | Vitest | 26 | 310 | **329** | 14 s | 4,708 | 6,374 | 0.74 |
| landing | node scripts | 5 | 40 | not run | — | 442 | — | — |
| **Total** | | **296** | 3,854 | **about 5,600** | | 61,716 | | |

The backend runner count is about twice the static count (1,462 more). The source of the extra tests is not checked yet. Files with `it.each` are `exercisesCatalogue` (11), `adminUserEmails` (5), `onboardingPool`, `reservedNames` and `reservedNamesApi` (3 each); loops over word lists exist too (for example in `lexiconSelectorsDE`). Slice 0 of the prune plan counts the tests of each file from the runner. The e2e runner count is 196 in 47 files (`playwright test --list`); `deployed-smoke.spec.ts` has its own config and is not in the list.

## Groups

**Frontend (1,820 tests)**

| Group | Files | Tests |
|---|---|---|
| Page flows (`pages/*.test.tsx`) | 13 | 304 |
| Auth, access, demo, onboarding, captcha flows | 10 | 128 |
| Query hooks (`hooks.test.tsx`) | 5 | 70 |
| Components (not pages, not UI primitives) | 52 | 689 |
| UI primitives (`components/ui/`) | 5 | 13 |
| Pure logic (`.ts`) | 50 | 576 |
| Form-engine config tests | 7 | 100 |
| Locale-file tests | 4 | 11 |

**Backend (1,485 tests)**

| Group | Files | Tests |
|---|---|---|
| Integration (`tests/*.test.js`) | 50 | 1,108 |
| of which admin routes | 17 | 274 |
| of which access, demo, captcha, OAuth, auth | 15 | 331 |
| of which words, tags, dictionary, clone, lexicon | 6 | 324 |
| of which practice and exercises | 5 | 111 |
| Unit (`tests/unit/`) | 23 | 358 |
| of which lexicon selectors | 6 | 111 |
| of which exercise engine | 8 | 109 |

**e2e (199 tests)**: phase gates 29 · autocomplete 57 (10 specs: one for each language or slice) · admin 44 · OAuth 16 · other features about 48 · layout-only specs 5.

**Admin (310 tests)**: pages and components 260 (15 files) · pure logic 50 (11 files). `AccessPage.test.tsx` has 68 tests.

## Largest files

| Tests | File |
|---|---|
| 131 | `backend/tests/dictionary.test.js` |
| 98 | `frontend/src/features/words/form-engine/TranslationCard.test.tsx` |
| 81 | `backend/tests/tags.test.js` |
| 76 | `backend/tests/auth.test.js` |
| 68 | `admin/src/features/access/AccessPage.test.tsx` |
| 60 | `frontend/src/features/words/pages/ReviewPage.test.tsx` |
| 48 | `backend/tests/words-simple.test.js` |
| 44 | `frontend/src/features/tags/pages/TagViewPage.test.tsx` |

## Findings

### F1. Layout and visual assertions

About 170 lines assert classes, styles or geometry (`toHaveClass`, `toHaveStyle`, `.className`, `getComputedStyle`, `boundingBox`, `getBoundingClientRect`, `classList`): frontend 144, e2e 15, admin 11.

Files with the most: `TranslationCard.test.tsx` 25, `ReviewTable.test.tsx` 15, `FieldRenderer.test.tsx` 13, `TagWordsTable.test.tsx` 10, `PreselectedWords.test.tsx` 10, `admin/.../ColumnChart.test.tsx` 9.

Examples of titles:
- `button.test.tsx`: "renders the default (primary) variant at 36px with the Ladu radius".
- `input.test.tsx`: "renders at 36px with the Ladu control padding".
- `TranslationCard.test.tsx`: "bottom-aligns the cells of a paired row", "reserves room under a mandatory field…" (about 13 tests on alignment and room).

Four e2e specs test only geometry: `section-title-alignment.spec.ts`, `words-sidebar-layout.spec.ts`, `verb-radio-rows.spec.ts` (rows share a line on desktop and stack on a phone), `field-affixes.spec.ts`.

Not all of this is waste. Tests of structure that changes between phone and desktop (a scroller, a stacked column) test behaviour. The policy keeps that kind (§2, point 5).

### F2. One rule tested at many layers

The word "See" (the "der See" homograph rule) appears in 8 test files:
- backend: `dictionary.test.js`, `lexiconLoad.test.js`, `unit/lexiconTranslations.test.js`;
- frontend: `TranslationCard.test.tsx`, `autocomplete/hooks.test.tsx`;
- e2e: `autocomplete-b-german-lexicon.spec.ts`, `autocomplete-f-type-ahead.spec.ts`, `autocomplete-slice-g-start-from-word.spec.ts`.

Autocomplete as a whole: 111 unit tests (lexicon selectors), 131 integration tests (`dictionary.test.js`), a large block in `TranslationCard.test.tsx` and `autocomplete/`, and 57 e2e tests in 10 specs.

### F3. Component tests that repeat page tests

Example: `TagWordsTable.test.tsx` (41 tests) and `TagViewPage.test.tsx` (44 tests) cover much of the same behaviour. The same pattern may exist for the review table and the review page. Not checked test by test.

### F4. e2e tests that check backend rules through the API

33 e2e files call the API directly (`page.request`, `request.get/post`). Some of these prepare data (fine). Some assert a backend rule. Example: `phase-5-5-saved-practice.spec.ts`, "privacy: a second account … 404 for every id". The backend integration suite already owns these rules. (The first version of this record named `phase-2-noun-crud` "GET /api/words/:id for another user". That was wrong: the test is a browser flow that checks a notice and a redirect.)

### F5. Meta tests

- Useful and cheap: locale parity (`lib/locales.test.ts`), third-party licence notices (`third-party-notices.test.ts`, frontend and admin).
- Low value: `frontend/src/test/smoke.test.ts` ("runs Vitest"), `backend/tests/sanity.test.js`, `backend/tests/snapshots.test.js` (data-shape snapshots).

### F6. Admin tool

Admin is an internal tool. It has 310 tests, 26 files. `AccessPage.test.tsx` has 68 tests. Check which of them prove a user journey.

## What this inventory does not show

- Run time of each suite. Measure it before the prune slice, so that the gain can be shown.
- Which tests found a real bug in the past. `git log` can give a hint.
- Coverage numbers. `npm run test:coverage` exists for the backend only.

## Baseline (Slice 0 of the prune plan, 2026-11-02)

All four suites were green. The runs had v8 coverage on (not for e2e), so the times are a little higher than in the totals table: admin 20 s, frontend 66 s, backend 333 s, e2e 170 s. The reports are kept outside the repo; the numbers are here.

### Coverage

| Workspace | Lines | Functions | Branches |
|---|---|---|---|
| admin | 96.36% (4,857 / 5,040) | 95.44% | 94.66% |
| frontend | 95.24% (21,134 / 22,189) | 92.39% | 92.58% |
| backend | 93.26% (5,343 / 5,729) | 92.97% | 87.04% |

After each prune slice, the same run is compared file by file. A file that loses covered lines is explained or the removal is undone.

### Where the test count comes from
`backend/tests/unit/onboardingPool.test.js` has **1,193 tests** and runs in 0.6 s. It checks every word of the onboarding pool, so it is a data check, not a repeat. Without it the backend has 1,754 tests. The "5,600 tests" total is high only because of this file.

### Where the time goes

**Backend: 329 s, in one line.** The suite runs with `maxWorkers: 1` (one shared database), so the sum of the file times equals the wall time. Eight files take 53% of it:

| Seconds | Tests | File |
|---|---|---|
| 49.1 | 85 | `tags.test.js` |
| 32.1 | 131 | `dictionary.test.js` |
| 21.4 | 59 | `exercises.test.js` |
| 18.5 | 55 | `words-simple.test.js` |
| 14.9 | 78 | `auth.test.js` |
| 13.3 | 26 | `wordClone.test.js` |
| 12.0 | 30 | `adminStaff.test.js` |
| 11.5 | 37 | `practiceConfigs.test.js` |

The average is 0.19 s for each database test (329 s / 1,754). Two costs measured on 2026-11-02:
- `clearDB()` (runs before each test, truncates the tables): **59 ms**.
- One `bcrypt` hash at 10 rounds (the value in `userController.ts` and `staffAccounts.ts`; a register plus a login is two hash operations): **72 ms**.

One cleanup plus one register and login is about 0.2 s, which matches the average. This is an estimate, not a file-by-file measure. The consequence: in the backend, a test costs about 0.2 s whatever it asserts, so removing a database test saves about 0.2 s.

**e2e: 170 s wall, 630 s summed over 6 workers.**
- The 11 autocomplete specs take 249 s (40%). The largest: `i-conjunctions-prepositions` 38 s, `h-reflexive` 34 s, `g-adjectives-adverbs` 33 s, `j-french-lexicon` 27 s.
- `language-french-forms.spec.ts` takes 79 s (12.5%) for 18 tests.
- The 4 geometry specs take 21 s together (3%).

**Frontend: 51 s wall, 311 s summed.** The slowest: `ReviewPage.test.tsx` 43 s (60 tests), `PracticePage.configs` 19 s, `TagViewPage` 17 s, `TranslationCard` 16 s (105 tests), `PracticePage.test` 16 s, `PracticePage.tags` 16 s, `onboarding.test` 15 s.

**Admin: 14 s wall.** `AccessPage.test.tsx` is 14 s of the 51 s sum (75 tests).
