# Plan: Dependency updates (replaces Dependabot PR #139)

Status: not started. Written on 2026-11-26. No file has been changed yet.

Goal: bring in the updates of PR #139 through small PRs. Each PR can be reviewed, tested and reverted alone. **Do not merge #139.**

## Progress

Update this table when a PR opens and when it merges.

| PR | Content | Risk | State | GitHub PR |
|---|---|---|---|---|
| 1 | Security fixes; pause Dependabot npm updates | Low | Not started | |
| 2 | All minor and patch updates; remove `@dnd-kit` | Low | Not started | |
| 3 | Express 5 | Medium | Not started | |
| 4 | `bcryptjs` 3, `dotenv` 18, `concurrently` 10 | Low | Not started | |
| 5 | Test tooling: `jsdom` 31, `msw` 3, `jest-dom` 8 | Medium | Not started | |
| 6 | Vite 8 and `@vitejs/plugin-react` 6 | Medium | Not started | |
| 7 | `react-error-boundary` 6, `react-toastify` 11, `zustand` 5, `cn` 0.5 | Medium | Not started | |
| 8 | React 19 | Medium | Not started | |
| 9 | `@tanstack/react-table` 9 | Medium | Not started | |
| 10 | `@hookform/resolvers` 7 | Medium | Not started | |
| 11 | i18next 27 and `react-i18next` 18 | Medium | Not started | |
| 12 | Sentry 11 (backend and frontend) | **High (privacy)** | Not started | |
| 13 | Close the plan; turn Dependabot on again | Low | Not started | |

## Starting point (checked on 2026-11-26)

- **Production dependencies:** 0 known vulnerabilities (`npm audit --omit=dev`). `landing/`: 0.
- **All dependencies:** 21 audit entries (5 high, 16 moderate), from 5 advisories in development tools: `zod` and `semver` (high); `minimatch`, `ip-address` and `esbuild` (moderate).
- **Malware:** the OSV database had no record for any locked version.
- **CI on #139:** typecheck, frontend tests (1242 fail), admin tests (276 fail), backend tests (2 of 2991 fail), E2E (53 fail, 96 not run) and the `web` and `admin` images fail.
- **Runtime:** production uses Node 24.22.3, which has the security fixes of 2026-11-11.
- **Not updated by this plan:** TypeScript (frontend and admin stay on 5.9, backend on 6; TypeScript 7 stays ignored), Node 24, Postgres (see `postgres-major-upgrade.md`), Docker base images and GitHub Actions (Dependabot continues for these).

## Why this order

1. **Security first.** PR 1 is small and removes both high advisories.
2. **Minor and patch next.** Later PRs then show only the effect of one major change.
3. **Backend (3, 4) before frontend.** Express 5 fails only 2 tests, and it removes the Express 4 end-of-life question early.
4. **Test tooling (5) before the build tool (6) and React (8).** Test tools do not reach production. Later PRs are then checked on the final tools.
5. **Small React libraries (7) before React 19 (8).** All of them work on React 18, so a failure in PR 8 is a React 19 failure.
6. **`react-table` (9), forms (10) and i18n (11) after React 19.** One variable at a time.
7. **Sentry (12) last.** It touches backend and frontend. It is checked once, on Express 5 and React 19.

Hard rules from the package requirements: `plugin-react` 6 needs Vite 8 (same PR). `react-i18next` 18 needs i18next 27 (same PR). `react` and `react-dom` change in `frontend/` and `admin/` in the same PR, because both share one lockfile. `jest-dom` 8 needs Vitest 5 (already installed).

PRs 3 and 4 do not depend on PRs 5 to 11. You can move them if you want.

## Rules for every PR

