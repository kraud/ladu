# CLAUDE.md — Ladu (keelapp-v2)

Context for working in this monorepo. Read this first every session. It applies to **both** `backend/` and `frontend/`.

---

## 1. What Ladu is

A multilingual vocabulary manager for **polyglots** — people who already speak several languages and want to keep *all* of them alive, not just study one new pair. A **Word** is one concept (e.g. "to dance") that holds **translations in many languages at once**, each with full grammatical detail (conjugations, declensions, gender…). Stored data feeds an **adaptive exercise engine** (spaced-repetition / forgetting-curve) that generates cross-language practice.

Design commandments (from `.context/overview.md` §1.2 — honour these in every UI decision):
1. Word entry must be fast and frictionless.
2. Social features are always optional; the solo loop (words + exercises) must work fully without them.
3. Never bury access to the core dictionary.
4. All languages shown equally — never hardcode EN/ES as "primary".
5. Capture grammatical nuance without overwhelming the UI.
6. Every stored datum feeds practice + stats.
7. Mastery/progress status is always legible to the user.

Supported languages: **EN, ES, DE, EE** (English, Spanish, German, Estonian). A Word needs translations in **≥2 languages**.

---

## 2. What this repo is (and is not)

This is a **from-scratch re-implementation**, not the live app.

- The **old app** (`../keelapp`, a separate repo/Docker stack) stays **live on the real domain** the entire time. It is the *executable specification* — when a doc can't answer "what should happen?", run the old app. We do **not** have its frontend source here on purpose: re-importing it would re-import its mistakes.
- This repo (`keelapp-v2`) is an **npm-workspaces monorepo**: `backend/` (copied from the old repo, then modified) + `frontend/` (clean slate on a new stack). It deploys to a **temporary domain**; the user switches the real domain manually once route-by-route parity is verified.
- The **backend issues were minor** — it is brought over and edited in place. The **frontend is a full rebuild**. ~70–75% of the old frontend (Redux/service boilerplate, 8,700 lines of copy-paste forms, ~100 status-watching `useEffect`s) is *not* meant to survive.

### How we work together (important — the user set these rules)

- **One feature at a time, small vertical slices.** Each slice ends with something runnable.
- **No one-shotting big features.** Prioritise changes the user can *review, understand, and commit* before moving on.
- **Docs + tests are written alongside the feature**, not deferred.
- **Ask before assuming.** On any critical/ambiguous decision, check with the user — do not guess.
- Immediate priority: **Phase 1 (Auth + app shell)**, then Phases 2–3 (words, form engine, Review).
- **Friendships, notifications, tags and tag-sharing are explicitly deferred until after Phases 1–3.** Prior agents started the backend social redesign (§8.2/§8.3): keep its **schema changes**, but its controllers/tests are not to be reconciled now. Backend tests tied to friendship/tag_shares may be removed or left failing for now — "no test there yet" is acceptable until we return to it.
- The user commits the working tree once **Phase 0 is agreed done** — there is one baseline commit to make, not per-change commits yet.

---

## 3. Where the specs live

| Path | What it is | Authority |
|------|-----------|-----------|
| `.context/overview.md` | Product/domain spec, feature requirements, workflows | **Authoritative** |
| `.context/.frontend/new-repo-build-plan.md` | **THE plan we follow** — phased roadmap, architecture decisions, invariants | **Authoritative** |
| `.context/.frontend/frontend-reimplementation-study.md` | Why rewrite vs refactor; **§8 deficiency catalog**, **§9 flow catalog**, §11 verdict | **Authoritative** (rationale + fix list) |
| `.context/.frontend/snapshot/*.md` (14 files) | Frozen 2026-09-05: behaviour inventory of every old page/component + full data model, case registry, per-form yup schemas, Review-table + exercise-flow specs, autocomplete transforms | **Primary working spec** — read the relevant file before building a feature |
| `.context/.frontend/snapshot/ui/00-global.md … 06-social.md` (7 files) | **UI-blueprint**: what each screen must *do* — shell, navigation, screen-by-screen layout + interaction spec + the §8 intentional deltas. Built from the old frontend. Feed `00`→`06` in order. | **Authoritative for feature behaviour/UX** — this is the vision we implement |
| `MOCKUPS/` | HTML/CSS mockups (`index.html`, `auth/`, `word-editor.html`, `review.html`, `assets/`). The **design language** — how things look (layout, spacing, colour, typography, components). | **Authoritative for visual design** — the lens the UI-blueprint is rendered through |
| `.context/.frontend/frontend-structure.md` | `frontend/src/` layout + component breakdown + blueprint→module map; decisions D1–D5 resolved | **Authoritative for FE file structure** |
| `.context/.frontend/frontend-migration-plan.md` | The superseded in-place-refactor plan. Kept for its **Appendix B behavioural inventory** + library verdicts | Reference only |
| `.context/archive/` | `root.md` + `production-migration-plan.md` — old MERN/CRA/Redux stack description + a MongoDB→Postgres deploy discussion. **Stale**; history only (see `archive/README.md`). Deploy notes may be revisited at Phase 8. | Archived |

