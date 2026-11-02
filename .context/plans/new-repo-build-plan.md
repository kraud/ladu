# New-Repo Reimplementation Build Plan

*2026-09-05. Planning only — no code was changed. Executing the verdict of the frontend re-implementation study (archive record: `archive/2026-09-frontend-reimplementation-study.md`) §11: a **new repository** (npm-workspaces monorepo: copied backend + clean-slate frontend), built in small vertical slices, deployed to a temporary domain, cutover by manual domain switch. Companion document: the study (§7 target shape, §8 deficiency catalog, §9 flow catalog, §11 verdict).*

**The documentation snapshot this plan was built on is described in section 3 (closed).** Its lasting parts are listed in the README table.

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

## 2. Snapshot strategy — decision (closed)

On 2026-09-05 three ways to know "what to build" were compared: **A** a use-case inventory written from the old code (the *snapshot*), **B** a copy of the old frontend inside the repo (rejected: it breaks every grep gate, and 32,400 dead lines mislead), **C** the live old app as the executable specification. The decision was **A + C**. The old app stays the tiebreaker until the Phase 8 cutover, and Phase 8 has a per-route parity pass because the inventory cannot carry every incidental behaviour.

## 3. Documentation snapshot (closed)

The snapshot was produced and frozen on 2026-09-05 from the old code (about 4,100 lines under `.context/.frontend/snapshot/`, every claim with `file:line`). It served the rebuild. Files that are still useful stay in `.context/.frontend/snapshot/`, and the README table gives each one a reason and a stop date. The rest was removed in the consolidation; read any removed file with `git log -- .context/.frontend/snapshot/<file>`. The full text of the old sections 2 and 3 (file table, coverage checks, key snapshot facts) is in `git log -- .context/plans/new-repo-build-plan.md`.


## 4. New-repo architecture (decisions inherited + final)

**Stack** (study §7; migration-plan library verdicts stand): Vite · TypeScript 5 **strict from commit one** (`noImplicitAny: true`, `@ts-ignore` banned by lint) · React latest · Tailwind v4 + shadcn/Base UI + Phosphor · TanStack Query v5 · TanStack Router (typed routes; kills the param-parsing class of bugs) · Zustand (session + `selectedPoS` + UI state only) · react-hook-form + yup · @tanstack/react-table · @dnd-kit · i18next (44 locale JSONs copy verbatim) · react-toastify · axios (one client, request interceptor, 401→logout) · react-error-boundary per route · Vitest + MSW · c3/D3 code-split. **Playwright** lives in a third workspace (`e2e/`) for full-stack per-phase gates; the `@playwright/mcp` server (`.mcp.json`) drives a browser interactively during a session.

**Frontend invariants (enforced from commit one):**
1. No server state outside TanStack Query; no status booleans — mutations expose `isPending/isError/data` + `onSuccess/onError`; all §9 flow sequencing becomes mutation callbacks and invalidation edges.
2. One invalidation graph document, declared once, extended per phase (migration plan §5.2 is the seed).
3. Config-driven form engine: one renderer + per-PoS/language configs. Noun + verb configs derive from the `WordCasesData` registry (`frontend/src/ts/wordCasesDataByPoS.ts`); adjective + adverb configs derive from the `AdjectiveCases`/`AdverbCases` enums directly (`data-model.md`) — `WordCasesData` only holds `Noun` and `Verb` keys, so those four adjective/adverb forms are enum-driven fixed schemas, not registry-driven. Field lists + yup rules + ordering per form are in `forms-{nouns,verbs,adjectives-adverbs}.md`; `enums.ts` + `interfaces.ts` port verbatim. Net: 15 × ~580-line components → ~2,000 lines total (study §7).
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
| 3.9 | **Dark mode + small fixes** (light/dark theme on landing, auth and app; landing language selector) | 3.5 |
| 4 | Tags | 3 |
| 5 | Exercises + performance | 3 |
| 6 | Social: friendships + notifications + users (redesigned models) | 1 |
| 7 | Tag shares/clone + Account + polish | 4, 6 |
| D | **Deployment pipeline** (staging + production on the real domain) — see [`.context/guides/infrastructure-guide/deployment-strategy.md`](../../.context/guides/infrastructure-guide/deployment-strategy.md) | 3.5 |
| O | **OAuth login** (Sign in with Google/Microsoft, alongside email+password) — see [`.context/features/oauth-login-strategy.md`](../../.context/features/oauth-login-strategy.md) | 1 |
| 8 | Parity checklist + apex cutover | all |

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
- Review page: TanStack table; **all filters in URL searchParams** (today only the tag param hydrates, once — the old snapshot `pages-review-practice`); **stable-id row selection** (fixes `Review.tsx:228-254`); `useInfiniteQuery` over the paginated list; TableFilters + DnD column order ported on @dnd-kit.
- **Gate**: word CRUD + search + autocomplete flows' MSW tests green; filters survive reload (URL round-trip); selecting row N after a filtered refetch navigates to the right word.
- **e2e** (`phase-3-review.spec.ts`): create words of each PoS via the engine; on Review, apply a filter → reload → filter still applied from the URL; scroll triggers the next page; click a row after a filtered refetch and land on the correct word; an autocomplete lookup populates fields.