- Start from a fresh `main`. One PR from the table, one branch.
- Add `--min-release-age=7` to every `npm install` and `npm update`. It skips releases younger than 7 days, to reduce the risk of a malicious release. Consequence: you can get a version a little older than the one in #139 or the newest one. That is correct.
- Use `npm`, not manual edits of `package-lock.json`.
- **Checks before the PR is ready:**
  - `npm ci`
  - `npm run lint` and `npm run typecheck` in `backend`, `frontend` and `admin`
  - `npm test -w backend`, `npm test -w frontend`, `npm test -w admin`
  - `npm run build -w frontend` and `npm run build -w admin`
  - `npm run test:e2e`
  - `npm ls react react-dom` shows **one** version of each
  - `npm audit` is not worse than before the PR
- Check the installed result, not only the lockfile: run `npm ci` after a lockfile change.
- Write the versions, the audit count and any surprise in "Review log".
- Suggest a commit message after each step. The user makes the branches and commits.
- **A merge to `main` deploys to production after the staging smoke test.** Check the change locally first. To roll back, revert the PR.

## The PRs

### PR 1: Security fixes and Dependabot pause

Branch: `deps/01-security`

1. In `backend/package.json`, set `nodemon` to `^3`.
2. Run `npm install`, then `npm audit fix` (no `--force`).
3. In `.github/dependabot.yml`, in the root npm entry only, set `open-pull-requests-limit: 0`, with a comment that points to this plan. This stops version updates. Security updates continue.
4. Run `npm run dev` and change a backend file. `nodemon` must restart the server.
5. **User, on GitHub:** close #139 without a merge, after this PR merges.
6. **User, on the Mac:** update Node to 24.22.3 or newer.

Expected audit (tried on a copy, 2026-11-26): 6 moderate, 0 high. The rest comes from `esbuild` (through `drizzle-kit`) and `minimatch` (through `nodemon` 3.1.14).

Done when: 0 high advisories and #139 is closed.

### PR 2: Minor and patch updates; remove `@dnd-kit`

Branch: `deps/02-minor-patch`

1. Remove `@dnd-kit/core`, `modifiers`, `sortable` and `utilities` from `frontend`. No file in `frontend/src` or `admin/src` imports them. Add a note in `roadmap.md` (Phase 7) that the package must be added again if the language ordering uses it.
2. Set `@types/node` to `^24` in `backend` and `e2e` (today: 26 and 20). The types must match the runtime.
3. Run `npm update --save`. It stays inside the current ranges, so no major version and no `cn` 0.5.
4. Check the diff of every `package.json`. No major number changes, except `@types/node`.
5. Look at the language libraries (`english-verbs-*`, `german-*`, `spanish-verbs`, `rosaenlg-gender-es`, 3.3 → 3.4 and 5.3 → 5.4). `services/dictionary/generators.ts` uses them, so new data can change generated forms. A failing dictionary test is a real finding, not noise.

Done when: all checks pass, and `npm outdated` shows only the majors of this plan.

### PR 3: Express 5

Branch: `deps/03-express-5`

1. Read the Express 5 migration guide. Set `express` to `^5`.
2. **Query parser (decision D1).** Keep the simple parser. Add one small shared check that answers 400 when a query key contains `[`. Call it in `listAudit` (`controllers/admin/auditController.ts`) and `listUsers` (`controllers/admin/userController.ts`). **Do not change the two tests** (`tests/adminAudit.test.js`, `tests/adminUsers.test.js`): they pass again with this check.
   - **Why they expect 400.** Express 4 turned `staff[]=x` into a list under the key `staff`. The controllers refuse a filter that is not text. A list must not crash the code (500), and a wrong filter must not be ignored, because the admin would then see unfiltered rows.
   - **What changes in Express 5.** The key stays `staff[]`, so the controller sees no `staff` filter and answers 200 with all rows. In the audit test, `staff[]=x`, `action[]=x` and `from[]=…` are all affected (the test stops at the first one). In the users test, the 400 came from `status[]`; `search[]` was ignored.
   - Keep the existing text-type guards. A repeated key (`status=a&status=b`) is still a list.