> **The goal: implement the feature vision described in the UI-blueprint (`snapshot/ui/`), using the MOCKUPS as the visual lens.** Blueprint = behaviour + intent; mockups = look + feel.
> (The build plan text points at `.context/.frontend/ui/` — the files actually live under `.context/.frontend/snapshot/ui/`.)

---

## 4. Target stack

### Frontend (`frontend/`) — clean slate
Vite 5 · React 18 · **TypeScript 5 strict** (`noImplicitAny`, `noUnusedLocals/Parameters` already on; `@ts-ignore` and non-null assertions `!` are banned) · Tailwind v4 (`@tailwindcss/vite`) + shadcn/Base UI *(not yet initialised)* + Phosphor icons · **TanStack Query v5** (all server state) · **TanStack Router** (typed routes) · **Zustand** (session + `selectedPoS` + UI state only) · react-hook-form + yup · @tanstack/react-table · @dnd-kit · i18next (locale JSONs copied verbatim) · react-toastify · axios (one client, request interceptor, 401→logout — no refresh endpoint exists) · react-error-boundary per route · Vitest + MSW · c3/D3 (code-split behind Dashboard).

### Backend (`backend/`) — copied + modified
Node/Express (`.js` routes) → **TypeScript controllers loaded via `tsx`** · **Drizzle ORM on PostgreSQL** (`backend/src/db/schema.ts` is the source of truth) · JWT auth (`protect` middleware) · bcryptjs · Nodemailer · Jest + ts-jest + supertest · drizzle-kit for migrations. Local DB via Docker Compose (Postgres 15: `keelapp_dev`, `keelapp_test`).

---

## 5. Frontend invariants (enforce from commit one)

1. **No server state outside TanStack Query.** No loading/success/error status booleans anywhere — mutations expose `isPending / isError / data` + `onSuccess / onError`. Every cross-cutting flow from study §9 becomes mutation callbacks + cache-invalidation edges, never chained `useEffect` flag machines.
2. **One invalidation-graph document**, declared once and extended per phase (seed: migration-plan §5.2 / study §5.2).
3. **Config-driven form engine.** One renderer + per-PoS/language configs. Noun & Verb configs derive from the `WordCasesData` registry (`snapshot/word-cases-data.md` — 132 entries); Adjective & Adverb are enum-driven fixed schemas (`AdjectiveCases`/`AdverbCases` in `snapshot/data-model.md`). Field lists + yup rules + order per form: `snapshot/forms-{nouns,verbs,adjectives-adverbs}.md`. `ts/enums.ts` + `ts/interfaces.ts` are ported verbatim. Target: 15 hand-rolled forms (~8,700 lines) → ~2,000 lines. **No Estonian adverb form exists.**
4. **`<ProtectedRoute>` from the first commit.** The old app leaves Practice, Account, NotificationHub, DisplayTag unguarded — fix that immediately, don't reproduce it.
5. **URL is state** (Review filters live in `searchParams`), **stable-id row selection** (never index), stable React keys everywhere, session persisted via Zustand `persist` with a guarded parse (no raw `JSON.parse(localStorage['user'])`).
6. Strict TS; zero non-null assertions (lint rule); `react-error-boundary` per route.

---

## 6. Backend copy rules & the §8 deficiency fixes

**Copy rules:** keep TS controllers/routes/Drizzle schema/Jest tests; **drop every legacy Mongoose `.js` controller/model** (already deleted in the working tree). Apply §8.5 hygiene (CORS allowlist via `CORS_ORIGIN` — done in `app.js`; stable error codes instead of leaking `err.stack`). Keep the dual `_id` + `id` response shape until cutover; new FE types use `id` only.

**TODO routes:** keep `GET /api/tags/filterTags`; **delete** `GET /api/words/getAllWordDataByWord` (no consumer).

**§8 redesigns land in the phase that consumes them, one at a time — not all up front:**

| Fix | What | Phase |
|-----|------|-------|
| §8.1 Notifications | Keep polling, make it visibility-aware (`refetchInterval: 90_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: 'always'`, error toast); `?unreadOnly=&since=` cursor params; notifications become a display-only inbox; notification rows created **server-side** in the same transaction as the domain action. SSE only if Railway is chosen — documented contingency, not default. | 6 |
| §8.2 Friendships | Redesigned table: `requesterId` / `addresseeId` NOT NULL, `status` enum (`pending/accepted/declined/cancelled`), partial-unique constraints, one action per endpoint, **decline** action (new), transactional compound ops. Drop the legacy `userIds`-array API shape. | 6 |
| §8.3 Tag share / clone | Explicit `tag_shares` table + share/accept/decline endpoints; **transactional server-side clone that preserves translations + cases** (old clone silently drops them); `canViewTag` authz helper enforced on `getTagById` / `followTag` / clone; `createTag` sets `authorId` server-side; `public` column → `visibility` enum. | 7 |
| §8.4 pagination | Cursor pagination on `getWords` / `getWordsSimplified` (+ `useInfiniteQuery` on FE); `GET /api/words/:id` gains an ownership check. | 3 (list), 2 (`:id` check) |