### Phase 3.5 — Dashboard + user metrics

Split out of Phase 1 (2026-09-10): the metrics endpoint aggregates `words` + `translations` only (`backend/controllers/metricController.ts`), so the Dashboard has nothing to show until Phases 2–3 can create words. This is the first phase to exercise the **read** path against the real backend.

- Backend: `GET /api/users/getUserMetrics` already exists and is already `id`-only — but has **no Jest coverage at all**. Add it here: the six fields (`totalWords`, `wordsPerPOS`, `translationsPerLanguage`, `translationsPerLanguageAndPOS`, `wordsPerMonth`, `incompleteWordsCount`), fresh-account zeros, per-user isolation.
- Frontend: `features/metrics/{api,keys,hooks}.ts` (`getUserMetrics`, `staleTime: 5 * 60_000`); `UserInfoPanel` stat cards; `MetricsPanel` with the pie (words per PoS) and bar (translations per language / per month) plus their words↔translations metric toggles; `chartColors`; the `dashboard.json` `charts.*` keys wired; skeleton loading; zero-words empty state with the "Add your first words" CTA → `/addWord`; chart worst-category click → `/addWord/<pos>`. **Shipped differently than sketched here**: the charts are hand-rolled inline SVG, not a chart library, so there is nothing to code-split — `c3`/`d3` were installed but imported nowhere and were dropped from `package.json` instead (phase file D2/D11).
- Invalidation: word CRUD ⇒ `['metrics']` — the edge is declared in Phase 2 but has no consumer until now.
- **Gate**: a seeded account renders totals matching the DB; a fresh account renders the empty state; backend metrics tests green.
- **e2e** (`phase-3-5-dashboard.spec.ts`): log in on an account holding words across ≥2 PoS and ≥2 languages → Dashboard totals and both charts match the data, every chart control works, and a word added through the real form refreshes the totals; a fresh account shows the empty state.

### Phase 3.9 — Dark mode + small fixes

Added 2026-09-25. This phase adds a light/dark theme to the landing page, the auth screens and the app. It also adds a language selector to the landing page. The choices of theme and language must carry over: landing → auth screens → logged-in app. Only **light** and **dark** are offered. There is no "system" option. The user will list the "small fixes" after the dark-mode slices are done.

Decisions taken with the user (2026-09-25):
- **Storage**: the theme is stored on the user row (new `users.theme` column, same pattern as `uiLanguage`) and in the browser.
- **Landing → app handoff**: URL parameters (`?lng=es&theme=dark`). The landing (`ladu.com.ar`) and the app (`app.ladu.com.ar`) are different origins, so `localStorage` does not carry over.
- **Landing texts**: Claude drafts the ES/DE/EE texts. The EE text is flagged for user review.
- **Small fixes**: not defined yet. The user adds them later.

Where the switch goes:

| Screen | Position |
|---|---|
| Landing | Under the list of languages, on the left side. A language selector is also on this page (same as the auth screens). |
| Auth screens | Next to the language selector (`.auth-lang` in `AuthLayout`). |
| Logged-in app | In the header, next to the language selector (`AppHeader`). |