3. **`req.body`.** It is `undefined` when the request has no body. Direct destructuring then gives 500 (`userController.ts:351` and `:761`, `oauthController.ts:337` and `:476`). Add one small middleware after the body parsers in `app.js` that sets `req.body` to `{}`. Add one test: `POST /api/users/login` with no body answers 4xx.
4. Check `res.status` calls with a value that can be invalid, `res.redirect`, `app.listen` error handling, and route paths.
5. Check that the frontend list filters still work. They send repeated keys (`pos=Noun&pos=Verb`), which the simple parser reads as a list.

Do not remove `express-async-handler` in this PR.

Done when: all checks pass, including E2E for the word list filters, Google sign-in and the admin pages.

### PR 4: Backend small majors

Branch: `deps/04-backend-majors`

1. `bcryptjs` 3 in `backend` and `e2e`. Remove `@types/bcryptjs` from both (the package has its own types).
   - New hashes start with `$2b$`. Old hashes still work. A rollback is safe: version 2.4.3 also reads `$2b$` (checked in its code).
   - Test: log in with a user created **before** the update, as a learner and as staff.
2. `dotenv` 18 in `backend` and `e2e`. It prints a line to stderr on each load. Add `quiet: true` if the output is noise. `.env.vault` and preloading were removed; we use neither.
3. `concurrently` 10 (root). Run `npm run dev` and `npm run dev:admin`.

Done when: all checks pass and the backend image builds and starts in CI.

### PR 5: Test tooling

Branch: `deps/05-test-tooling`

1. `jsdom` 31 (root, `frontend`, `admin`). The CSS engine is new. It needs Node 24.15 or newer: change `engines.node` in the root `package.json` to `>=24.15 <25`.
2. `@testing-library/jest-dom` 8. Add `@testing-library/dom` as a direct development dependency (now required).
3. `msw` 3:
   - Rename `onUnhandledRequest` to `onUnhandledFrame` in `frontend/src/test/setup.ts` and `admin/src/test/setup.ts`. Prove that an unhandled request still fails a test.
   - MSW no longer changes `setTimeout` for fake timers. Check the 4 test files that use `vi.useFakeTimers`.
   - Cookie handling changed. Check handlers that read cookies.

Done when: the test counts are equal to `main`, and no test was removed or skipped.

### PR 6: Vite 8

Branch: `deps/06-vite-8`

1. **Before the change:** build `frontend` and `admin`. Save both `dist/THIRD-PARTY-NOTICES.txt` files and the file sizes.
2. `vite` 8 and `@vitejs/plugin-react` 6 in `frontend` and `admin`.
3. **Licence notices.** `third-party-notices.ts` (two copies) reads `chunk.modules` and `renderedLength`. Rolldown replaces Rollup, and the Vite guide does not say if these still work. Compare the new notices with the saved ones. The package list must not become shorter without a reason. Prove that the copyleft check still stops a build.
4. Browser target (decision D3): add no `build.target`. Write the new minimum browsers in the PR text.
5. Open the built app (`vite preview`). Check each main page, the language change and both themes. CommonJS import behaviour changed, so a runtime error is possible with a green build.

Done when: all checks pass, the notices are correct, and the images build and pass Trivy.

### PR 7: Small React libraries

Branch: `deps/07-react-libs`

Make one commit for each library.

1. `react-error-boundary` 6 (ES modules only). Check the type of `error` in `ErrorState.tsx` and `admin/src/app/Providers.tsx`.
2. `react-toastify` 11. Remove the CSS import in `Providers.tsx:25`. The HTML structure changed. Check by eye: loading → success and error toasts (`lib/toast.tsx`), the action button, both themes, a phone screen.
3. `zustand` 5. `persist` no longer saves the first state when the store is created. A selector that returns a new object each time can loop. Test: sign in, reload, leave a practice session, reload, resume (both auth stores and `sessionStore`).
4. `cn` 0.5 (`frontend` and `admin`). I found no changelog. Read the package source or releases first. Compare the main pages by eye. Needs Node 22 or newer.

Done when: all checks pass and the visual checks are written in the PR.

### PR 8: React 19

Branch: `deps/08-react-19`

