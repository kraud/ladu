# New-Repo Reimplementation Build Plan

*2026-09-05. Planning only — no code was changed. Executing the verdict of [frontend-reimplementation-study.md](../.frontend/frontend-reimplementation-study.md) §11: a **new repository** (npm-workspaces monorepo: copied backend + clean-slate frontend), built in small vertical slices, deployed to a temporary domain, cutover by manual domain switch. Companion document: the study (§7 target shape, §8 deficiency catalog, §9 flow catalog, §11 verdict).*

**The documentation snapshot this plan is built on lives in [`snapshot/`](../.frontend/snapshot/)** — fourteen files + the [`ui/`](../.frontend/snapshot/ui/) blueprint collection (7 files), ~4,100 lines total, every claim carrying `file:line` evidence, produced 2026-09-05 (see §3). It has two halves: the **behavior inventory** (what each page/component does — the "long list of use cases") and the **data model + form/logic specs** (the enums, interfaces, case registry, per-form field lists, Review-table column+cell model, exercise-flow card model, autocomplete transforms, and general utility functions you need to literally rebuild the forms).

---

## 1. Objective & shape

One new repo, two workspaces:

```
keelapp-v2/
├── package.json          # npm workspaces: ["backend", "frontend"]
├── backend/              # COPY of this repo's backend, then modified (§8 fixes ride along)
│   ├── routes/           # .js route files (unchanged — they require the TS controllers)
│   ├── controllers/*.ts  # live Drizzle/Postgres controllers; legacy Mongoose .js DROPPED
│   ├── src/db/schema.ts  # Drizzle schema, extended per §8.2/§8.3
│   ├── tests/            # 108 Jest tests, all green post-copy
│   └── api/index.js
└── frontend/             # from scratch
    └── src/              # Vite + TS 5 strict + React + Tailwind v4 + shadcn + TanStack Query/Router + Zustand + RHF/yup
```

- The current repo (`keelapp`) stays **untouched and live on the real domain** the entire time — it is the executable specification ("what should happen?" = run it).
- The new repo deploys to a **temporary domain** when its parity checklist is green; the user manually switches the real domain (platform still undecided — everything here is deploy-agnostic: pure HTTP, no persistent connections).
- Start small (user decision): Phase 1 = auth (register/login + verify/reset), Phase 2 = create/view **nouns** with translations in ≥3 languages (EN/ES/DE/EE — all four come free from the config-driven form engine). Each phase ships something runnable.
- **Kill-switch** (study §11): after Phase 1's vertical slice, if measured pace suggests the full rewrite exceeds ~2× the migration-plan effort, stop and execute the corrected migration plan instead.

## 2. Snapshot strategy — decision

The question: how do we always know what to do in the new frontend? Three options were evaluated.

| Option | What it is | Verdict |
|--------|-----------|---------|
| **A. Use-case inventory (documentation snapshot)** | A compact, evidence-grounded description of every page/component: purpose, exhaustive use cases, endpoints, guards, effect/flag sequencing, reuse notes. **Produced now — see §3.** | **Adopt — it is the primary working spec.** ~1,100 lines replaces 32.4K lines of code as the thing you read while building. It is also the source of the route-parity checklist (§5 Phase 8). |
| **B. Copy the old frontend into the new repo as read-only reference** | `frontend-old/` alongside `frontend/` | **Rejected.** (1) It breaks every grep gate the plan relies on (`grep "from '@mui'"` must be 0; a copied MUI tree makes every gate ambiguous or requires path-exclusions forever). (2) 32.4K dead lines of Redux+MUI actively mislead: an agent asked "how does X work?" finds two implementations and may port flag machines the rewrite is supposed to delete. (3) It duplicates what the old repo already provides on disk, one `cd` away. |
| **C. Old repo side-by-side + live old app as executable spec** | Keep `keelapp` checked out; v1 keeps running on the real domain until cutover | **Adopt as the complement to A.** Behavior questions not covered by the inventory ("what exactly happens if the token is expired mid-form?") are answered by *running* v1. Zero maintenance cost; it already exists. |

**Recommendation: A + C, reject B.** The inventory is the spec; the live old app is the tiebreaker; the old repo on disk is the greppable fallback. A copy inside the new repo adds nothing those three don't provide and permanently pollutes the codebase (a 32.4K-line read-only tree is never deleted, always excluded from greps, and always one confused import away from being linked).

Tradeoff accepted: the inventory abstracts — it cannot carry every incidental behavior. That residual risk is exactly why C stays (run v1 for any doubt) and why Phase 8 has a per-route parity pass *before* cutover, not trust in documents alone.

## 3. Documentation snapshot (produced)

Ten files under [`snapshot/`](../.frontend/snapshot/), all generated 2026-09-05 by reading the actual code (not the prior docs), every claim carrying `file:line`:

**Half A — behavior inventory** (what each page/component does — the use-case list):

