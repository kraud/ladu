# Dependency updates (replaces Dependabot PR #139)

**Status:** done 2026-11-27. One check stays open by the owner's decision: Sentry on staging and the old reports (idea I-21).

**PRs:** #151, #154, #156 (hotfix), #157, #159, #161 to #168, and PR 13 (branch `deps/13-close`).

**Result:** Express 5, React 19, Vite 8, TanStack Table 9, Sentry 11, i18next 27, MSW 3, jsdom 31. `@dnd-kit` removed (add it again if Phase 7 needs it). Production audit: 0.

**Decisions kept** (each is written where it applies):
- Admin list routes refuse bracket keys (`features/admin.md`). Sentry never gets bodies, cookies, query values, user data or database values (guide 04).
- Browser target is the Vite 8 default (`features/auth-and-shell.md`).
- Update rules, the 7-day rule and the traps: guide 03, "Updating dependencies". Dependabot ignores majors of TypeScript, `@types/node` and Postgres. No `cooldown` setting.

**Audit on 2026-11-27:** 9 moderate entries, development tools only.
- `minimatch` through `shadcn`: 4.23.1 fixes it and passes the 7-day rule on 2026-12-02.
- `minimatch` through `nodemon`: the newest version (3.1.14) still asks for an affected one.
- `esbuild` through `drizzle-kit`: no stable fix. Alert #29 dismissed as tolerable risk (the fault is in the esbuild server; a text search found no call).

**Accepted, not changed:** two `cn` copies in the lockfile; `npm ls` reports `ajv` and `date-fns` as invalid; bundles about 23 kB (gzip) larger with React 19.

**Plan versus built:**
- Closing the plan also fixed three app faults: the suggestion list that hid the page and failed CI (`features/autocomplete.md`), the practice card on a phone, and two build tools missing from the licence notices.
- Open ideas found on the way: I-16 to I-20.

**Known traps:**
- A green image build did not prove that the app loads (`drizzle-orm` moved to `backend/node_modules`; the deploy of PR 2 failed).
- Green tests did not show a `zustand` 5 render loop, two failed E2E runs came from timing, and Sentry 11 sent more data by default.

Full plan, results and review log (67 rows): `git log -- .context/plans/dependency-updates.md`
