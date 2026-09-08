# Reference

Commands, conventions, and reference material moved out of `CLAUDE.md` (which keeps the product intro and repo/working rules). Start with `CLAUDE.md` for "read this first" context; `.context/overview.md` is the product/domain spec.

---

## Commands

```bash
npm run docker:up            # local Postgres (keelapp_dev + keelapp_test)
npm run db:migrate           # apply Drizzle migrations to dev DB
npm run db:migrate:test      # apply to test DB
npm run dev                  # backend (:5001) + frontend (Vite) concurrently
npm test                     # backend Jest suite (workspace: backend)
npm test -w frontend         # frontend Vitest
npm run build                # frontend production build
npm run db:studio            # Drizzle Studio

npm run e2e:install          # one-time: download Chromium for Playwright
npm run test:e2e             # full-stack Playwright e2e suite (boots backend + frontend)
npm run test:e2e:headed      # same, in a visible browser window
```

**e2e prerequisites:** `docker:up` + `db:migrate` + `backend/.env` (same as the
backend Jest suite) plus `e2e:install` once. Details: [`e2e/README.md`](../e2e/README.md).

---

## Conventions

- **Commits/PRs:** commit or push only when the user asks; branch first if on `main`. Commit-message trailer:

  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Lm733paE2D4yHZ2f2UuUDp
  ```

  PR descriptions end with: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- Code follows English naming. Strict TS both tiers. No `@ts-ignore`, no non-null assertions in the frontend.
- When a spec is unclear, run the old app or ask — don't invent behaviour.
- Keep `CLAUDE.md` current when architecture decisions or phase status change.
- **Every phase ends with a green Playwright e2e run** covering that phase's
  vertical slice — a required gate, not optional polish. One spec per phase
  (`e2e/tests/phase-N-*.spec.ts`), written alongside the feature like the unit
  tests. MSW/Vitest proves flows in isolation; the e2e suite proves the real
  backend + Postgres + browser work together. See `new-repo-build-plan.md` §6.

---

## Where the specs live

| Path | What it is | Authority |
|------|-----------|-----------|
| `.context/overview.md` | Product/domain spec, feature requirements, workflows | **Authoritative** |
| `.context/.frontend/new-repo-build-plan.md` | **THE plan we follow** — phased roadmap, architecture decisions, invariants | **Authoritative** |
| `.context/.frontend/snapshot/*.md` (14 files) | Frozen 2026-09-05: behaviour inventory of every old page/component + full data model, case registry, per-form yup schemas, Review-table + exercise-flow specs, autocomplete transforms | **Primary working spec** — read the relevant file before building a feature |
| `.context/.frontend/snapshot/ui/00-global.md … 06-social.md` (7 files) | **UI-blueprint**: what each screen must *do* — shell, navigation, screen-by-screen layout + interaction spec + the §8 intentional deltas. Built from the old frontend. Feed `00`→`06` in order. | **Authoritative for feature behaviour/UX** — this is the vision we implement |
| `MOCKUPS/` | HTML/CSS mockups (`index.html`, `auth/`, `word-editor.html`, `review.html`, `assets/`). The **design language** — how things look (layout, spacing, colour, typography, components). | **Authoritative for visual design** — the lens the UI-blueprint is rendered through |
| `.context/.frontend/frontend-structure.md` | `frontend/src/` layout + component breakdown + blueprint→module map; decisions D1–D5 resolved | **Authoritative for FE file structure** |
| `.context/.frontend/frontend-migration-plan.md` | The superseded in-place-refactor plan. Kept for its **Appendix B behavioural inventory** + library verdicts | Reference only |
| `.context/archive/` | `root.md` + `production-migration-plan.md` — old MERN/CRA/Redux stack description + a MongoDB→Postgres deploy discussion. **Stale**; history only (see `archive/README.md`). Deploy notes may be revisited at Phase 8. | Archived |

> **The goal: implement the feature vision described in the UI-blueprint (`snapshot/ui/`), using the MOCKUPS as the visual lens.** Blueprint = behaviour + intent; mockups = look + feel.
> (The build plan text points at `.context/.frontend/ui/` — the files actually live under `.context/.frontend/snapshot/ui/`.)

---

## Target stack

### Frontend (`frontend/`) — clean slate
Vite 5 · React 18 · **TypeScript 5 strict** (`noImplicitAny`, `noUnusedLocals/Parameters` already on; `@ts-ignore` and non-null assertions `!` are banned) · Tailwind v4 (`@tailwindcss/vite`) + shadcn/Base UI *(not yet initialised)* + Phosphor icons · **TanStack Query v5** (all server state) · **TanStack Router** (typed routes) · **Zustand** (session + `selectedPoS` + UI state only) · react-hook-form + yup · @tanstack/react-table · @dnd-kit · i18next (locale JSONs copied verbatim) · react-toastify · axios (one client, request interceptor, 401→logout — no refresh endpoint exists) · react-error-boundary per route · Vitest + MSW (unit + flow tests) · c3/D3 (code-split behind Dashboard).

### Backend (`backend/`) — copied + modified
Node/Express (`.js` routes) → **TypeScript controllers loaded via `tsx`** · **Drizzle ORM on PostgreSQL** (`backend/src/db/schema.ts` is the source of truth) · JWT auth (`protect` middleware) · bcryptjs · Nodemailer · Jest + ts-jest + supertest · drizzle-kit for migrations. Local DB via Docker Compose (Postgres 15: `keelapp_dev`, `keelapp_test`).

### e2e (`e2e/`) — full-stack tests
Third npm workspace (alongside `backend/`, `frontend/`). **Playwright** (`@playwright/test`) drives Chromium against the *real* backend (:5001) + frontend dev server (:5173) — `webServer` in `e2e/playwright.config.ts` boots both. One spec per phase (`e2e/tests/phase-N-*.spec.ts`); green run is a required per-phase gate (build plan §5/§6). Kept out of the `frontend` workspace so Playwright's Node config + browser binaries never touch the Vite build or FE dep tree. Interactive browser driving during a session comes from the `@playwright/mcp` server registered in `.mcp.json`. CI job deferred — local gate for now.

---

## Frontend invariants (enforce from commit one)

1. **No server state outside TanStack Query.** No loading/success/error status booleans anywhere — mutations expose `isPending / isError / data` + `onSuccess / onError`. Every cross-cutting flow from study §9 becomes mutation callbacks + cache-invalidation edges, never chained `useEffect` flag machines.
2. **One invalidation-graph document**, declared once and extended per phase (seed: migration-plan §5.2 / study §5.2).
3. **Config-driven form engine.** One renderer + per-PoS/language configs. Noun & Verb configs derive from the `WordCasesData` registry (`snapshot/word-cases-data.md` — 132 entries); Adjective & Adverb are enum-driven fixed schemas (`AdjectiveCases`/`AdverbCases` in `snapshot/data-model.md`). Field lists + yup rules + order per form: `snapshot/forms-{nouns,verbs,adjectives-adverbs}.md`. `ts/enums.ts` + `ts/interfaces.ts` are ported verbatim. Target: 15 hand-rolled forms (~8,700 lines) → ~2,000 lines. **No Estonian adverb form exists.**
4. **`<ProtectedRoute>` from the first commit.** The old app leaves Practice, Account, NotificationHub, DisplayTag unguarded — fix that immediately, don't reproduce it.
5. **URL is state** (Review filters live in `searchParams`), **stable-id row selection** (never index), stable React keys everywhere, session persisted via Zustand `persist` with a guarded parse (no raw `JSON.parse(localStorage['user'])`).
6. Strict TS; zero non-null assertions (lint rule); `react-error-boundary` per route.

---

## Backend copy rules & the §8 deficiency fixes

**Copy rules:** keep TS controllers/routes/Drizzle schema/Jest tests; **drop every legacy Mongoose `.js` controller/model** (already deleted in the working tree). Apply §8.5 hygiene (CORS allowlist via `CORS_ORIGIN` — done in `app.js`; stable error codes instead of leaking `err.stack`).

**`id` only — `_id` is a MongoDB artifact (standing rule; `new-repo-build-plan.md` §4).** The Drizzle/Postgres schema has no `_id` column; every `_id` in a response is a hand-written alias kept for the *old* frontend, which runs against its own separate backend — nothing here needs it. New FE code and types use `id` exclusively (no `_id`, no `raw.id ?? raw._id` fallback). Backend `_id` aliases are stripped **per-slice, by whatever slice touches that controller/serializer** (responses + test assertions), not in one refactor; the affected docs are corrected in the same slice.

**TODO routes:** keep `GET /api/tags/filterTags`; **delete** `GET /api/words/getAllWordDataByWord` (no consumer).

**§8 redesigns land in the phase that consumes them, one at a time — not all up front:**

| Fix | What | Phase |
|-----|------|-------|
| §8.1 Notifications | Keep polling, make it visibility-aware (`refetchInterval: 90_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: 'always'`, error toast); `?unreadOnly=&since=` cursor params; notifications become a display-only inbox; notification rows created **server-side** in the same transaction as the domain action. SSE only if Railway is chosen — documented contingency, not default. | 6 |
| §8.2 Friendships | Redesigned table: `requesterId` / `addresseeId` NOT NULL, `status` enum (`pending/accepted/declined/cancelled`), partial-unique constraints, one action per endpoint, **decline** action (new), transactional compound ops. Drop the legacy `userIds`-array API shape. | 6 |
| §8.3 Tag share / clone | Explicit `tag_shares` table + share/accept/decline endpoints; **transactional server-side clone that preserves translations + cases** (old clone silently drops them); `canViewTag` authz helper enforced on `getTagById` / `followTag` / clone; `createTag` sets `authorId` server-side; `public` column → `visibility` enum. | 7 |
| §8.4 pagination | Cursor pagination on `getWords` / `getWordsSimplified` (+ `useInfiniteQuery` on FE); `GET /api/words/:id` gains an ownership check. | 3 (list), 2 (`:id` check) |

---

## Domain model cheat-sheet

```
Word (partOfSpeech: Noun | Verb | Adjective | Adverb; tags; clue; isCloned/originalCreator)
  └── Translation  (one per Lang: EN | ES | DE | EE)
        └── Case    (WordItem: caseName → value string; valid caseNames per PoS×Lang defined by enums)
```

- **Word rules:** ≥2 language translations always; `partOfSpeech` is immutable after creation; users edit/delete only words they authored; words from *followed* tags are read-only.
- **Tags:** `label` + `description` + `visibility` (`Private` / `Friends-Only` / `Public`). **Follow** = words appear read-only in your list/practice. **Clone** = independent editable copies.
- **Exercises:** two entry modes (pre-selected words from the table, or random/automated). Card types: Text Input, Multiple Choice, Mixed. Multi-language (prompt in A → answer in B) or single-language (grammatical prompt → answer in same language). Options: target languages, PoS filter, exclude native language, adaptive (forgetting-curve) vs random ordering, MC distractor levels 0–3, text-input strictness levels. Per-answer feedback + last-4-attempts indicator; manual `master` / `revise` overrides. Performance stored per translation-case.
- Full details: `snapshot/data-model.md`, `snapshot/word-cases-data.md`, `snapshot/exercise-flow.md`, `snapshot/review-table.md`, `snapshot/autocomplete.md`.

---

## Phased roadmap (`new-repo-build-plan.md` §5)

| # | Phase | Depends on |
|---|-------|-----------|
| 0 | Monorepo scaffold + backend copy + verbatim asset port | — |
| **1** | **Auth + app shell** (register/login/verify/reset · Zustand session · axios client + 401 interceptor · `ProtectedRoute` · Header shell · i18n init · Dashboard shell reading `getUserMetrics` · NotFound) — *first vertical slice, kill-switch measurement point* | 0 |
| 2 | Noun create/view with ≥3 translations · form engine v1 (nouns) · `AddWord` / `DisplayWord` / `WordForm` re-modelled as mutations | 1 |
| 3 | Form engine → verbs/adjectives/adverbs · autocomplete (`useAutocompleteTranslation`, EE sanitizers as query transforms, per-instance debounce) · Review table (URL filters, stable-id selection, `useInfiniteQuery`) | 2 |
| 4 | Tags (CRUD, follow/unfollow as two distinct mutations, bulk-add) | 3 |
| 5 | Exercises + performance + Dashboard charts | 3 |
| 6 | Social: friendships + notifications + users (redesigned models §8.1/§8.2) | 1 |
| 7 | Tag shares/clone (§8.3) + Account + polish | 4, 6 |
| 8 | Deploy to temp domain + route-parity checklist + intentional-deltas annex + manual cutover | all |