- **Backend**: a Drizzle migration adds `users.theme` (`'light' | 'dark'`, nullable). `register`, `login`, the Google sign-up completion and `updateUser` accept and validate it (the OAuth callback is a redirect with no body, so it cannot). The `serializeUser` allowlist includes it. Jest tests cover each path.
- **Frontend — palette**: `tokens.css` already plans for this (change the six seed colours under `:root[data-theme="dark"]`; the derived tones recompute). Reuse the dark values from `landing/style.css`. Also set dark values for `--lang-*`, `--success`, `--danger` and `--warning`. Change the shadcn variant in `styles.css` from `.dark` to `[data-theme="dark"]`. Audit the hard-coded colours (`globals.css`, `lib/avatar.ts`, the chart colours).
- **Frontend — theme state**: a Zustand `persist` store. An inline script in `index.html` sets `data-theme` before the first paint, so there is no flash.
- **Frontend — switch**: a `ThemeToggle` component (light/dark only). The public version is next to `PublicLanguageSelector`. The header version is next to `LanguageSelector` and saves through `useUpdateProfile`, like `uiLanguage`.
- **Frontend — carry-over at login**: login, register and the OAuth start send the current theme, like `uiLanguage`. After login, the user row is the source of truth.
- **Frontend — URL handoff**: at start-up, read `?theme=` once (i18next already reads `?lng=`), save it, and remove both parameters from the URL.
- **Landing**: a language selector (EN/ES/DE/EE) and a theme switch. Small inline JS; the choice is kept in the landing's own `localStorage`. The `prefers-color-scheme` block in `style.css` becomes `[data-theme="dark"]`. The "Log in" and "Open Ladu" links add `?lng=…&theme=…`. `<html lang>` follows the selected language. If a JS file is added, update the COPY list in `landing/Dockerfile`.
- **Start value** (decided 2026-09-25): a first visit with no stored choice follows the OS preference. The switch still offers only light and dark.

Slices (each one ends with something runnable):

| Slice | Scope |
|---|---|
| 0 | Persist the plan (now `features/theme-and-language.md`) |
| 1 | Dark palette + theme store + no-flash script + `ThemeToggle` on the auth screens |
| 2 | Backend: `users.theme` + tests |
| 3 | Header `ThemeToggle` + login/register carry-over |
| 4 | URL handoff (`?theme=`, remove parameters) |
| 5 | Landing: language selector + theme switch + translations |
| 6 | Phase gate: e2e + docs + full green run |
| 7+ | Small fixes (added later by the user) |

- **Gate**: backend and frontend suites green. Every screen checked in both themes (Playwright MCP screenshots). No theme flash on reload.
- **e2e** (`phase-3-9-theme.spec.ts`): open `/login?lng=es&theme=dark` → the page is Spanish and dark, and the parameters are removed. Switch the theme on the auth screen → log in → the app stays dark. Switch the theme in the header → reload and log in from a new browser context → the theme comes back from the user row.

### Phase 4 — Tags
- Tag CRUD, follow/unfollow as **two distinct mutations** (the overloaded-slot hook dies), `TagInfoModal` without op-booleans, `AutocompleteMultiple` (tag picker), bulk-add-tags-to-words with declared invalidation edges (`['tags', id, 'wordCount']` + `['words']`), `filterTags` kept per §3.
- **Gate**: tag flows' integration tests green; dead thunks (`getAmountByTag`) simply don't exist.
- **e2e** (`phase-4-tags.spec.ts`): create a tag, bulk-add it to several words from Review, follow another user's tag (its words show read-only), unfollow it (they disappear); the word-count badge reflects each change.

### Phase 5 — Exercises + performance

> **Detailed plan (2026-09-29): [`phase-5-practice.md`](./phase-5-practice.md)** — supersedes the bullets below. It changes the API (three new endpoints, old routes removed), the backend security and data integrity, and the e2e spec name (`phase-5-practice.spec.ts`). The bullets are kept as the original outline.

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

### Design for the deferred social phases (from the study, §8.1 to §8.3 and §9)

*Folded here from the frontend re-implementation study (archive record: `archive/2026-09-frontend-reimplementation-study.md`) so the design stays readable while the work waits. The defects were verified against the old code on 2026-09-05. **State of the backend (checked 2026-11-02):** the redesigned schema and routes exist. `friendships` has `requester_id`, `addressee_id` and a `friendship_status` enum with the two partial unique indexes; `tag_shares` has a `tag_share_status` enum and a pending-unique index; `tags.visibility` is a `tag_visibility` enum. The routes are `GET/POST /api/friendships`, `POST /api/friendships/:id/accept`, `/decline`, `DELETE /api/friendships/:id`, `POST /api/tags/:id/share`, `POST /api/tag-shares/:id/accept` and `/decline`. The controllers, the notification changes and the tests are **not reconciled** (`CLAUDE.md` defers them): there is no friendship or tag-share test, and no frontend. Phases 6 and 7 mean: reconcile and test these controllers, then build the frontend. The tag-side items already built are in `features/tags.md`.*