1. Read the React 19 upgrade guide.
2. Update `react`, `react-dom`, `@types/react` and `@types/react-dom` in `frontend` and `admin` together.
3. Run `npm dedupe`. **This is the trap of #139:** React 18 stayed at the root, two copies existed, and hooks failed. `npm ci` does not repair it. `npm ls react react-dom` must show only version 19.
4. Fix the type errors. Known: `routes/not-found.tsx:46` (`useRef` needs an argument).
5. Check the browser console on the main pages for new warnings.

Done when: all checks pass.

### PR 9: TanStack Table 9

Branch: `deps/09-react-table-9`

1. Use the new API. Do not use `useLegacyTable` (deprecated, temporary).
2. Files: `words/review/ReviewTable.tsx`, `words/review/columns.tsx`, `words/review/useWordSelection.ts`, `tags/components/TagWordsTable.tsx`, and their two test files.
3. Main changes: `useReactTable` → `useTable`; a required `features` object (`tableFeatures`); row models move into it; `ColumnDef` needs the feature type first; row methods cannot be destructured.
4. Test by hand: select rows, select all, selection across pages, the half-selected checkbox, sorting, the phone view.

Done when: all checks pass and the selection behaviour is the same as before.

### PR 10: Form resolvers

Branch: `deps/10-form-resolvers`

1. `@hookform/resolvers` 7. `react-hook-form` is already new enough (7.55 or newer is needed).
2. Version 5 changed the types: `useForm<Input, Context, Output>`. Prefer types inferred from the yup schema. 9 files import the package.
3. Versions 6 and 7 change only resolvers that we do not use.
4. Test each form: validation messages and the sent data (login, register, reset, Google forms, access request, account, word form).

Done when: all checks pass without `any` and without `@ts-ignore`.

### PR 11: i18n

Branch: `deps/11-i18n`

1. `i18next` 27 and `react-i18next` 18 together.
2. Check against `src/i18n.ts`:
   - An empty string now falls back to English. I found no empty value, except `"examples": [""]` lists in `ee/wordRelated.json`. Check these.
   - A language code that is not safe is now refused. Test the handoff `?lng=` with a good and a bad value.
   - The code `ee` must still load the Estonian files, and `<html lang>` must still be `et`.
3. `Trans` now always decodes HTML entities. Check `DemoIntro.tsx`, `TermsNote.tsx` and `ProgressHeader.tsx`.
4. The new types check interpolation values by default. Fix the errors; do not turn the check off without a reason.

Done when: all checks pass, and the five languages were opened in the browser.

### PR 12: Sentry 11

Branch: `deps/12-sentry-11`

**The main risk is privacy.** In version 10, extra data was off by default. In version 11 it is **on** by default: request and response bodies (this includes passwords), cookies, headers, query values (this can include tokens), user data, database query data and local variables.

1. `@sentry/node` and `@sentry/react` 11.
2. In `backend/api/index.js` and `frontend/src/main.tsx`, set `dataCollection` as in decision D2. Do this in the same commit as the version change.
3. Write a test that proves it: start the SDK with a fake transport, cause an error on a request that holds a password and a token, and check that the event contains neither.
4. `Sentry.setupExpressErrorHandler(app)` (`app.js:75`) is deprecated. The SDK now captures route errors itself. Remove it only if a test shows that 5xx errors arrive and 4xx errors do not.
5. Instrumentation changed. Check that errors still arrive with `Sentry.init()` before `require('../app')`.
6. Tracing is off today. Do not turn it on.
7. Compare `landing/privacy.html` (Sentry text) with what is sent now.
8. Check with a real test error in a local run with a test DSN, then on staging. Read the full event in Sentry.

Done when: the privacy test passes, and a real staging event shows no sensitive data.

### PR 13: Close the plan

Branch: `deps/13-close`

