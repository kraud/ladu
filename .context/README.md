# Reference

Commands, conventions, and reference material moved out of `CLAUDE.md` (which keeps the product intro and repo/working rules). Start with `CLAUDE.md` for "read this first" context; `.context/overview.md` is the product/domain spec.

---

## Commands

```bash
npm run docker:up            # local Postgres (keelapp_dev + keelapp_test)
npm run db:migrate           # apply Drizzle migrations to dev DB
npm run db:migrate:test      # apply to test DB
npm run dev                  # backend (:5001) + frontend (Vite) concurrently
npm run dev:admin            # backend (:5001) + admin UI (Vite, :5174) — staff tool, .context/features/admin.md
npm test -w admin            # admin Vitest
npm test                     # backend Jest suite (workspace: backend)
npm test -w frontend         # frontend Vitest
npm run build                # frontend production build
npm run db:studio            # Drizzle Studio

npm run e2e:install          # one-time: download Chromium for Playwright
npm run test:e2e             # full-stack Playwright e2e suite (own ports :5101/:5273/:5274 and own database keelapp_e2e: npm run dev can keep running)
                             # specs named *-gate.spec.ts change the access gates (global state): they run last, each in its own project, one after the other
npm run test:e2e:headed      # same, in a visible browser window
```

**e2e prerequisites:** `docker:up` + the repo-root `.env` plus `e2e:install` once. The run creates and
migrates its own database `keelapp_e2e`. Details: [`e2e/README.md`](../e2e/README.md).

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
  backend + Postgres + browser work together. See `.context/roadmap.md` §6.

---

## Where the specs live