**Notifications (§8.1, Phase 6).** The old app polled every 90 s whether the tab was visible or not, shipped the whole history (dismissed rows too) and filtered the unread badge on the client. Poll errors were silent.
- Use one `['notifications']` query with `refetchInterval: 90_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: 'always'`, and an `onError` toast.
- The list endpoint takes `?unreadOnly=&since=` so a poll ships changes, not history. Dismiss and snooze are mutations that update the cache with `setQueryData`.
- Notifications become a **display-only inbox**. A pending action (accept a friend request, accept a shared tag) is drawn from the domain query (friendships, tag shares), never by parsing notification JSON.
- Options rejected: SSE (needs a persistent process; it forces a host that can hold connections; keep it as a documented upgrade at `/api/notifications/stream` with `Last-Event-ID`), websockets (no two-way need).
- The notification row is created **server-side in the same transaction** as the domain action.

**Friendships (§8.2, Phase 6).** Old defects: no requester column (the id pair was sorted, so the requester existed only in a notification's JSON); no decline action (a request stayed `pending` forever); duplicate pending rows were possible (the schema comment claimed a CHECK that did not exist); compound endpoints were not transactional; the client sent two calls (notification, then friendship) and waited with four booleans.
- One `friendships` table: `requesterId` and `addresseeId` (not null, foreign keys), `status` enum `pending|accepted|declined|cancelled` (not null).
- Partial unique index `(requesterId, addresseeId) WHERE status = 'pending'` (one open request per direction). Expression unique index `(LEAST(requesterId, addresseeId), GREATEST(requesterId, addresseeId)) WHERE status = 'accepted'` (one friendship per pair). The create handler checks both directions.
- One action per endpoint: `POST /api/friendships` (also creates the notification in the same `db.transaction`), `POST /:id/accept`, `POST /:id/decline` (**new**), `DELETE /:id` (cancel by the requester while pending; unfriend by either side once accepted), a list and a pending inbox. The `friendship_partnerships` table carries over. Drop the legacy `userIds` array shape.
- Frontend: `useFriendships` and `useFriendRequests`, one mutation per action. The dual-slice wait dies by construction.

**Tag sharing (§8.3, Phase 7).** Old defects: the share lifecycle used a notification as its state machine (no accept or decline state); any user could clone any tag by id, private ones included; a clone copied only the part of speech and clue of each word (translations and cases were lost) and ran as three inserts without a transaction; follow and unfollow shared one state slot.
- Already built in Phase 4 (see `features/tags.md`): the `canViewTag` check, the author set on the server, and the transactional tag clone.
- In the schema and routes already (not tested, not reconciled): a `tag_shares` table (`tagId`, `senderId`, `recipientId`, `status` enum `pending|accepted|declined`, partial unique pending per `(tagId, recipientId)`), and the endpoints `POST /api/tags/:id/share`, `POST /api/tag-shares/:id/accept`, `POST /api/tag-shares/:id/decline`. The design for accept is: it checks `recipientId === req.user.id` and `status = 'pending'`, then runs the server-side clone. A clone of a shared tag is allowed when a pending share exists for the caller or the tag is Public.
- Frontend: one accept mutation. The clone button on a tag page and the inbox entry collapse into it.

**Flows to re-encode on purpose (study §9).** Friend request send, cancel, accept, delete; tag share and accept-and-clone; notification polling. Each becomes mutation callbacks and invalidation edges, never chained effects.

### Phase 8 — Parity + cutover
- Deployment moved forward (2026-09-16): `app.` and `staging.` subdomains of the real domain run v2 from the pipeline in [`.context/guides/infrastructure-guide/deployment-strategy.md`](../../.context/guides/infrastructure-guide/deployment-strategy.md), and every phase after 3.5 ships through it. Phase 8 no longer deploys; it verifies parity and switches the apex.
- **Route-parity checklist**: per route (12 + catch-all), walk every use case against the new build (run the old app; the remaining snapshot files in `.context/.frontend/snapshot/` help); **intentional-deltas annex** lists every §8-driven behavior change with its own verification (decline action, visibility-aware polling, clone preserving translations, server-side authz + notifications, 401→logout, guards on the 4 pages, URL-persisted filters, pagination).

**Intentional-deltas annex (folded 2026-11-02 from the old UI blueprint files `ui/00-global` §4, `ui/04-review` and `ui/05-practice`; the last two were removed).** Each row is a place where the new app is meant to differ from the old one. The three source files list 14 items; 3 of them (stable id, URL filters, pagination) appear in two files, so the table has 11 rows. Phase 8 checks each row against the running app and maps it to a passing assertion. The column "State" says what the specs show today; it is not a Phase 8 verification.

| # | Delta (old app, then new app) | State today | Source |
|---|---|---|---|
| 1 | Protected routes are guarded. Old: Practice, Account, Notifications and Tag pages rendered without sign-in. | Built: `ProtectedRoute` (`features/auth-and-shell.md` §2). | `ui/00` §4.1 |
| 2 | Rows are selected by stable id. Old: by array index, so a filter selected the wrong row. | Built: `features/words-list.md` §3, `features/word-form-engine.md` D44. | `ui/00` §4.2, `ui/04` |
| 3 | Filters and params live in the URL, and word lists are paginated. Old: only the tag parameter, read once; the list was not paginated. | Built: numbered pages (`features/words-list.md` W-1 to W-4). | `ui/00` §4.3, `ui/04` (two rows) |
| 4 | A 401 clears the session and redirects to `/login`. | Built: the axios interceptor (`features/auth-and-shell.md` §2). | `ui/00` §4.4 |
| 5 | Notifications are a display-only inbox. Pending actions (friend request, tag share) come from domain queries with an explicit accept or decline. Decline is new. | Not built in the frontend. Schema and routes exist (see "Design for the deferred social phases"). | `ui/00` §4.5 |
| 6 | Tag share has accept and decline. Old: dismissing a notification was the state. | Not built in the frontend. Routes `POST /api/tag-shares/:id/accept` and `/decline` exist, untested. | `ui/00` §4.6 |
| 7 | One mutation per action. No multi-wait flag machines. Toasts fire from `onSuccess` and `onError`. | Built: invariant of the frontend (`.context/README.md`, invariant 1). | `ui/00` §4.7 |
| 8 | The language order is user preference data (`users.languages` order). The ordering UI writes it. Everything else (table columns, exercise generation) reads it. | Reading is built. The Review column order lives in the URL and does not write the preference (`word-form-engine.md` D6). Editing the languages on `/user` writes it (`auth-and-shell.md` P1-9); drag and drop belongs to Phase 7. | `ui/00` §4.8 |
| 9 | The Review row type follows the real simplified response (`dataXX` accessors), not the stale `TableWordData` type. | Built (`word-form-engine.md` §3). | `ui/04` |
| 10 | A failed performance save is shown with a toast. Old: an unhandled error left the card state out of step. | Phase 5 rebuilt the flow (`plans/phase-5-practice.md`); not yet checked against this delta. | `ui/05` |
| 11 | The amount validator accepts only true positive integers. Old: it accepted `+1`. | Phase 5 rebuilt the validators (`plans/phase-5-practice.md`); not yet checked against this delta. | `ui/05` |

Also part of the annex, kept where they are: the form validation fixes (`features/word-form-engine.md` §3), the practice deltas (`plans/phase-5-practice.md` Part A, "known defects"), and the social items of the study (decline, visibility-aware polling, a clone that keeps translations, server-side authorisation; `Design for the deferred social phases`).
- User points the apex domain at the VPS (Terraform) once `landing/` is ready. Old repo becomes greppable reference; archive when satisfied.
- **Gate**: checklist + annex fully green; zero unexplained parity failures.
- **e2e**: the full `e2e/tests/` suite (Phases 1–7 specs, incl. 3.5) green in CI and the deployed smoke spec green against `app.`; the intentional-deltas annex items each map to a passing assertion.

## 6. Testing strategy

- **No characterization tests of old timing behavior** (study §7). MSW integration tests written against the NEW code per flow — deterministic by construction.
- Contract types derived from the live backend (Drizzle schema as source of truth); the `endpoints.md` shapes section is the seed for the typed API layer.
- The form engine gets a generation test: config → yup field list must equal the old form's field list (the one place old/new are diffed mechanically).
- Per-phase gates above are grep- or test-verifiable — no "looks done".
- **Playwright e2e, one spec per phase** (`e2e/` workspace — a third workspace beside `backend/`/`frontend/`). Where MSW/Vitest mock the network, the e2e spec runs the *real* stack: `playwright.config.ts` → `webServer` boots `npm run dev -w backend` (real Postgres, migrations applied) + the Vite dev server, and Chromium walks the phase's headline user journey. A green `npm run test:e2e` is a required gate for every phase, written alongside the feature — not batched into Phase 8. Deps and browser binaries stay in `e2e/` so they never enter the `frontend` `tsc -b` / Vite build or its dependency tree. Interactive browser driving mid-session (exploring a flow, drafting selectors, screenshots) comes from the `@playwright/mcp` server in `.mcp.json`; it and the suite are independent. **CI**: the deployment pipeline's Phase A adds the `e2e` job (Postgres service + both servers + `playwright install`, `--workers=1`); a separate `deployed-smoke.spec.ts` runs against staging on each deploy. See [`e2e/README.md`](../../e2e/README.md).

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
3. **Spot-checks** (file:line resolved in source): `Review.tsx:228-254` ✓ · `WordForm.tsx:64-67,114-149` ✓ · `MainView.tsx:67-75` ✓ · `tagSlice.ts:541-562` ✓ · `RoutesWithAnimation.tsx:122-129` ✓ · `AuthVerify.tsx:19-29` ✓.

## 9. Progress — quick reference

*Updated 2026-11-02 (consolidation). One row per phase: status, and where the lasting content is. Per-phase plans were folded into the live specs and archived; their old text is one `git log -- <old path>` away. Counts of tests at each gate are in the archive records.*

| Phase | Status | Live spec | Archive record |
|---|---|---|---|
| 0 — Scaffold + backend copy | ✅ done (`c030b68`) | — | — |
| 1 — Auth + app shell | ✅ 2026-09-10, PR #1 | [`features/auth-and-shell.md`](../features/auth-and-shell.md) | `archive/2026-09-phase-1-auth-app-shell.md` |
| 2 — Noun create/view (form engine v1) | ✅ 2026-09-12, PR #2 | [`features/word-form-engine.md`](../features/word-form-engine.md) | `archive/2026-09-phase-2-noun-crud.md` |
| 3 — Form engine completion + autocomplete + Review | ✅ 2026-09-15, PR #3 | [`features/word-form-engine.md`](../features/word-form-engine.md), [`features/words-list.md`](../features/words-list.md) | `archive/2026-09-phase-3-forms-review.md` |
| 3.5 — Dashboard + user metrics | ✅ 2026-09-16, PR #4 | [`features/dashboard.md`](../features/dashboard.md) | `archive/2026-09-phase-3-5-dashboard.md` |
| 3.9 — Dark mode + small fixes | ✅ 2026-09-26, PR #52 | [`features/theme-and-language.md`](../features/theme-and-language.md) | `archive/2026-09-phase-3-9-dark-mode.md` |
| 4 — Tags | ✅ 2026-09-28, PR #53 | [`features/tags.md`](../features/tags.md) | `archive/2026-09-phase-4-tags.md` |
| 5 — Practice (exercises + performance) | ✅ 2026-09-30 | [`phase-5-practice.md`](./phase-5-practice.md) (live: Part A is the practice knowledge base) | — |
| 5.5 — Saved practice configs + sessions | ✅ 2026-09-30 | [`features/saved-practice.md`](../features/saved-practice.md) | `archive/2026-09-saved-practice.md` |
| D — Deployment pipeline | ✅ phases 0, A to E, 2026-09-19 to 2026-11-01 | [`guides/infrastructure-guide/deployment-strategy.md`](../guides/infrastructure-guide/deployment-strategy.md) and the guide | — |
| O — OAuth login (Google) | ✅ 2026-09-24 | [`features/oauth-login-strategy.md`](../features/oauth-login-strategy.md) | `archive/2026-09-oauth-backlog.md` |
| 6 — Social: friendships + notifications | not started | design in "Design for the deferred social phases" (§5, after Phase 7) | — |
| 7 — Tag shares + Account + polish | not started | same | — |
| 8 — Parity + cutover | not started | the intentional-deltas annex is in the Phase 8 section (§5) | — |

Features built after the roadmap (admin dashboard, access gates, account badges, word tables, onboarding, demo, French, captcha) are listed in the README table (`.context/README.md`, "Where the specs live"). Standing rules for tests: `e2e/README.md` (one spec per phase, a green `npm run test:e2e` as the gate).
