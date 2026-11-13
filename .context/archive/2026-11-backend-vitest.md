# Backend tests: Jest to Vitest (2026-11)

**Status:** done 2026-11-13 on branch `backend-vitest` (merge status: see the PR). Tooling and tests only. There was no plan file; the work ran as four steps in one session.

**Result:** the backend now uses Vitest, like `frontend/` and `admin/`. 74 files, 2,975 tests, all green with `npm test`. Run time about 298 s (the Jest time was not measured on the same machine, so there is no speed claim). Line coverage 94.27% with `npm run test:coverage -w backend`. This is not the same scope as the 93.26% in the prune pass, because the `include` list is different. Lint: 0 errors, the same 34 warnings. `tsc` clean.

**Commits:** `094fa68` (spike), `b8e7da5` (dependencies), `adb70c2` (conversion of all test files), `ef8b86a` (removal of Jest). The close (this record and the `.gitignore` rule) comes after these.

**Decisions kept:**
- `vi.mock` does not reach modules loaded with `require()`, and gives no error. Use `mockModule` / `mockModuleFactory` from `backend/tests/mockModule.js`. The rule is in `guides/testing-policy.md` §8.
- `backend/tests/setup.js` loads `tsx/cjs`, so `require()` can read the TS sources. Jest used `ts-jest` for this.
- `fileParallelism: false` stays: all test files share one database.
- The `jose` transform, the `drizzle-orm` path maps and the Sentry resolver were Jest workarounds. They are deleted, and no replacement was needed.
- `.gitignore` now has a general `coverage` rule.

**Plan versus built:**
- The first spike passed with a dead mock. A direct check showed that `vi.mock` did nothing. Only the assertions on `sendMail` in `accessRequest.test.js` proved that `mockModule` works.
- `jest.setTimeout(n)` became `vi.setConfig({ testTimeout: n })`, not `vi.setTimeout`.
- `mockModule` first used `module.parent` to find the test file. That is only the first file that loads the helper. It now reads the caller from the stack.
- ESLint keeps `crypto: "off"` for test files (three files declare their own `crypto`).

**Known traps:**
- A test that passes does not prove that its mock is active. Assert on the mock.
- The dated history in `features/oauth-login-strategy.md` and `guides/infrastructure-guide/deployment-strategy.md` still says "Jest". It is a record of the past. Do not rewrite it.
- Jest 27 cannot resolve `tsx/cjs`. This mattered only while both runners existed.
