# New-Repo Reimplementation Build Plan

*2026-09-05. Planning only — no code was changed. Executing the verdict of [frontend-reimplementation-study.md](./frontend-reimplementation-study.md) §11: a **new repository** (npm-workspaces monorepo: copied backend + clean-slate frontend), built in small vertical slices, deployed to a temporary domain, cutover by manual domain switch. Companion documents: the study (§7 target shape, §8 deficiency catalog, §9 flow catalog, §11 verdict), [frontend-migration-plan.md](./frontend-migration-plan.md) (durable library decisions + Appendix B behavioral inventory, all of which transfer 1:1 as the rewrite's specification).*

**The documentation snapshot this plan is built on lives in [`snapshot/`](./snapshot/)** — fourteen files + the [`ui/`](./ui/) blueprint collection (7 files), ~4,100 lines total, every claim carrying `file:line` evidence, produced 2026-09-05 (see §3). It has two halves: the **behavior inventory** (what each page/component does — the "long list of use cases") and the **data model + form/logic specs** (the enums, interfaces, case registry, per-form field lists, Review-table column+cell model, exercise-flow card model, autocomplete transforms, and general utility functions you need to literally rebuild the forms).

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
- The new repo deploys to a **temporary domain** when its parity checklist is green; the user manually switches the real domain (decision in `.context/production-migration-plan.md`, platform still undecided — everything here is deploy-agnostic: pure HTTP, no persistent connections).
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

Ten files under [`snapshot/`](./snapshot/), all generated 2026-09-05 by reading the actual code (not the prior docs), every claim carrying `file:line`:

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

**UI blueprint** — [`ui/`](./ui/) (7 files, ~700 lines): design-neutral, screen-by-screen layout + interaction spec for the reimplementation frontend (built for AI-assisted UI development). `00-global.md` fixes the shell, navigation, shared patterns, states, and the §8 intentional deltas; 01–06 cover auth, Dashboard, word editor, Review table, Practice flow, and social views. Feed 00→06 in order.

Key snapshot facts the roadmap relies on:

- **Session model**: `localStorage['user']` holds the *entire* verified login response incl. token (`authService.ts:18-20`); register does NOT persist the response (`Register.tsx:71-73`); verify stores `response.data.user` (`authService.ts:52-54`). Three different write shapes — the new session store normalizes to one.
- **Guards**: `AuthVerify.tsx:19-29` (expiry on route change) is the *only* guard; per-page redirects exist on Dashboard/AddWord/Review; **Practice, Account, NotificationHub, DisplayTag render unauthenticated** (known bug — the rewrite's `ProtectedRoute` fixes it in the first commit, per §8.4).
- **Polling**: 90,000 ms + immediate first fetch (`MainView.tsx:67-75`; comment wrongly says 60 s); no visibility handling; ships full history incl. dismissed; badge filtered client-side (`Header.tsx:200-206`).
- **Flag machines to delete**: WordForm's 4 `recently*` flags + chained effects (`WordForm.tsx:64-67, 114-149`, incl. the self-triggering `setHideView` effect :147-149); FriendSearchModal's 4-op-boolean dual-slice wait (:91-94, 148-180); TagInfoModal's 5 booleans over an overloaded `fullTagData` slot (`tagSlice.ts:437-492`); follow/unfollow overloading `followedTagResponse` (`tagSlice.ts:541-562`).
- **Form duplication**: 15 per-language forms ≈ 8,700 lines of identical scaffolding; per-language variance = yup field lists + case names, now fully transcribed in Half B (`data-model.md` for the enums, `word-cases-data.md` for the 132-entry case registry, `forms-{nouns,verbs,adjectives-adverbs}.md` for the per-form yup schemas + field order). Port `enums.ts` + `interfaces.ts` verbatim; generate the forms from the registry + schema specs.
- **EE autocomplete sanitization** (`sanitizeDataStructureEENoun/EEAdjective/EEVerb/ESVerb`, `autocompleteFormFunctions.ts`) moves into query transforms; module-level shared debounce timer (`generalUseFunctions.ts:544-550`) becomes per-instance `useDebouncedCallback`.
- **Contract oddities to normalize in the copied backend** (from `endpoints.md`): dual Mongo `_id` + Postgres `id` in responses (keep in BE until cutover, drop in new FE types); `DELETE /api/words/deleteMany` and `DELETE /api/tags/unfollowTag/:id` carry request bodies (move to POST/DELETE-with-query); `GET /api/words/:id` has no ownership check (`wordController.ts:571-580`); EE autocomplete proxies an external API with unhandled-rejection risk (`autocompleteTranslationController.ts:314`).
- **TODO routes — decision**: `GET /api/tags/filterTags` (TODO-marked `tagRoutes.js:17`) **keep** — consumed by `tagService.filterTags` (`tagService.ts:130-145`); `GET /api/words/getAllWordDataByWord` (TODO-marked `wordRoutes.js:17`, no FE consumer) **delete** in the copy.

**Coverage & verification (performed 2026-09-05):**

- Routes: 14 files under `frontend/src/pages` (12 routed + unrouted `LoadingScreen`) + 3 `management/` files — all covered across the four page snapshot files; route list verified against `RoutesWithAnimation.tsx:54-138` (12 routes + catch-all; `/tag/:tagId?` env-gated via `checkEnvironmentAndIterationToDisplay(2)` at :122-129).
- Endpoints: independent grep of `router.(get|post|put|delete)` across `backend/routes/*.js` = **57** — matches `endpoints.md` exactly.
- Spot-checks of inventory claims against source, all confirmed: `Review.tsx:228-254` (index-keyed selection + TODOs at :232,:237,:246), `WordForm.tsx:64-67,114-149` (flag machine), `MainView.tsx:67-75` (90 s poll + wrong comment), `tagSlice.ts:541-562` (overloaded slot), `RoutesWithAnimation.tsx:122-129` (env-gated route), `AuthVerify.tsx:19-29` (expiry check + malformed-token crash).
- Spot-checks of the form specs against source: `NounFormES.tsx:33-46` (regularity/gender/singular/plural) and `NounFormDE.tsx:34-61` (regularity/gender + 4-case × sing/plural, only nominative-singular required) match `forms-nouns.md`; `word-cases-data.md` totals (Noun 21 = EN 2 + ES 3 + DE 9 + EE 7; Verb 111 = EN 21 + ES 42 + DE 28 + EE 20) sum correctly to 132 and were programmatically cross-checked against `wordCasesDataByPoS.ts` by the writing agent.
- Review-table spec (`review-table.md`) grounded against `ReviewTableColumns.tsx:52-321` (column factory), `ExtraTableComponents.tsx:142-241` (cell→modal), and `wordController.ts:155-232` (the `dataXX` primary-case extraction). Confirmed the FE type `TableWordData` (`ReviewTableColumns.tsx:13-40`) is stale — it omits the `dataDE/dataEE/dataEN/dataES` accessors the factory actually reads — a discrepancy the spec flags for the rewrite.

**Maintenance rule**: the snapshot is frozen at 2026-09-05. The old app is dormant (no commits touching `frontend/src` in ~3 months), so drift risk is ~zero; if v1 ever changes, re-diff the affected snapshot sections.

## 4. New-repo architecture (decisions inherited + final)

**Stack** (study §7; migration-plan library verdicts stand): Vite · TypeScript 5 **strict from commit one** (`noImplicitAny: true`, `@ts-ignore` banned by lint) · React latest · Tailwind v4 + shadcn/Base UI + Phosphor · TanStack Query v5 · TanStack Router (typed routes; kills the param-parsing class of bugs) · Zustand (session + `selectedPoS` + UI state only) · react-hook-form + yup · @tanstack/react-table · @dnd-kit · i18next (44 locale JSONs copy verbatim) · react-toastify · axios (one client, request interceptor, 401→logout) · react-error-boundary per route · Vitest + MSW · c3/D3 code-split.

**Frontend invariants (enforced from commit one):**
1. No server state outside TanStack Query; no status booleans — mutations expose `isPending/isError/data` + `onSuccess/onError`; all §9 flow sequencing becomes mutation callbacks and invalidation edges.
2. One invalidation graph document, declared once, extended per phase (migration plan §5.2 is the seed).
3. Config-driven form engine: one renderer + per-PoS/language configs. Noun + verb configs derive from the `WordCasesData` registry (`word-cases-data.md`); adjective + adverb configs derive from the `AdjectiveCases`/`AdverbCases` enums directly (`data-model.md`) — `WordCasesData` only holds `Noun` and `Verb` keys, so those four adjective/adverb forms are enum-driven fixed schemas, not registry-driven. Field lists + yup rules + ordering per form are in `forms-{nouns,verbs,adjectives-adverbs}.md`; `enums.ts` + `interfaces.ts` port verbatim. Net: 15 × ~580-line components → ~2,000 lines total (study §7).
4. Centralized `ProtectedRoute` from the first commit; stable-id row selection; URL as state (filters in searchParams); stable keys everywhere; guarded `JSON.parse` via Zustand `persist`.
5. Strict TS; zero non-null assertions (lint rule) — kills the `x!!` crash vector (`§8.4 #5`).

**Backend copy rules** (one-time, Phase 0): copy TS controllers/routes/Drizzle schema/Jest tests; **drop every legacy Mongoose `.js` controller/model** (the dead code path — confirmed: routes require the `.ts` controllers); apply §8.5 hygiene (CORS allowlist or same-origin, stable error codes instead of `err.stack` leakage); apply the §8 schema/controller redesigns *in the phase that consumes them* (§8.2 in Phase 6, §8.3 in Phase 7, pagination in Phase 3) — not all up front, so every phase stays small and testable. Preserve the `_id`+`id` dual-key response shape until cutover (the old FE needs it); the new FE types only use `id`.

## 5. Phased roadmap

Each phase: scope → gate. Order chosen so every phase ends with a runnable app and the riskiest bespoke logic (form engine, exercise flow) lands after the plumbing is proven.

| # | Phase | Depends on |
|---|-------|-----------|
| 0 | Monorepo scaffold + backend copy | — |
| 1 | **Auth + app shell** (first vertical slice) | 0 |
| 2 | **Noun create/view, ≥3 languages** (second critical feature) | 1 |
| 3 | Form engine → all PoS + autocomplete + Review | 2 |
| 4 | Tags | 3 |
| 5 | Exercises + performance + Dashboard charts | 3 |
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
- Frontend: Zustand `persist` session (single normalized shape — fixes the 3-way localStorage drift); axios client + interceptor (401→`clearSession()` + redirect); `Register`, `Login`, `VerificationUser`, `ResetPassword` (yup schemas ported); `ProtectedRoute` on every guarded route (the four unguarded pages fixed on day one); Header shell (nav, UI-language switcher, i18n init); Dashboard shell + `getUserMetrics` read (proves the query stack); `NotFound`; route-entry animation as CSS keyframe.
- Tests: MSW auth handlers; integration suite register → verify → login → logout → expired-token → protected-redirect.
- **Gate**: full auth suite green; `grep "JSON.parse(localStorage"` in FE = 0; visiting any protected route unauthenticated redirects; **record pace → kill-switch evaluation** (study §11b).

### Phase 2 — Noun create/view with ≥3 translations *(second vertical slice)*
- Backend: `getWordsSimplified` gains cursor pagination (§8.4 #2); `GET /api/words/:id` gains ownership check.
- Frontend: `TranslationItem` model; **form engine v1 — nouns only**: one renderer + 4 noun configs (EN/ES/DE/EE) generated from `NounCasesData`; `AddWord` page (PoS selector; route param typed via TanStack Router); `DisplayWord` read-only; `WordForm` orchestration re-modeled: create/update/delete as mutations whose `onSuccess` chains navigate + toast + reset (the `recently*` flags and chained effects are *not ported* — snapshot `pages-word-flow.md` documents the behavior to reproduce, not the mechanism); tags + clue fields; `filterAvailableTranslationsBySelectedLanguages` logic ported as a pure function with tests (`WordForm.tsx:157-169`).
- i18n: `wordRelated` + `caseDescription` namespaces wired.
- **Gate**: create a noun with EN+ES+DE+EE translations, save, reload it in DisplayWord — all four translations render with correct case fields; edit + save round-trips; MSW tests for the CRUD flow; `wordCasesDataByPoS` config produces byte-identical yup field lists for nouns vs the old `NounForm*` components (verified by a one-off generation test, then kept as the engine's regression test).

### Phase 3 — Form engine completion + autocomplete + Review
- Verbs/adjectives/adverbs configs (engine already proven on nouns; the ~5,300 lines of verb forms collapse to configs); `checkEnvironmentAndIterationToDisplay` ported into `env.ts`.
- `useAutocompleteTranslation(lang, pos, query)` family with typed query keys; EE sanitizers as query transforms (`sanitizeDataStructureEE*`); per-instance debounce (deletes the module-level shared timer, `generalUseFunctions.ts:544-550`); `AutocompleteButtonWithStatus` ported.
- Review page: TanStack table; **all filters in URL searchParams** (today only the tag param hydrates, once — snapshot `pages-review-practice.md`); **stable-id row selection** (fixes `Review.tsx:228-254`); `useInfiniteQuery` over the paginated list; TableFilters + DnD column order ported on @dnd-kit.
- **Gate**: word CRUD + search + autocomplete flows' MSW tests green; filters survive reload (URL round-trip); selecting row N after a filtered refetch navigates to the right word.

### Phase 4 — Tags
- Tag CRUD, follow/unfollow as **two distinct mutations** (the overloaded-slot hook dies), `TagInfoModal` without op-booleans, `AutocompleteMultiple` (tag picker), bulk-add-tags-to-words with declared invalidation edges (`['tags', id, 'wordCount']` + `['words']`), `filterTags` kept per §3.
- **Gate**: tag flows' integration tests green; dead thunks (`getAmountByTag`) simply don't exist.

### Phase 5 — Exercises + performance + Dashboard charts
- `ExerciseParameterSelector` → params in typed route searchParams; `getUserExercises` query; `ExerciseCard` re-modeled per flow #4 (answer state in component state; `saveTranslationPerformance`/`savePerformanceAction` as mutations with `setQueryData` splice + metrics invalidation — no `currentCardIndex` slice splicing); `EndScreen`/`ResultRow`; charts (c3/D3) code-split behind Dashboard.
- **Gate**: full practice session MSW test (params → cards → end screen → performance saved → metrics reflect).

### Phase 6 — Social (redesigned models ride along)
- **Friendships §8.2**: new `friendships` table (requesterId/addresseeId/status enum, partial unique constraints); one action per endpoint; friend-request notification created **server-side in the same transaction**; decline action (new capability); FE: `useFriendships`/`useFriendRequests` + one mutation per action (the dual-slice wait + 4 booleans die by construction).
- **Notifications §8.1**: `['notifications']` query, `refetchInterval: 90_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: 'always'`, error toast (no more silent failures); `?unreadOnly=&since=` cursor params on the list endpoint; dismiss via `setQueryData`; notifications become a display-only inbox — pending actions render from domain queries.
- Users: search + `UserBadge`; `FriendSearchModal` rebuilt on the new mutation set.
- **Gate**: send → accept/decline → unfriend flows green incl. the new decline path; badge updates ≤ poll interval; hidden tab does not poll.

### Phase 7 — Tag shares + Account + polish
- **§8.3**: `tag_shares` table; share/accept/decline endpoints; server-side transactional clone **preserving translations + cases** (fixes the data-loss bug); `canViewTag` authz helper enforced on getTagById/followTag/clone; `createTag` sets `authorId` server-side; `public` → `visibility` enum. One accept mutation (DisplayTag's clone button and the hub entry collapse into it).
- Account (profile, DnD language order on @dnd-kit, preferences); remaining shared components; polish backlog: code-split audit, staleTime policy (migration plan Phase 8 table), LoadingScreen consolidation (n/a — new code), SpinningText/ImageCarousel as CSS if cheap, else keep motion for those two.
- **Gate**: §8.2/§8.3 intentional-deltas each have a green verification; full-suite green.

### Phase 8 — Deploy + parity + cutover
- Deploy to the temporary domain (platform per `.context/production-migration-plan.md` when decided).
- **Route-parity checklist**: per route (12 + catch-all), walk every use case in the snapshot files against the new build; **intentional-deltas annex** lists every §8-driven behavior change with its own verification (decline action, visibility-aware polling, clone preserving translations, server-side authz + notifications, 401→logout, guards on the 4 pages, URL-persisted filters, pagination).
- User manually switches the real domain. Old repo becomes greppable reference; archive when satisfied.
- **Gate**: checklist + annex fully green; zero unexplained parity failures.

## 6. Testing strategy

- **No characterization tests of old timing behavior** (study §7). MSW integration tests written against the NEW code per flow — deterministic by construction.
- Contract types derived from the live backend (Drizzle schema as source of truth); the `endpoints.md` shapes section is the seed for the typed API layer.
- The form engine gets a generation test: config → yup field list must equal the old form's field list (the one place old/new are diffed mechanically).
- Per-phase gates above are grep- or test-verifiable — no "looks done".

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