1. In `.github/dependabot.yml`: remove `open-pull-requests-limit: 0`. Group only `minor` and `patch` updates. Majors then arrive one by one. Add an `ignore` for major updates of `@types/node`.
2. Run the licence check again (`research/licence-study.md` §8).
3. Run `npm audit`. For each advisory that stays, write why. Dismiss it on GitHub only if the user agrees.
4. Update the stack text in `.context/README.md` (it says Vite 5 and React 18) and the update rules in the infrastructure guide.
5. Write the record in `archive/`, remove this file and its row in the README.

## Decisions

Confirmed by the user on 2026-11-26.

| ID | Topic | Decision | Rejected | Used in |
|---|---|---|---|---|
| D1 | Express 5 query parser | Keep the new simple parser. The two admin list routes refuse keys with brackets (400). | `app.set('query parser', 'extended')`, which keeps the old behaviour. | PR 3 |
| D2 | Sentry data collection | No bodies, cookies, query values, user data, database data or local variables. Headers: keep the version 10 behaviour. | Headers off too. | PR 12 |
| D3 | Browser target in Vite 8 | Accept the new default: Chrome 111, Edge 111, Firefox 114, Safari 16.4. No `build.target` setting. | Keep the old values. | PR 6 |
| D4 | Dependabot during the plan | Pause npm version updates in PR 1. PR 13 turns them on again. | Leave them on. | PR 1, PR 13 |

## Rollback

- **Each PR:** revert the merge commit on `main`. The deploy builds the older versions again. No PR in this plan changes the database schema.
- **PR 4:** `$2b$` password hashes stay valid after a revert.
- **PR 7:** after a revert, check that a saved browser session still loads (`zustand` `persist`).

## Traps

- **Two React copies** (PR 8, and any lockfile change). Check `npm ls react react-dom`.
- **Sentry 11 sends more data by default** (PR 12). Never merge the version change without `dataCollection`.
- **A green build can hide wrong licence notices** (PR 6).
- **A green test run can use old installed packages.** On 2026-11-26 the local `node_modules` did not match the lockfile (`nodemailer` 10.0.10). Run `npm ci`.
- **Newer versions appear all the time.** Take the newest version that passes the 7-day rule, then read the notes again if it is a new major.
- **`npm audit fix --force`** proposes an old `drizzle-kit` (0.18.1). Do not use `--force`.

## Not in scope

- TypeScript 7, Node 26, Postgres and base images.
- Removing `nodemon` or `express-async-handler`.
- New features of the new versions (React Compiler, Sentry tracing, new React APIs).

## Review log

Issues found while checking #139 and writing this plan. Add new rows during the work.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Blocker | #139 leaves React 18 and 19 in one lockfile. | PR 8 step 3. |
| 2 | Blocker | `react-table` 9 renamed its API. | PR 9. |
| 3 | Blocker | `msw` 3 renamed `onUnhandledRequest`. | PR 5. |
| 4 | Major | Sentry 11 collects bodies, cookies and user data by default. A plain version change can send passwords to Sentry. Not seen in the first report. | PR 12, decision D2. |
| 5 | Moderate | Express 5 query parser: 2 admin tests fail. | PR 3, decision D1. |
| 6 | Moderate | Express 5: `req.body` can be `undefined`. | PR 3 step 3. |
| 7 | Moderate | The licence notice plugin depends on bundler internals that Vite 8 replaces. Not proven to break. | PR 6 steps 1 and 3. |
| 8 | Moderate | `@types/node` does not match Node 24. | PR 2, and PR 13 for the rule. |
| 9 | Moderate | One Dependabot group mixes all majors. | PR 1 (pause), PR 13 (new groups). |
| 10 | Minor | `@dnd-kit` is not imported. | PR 2. |
| 11 | Minor | `@types/bcryptjs` is not needed with `bcryptjs` 3. | PR 4. |
| 12 | Minor | `cn` 0.2 → 0.5 has no changelog that I found. | PR 7 step 4. |
| 13 | Minor | After PR 3, other routes ignore a key such as `tag[]=x` (Express 4 read it as a list). The apps send repeated keys without brackets, so they are not affected. | Accepted: D1 covers only the two admin routes. |