| Path | What it is | Authority |
|------|-----------|-----------|
| `.context/overview.md` | Product/domain spec, feature requirements, workflows | **Authoritative** |
| `.context/roadmap.md` | **The roadmap of the rebuild** (its old name was new-repo-build-plan): phases 0 to 8 with their status, architecture decisions, invariants, the testing strategy, risks, the deferred social design and the Phase 8 deltas annex. Phases 6 to 8 are open. | **Authoritative** |
| `.context/features/auth-and-shell.md` | **Auth and app shell**: register, verify, login, reset, the session store, `ProtectedRoute`, the shell, profile editing. Built 2026-09-08 to 2026-09-10. | **Authoritative for auth and the shell** |
| `.context/features/word-form-engine.md` | **Word form engine, word pages and the Review table**: configs, `FieldConfig`, the observable contract, the decisions D1 to D44 with their status. Built 2026-09-10 to 2026-09-15. | **Authoritative for the form engine** |
| `.context/features/dashboard.md` | **Dashboard and user metrics**: stat cards, hand-rolled charts, unpracticed-words coverage. Built 2026-09-16, changed 2026-10-23. | **Authoritative for the dashboard** |
| `.context/features/theme-and-language.md` | **Light and dark theme**, the `?lng=&theme=` handoff from the landing page, the login carry-over. Built 2026-09-25 to 2026-09-26. | **Authoritative for the theme** |
| `.context/features/tags.md` | **Tags**: the resource API, follow, clone, link and unlink, `TagSummary`, the `/tags` and `/tag/$tagId` pages, the word-editor tags section. Built 2026-09-27 to 2026-09-28. Tag sharing UI is deferred. | **Authoritative for tags** |
| `.context/features/oauth-login-strategy.md` | **Sign in with Google** (OIDC with PKCE, state tokens, linking, the stub issuer for tests). Done 2026-09-24. Code cites its phases and section names. | **Authoritative for OAuth sign-in** |
| `.context/features/practice.md` | **Practice (exercises and performance)**: Part A is the knowledge base (parameters, exercise catalogue, answer checking, knowledge math, known defects); Part B the decisions and the architecture; Part C the functional requirements of the process. Section numbers are cited by code. Built 2026-09-29 to 2026-09-30. The slices are in `research/practice-build-record.md`. | **Authoritative for practice** |
| `.context/features/saved-practice.md` | **Saved practice**: saved configurations (named settings, words or tags) and saved sessions (leave and resume), private to the owner. Built 2026-09-30, extended 2026-10-04 and 2026-10-11. | **Authoritative for saved practice** |
| `.context/features/autocomplete.md` | **Autocomplete and "Start from a word"**: the dictionary routes, the lexicon tables, the Estonian adapter, the fill rules and the draft. The research, evidence and decisions D1 to D34 are in `research/autocomplete-data-source-strategy.md` (kept whole). Built 2026-09-25 to 2026-10-24. | **Authoritative for autocomplete** |
| `.context/features/admin.md` | **The admin dashboard ("Ladu Admin")**: staff accounts and roles, user list and actions (ban, delete, restore, purge, force logout, emails), health page, staff and audit log, overview statistics, and account badges with reserved names. Built 2026-09-30 to 2026-10-07; all parts merged and rolled out. Known defects and open items are in its §6 and §7. | **Authoritative for the admin area** |
| `.context/features/access-control.md` | **Access gates**: closed, open or limited registration and login, an invite list, an allowed-accounts list, translated banners, and a "sign everyone out" panic button. It also holds the **request-access flow** (`/request`, a request list, Approve and Remove, a team email). Built and merged 2026-10-01 (PRs #63 to #65). | **Authoritative for access gates** |
| `.context/features/words-list.md` | **The word tables `/words` and `/tag/$tagId`**: numbered pagination (offset mode on `GET /api/words/simple`), selection across pages, the Owner filter, action bar rules, row click, view-only words of followed tags, single-word clone, the no-duplicates rule, and saved practice lists. Built 2026-10-12 to 2026-10-14 (PR #87). | **Authoritative for the word tables** |
| `.context/features/onboarding.md` | **First-login onboarding**: a full-screen flow (levels, at least 4 topics, 50 to 150 words) that creates tagged words with their forms; the admin switch; the API; the pool rules. Built 2026-10-16 to 2026-10-19 (PR #94). The pool decisions are in `research/onboarding-word-pool.md`. | **Authoritative for onboarding** |
| `.context/.frontend/snapshot/data-model.md` | Enums and interfaces (verbatim transcription of `ts/enums.ts` and `ts/interfaces.ts`) with per-form notes. Still edited when a language or field is added. | **Live spec** |
| `.context/.frontend/snapshot/forms-adjectives-adverbs.md`, `forms-conjunctions-prepositions.md`, `forms-french.md` | Field lists, yup rules and field order of those forms. The last two describe v2 only. Form tests and the add-language guide cite them. | **Live spec** |
| `.context/.frontend/snapshot/pages-word-flow.md` | Use cases of Add Word, the word page and `WordForm` in the old app. Edited 2026-10-24; several plans and guides cite it. | **Live spec** (still edited) |
| `.context/.frontend/snapshot/forms-nouns.md`, `forms-verbs.md` | Field lists and yup rules of the old noun and verb forms. `nouns.test.ts` and `verbs.test.ts` use them as the oracle for old behaviour. | **Test oracle. Stop date:** the Phase 8 cutover |
| `.context/.frontend/snapshot/pages-social-account.md`, `endpoints.md`, `ui/06-social.md` | Old Account, notification, friend and tag-share behaviour; the social routes (today and in the old app); the redesigned social screens. | **Reference for the deferred social phases. Stop date:** when the social phases ship |
| `.context/.frontend/snapshot/ui/00-global.md` | Shell, navigation, shared patterns and states of the old UI. | **Reference. Stop date:** the Phase 8 cutover |
| `.context/.frontend/snapshot/` (removed 2026-11-02) | `ui/01` to `ui/05`, `pages-auth-shell`, `pages-review-practice`, `exercise-flow`, `review-table`, `general-use-functions`, `word-cases-data`, `autocomplete`. The features are built and the code is the truth. Their intentional deltas are in the annex of the build plan (Phase 8). Read the old text with `git log -- <path>`. | **Removed** |
| `.context/guides/add-part-of-speech.md` | **Checklist for adding a part of speech** (or a new field group) to Ladu: research template, field rules, naming rules, every file to touch, what needs no change, rollout reminders. Read it before any new-PoS plan. | **Authoritative for the process** |
| `.context/guides/add-language.md` | **Checklist for adding a language** to Ladu: decisions to take, research template per part of speech, naming rules, every file to touch by tier (backend, frontend, forms, lexicon, onboarding, landing page), what needs no change, rollout. Built slice by slice while French is added; items marked `(unverified)` are not confirmed yet. Read it before any new-language plan. | **Authoritative for the process** |
| `.context/design/README.md` | **Design system and mood board** (2026-10-29): principles, colour tokens, typography, layout, component patterns, icons, motion and states, an agent checklist, and `mood-board.html` with real screenshots in `assets/`. Read it before you build or change any UI. | **Authoritative for UI look** (the code wins on a conflict; then fix the document) |
| `.context/features/conjunctions-prepositions.md` | **Conjunctions and prepositions**: forms in EN, ES, DE and EE (type, pairs, position, governed case), the Estonian Ekilex adapter, the lexicon data, 13 findings. Built 2026-10-24 to 2026-10-25 (PR #109). The checklist is `guides/add-part-of-speech.md`. | **Authoritative for conjunctions and prepositions** |
| `.context/features/french.md` | **French, the fifth language**: interface and learnable language, forms for all six parts of speech, Wiktionary autocomplete, onboarding pool and demo. Built 2026-10-25 to 2026-10-26 (PR #110). The review sheets for the French teacher are in `research/language-french-review.md` and `research/language-french-strings.md`. Open: V10 (`plans/french-pronominal-type-ahead.md`). | **Authoritative for French** |
| `.context/guides/infrastructure-guide/` | Operator's manual (9 files): architecture, environments and databases, development workflow, dashboards, troubleshooting, secrets, glossary, and the build log `deployment-strategy.md` (Phases 0 to E, all done). Moved here from `.dev-context/` on 2026-11-01. | **Authoritative for operations** |
| `.context/features/captcha.md` | **Captcha (Cloudflare Turnstile)** on the demo, registration, password reset and access request; the admin switch; the keys; the outage rule. Built 2026-10-19 (PR #95). | **Authoritative for the captcha** |
| `.context/features/demo.md` | **Demo access**: "Try the demo" makes a throw-away account with sample data, limited in time, words and tags, deleted on expiry; the admin Demo tab, statistics and the template. Built 2026-10-15 (PR #89). The template is still a placeholder set. | **Authoritative for the demo** |
| `.context/features/adverb-gradability.md` | **Adverb gradability**: the required Gradable / Non-gradable radio in every language, the "more / most", "más", "kõige", "plus" boxes that fill and lock the degree fields, and the autocomplete and pool rules. Built 2026-10-24. Open: a review of the new ES/DE/EE strings and of 10 pool entries. | **Authoritative for adverb degrees** |
| `.context/plans/manual-production-release.md` | Manual production releases (tags, GitHub Releases, approval gate). Research done 2026-10-12; not started. | **Working record** |
| `.context/features/landing-and-legal.md` | **Landing site and legal pages**: Terms, Privacy, Impressum, Credits, the Markdown blog, the registration consent note, third-party notices. Built 2026-10-06. The licence study is in `research/licence-study.md`. | **Authoritative for the landing site** |
| `.context/research/autocomplete-coverage-report.md` | Slice 0 research for autocomplete (2026-10-08): go for DE, ES and EN; go with an online fallback for EE. | **Done** (research report, kept whole: other docs quote its figures) |
| `.context/research/deferred-ideas.md` | **Deferred ideas**: ideas that are not plans yet, each with why and what to investigate first (modal verbs, browse all words, lawyer check, header search, placement test, and more). Add an idea here; move it to `plans/` when it is ready. | **Working record** |
| `.context/research/french-lexicon-coverage.md` | Coverage research of the French lexicon (slice 8, 2026-10-26): fill rates per part of speech, the shape of a French entry, translations, size. | **Done** (research report) |
| `.context/research/practice-build-record.md` | The slices (with their "as built" notes), the file list and the verification of the Phase 5 plan. Code comments that cite "Slice 3" or "Slice 9" of practice mean this file. | **Done** (build record) |
| `.context/research/language-french-review.md`, `language-french-strings.md` | The two review sheets for the French teacher (word forms and practice; interface strings). The teacher reviews them later; each answer is a small follow-up. | **Working record** (until the review) |
| `.context/plans/french-pronominal-type-ahead.md` | Fix plan V10: the French type-ahead does not offer "se laver". Written 2026-10-27, not built. | **Planned** |
| `.context/research/licence-study.md` | **Licence study** (2026-10-06): can Ladu go online, what changes with a paid tier, a table per dependency (licence, use, duty, risk), actions A1 to A6, questions for a lawyer, and how to re-run it (§8). Code, the landing Terms page and the build scripts cite it. | **Done** (research report; re-run when dependencies change) |
| `.context/research/onboarding-word-pool.md` | **Onboarding word pool**: the analysis, the 32 questions with the user's answers, the German, Spanish and Estonian value decisions, the senses, and "Applied in code" (2026-10-19). Merged from three files. The applied pool is `backend/scripts/onboarding/pool.tsv`. | **Working record** (until the onboarding feature closes) |
| `MOCKUPS/` | HTML/CSS mockups (`index.html`, `auth/`, `word-editor.html`, `review.html`, `assets/`). The **design language** — how things look (layout, spacing, colour, typography, components). | **Authoritative for visual design** — the lens the UI-blueprint is rendered through |
| `.context/.frontend/frontend-structure.md` | `frontend/src/` layout + component breakdown + blueprint→module map; decisions D1–D5 resolved | **Authoritative for FE file structure** |

> **How to read the specs:** `features/` and `design/` describe what is built, `plans/` what is still open, and `.frontend/snapshot/` what the old app did (kept only where the new app must still be checked against it, each file with a stop date).

---

## Target stack

### Frontend (`frontend/`) — clean slate
Vite 5 · React 18 · **TypeScript 5 strict** (`noImplicitAny`, `noUnusedLocals/Parameters` already on; `@ts-ignore` and non-null assertions `!` are banned) · Tailwind v4 (`@tailwindcss/vite`) + shadcn/Base UI *(not yet initialised)* + Phosphor icons · **TanStack Query v5** (all server state) · **TanStack Router** (typed routes) · **Zustand** (session + `selectedPoS` + UI state only) · react-hook-form + yup · @tanstack/react-table · @dnd-kit · i18next (locale JSONs copied verbatim) · react-toastify · axios (one client, request interceptor, 401→logout — no refresh endpoint exists) · react-error-boundary per route · Vitest + MSW (unit + flow tests) · Dashboard charts are hand-rolled inline SVG, no chart library (`c3`/`d3` were installed unused and dropped in Phase 3.5).

### Backend (`backend/`) — copied + modified
Node/Express (`.js` routes) → **TypeScript controllers loaded via `tsx`** · **Drizzle ORM on PostgreSQL** (`backend/src/db/schema.ts` is the source of truth) · JWT auth (`protect` middleware) · bcryptjs · Nodemailer · Jest + ts-jest + supertest (integration tests import `require('./request')`, never `supertest` directly: it keeps one server per test file — a server per request cycles macOS's ephemeral ports and causes random `socket hang up` failures in full runs) · drizzle-kit for migrations. Local DB via Docker Compose (Postgres 15: `keelapp_dev`, `keelapp_test`).

### e2e (`e2e/`) — full-stack tests
Third npm workspace (alongside `backend/`, `frontend/`). **Playwright** (`@playwright/test`) drives Chromium against the *real* backend + frontend dev server on their own ports (:5101, :5273) and their own database (`keelapp_e2e`) — `webServer` in `e2e/playwright.config.ts` boots them (`e2e/fixtures/env.ts` holds the values). One spec per phase (`e2e/tests/phase-N-*.spec.ts`); green run is a required per-phase gate (build plan §5/§6). Kept out of the `frontend` workspace so Playwright's Node config + browser binaries never touch the Vite build or FE dep tree. Interactive browser driving during a session comes from the `@playwright/mcp` server registered in `.mcp.json`. CI job deferred — local gate for now.

---

## Frontend invariants (enforce from commit one)

1. **No server state outside TanStack Query.** No loading/success/error status booleans anywhere — mutations expose `isPending / isError / data` + `onSuccess / onError`. Every cross-cutting flow from study §9 becomes mutation callbacks + cache-invalidation edges, never chained `useEffect` flag machines.
2. **One invalidation-graph document**, declared once and extended per phase (seed: migration-plan §5.2 / study §5.2).
3. **Config-driven form engine.** One renderer + per-PoS/language configs. Noun & Verb configs derive from the `WordCasesData` registry (`frontend/src/ts/wordCasesDataByPoS.ts`); Adjective & Adverb are enum-driven fixed schemas (`AdjectiveCases`/`AdverbCases` in `snapshot/data-model.md`). Field lists + yup rules + order per form: `snapshot/forms-{nouns,verbs,adjectives-adverbs}.md`. `ts/enums.ts` + `ts/interfaces.ts` are ported verbatim. Target: 15 hand-rolled forms (~8,700 lines) → ~2,000 lines. **No Estonian adverb form exists.**
4. **`<ProtectedRoute>` from the first commit.** The old app leaves Practice, Account, NotificationHub, DisplayTag unguarded — fix that immediately, don't reproduce it.
5. **URL is state** (Review filters live in `searchParams`), **stable-id row selection** (never index), stable React keys everywhere, session persisted via Zustand `persist` with a guarded parse (no raw `JSON.parse(localStorage['user'])`).
6. Strict TS; zero non-null assertions (lint rule); `react-error-boundary` per route.

---

## Backend copy rules & the §8 deficiency fixes

**Copy rules:** keep TS controllers/routes/Drizzle schema/Jest tests; **drop every legacy Mongoose `.js` controller/model** (already deleted in the working tree). Apply §8.5 hygiene (CORS allowlist via `CORS_ORIGIN` — done in `app.js`; stable error codes instead of leaking `err.stack`).

**`id` only — `_id` is a MongoDB artifact (standing rule; `.context/roadmap.md` §4).** The Drizzle/Postgres schema has no `_id` column; every `_id` in a response is a hand-written alias kept for the *old* frontend, which runs against its own separate backend — nothing here needs it. New FE code and types use `id` exclusively (no `_id`, no `raw.id ?? raw._id` fallback). Backend `_id` aliases are stripped **per-slice, by whatever slice touches that controller/serializer** (responses + test assertions), not in one refactor; the affected docs are corrected in the same slice.

**TODO routes:** **delete** `GET /api/words/getAllWordDataByWord` (no consumer). (`GET /api/tags/filterTags` — along with the rest of the legacy tag route surface — was itself deleted in Phase 4's tag-API rebuild; see `features/tags.md`.)

**§8 redesigns land in the phase that consumes them, one at a time — not all up front:**

| Fix | What | Phase |
|-----|------|-------|
| §8.1 Notifications | Keep polling, make it visibility-aware (`refetchInterval: 90_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: 'always'`, error toast); `?unreadOnly=&since=` cursor params; notifications become a display-only inbox; notification rows created **server-side** in the same transaction as the domain action. SSE only if Railway is chosen — documented contingency, not default. | 6 |
| §8.2 Friendships | Redesigned table: `requesterId` / `addresseeId` NOT NULL, `status` enum (`pending/accepted/declined/cancelled`), partial-unique constraints, one action per endpoint, **decline** action (new), transactional compound ops. Drop the legacy `userIds`-array API shape. | 6 |
| §8.3 Tag share / clone | Explicit `tag_shares` table + share/accept/decline endpoints; **transactional server-side clone that preserves translations + cases** (old clone silently drops them); `canViewTag` authz helper enforced on `getTagById` / `followTag` / clone; `createTag` sets `authorId` server-side; `public` column → `visibility` enum. | 7 |
| §8.4 pagination | `GET /api/words/simple` has two modes. Cursor mode (`cursor`, `limit` 1–100; `useInfiniteQuery` on FE): `{items, nextCursor, total}`. Offset mode (`page`, `limit` 1–200 or `all`; added in `features/words-list.md` Slice 1): `{items, total, page, pageSize}`. Both accept `owner=me` (own words only) and `owner=others` (words of followed tags only; added with the /words Owner filter). `GET /api/words` is not paginated and has no FE caller. `GET /api/words/:id` gains an ownership check (a non-owner may read a word on any Public tag, or reached through a followed tag), and returns `myCloneId` (the caller's own copy, or null) for a word of someone else. Without a `tag` filter and without `owner=others`, the list leaves out a followed word when the caller has an own copy of it (`source_word_id`); `total` and pages count the same rows. `POST /api/words/:id/clone` copies one readable word into the caller's account (private, no tags, `source_word_id` set; 400 own word, 403 not readable, 409 already copied). | 3 (list), 2 (`:id` check) |

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
- Full details: `snapshot/data-model.md`, `frontend/src/ts/wordCasesDataByPoS.ts`, `features/practice.md` Part A, `features/word-form-engine.md` (Review table), `research/autocomplete-data-source-strategy.md`.

---

## Phased roadmap (`.context/roadmap.md` §5)

| # | Phase | Depends on |
|---|-------|-----------|
| 0 | Monorepo scaffold + backend copy + verbatim asset port | — |
| **1** | **Auth + app shell** (register/login/verify/reset · Zustand session · axios client + 401 interceptor · `ProtectedRoute` · `AppHeader` shell · i18n init · Home page = welcome banner only, **no metrics query** · NotFound) — *first vertical slice, kill-switch measurement point* | 0 |
| 2 | Noun create/view with ≥3 translations · form engine v1 (nouns) · `AddWord` / `DisplayWord` / `WordForm` re-modelled as mutations | 1 |
| 3 | Form engine → verbs/adjectives/adverbs · autocomplete (`useAutocompleteTranslation`, EE sanitizers as query transforms, per-instance debounce) · Review table (URL filters, stable-id selection, `useInfiniteQuery`) | 2 |
| 3.5 | Dashboard + user metrics — `getUserMetrics` query · `UserInfoPanel` stat cards · both word-derived charts (pie: words per PoS; bar: translations per language/month) | 3 |
| 4 | ✅ Tags — rebuilt backend API (ownership checks, pagination, `TagSummary`) + `/tags`/`/tag/:id` pages, Review integration (column/filter/bulk-assign), word-editor assignment, follow/unfollow, clone. Sharing UI stays Phase 7. | 3 |
| 5 | Exercises + performance | 3 |
| 6 | Social: friendships + notifications + users (redesigned models §8.1/§8.2) | 1 |
| 7 | Tag shares/clone (§8.3) + Account + polish | 4, 6 |
| 8 | Deploy to temp domain + route-parity checklist + intentional-deltas annex + manual cutover | all |