---

## 7. Domain model cheat-sheet

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

## 8. Phased roadmap (`new-repo-build-plan.md` §5)

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

**Kill-switch (study §11b):** after Phase 1, if measured pace suggests the full rewrite will exceed ~2× the equivalent in-place-migration effort, stop and execute the corrected `frontend-migration-plan.md` instead.

---

## 9. Current state (as of 2026-09-07)

Prior agents did partial Phase 0 + started (unfinished) backend social redesign.

**Done / in place:**
- Root `package.json` = `keelapp-v2` workspaces (`backend`, `frontend`); `dev`/`build`/`test`/`docker:*`/`db:*` scripts.
- `frontend/` scaffolded: Vite + React 18 + TS 5 strict + Vitest + MSW + Tailwind v4; full target stack in `frontend/package.json`. Proxy `/api` → `http://localhost:5001`.
- `frontend/src/`: `App.tsx` (placeholder), `env.ts`, `i18n.ts`, `main.tsx`, `styles.css`, `test/{setup,smoke}`. **Ported verbatim:** `ts/enums.ts`, `ts/interfaces.ts`, `ts/wordCasesDataByPoS.ts`. `public/` has flags + logos + `locales/`.
- Backend: legacy Mongoose `.js` controllers/models deleted; TS controllers active via `tsx`; `app.js` CORS hygiene (§8.5) applied.
- Backend social redesign **schema-level**: `friendships` (requester/addressee/status enum + partial-unique indexes), `tag_shares` table, `tag_visibility` enum, `tagShareRoutes.js` — schema + migration `0001_early_kree.sql` written. Controllers/tests for these are **not** reconciled (deferred to Phases 6–7).
- **Backend test suite is green: 11 suites / 130 tests pass** (`npm test`, 4 consecutive clean full runs). Fixed 2026-09-07: `.env` had `NODE_ENV = 'development'` which `src/db/index.ts`'s `dotenv.config({override:true})` used to clobber the Jest runner's `NODE_ENV=test`, so tests ran against `keelapp_v2_dev` instead of `keelapp_v2_test`. Fix: capture `NODE_ENV` before `dotenv` in `src/db/index.ts` + removed the `.env` line. `tests/friendships.test.js` deleted (friendship redesign deferred). `tests/autocomplete.test.js` — the EE test already mocks `https.get`; kept.
- Frontend: `npm test -w frontend` (vitest 1/1) + `npm run build -w frontend` (tsc -b + vite build) both green.
- `.gitignore` extended: `.DS_Store`, `dist`, `*.tsbuildinfo`; root `.DS_Store` untracked.

**Not done / broken / caveats:**
- **Everything is uncommitted** on `main` except the single `Initial content from migration.` commit — this working tree *is* the Phase 0 baseline, to be committed when agreed done.
- `keelapp_v2_dev` still holds ~15 stale test-fixture users from the pre-fix bug (harmless — tests no longer touch it; no real dev data exists yet). Recreate + `npm run db:migrate` when convenient.
- `sendEmail` is not mocked in every backend test file → some suites make real Gmail SMTP calls (slow, "454 Too many login attempts" console noise); tests still pass. A global mock in the Jest setup would speed/quiet the suite.
- (done) Stale `root.md` + `production-migration-plan.md` moved to `.context/archive/` with a README.
- shadcn/Base UI **not initialised**; no router/query/Zustand code yet; no `ProtectedRoute`, no auth pages, no API client.
- No frontend feature code, no MSW handlers beyond scaffold.
- **Frontend `src/` structure**: `.context/.frontend/frontend-structure.md` — layout + blueprint→module map. Decisions D1–D5 **resolved** (code-based routing · port MOCKUPS design tokens to Tailwind v4 `@theme` · per-phase shadcn · thin route files · `lib/`). Ready to scaffold in Phase 1.

---

## 10. Commands

```bash
npm run docker:up            # local Postgres (keelapp_dev + keelapp_test)
npm run db:migrate           # apply Drizzle migrations to dev DB
npm run db:migrate:test      # apply to test DB
npm run dev                  # backend (:5001) + frontend (Vite) concurrently
npm test                     # backend Jest suite (workspace: backend)
npm test -w frontend         # frontend Vitest
npm run build                # frontend production build
npm run db:studio            # Drizzle Studio
```

---

## 11. Conventions

- **Commits/PRs:** commit or push only when the user asks; branch first if on `main`. Commit-message trailer:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Lm733paE2D4yHZ2f2UuUDp
  ```
  PR descriptions end with: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- Code follows English naming. Strict TS both tiers. No `@ts-ignore`, no non-null assertions in the frontend.
- When a spec is unclear, run the old app or ask — don't invent behaviour.
- Keep this file current when architecture decisions or phase status change.