| File | Covers | Size |
|------|--------|------|
| `endpoints.md` | All 57 backend endpoints (method, path, auth, purpose, FE consumer file:line), count reconciliation (54 FE HTTP calls across 10 services; 3 backend-only), TODO-route status, request/response shapes for the vertical-slice endpoints | 180 lines |
| `pages-auth-shell.md` | Login, Register, VerificationUser, ResetPassword, NotFound, LoadingScreen, MainView, RoutesWithAnimation, LocationProvider, AuthVerify, Header | 225 lines |
| `pages-word-flow.md` | Dashboard, AddWord, DisplayWord, WordForm, TranslationFormGeneric, WordFormSelector, form commons + autocomplete functions, NounFormEE/EN, WordSimpleList, autocompletedTranslation feature | 253 lines |
| `pages-review-practice.md` | Review, Practice, table components, ExerciseCard, ExerciseParameterSelector, EndScreen, ResultRow, exercises + exercisePerformance features, charts (structure) | 150 lines |
| `pages-social-account.md` | Account, NotificationHub, DisplayTag, FriendSearchModal, TagInfoModal, UserBadge, AutocompleteSearch/Multiple, GeneralUseComponents, DnD components, ImageCarousel, ConfirmationButton/Modal, useFollowUnfollowTag, useInterval, users/friendships/notifications/tags/metrics features | 330 lines |
| `review-table.md` | Full column & cell-interaction spec for the Review table: simplified row shape, the 5 column kinds (select/owner, Type, per-language, tags), the primary-case `dataXX` mapping per PoS×language, cell→modal edit/delete/new-translation flows, owner differentiation, row selection + bulk actions | 200 lines |
| `exercise-flow.md` | Full spec for the exercise domain: `ExerciseParameters` model + defaults, the 9-control parameter menu with difficulty-slider semantics + validation, `getUserExercises` contract, answer-evaluation rules (TI 3-level accent/case normalization + MC), performance save/master-forget payloads, end-screen + result-row, rebuild checklist | 220 lines |

**Half B — data model + form specs** (the shape — what you need to literally rebuild the forms):

| File | Covers | Size |
|------|--------|------|
| `data-model.md` | Verbatim transcription of `ts/enums.ts` (all 30 enums: NounCases, VerbCases, AdjectiveCases, AdverbCases, Lang, PartOfSpeech, gender/plural/declension, pronoun enums, …) and `ts/interfaces.ts` (WordData, WordDataBE, TranslationItem, WordItem, TagData, NotificationData, FriendshipData, FilterItem, exercise/performance types, …) + `wordCasesDataByPoS` interface | 262 lines |
| `word-cases-data.md` | Complete `WordCasesData` registry verbatim: all 132 entries — Noun 21 (EN 2, ES 3, DE 9, EE 7), Verb 111 (EN 21, ES 42, DE 28, EE 20), each `caseName → language + plurality/declension/person/tense/mood` | 257 lines |
| `forms-nouns.md` | NounFormEN/ES/DE/EE — verbatim yup schemas, structural fields (regularity, gender, shortForm), field order | 148 lines |
| `forms-verbs.md` | VerbFormEN/ES/DE/EE — verbatim yup schemas, structural fields (regularity, DE auxVerb/caseType/prefix, ES non-finite), tense-grouped field order | 272 lines |
| `forms-adjectives-adverbs.md` | AdjectiveForm×4 + AdverbForm×3 — verbatim yup schemas, field order; confirms **no Estonian adverb form** | 257 lines |
| `general-use-functions.md` | Full export inventory of `generalUseFunctions.ts` (748 lines): all ~30 helpers — language/PoS lookups, avatar/color, friendship-button logic, filter extraction, word-chip/primary-case display, timers, sorting, color interpolation — with quirks + port/test guidance | 180 lines |
| `autocomplete.md` | The 8 autocomplete endpoint variants + the 4 shared EE/ES sanitize transforms (exact case mappings + word-form codes), the found/partial/not-found status, and the 4 inline (non-shared) sanitizers to lift | 150 lines |

**UI blueprint** — [`ui/`](../.frontend/snapshot/ui/) (7 files, ~700 lines): design-neutral, screen-by-screen layout + interaction spec for the reimplementation frontend (built for AI-assisted UI development). `00-global.md` fixes the shell, navigation, shared patterns, states, and the §8 intentional deltas; 01–06 cover auth, Dashboard, word editor, Review table, Practice flow, and social views. Feed 00→06 in order.

Key snapshot facts the roadmap relies on:

- **Session model**: `localStorage['user']` holds the *entire* verified login response incl. token (`authService.ts:18-20`); register does NOT persist the response (`Register.tsx:71-73`); verify stores `response.data.user` (`authService.ts:52-54`). Three different write shapes — the new session store normalizes to one.
- **Guards**: `AuthVerify.tsx:19-29` (expiry on route change) is the *only* guard; per-page redirects exist on Dashboard/AddWord/Review; **Practice, Account, NotificationHub, DisplayTag render unauthenticated** (known bug — the rewrite's `ProtectedRoute` fixes it in the first commit, per §8.4).
- **Polling**: 90,000 ms + immediate first fetch (`MainView.tsx:67-75`; comment wrongly says 60 s); no visibility handling; ships full history incl. dismissed; badge filtered client-side (`Header.tsx:200-206`).
- **Flag machines to delete**: WordForm's 4 `recently*` flags + chained effects (`WordForm.tsx:64-67, 114-149`, incl. the self-triggering `setHideView` effect :147-149); FriendSearchModal's 4-op-boolean dual-slice wait (:91-94, 148-180); TagInfoModal's 5 booleans over an overloaded `fullTagData` slot (`tagSlice.ts:437-492`); follow/unfollow overloading `followedTagResponse` (`tagSlice.ts:541-562`).
- **Form duplication**: 15 per-language forms ≈ 8,700 lines of identical scaffolding; per-language variance = yup field lists + case names, now fully transcribed in Half B (`data-model.md` for the enums, `word-cases-data.md` for the 132-entry case registry, `forms-{nouns,verbs,adjectives-adverbs}.md` for the per-form yup schemas + field order). Port `enums.ts` + `interfaces.ts` verbatim; generate the forms from the registry + schema specs.
- **EE autocomplete sanitization** (`sanitizeDataStructureEENoun/EEAdjective/EEVerb/ESVerb`, `autocompleteFormFunctions.ts`) moves into query transforms; module-level shared debounce timer (`generalUseFunctions.ts:544-550`) becomes per-instance `useDebouncedCallback`.
- **Contract oddities to normalize in the copied backend** (from `endpoints.md`): the legacy `_id` alias in responses — a hand-written mirror of the Postgres `id` (`serializeUser`'s `{ ...user, _id: user.id }`, `serializeLoginUser`/`publicUserResponse` returning `_id` *instead of* `id`, `authMiddleware`'s `_id`, `wordService`'s `_id: t.id`/`_id: word.id`, `notificationController`/`tagController` mappers, …). The Drizzle schema has **no `_id` column**; it is a MongoDB artifact kept only for a still-Mongo-shaped frontend — and the old frontend runs against its **own separate backend/Docker stack**, not this copy, so nothing here consumes it. **Strip it per-slice** as each controller is touched (see §4), not "until cutover". Other oddities: `DELETE /api/words/deleteMany` and `DELETE /api/tags/unfollowTag/:id` carry request bodies (move to POST/DELETE-with-query); `GET /api/words/:id` has no ownership check (`wordController.ts:571-580`); EE autocomplete proxies an external API with unhandled-rejection risk (`autocompleteTranslationController.ts:314`).
- **TODO routes — decision**: `GET /api/tags/filterTags` (TODO-marked `tagRoutes.js:17`) **keep** — consumed by `tagService.filterTags` (`tagService.ts:130-145`); `GET /api/words/getAllWordDataByWord` (TODO-marked `wordRoutes.js:17`, no FE consumer) **delete** in the copy.

**Coverage & verification (performed 2026-09-05):**

- Routes: 14 files under `frontend/src/pages` (12 routed + unrouted `LoadingScreen`) + 3 `management/` files — all covered across the four page snapshot files; route list verified against `RoutesWithAnimation.tsx:54-138` (12 routes + catch-all; `/tag/:tagId?` env-gated via `checkEnvironmentAndIterationToDisplay(2)` at :122-129).
- Endpoints: independent grep of `router.(get|post|put|delete)` across `backend/routes/*.js` = **57** — matches `endpoints.md` exactly.
- Spot-checks of inventory claims against source, all confirmed: `Review.tsx:228-254` (index-keyed selection + TODOs at :232,:237,:246), `WordForm.tsx:64-67,114-149` (flag machine), `MainView.tsx:67-75` (90 s poll + wrong comment), `tagSlice.ts:541-562` (overloaded slot), `RoutesWithAnimation.tsx:122-129` (env-gated route), `AuthVerify.tsx:19-29` (expiry check + malformed-token crash).
- Spot-checks of the form specs against source: `NounFormES.tsx:33-46` (regularity/gender/singular/plural) and `NounFormDE.tsx:34-61` (regularity/gender + 4-case × sing/plural, only nominative-singular required) match `forms-nouns.md`; `word-cases-data.md` totals (Noun 21 = EN 2 + ES 3 + DE 9 + EE 7; Verb 111 = EN 21 + ES 42 + DE 28 + EE 20) sum correctly to 132 and were programmatically cross-checked against `wordCasesDataByPoS.ts` by the writing agent.
- Review-table spec (`review-table.md`) grounded against `ReviewTableColumns.tsx:52-321` (column factory), `ExtraTableComponents.tsx:142-241` (cell→modal), and `wordController.ts:155-232` (the `dataXX` primary-case extraction). Confirmed the FE type `TableWordData` (`ReviewTableColumns.tsx:13-40`) is stale — it omits the `dataDE/dataEE/dataEN/dataES` accessors the factory actually reads — a discrepancy the spec flags for the rewrite.

**Maintenance rule**: the snapshot is frozen at 2026-09-05. The old app is dormant (no commits touching `frontend/src` in ~3 months), so drift risk is ~zero; if v1 ever changes, re-diff the affected snapshot sections.

## 4. New-repo architecture (decisions inherited + final)

**Stack** (study §7; migration-plan library verdicts stand): Vite · TypeScript 5 **strict from commit one** (`noImplicitAny: true`, `@ts-ignore` banned by lint) · React latest · Tailwind v4 + shadcn/Base UI + Phosphor · TanStack Query v5 · TanStack Router (typed routes; kills the param-parsing class of bugs) · Zustand (session + `selectedPoS` + UI state only) · react-hook-form + yup · @tanstack/react-table · @dnd-kit · i18next (44 locale JSONs copy verbatim) · react-toastify · axios (one client, request interceptor, 401→logout) · react-error-boundary per route · Vitest + MSW · c3/D3 code-split. **Playwright** lives in a third workspace (`e2e/`) for full-stack per-phase gates; the `@playwright/mcp` server (`.mcp.json`) drives a browser interactively during a session.

**Frontend invariants (enforced from commit one):**
1. No server state outside TanStack Query; no status booleans — mutations expose `isPending/isError/data` + `onSuccess/onError`; all §9 flow sequencing becomes mutation callbacks and invalidation edges.
2. One invalidation graph document, declared once, extended per phase (migration plan §5.2 is the seed).
3. Config-driven form engine: one renderer + per-PoS/language configs. Noun + verb configs derive from the `WordCasesData` registry (`word-cases-data.md`); adjective + adverb configs derive from the `AdjectiveCases`/`AdverbCases` enums directly (`data-model.md`) — `WordCasesData` only holds `Noun` and `Verb` keys, so those four adjective/adverb forms are enum-driven fixed schemas, not registry-driven. Field lists + yup rules + ordering per form are in `forms-{nouns,verbs,adjectives-adverbs}.md`; `enums.ts` + `interfaces.ts` port verbatim. Net: 15 × ~580-line components → ~2,000 lines total (study §7).
4. Centralized `ProtectedRoute` from the first commit; stable-id row selection; URL as state (filters in searchParams); stable keys everywhere; guarded `JSON.parse` via Zustand `persist`.
5. Strict TS; zero non-null assertions (lint rule) — kills the `x!!` crash vector (`§8.4 #5`).

**Backend copy rules** (one-time, Phase 0): copy TS controllers/routes/Drizzle schema/Jest tests; **drop every legacy Mongoose `.js` controller/model** (the dead code path — confirmed: routes require the `.ts` controllers); apply §8.5 hygiene (CORS allowlist or same-origin, stable error codes instead of `err.stack` leakage); apply the §8 schema/controller redesigns *in the phase that consumes them* (§8.2 in Phase 6, §8.3 in Phase 7, pagination in Phase 3) — not all up front, so every phase stays small and testable.

**`id` only — `_id` is a MongoDB artifact (standing rule).** The Drizzle/Postgres schema has no `_id` column; every `_id` in a backend response is a hand-written alias of `id` added so a still-Mongo-shaped frontend keeps working. The **old frontend runs against its own separate backend/Docker stack** (`../keelapp`), not this copied backend — so the alias has no consumer here and is dead weight, *not* something to "keep until cutover".
- **New frontend** code and types use `id` exclusively: no `_id` field, no `raw.id ?? raw._id` fallback, no "TODO: should it be `_id`?". Any part of this plan or the snapshot docs that says otherwise is superseded by this rule.
- **Backend** `_id` aliases are removed **per-slice, by the slice that touches the controller/serializer** — strip it from the responses that slice consumes plus the affected test assertions, as part of that slice's work. No standalone backend `_id` refactor pass.
- **Docs** are corrected in the same slice: fix this file and the affected `snapshot/*.md` sections when their `_id` claims are made stale.

## 5. Phased roadmap

Each phase: scope → gate. Order chosen so every phase ends with a runnable app and the riskiest bespoke logic (form engine, exercise flow) lands after the plumbing is proven.

**Every phase also ships a Playwright e2e spec** (`e2e/tests/phase-N-*.spec.ts`) that walks that phase's vertical slice against the real backend + Postgres + a browser, written alongside the feature. A green `npm run test:e2e` is part of every gate below — it is not deferred to Phase 8. See §6.

| # | Phase | Depends on |
|---|-------|-----------|
| 0 | Monorepo scaffold + backend copy | — |
| 1 | **Auth + app shell** (first vertical slice) | 0 |
| 2 | **Noun create/view, ≥3 languages** (second critical feature) | 1 |
| 3 | Form engine → all PoS + autocomplete + Review | 2 |
| 3.5 | **Dashboard + user metrics** (the `getUserMetrics` query, stat cards, both word-derived charts) | 3 |
| 4 | Tags | 3 |
| 5 | Exercises + performance | 3 |
| 6 | Social: friendships + notifications + users (redesigned models) | 1 |
| 7 | Tag shares/clone + Account + polish | 4, 6 |
| 8 | Deploy + parity checklist + cutover | all |

### Phase 0 — Scaffold + backend copy
- Workspaces; Vite frontend with the full stack above; CI running backend Jest + frontend Vitest/build.
- Backend copy per §4 rules; `filterTags` kept, `getAllWordDataByWord` deleted; §8.5 hygiene applied; all 108 tests green.
- Port the verbatim assets: `ts/enums.ts`, `ts/wordCasesDataByPoS.ts`, `public/locales/**` (4 langs × 11 namespaces), flags/logo assets.
- **Gate**: `npm test` green in both workspaces; legacy-`.js` grep = 0; dev proxy reaches the backend.

### Phase 1 — Auth + app shell *(first vertical slice; also the kill-switch measurement point)*
- Backend: unchanged (auth endpoints exist and are correct — bcrypt/JWT expiry verified, study §8.4).
- Frontend: Zustand `persist` session (single normalized shape — fixes the 3-way localStorage drift); axios client + interceptor (401→`clearSession()` + redirect); `Register`, `Login`, `VerificationUser`, `ResetPassword` (yup schemas ported); `ProtectedRoute` on every guarded route (the four unguarded pages fixed on day one); real app shell (`AppHeader` nav, UI-language switcher, `UserMenu`, i18n init); a Home page at `/` that is **just the welcome banner** (name + cycling EN→ES→DE→EE greeting) with an `EmptyState` CTA to Add Word — **no metrics query** (the numbers are all structurally zero until words exist; the whole Dashboard is Phase 3.5); `NotFound`; route-entry animation as CSS keyframe.
- **Accepted consequence**: Phase 1 now proves the *mutation* path end to end (auth) but ships no `useQuery` — the read path, `useInfiniteQuery` and the `staleTime` policy are first exercised in Phase 2. The kill-switch measurement therefore covers less surface than originally scoped; note that when recording pace.
- Tests: MSW auth handlers; integration suite register → verify → login → logout → expired-token → protected-redirect.
- **Gate**: full auth suite green; `grep "JSON.parse(localStorage"` in FE = 0; visiting any protected route unauthenticated redirects; **record pace → kill-switch evaluation** (study §11b).
- **e2e** (`phase-1-auth.spec.ts`): register → verify → login → land on Home (welcome banner + shell nav) → logout; expired/absent token on a protected route redirects to login; UI-language switch persists across reload.

### Phase 2 — Noun create/view with ≥3 translations *(second vertical slice)*
- Backend: `getWordsSimplified` gains cursor pagination (§8.4 #2); `GET /api/words/:id` gains ownership check.
- Frontend: `TranslationItem` model; **form engine v1 — nouns only**: one renderer + 4 noun configs (EN/ES/DE/EE) generated from `NounCasesData`; `AddWord` page (PoS selector; route param typed via TanStack Router); `DisplayWord` read-only; `WordForm` orchestration re-modeled: create/update/delete as mutations whose `onSuccess` chains navigate + toast + reset (the `recently*` flags and chained effects are *not ported* — snapshot `pages-word-flow.md` documents the behavior to reproduce, not the mechanism); tags + clue fields; `filterAvailableTranslationsBySelectedLanguages` logic ported as a pure function with tests (`WordForm.tsx:157-169`).
- i18n: `wordRelated` + `caseDescription` namespaces wired.
- **Gate**: create a noun with EN+ES+DE+EE translations, save, reload it in DisplayWord — all four translations render with correct case fields; edit + save round-trips; MSW tests for the CRUD flow; `wordCasesDataByPoS` config produces byte-identical yup field lists for nouns vs the old `NounForm*` components (verified by a one-off generation test, then kept as the engine's regression test).
- **e2e** (`phase-2-noun-crud.spec.ts`): logged-in user adds a noun with ≥3 language translations through the real form, saves, reloads DisplayWord and sees all translations + case fields; edits one and the change persists after reload; `GET /api/words/:id` for another user's word is refused.

### Phase 3 — Form engine completion + autocomplete + Review
- Verbs/adjectives/adverbs configs (engine already proven on nouns; the ~5,300 lines of verb forms collapse to configs); `checkEnvironmentAndIterationToDisplay` ported into `env.ts`.
- `useAutocompleteTranslation(lang, pos, query)` family with typed query keys; EE sanitizers as query transforms (`sanitizeDataStructureEE*`); per-instance debounce (deletes the module-level shared timer, `generalUseFunctions.ts:544-550`); `AutocompleteButtonWithStatus` ported.
- Review page: TanStack table; **all filters in URL searchParams** (today only the tag param hydrates, once — snapshot `pages-review-practice.md`); **stable-id row selection** (fixes `Review.tsx:228-254`); `useInfiniteQuery` over the paginated list; TableFilters + DnD column order ported on @dnd-kit.
- **Gate**: word CRUD + search + autocomplete flows' MSW tests green; filters survive reload (URL round-trip); selecting row N after a filtered refetch navigates to the right word.
- **e2e** (`phase-3-review.spec.ts`): create words of each PoS via the engine; on Review, apply a filter → reload → filter still applied from the URL; scroll triggers the next page; click a row after a filtered refetch and land on the correct word; an autocomplete lookup populates fields.

### Phase 3.5 — Dashboard + user metrics

Split out of Phase 1 (2026-09-10): the metrics endpoint aggregates `words` + `translations` only (`backend/controllers/metricController.ts`), so the Dashboard has nothing to show until Phases 2–3 can create words. This is the first phase to exercise the **read** path against the real backend.

- Backend: `GET /api/users/getUserMetrics` already exists and is already `id`-only — but has **no Jest coverage at all**. Add it here: the six fields (`totalWords`, `wordsPerPOS`, `translationsPerLanguage`, `translationsPerLanguageAndPOS`, `wordsPerMonth`, `incompleteWordsCount`), fresh-account zeros, per-user isolation.
- Frontend: `features/metrics/{api,keys,hooks}.ts` (`getUserMetrics`, `staleTime: 5 * 60_000`); `UserInfoPanel` stat cards; `MetricsPanel` with the pie (words per PoS) and bar (translations per language / per month) plus their words↔translations metric toggles; `chartColors`; charts **code-split behind the route**; the `dashboard.json` `charts.*` keys wired; skeleton loading; zero-words empty state with the "Add your first words" CTA → `/addWord`; chart worst-category click → `/addWord/<pos>`.
- Invalidation: word CRUD ⇒ `['metrics']` — the edge is declared in Phase 2 but has no consumer until now.
- **Gate**: a seeded account renders totals matching the DB; a fresh account renders the empty state; the charts land in a separate chunk; backend metrics tests green.
- **e2e** (`phase-3-5-dashboard.spec.ts`): log in on an account holding words across ≥2 PoS and ≥2 languages → Dashboard totals and both charts match the data; a fresh account shows the empty state.

### Phase 4 — Tags
- Tag CRUD, follow/unfollow as **two distinct mutations** (the overloaded-slot hook dies), `TagInfoModal` without op-booleans, `AutocompleteMultiple` (tag picker), bulk-add-tags-to-words with declared invalidation edges (`['tags', id, 'wordCount']` + `['words']`), `filterTags` kept per §3.
- **Gate**: tag flows' integration tests green; dead thunks (`getAmountByTag`) simply don't exist.
- **e2e** (`phase-4-tags.spec.ts`): create a tag, bulk-add it to several words from Review, follow another user's tag (its words show read-only), unfollow it (they disappear); the word-count badge reflects each change.

### Phase 5 — Exercises + performance
- `ExerciseParameterSelector` → params in typed route searchParams; `getUserExercises` query; `ExerciseCard` re-modeled per flow #4 (answer state in component state; `saveTranslationPerformance`/`savePerformanceAction` as mutations with `setQueryData` splice — no `currentCardIndex` slice splicing); `EndScreen`/`ResultRow`.
- The word-derived Dashboard charts are **Phase 3.5**, not here. `getUserMetrics` aggregates `words` + `translations` only and never reads `exercise_performances`, so a practice session does not change it. Any mastery/forgetting-curve visualization Phase 5 wants is its own scope and needs a **new** backend aggregation endpoint.
- **Gate**: full practice session MSW test (params → cards → end screen → performance saved → `getUserExercises` reflects the new attempt).
- **e2e** (`phase-5-exercises.spec.ts`): set parameters → run a full session answering cards (TI + MC) → end screen shows results → the saved attempts show on the last-4-attempts indicator on re-entry.

### Phase 6 — Social (redesigned models ride along)
- **Friendships §8.2**: new `friendships` table (requesterId/addresseeId/status enum, partial unique constraints); one action per endpoint; friend-request notification created **server-side in the same transaction**; decline action (new capability); FE: `useFriendships`/`useFriendRequests` + one mutation per action (the dual-slice wait + 4 booleans die by construction).
- **Notifications §8.1**: `['notifications']` query, `refetchInterval: 90_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: 'always'`, error toast (no more silent failures); `?unreadOnly=&since=` cursor params on the list endpoint; dismiss via `setQueryData`; notifications become a display-only inbox — pending actions render from domain queries.
- Users: search + `UserBadge`; `FriendSearchModal` rebuilt on the new mutation set.
- **Gate**: send → accept/decline → unfriend flows green incl. the new decline path; badge updates ≤ poll interval; hidden tab does not poll.
- **e2e** (`phase-6-social.spec.ts`, two browser contexts): user A sends a request → user B sees the notification and accepts → both show as friends; a second request is declined; unfriend removes the link; the notification badge updates within a poll interval.

### Phase 7 — Tag shares + Account + polish
- **§8.3**: `tag_shares` table; share/accept/decline endpoints; server-side transactional clone **preserving translations + cases** (fixes the data-loss bug); `canViewTag` authz helper enforced on getTagById/followTag/clone; `createTag` sets `authorId` server-side; `public` → `visibility` enum. One accept mutation (DisplayTag's clone button and the hub entry collapse into it).
- Account (profile, DnD language order on @dnd-kit, preferences); remaining shared components; polish backlog: code-split audit, staleTime policy (migration plan Phase 8 table), LoadingScreen consolidation (n/a — new code), SpinningText/ImageCarousel as CSS if cheap, else keep motion for those two.
- **Gate**: §8.2/§8.3 intentional-deltas each have a green verification; full-suite green.
- **e2e** (`phase-7-tag-shares.spec.ts`, two browser contexts): user A shares a tag → user B accepts → B gets an independent editable clone whose words keep every translation + case (the data-loss bug); a non-viewer is refused on `getTagById`/`followTag`/clone; Account language-order drag persists.

### Phase 8 — Deploy + parity + cutover
- Deploy to the temporary domain (platform still undecided).
- **Route-parity checklist**: per route (12 + catch-all), walk every use case in the snapshot files against the new build; **intentional-deltas annex** lists every §8-driven behavior change with its own verification (decline action, visibility-aware polling, clone preserving translations, server-side authz + notifications, 401→logout, guards on the 4 pages, URL-persisted filters, pagination).
- User manually switches the real domain. Old repo becomes greppable reference; archive when satisfied.
- **Gate**: checklist + annex fully green; zero unexplained parity failures.
- **e2e**: the full `e2e/tests/` suite (Phases 1–7 specs, incl. 3.5) green against the temp-domain build; the intentional-deltas annex items each map to a passing assertion. This is also the moment to stand up the deferred CI `e2e` job so the suite guards `main` post-cutover.

## 6. Testing strategy

- **No characterization tests of old timing behavior** (study §7). MSW integration tests written against the NEW code per flow — deterministic by construction.
- Contract types derived from the live backend (Drizzle schema as source of truth); the `endpoints.md` shapes section is the seed for the typed API layer.
- The form engine gets a generation test: config → yup field list must equal the old form's field list (the one place old/new are diffed mechanically).
- Per-phase gates above are grep- or test-verifiable — no "looks done".
- **Playwright e2e, one spec per phase** (`e2e/` workspace — a third workspace beside `backend/`/`frontend/`). Where MSW/Vitest mock the network, the e2e spec runs the *real* stack: `playwright.config.ts` → `webServer` boots `npm run dev -w backend` (real Postgres, migrations applied) + the Vite dev server, and Chromium walks the phase's headline user journey. A green `npm run test:e2e` is a required gate for every phase, written alongside the feature — not batched into Phase 8. Deps and browser binaries stay in `e2e/` so they never enter the `frontend` `tsc -b` / Vite build or its dependency tree. Interactive browser driving mid-session (exploring a flow, drafting selectors, screenshots) comes from the `@playwright/mcp` server in `.mcp.json`; it and the suite are independent. **CI**: no `e2e` job yet — it is a local gate until the suite has several phases of stable specs, then Phase 8 adds the job (Postgres service + both servers + `playwright install`). See [`e2e/README.md`](../../e2e/README.md).

## 7. Risks

| Risk | Mitigation |
|------|-----------|
| Second-system overdesign (study §10) | Copy v1's UX verbatim except the §8 fix list; the only new user-facing capability is request decline |
| Inventory abstraction misses incidental behavior | Live old app is the tiebreaker (§2 option C); parity pass before cutover |
| Form engine regression on verbs/adjectives/adverbs | Generation test pins config output to the old field lists (§6) |
| Backend redesign (§8.2/8.3) breaks untouched flows | 108 copied tests must stay green; redesigns ship in their consuming phase, one at a time |
| Cutover data gap | Old DB stays authoritative until the user switches the domain; the new backend's schema migrations are designed to be applied to a dump of the live DB at cutover time (add to Phase 8 checklist) |
| Pace collapse → wrong path | Kill-switch re-evaluation after Phase 1 (study §11b) |

## 8. Verification log

Performed 2026-09-05, before this plan was written:

1. **Route cross-check** — `glob frontend/src/pages/**/*.tsx` (14 files) vs snapshot coverage: 0 missing; route table re-read from `RoutesWithAnimation.tsx:54-138`.
2. **Endpoint cross-check** — `grep -c "router.(get|post|put|delete)" backend/routes/*.js` = 57 total (autocomplete 8, exercise 3, friendship 6, notification 5, tag 15, user 10, word 10) — matches `endpoints.md` (57 exposed / 54 FE-called / 3 backend-only).
3. **Spot-checks** (file:line resolved in source): `Review.tsx:228-254` ✓ · `WordForm.tsx:64-67,114-149` ✓ · `MainView.tsx:67-75` ✓ · `tagSlice.ts:541-562` ✓ · `RoutesWithAnimation.tsx:122-129` ✓ · `AuthVerify.tsx:19-29` ✓ (per `pages-auth-shell.md` highlights).

## 9. Progress — quick reference

*Snapshot 2026-09-08. This is the "where are we" glance for when work resumes; keep the tail current as slices land. Per-slice detail — goals, decisions taken with the user, what actually shipped vs. what was planned — lives in the per-phase files in this folder, one file per phase.*

| Phase | Status |
|---|---|
| 0 — Scaffold + backend copy | ✅ done — commit `c030b68`; backend 130/130 green |
| 1 — Auth + app shell | ✅ **done & committed** 2026-09-10 — merged to `main` via PR #1 (`0cf091f`); final state backend 144/144, frontend 98/98, e2e 7/7, build green (breakdown below) |
| 2 — Noun create/view (form engine v1) | 🚧 **in progress** — plan: [`phase-2-noun-crud.md`](./phase-2-noun-crud.md). Slice 1 (backend `_id` strip on word responses + `GET /api/words/:id` ownership check) done; Slices 2–6 pending |
| 3, 3.5, 4–8 | not started |

- **Context docs refactored** (commit `891ffba`): `CLAUDE.md` is now product intro + working rules only; commands, target stack, invariants, spec index and roadmap table moved to [`.context/README.md`](../README.md).
- **Test infra** (commit `39fe6d6`): the `e2e/` Playwright workspace + the `@playwright/mcp` server (`.mcp.json`) landed. `e2e/tests/smoke.spec.ts` (Phase 0 harness check) is green; per-phase specs (`phase-N-*.spec.ts`) are authored as each phase reaches its gate. `phase-1-auth.spec.ts` landed 2026-09-10 (4 tests; the workspace gained `pg` + `dotenv` + `fixtures/db.ts` for reading the verification token off the dev DB).

### Phase 1 — [`phase-1-auth-app-shell.md`](./phase-1-auth-app-shell.md)

Five reviewable slices; the user commits and re-confirms between each.

| Slice | Status |
|---|---|
| 0 — persist the plan into the repo | ✅ done |
| 1 — design system + UI primitives (Ladu tokens in Tailwind v4, shadcn/Base UI init, 8 primitives) | ✅ done 2026-09-08 — commit `39fe6d6`; frontend 9/9 + build green |
| 2 — app plumbing (axios client + 401 interceptor, Zustand `persist` session, typed router, `ProtectedRoute`, real 404, MSW infra) | ✅ done 2026-09-08 — frontend 42/42 + build green; guard + 404 verified in-browser |
| 3 — auth pages (register / verify / login / logout / reset) | ✅ done 2026-09-08 — frontend 74/74 + build green; backend 130/130 green |
| 4 — app shell + Home (`AppHeader`, `LanguageSelector`, `UserMenu`, welcome banner) | ✅ done 2026-09-10 — frontend 81/81 + build green; shell + language switch + logout + nav-gate + mobile Sheet verified in-browser |
| 5 — backend hygiene + phase gate | ✅ done 2026-09-10 — leaks closed (`serializeUser` allowlist; both `userColumnsWithoutPassword` trimmed); registration language picker + public UI-language selector added; `phase-1-auth.spec.ts` written; grep gate + guard verified |
| 5b — Account page (profile + language editing) | ✅ done 2026-09-10 — user-requested "one last modification". `features/account/` (`AccountPage` view/edit + `ProfileForm` + `buildProfileSchema`); edits name/username/languages only; `updateUser` now backend-validates `languages` (>= 2, like registration); zero-languages edge case → warning banner; `LanguagePicker` moved to `components/common/`; new `account` i18n namespace (EE flagged) |
| **commit** | ✅ 2026-09-10 — everything above landed on `main` via **PR #1** (`0cf091f`, from branch `auth-and-app-shell`). Final Phase-1 state: backend **144/144**, frontend **98/98**, **e2e 7/7**, build green |

Deviations agreed with the user (full text in the plan's Slice 4/5 outcomes): no `VerifyEmailBanner` (unverified users are blocked at login); five shadcn primitives (`dialog`, `alert-dialog`, `checkbox`, `radio-group`, `textarea`) held to Phase 2; Dashboard/metrics (metrics query, stat cards, both word-derived charts) re-scoped to **Phase 3.5** (2026-09-10) — Phase 1 Home is only the welcome banner and ships **no `useQuery`**; `button.tsx` wrapped in `forwardRef` (React-18 ref support, first needed by `sheet.tsx`). **Three blueprint additions** (none in `ui/01-auth.md`): a language-selection step in registration (`users.languages`, >= 2, selection order; backend-validated); a UI-language selector on the public routes (persists via the i18next detector cache, and is written to `users.uiLanguage` on the login/register request); and a **profile-editing subset of the Account page** (`/user` — name/username/languages, backend-validated `updateUser`; the full tags/friends/DnD Account page stays Phase 7). Kill-switch (study §11b): 5 slices / 3 sessions, landed on scope, reusable design-system cost paid down — **verdict: continue the rewrite**; re-evaluate if Phase 3's form engine overruns. The Phase 1 e2e spec (`phase-1-auth.spec.ts`, 4 tests) landed 2026-09-10 — `npm run test:e2e` is 7/7 green (local only; no CI job until Phase 8).

**Dashboard/metrics re-scoped out of Phase 1 (2026-09-10):** Slice 4 originally bundled the app shell with a Dashboard reading `getUserMetrics`. Since that endpoint aggregates `words` + `translations` only, it has nothing to show until Phases 2–3 exist. Slice 4 now ships the shell plus a Home page that is only the welcome banner; the full Dashboard (metrics query, stat cards, both word-derived charts) moved to the new **Phase 3.5** — see [`phase-3-5-dashboard-metrics.md`](./phase-3-5-dashboard-metrics.md). Phase 5 lost its "+ Dashboard charts" for the same reason. The `getUserMetrics` path correction (blueprint's `/api/metrics/...` → real `/api/users/getUserMetrics`) now lives in the Phase 3.5 file.

**`_id` correction (2026-09-08):** the `_id` MongoDB artifact is being removed as-we-go, not in one refactor — see the standing rule in §4. Frontend done in Slice 2: `ts/interfaces.ts` (`UserData`/`NotificationData`/`FriendshipData`/`TagData`/`FilterItem` → `id`) and `authStore` (`RawUser._id` and the `raw._id` fallback dropped) plus their tests. **Slice 3 (2026-09-08) swept the entire auth/user/metrics backend surface** (Option B, agreed with the user): `serializeUser` / `serializeLoginUser` / `publicUserResponse` / `authMiddleware` (`serializeAuthenticatedUser` wrapper deleted) / `getBasicUserMetrics`'s internal arg / `metricController.calculateBasicUserMetrics`'s param type — all `id` now, no `_id` anywhere in that surface. `backend/tests/auth.test.js` plus the `registerAndLogin` call sites in `tests/{words,exercises,tags,notifications}.test.js` updated; backend 130/130 green. **Remaining `_id` aliases** live only in `wordController` / `tagController` / `notificationController` / `exerciseController` responses — stripped in their consuming phases (2/4/6). Slice 5's backend scope is now just the bcrypt-hash and `passwordTokens` leaks + the phase gate.
- **Phase 2 Slice 1 (2026-09-10):** the word-response surface is now `id`-only — `WordResponse` / `AssembledTranslation` (`services/wordService.ts`), `simplifyWord` and the `deleteWord` `{ id }` response (`wordController.ts`). `exerciseController.fetchWordsWithData` remaps to its own internal legacy `_id` shape so the exercise-generation helpers are untouched. Tests updated: `words.test.js`, `exercises.test.js`, `snapshots.test.js`, `tags.test.js` (word-id reads), `unit/wordService.test.js`. Still carrying `_id`: `tagController` (`normalizeTag`), `notificationController`, and the `/simple` + tag-filter request-input readers — stripped in Phases 4 / 6.

### Phase 2 — [`phase-2-noun-crud.md`](./phase-2-noun-crud.md)

In progress. Seven slices (0–6); the user commits and re-confirms between each. Decisions D1–D4 taken with the user 2026-09-10 (pagination deferred to Phase 3; clue-only, no tags field; `GET /api/words/:id` returns 403 for non-owner with the non-owner read-only view deferred to Phase 4; noun field labels i18n-keyed).

| Slice | Status |
|---|---|
| 0 — persist the plan | ✅ done |
| 1 — backend: `_id` strip on word responses + `GET /api/words/:id` ownership check (403) + tests | ✅ done 2026-09-10 — backend **145/145** green; `snapshot/endpoints.md` corrected (`data-model.md` §2.1 already `id`-clean) |
| 2 — `features/words` data layer (types / api / keys / hooks / MSW) | ✅ done 2026-09-10 — `features/words/{types,api,keys,hooks}.ts` + `test/msw/wordHandlers.ts`; hooks do invalidation only (toasts/nav deferred to the pages); `wordKeys` namespaced; frontend **98 → 105**, build green |
| 3 — form engine core: configs + `buildYupSchema` + `FieldRenderer` + `TranslationCard` + 5 held-over shadcn primitives + regression test | not started |
| 4 — `WordForm` orchestrator + `PartOfSpeechSelector` + `AddWordPage` (create) | not started |
| 5 — `WordPage` (owner view / edit / delete) | not started |
| 6 — phase gate: `phase-2-noun-crud.spec.ts` + docs + full green run | not started |

### Phase 3.5 — [`phase-3-5-dashboard-metrics.md`](./phase-3-5-dashboard-metrics.md)

Not started. Created 2026-09-10 by splitting the Dashboard/metrics work out of Phase 1 Slice 4 (rationale above). Depends on Phase 3 — needs words of every PoS in the DB before the numbers and charts mean anything. Stub plan records the backend surface, the i18n split, and the open questions to resolve when it starts.
