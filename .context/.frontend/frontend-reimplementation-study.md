# Frontend Re-implementation Study: Refactor In-Place vs. Rebuild

*2026-09-04. Evaluation only — no code was changed. Companion document to `frontend-migration-plan.md` (the in-place refactor plan). Every factual claim below was verified against the repository this date, by grep/read and three read-only audits (useEffect misuse, Redux coupling, repo/context scan).*

*2026-09-05 — final revision. Scope extended beyond the stack evaluation: four further read-only audits (notification delivery, friendships domain, tag share/clone domain, cross-cutting anti-patterns) feed a new deficiency catalog with fix-forward recommendations (§8), and §7 is rewritten for the new-repo re-implementation shape (backend copied + modified, deployment platform undecided). No code was changed.*

---

## 1. The question

The migration plan proposes a 10-phase in-place refactor (CRA→Vite, MUI→shadcn/Tailwind, Redux→TanStack Query + Zustand), estimated at ~7–10 weeks with Phase 5 alone at 4–6 weeks. This study evaluates the alternative: **re-implement the frontend from scratch on the target stack**, treating the existing app as the proof-of-concept — a complete, deployable, executable specification of every flow, running against the live backend.

Three concerns drive the evaluation:

1. **Misused `useEffect`s** — do the 148 effects scattered across 52 files encode fragile, bug-prone behavior that a cluster-by-cluster refactor would faithfully port (and thus preserve) rather than fix?
2. **TanStack suite fit** — how much of what Redux + auxiliary libraries do today could the TanStack suite (Query, Table, Router, Form) absorb more cheaply?
3. **Deficiency fixing** — which current feature implementations (notification delivery, the friendship-request lifecycle, tag share/clone) and cross-cutting habits (index keys, unguarded localStorage parsing, no error boundaries, unpaginated lists) should be *redesigned* rather than ported, given a blank slate? §8 answers with a catalog and fix-forward recommendations.

---

## 2. Situational facts (verified 2026-09-04)

These facts frame the whole comparison:

| Fact | Evidence |
|------|----------|
| **Backend migration is complete and live.** Express + Postgres + Drizzle, TypeScript controllers loaded via tsx; 108 backend tests; only dead-Mongoose-file cleanup remains. | `backend/api/index.js` (pg Pool + drizzle-migrate on startup); `.context/migration-plan.md` Phases 1–5 marked COMPLETE |
| **No refresh endpoint exists.** The TOKENS table serves email-verification and password-reset tokens. | All `backend/routes/*.js` enumerated; no refresh route |
| **The current frontend IS the PoC.** No separate prototype exists on disk or in git refs. | repo-wide scan |
| **The frontend is dormant** — no commits touching `frontend/src` in ~3 months; the working branch `frontend-update-migration` was just created with zero commits. | git log |
| **Zero frontend tests.** CI runs backend tests only; `@testing-library/*` installed but unused. | no `*.test|*.spec` under `frontend/src`; `.github/workflows/test.yml` |
| **Two backend routes are TODO-marked for possible removal** (`GET /api/tags/filterTags`, `GET /api/words/getAllWordDataByWord`) — contract pinning must confirm their status. | `backend/routes/tagRoutes.js:17`, `backend/routes/wordRoutes.js:17` |
| **Deployment platform is undecided.** Vercel (single project) vs Railway (backend) + Neon (Postgres) still under evaluation; the rewrite must stay deploy-agnostic until that decision lands. | `.context/production-migration-plan.md` ("Decisions Pending") |
| **The backend is a persistent listener, not a serverless handler.** `backend/api/index.js` boots a pg Pool, auto-applies Drizzle migrations, then `app.listen()`; no serverless export, no `VERCEL` conditional; the only `vercel.json` sits under `backend/` (70B, incompatible with the entrypoint). SSE/websockets are therefore viable only on a persistent host (the Railway path) — a constraint §8.1 factors in. | `backend/api/index.js:38,52`; `backend/app.js:31` |

The dormant-frontend + live-final-backend combination is decisive context: the refactor plan's main advantage — shipping incremental improvements to a live, actively-developed app — buys nothing here, and its main risk — backend contract drift mid-migration — has evaporated.

---

## 3. What the existing codebase consists of (evidence)

`frontend/src` = **32,413 lines**. Composition:

| Area | Lines | Nature |
|------|-------|--------|
| `components/forms/` | 10,198 | 15 per-language PoS forms ≈ **8,700 near-copy-paste** (verbs 5,268; nouns 1,555; adjectives 1,244; adverbs 651) + tags form 468 |
| `pages/` | 4,342 | 13 routes + management shell |
| `features/` (10 slices + 10 services) | 3,036 | ~2,600–2,800 deletable async-state boilerplate |
| `components/table/` | 1,864 | Review table (tanstack/react-table based) |
| `ts/` | ~1,800 | enums.ts 601 + wordCasesDataByPoS.ts 1,192 — **pure data, portable verbatim** |
| charts, exercises, misc components | ~6,000 | Dashboard charts (c3/D3), practice flow, shared UI |
| i18n | 44 JSONs | 4 languages × 11 namespaces — **portable verbatim** |

Quality signals: **148 `useEffect`** across 52 files; **172 `@ts-ignore`**; **440 `any` uses**; 55 `createAsyncThunk`s mapping to **54 real endpoints**, each service method rebuilding the same bearer-token config and base-URL logic.

Key structural finding (verified by diffing `VerbFormEN.tsx` against `VerbFormEE.tsx`): the 15 per-language forms share identical scaffolding — same imports, same thunk-watching, same hydration effect (`if(currentTranslationData.cases){ setValuesInForm(...) }` appears ~12 times); only the yup field lists and case names differ. `wordCasesDataByPoS.ts` + `enums.ts` already encode the per-language case data these forms hard-code. **This is a config-driven form engine waiting to happen: ~8,700 lines → ~2,000.**

The backend is now in scope of the rewrite — it is *copied* into the new repo, then modified. Its live path is TypeScript controllers (`backend/controllers/*.ts`) + the Drizzle schema (`backend/src/db/schema.ts`); legacy Mongoose `.js` controllers/models still sit alongside them (the pending Phase-6 cleanup). Its domain-model deficiencies — friendships, tag shares, authorization, pagination — are cataloged in §8 and fixed during the copy, not ported.

---

## 4. The useEffect problem, quantified (user concern #1)

The audit taxonomy of the 148 effects:

| Pattern | ~Count | Examples (file:line) | Fate under TanStack Query |
|---------|--------|---------------------|---------------------------|
| Thunk-status watchers: toast/refetch/reset on `isLoading/isSuccess/isError` | 55–60 | `TagInfoModal.tsx:134` (CRUD state machine in one effect), `ExtraTableComponents.tsx:172,186` (edge-emulation with `finishedUpdating` flags), `Review.tsx:285`, `useFollowUnfollowTag.tsx:26` | **Deleted.** Mutation `onSuccess/onError` + cache invalidation replace them |
| Derived-state-in-effect (redux/props → local mirrors; chart parsing; form hydration) | ~45 | `Account.tsx:152,156`, `AutocompleteMultiple.tsx:76`, `BarChart.tsx:102`, `PieChart.tsx:95`, `WordForm.tsx:78-106` (carries its own `TODO: replace with calculated state`) | **Deleted.** `useMemo`/derived selectors/controlled form init |
| Guard/redirect in effect | ~8 | `AddWord.tsx:31`, `Dashboard.tsx:33`, `Review.tsx:69`, `NotificationHub.tsx:50` | Route guards at render time |
| Should-be event handlers (refetch via boolean flags, `onSelect` in effect) | ~15 | `NotificationHub.tsx:59-73`, `Account.tsx:145-183` (`triggerGetFriendships/triggerGetTagList`), `FriendSearchModal.tsx:148-165` | Mutation callbacks |
| Chained flag machines (effect A sets flag → effect B reacts) | ~10 | `WordForm.tsx:115-149` (incl. the `setHideView(false)` on `[hideView]` re-render hack), `DisplayTag.tsx:107-120` + `NotificationHub.tsx:75-83` (one clone outcome, two watcher chains) | Explicit `onSuccess` sequencing |
| Debounce/timer effects | ~6 + ~12 autocomplete arms | `Review.tsx:216`, forms' `setTimerTriggerFunction` timers (inconsistent cleanup: `LoadingScreen.tsx:23` has none) | Debounce utilities / query keys |
| **Genuine cross-slice business flows** | **~25–30% of the total** | see §9 flow catalog | **Must be re-encoded explicitly** — the crown jewels |

**Root cause, not symptom**: slices expose only shared boolean triplets and one payload slot — no cache, no per-request identity, no invalidation. Every consumer is therefore forced to watch status in an effect and hand-orchestrate refetches. The effects are not random incompetence; they are the only way to express request lifecycle in this architecture. That is why there are 148 of them and why a *faithful* refactor (the migration plan's governing principles #2 and #3: characterization tests + one-pass rule + "always shippable" behavior preservation) would port most of them rather than delete them.

**The bug surface the user worries about is real and specific**: boolean-soup state machines (`WordForm`'s 4 `recently*` flags, `TagInfoModal`'s 5 booleans, `FriendSearchModal`'s 4 op booleans, `Account`'s trigger flags), stale-closure deps (`Account.tsx:80-88` reads `user._id` with `[dispatch]` deps), self-triggering effects (`WordForm.tsx:147`), index-keyed selection against refetched lists (`Review.tsx:220`), and dual-success waits (friend-request effects fire only after BOTH notifications AND friendships slices report success — a race if one refetches slower). ~100 of the 148 effects belong to the first four rows and should not survive contact with the target stack.

---

## 5. Redux and the service layer vs. TanStack Query (user concern #2)

- **~80% of slice state is pure server cache** (words, tags, notifications, friendships, users, metrics, exercises, performance, autocomplete). Genuine client state: `wordSlice.currentlySelectedPoS` (+ its `setSelectedPoS/resetSelectedPoS` reducers), the auth session, and a few transient tag-form slots. This is the textbook TanStack Query + Zustand split.
- **~2,600–2,800 of the 3,036 feature lines are deletable boilerplate**: 55 thunks × ~9 identical catch lines (~500), 55 × ~11 identical extraReducers status lines (~600), ~90 lines of boolean-triplet declarations, ~70 lines of manual reset/clear reducers, ~300–400 lines of duplicated bearer-config/base-URL plumbing across services (→ one axios client + interceptor).
- **What must survive as knowledge** (not code): the invalidation/chaining edges, the flow sequencing (§9), localStorage-based session wiring, the Estonian-form sanitization logic currently buried inside `autocompletedTranslationSlice` extraReducers (`sanitizeDataStructureEENoun/EEVerb/EEAdjective` — must be lifted into query transforms), the 90s notification poll, and the collapse of the `TagDataForm.tsx:57-66` direct-service bypass into a single query.
- Coupling is real but concentrated: FriendSearchModal reads 5 slices; Header, Account, NotificationHub, TagDataForm read 4 each; the 15 language forms each read the autocomplete slice. A query-hook architecture replaces these with per-flow hooks (`useFollowedTags`, `useFriendRequests`, `useAutocompleteTranslation(lang, pos)`) whose invalidation edges are declared once, instead of re-implemented per component.

**TanStack suite verdicts:**

| Library | Verdict | Reasoning |
|---------|---------|-----------|
| **TanStack Query** | Adopt (both paths) | Deletes ~2,700 lines of plumbing; the migration plan already chose it. In a rewrite it is there from day one — no Redux/TanStack coexistence. |
| **TanStack Table** | Keep (already in use) | Review table is built on it; UI-agnostic. |
| **TanStack Router** | **Adopt in a rewrite** (not available to the refactor path, which keeps React Router 6) | Type-safe params matter here: `/addWord/:partOfSpeech?`, `/review/:filtersURL?`, `/word/:wordId?`, `/user/:userId?/notifications`. Typed routes eliminate a class of param-parsing bugs the current `RoutesWithAnimation.tsx` + per-page `useParams` parsing invites. |
| **TanStack Form** | **Do not adopt — keep react-hook-form + yup** | RHF is already proven in this codebase's hardest use case (15 dynamic per-language forms); shadcn integrates with RHF; TanStack Form is younger with a smaller ecosystem. The validation logic (yup schemas per form) ports as-is. Revisit only if the config-driven form engine makes RHF's dynamic schema composition awkward. |
| **Zustand** | Adopt (session + `selectedPoS` + UI state) | The only genuine client state. |
| Charts | Keep c3/D3, code-split | Migration-plan verdict holds; charts are isolated to Dashboard. |
| i18next, @dnd-kit, react-toastify | Keep | UI-agnostic, already paid for; 44 locale JSONs copy verbatim. |

---

## 6. Cost model — in-place refactor (per `frontend-migration-plan.md`)

The plan's own numbers: ~7–10 weeks across 10 phases (human-calibrated, 2026-08-11), Phase 5 = 4–6 weeks. Hidden costs this review surfaced:

1. **Characterization tests of flag machines are expensive and flaky.** Governing principle #2 (MSW tests pin current behavior, kept green through the swap) requires deterministically reproducing dual-success waits, chained boolean effects, debounce timing, and 90s polling of the OLD code. That is test engineering on the least testable code in the repo — the plan budgets no separate estimate for it, and flaky pinning tests erode the safety net they exist to provide.
2. **Faithful porting preserves the anti-patterns.** The one-pass rule and behavior-preservation gates mean the ~100 mechanical effects are ported (MUI leaves → shadcn leaves) rather than deleted. There is no "effect re-modeling" workstream in the plan; the boolean soups arrive intact in the new stack, minus the tests that pinned them.
3. **The 15 forms convert individually.** Phase 5d treats per-language forms as separate conversions — double-touching ~8,700 lines of copy-paste and freezing the duplication permanently.
4. **4–6 weeks of dual-stack coexistence**: MUI + Tailwind, Redux + TanStack, CssBaseline vs preflight, per-cluster grep gates. Every phase pays a tax to keep two architectures simultaneously alive.
5. **Toolchain surgery is pure overhead**: CRA→Vite migration, tsconfig rewrite, 74-file icon codemod, z-index bridge, design-token bridge — none of it produces product value; it exists only to keep the old app shippable during conversion.

What the refactor buys (genuinely): continuous shippability, reversible phases, incremental verification, and no parity risk — every intermediate state is the real app.

## 7. Cost model — re-implementation

**Shape**: a **new repository** — a fresh monorepo with npm workspaces from day one (`backend/` + `frontend/`). The backend is *copied* from the current repo (TS controllers, routes, Drizzle schema, Jest tests — the legacy Mongoose `.js` files are dropped in the copy) and then modified per §8: the friendships model (§8.2), `tag_shares` + authorization + transactional clone (§8.3), hygiene fixes (§8.5), and pagination (§8.4). The frontend is built from scratch on the target stack below. The current repo stays untouched and **live on the real domain** the entire time — it is the executable spec; the new repo deploys to a **temporary domain**, and the real domain is switched to the new deployment manually once the parity checklist and its intentional-deltas annex are green (§11). The hosting platform (Vercel single-project vs Railway + Neon) remains undecided (`.context/production-migration-plan.md`), so the default architecture is deploy-agnostic: pure HTTP request/response, no persistent-connection dependency — SSE stays a documented contingent upgrade (§8.1), not a default.

**Target stack** (inherits the migration plan's settled library decisions — those verdicts were already correct): Vite + TypeScript 5 **strict from day one** (`noImplicitAny: true`, zero `@ts-ignore` tolerance), React latest stable, Tailwind v4 + shadcn/Base UI + Phosphor icons, TanStack Query v5, TanStack Router, Zustand, react-hook-form + yup, @tanstack/react-table, @dnd-kit, i18next, react-toastify, axios (one client, request interceptor, 401→logout — no refresh endpoint exists).

**Architecture decisions that shrink the codebase**:
- Config-driven form engine: field lists, yup schemas, and case names derived from `wordCasesDataByPoS.ts` + `enums.ts` (both ported verbatim); one form renderer + 15 configs instead of 15 hand-rolled 580-line components.
- ~54 typed query/mutation hooks generated against the live backend contract (Phase 0 catalog of the migration plan + Drizzle schema); invalidation graph declared once.
- No status booleans anywhere: mutation state is `isPending/isError/data` + `onSuccess/onError`.
- Guards centralized from day one (`ProtectedRoute` on the router) — fixing the known unguarded-pages bug in the first commit, not in Phase 5f.
- Backend changes ride the same rewrite: the §8 fixes are schema migrations + controller changes in the copied, user-less backend — not a live-migration project.

**Testing**: no characterization of old timing behavior. Instead: MSW-backed integration tests per flow written against the NEW code (deterministic by construction — no flag machines to synchronize), plus a **route-parity checklist** derived from the migration plan's Appendix B behavioral inventory + §9 flow catalog below, carrying an **intentional-deltas annex** listing every §8 behavior change (request-decline action, visibility-aware polling, clone preserving translations, server-side authorization) so those parity "failures" are expected and explicitly verified. The old app answers any "what should happen?" question by running it.

**Agentic-effort model** (the framing the user requested): with AI-assisted implementation, generation is cheap and discovery is expensive. This study + the migration plan's Phase 0/Appendix B + the audits have already paid the discovery cost: contracts, flows, inventory, and library decisions exist as documents. The expensive-remaining parts are the genuinely bespoke logic: the exercise flow (ExerciseCard 1,126 lines / EndScreen 510 / ExerciseParameterSelector 651), the Review table (1,864 lines), and the form engine. Estimated output: **~10–14K lines vs. today's 32.4K**, with the constraint set (strict TS, no booleans soup) enforced from commit one. Deliberately no week estimate: agentic throughput varies too much; the honest relative statement is that the rewrite touches only the ~30% of the codebase that is real product logic, while the refactor additionally pays coexistence, characterization, and toolchain tax on 100% of it.

**Cutover**: the new repo deploys to a temporary domain when its parity checklist is green per route; the old repo remains the live production deployment until the user manually switches the real domain to the new deployment (a DNS/hosting change made outside this codebase). Zero user-facing risk while building — v1 stays live the entire time, which neutralizes the refactor's traditional "always shippable" advantage for a dormant app. After the switch, the old repo is greppable reference material until the user archives it.

## 8. Deficiency catalog & fix-forward recommendations (2026-09-05)

*Added in the final revision, from four further read-only audits (notification delivery, friendships domain, tag share/clone domain, cross-cutting anti-patterns). The question: which current implementations should be **redesigned** in a rewrite rather than ported? Verdicts: notifications — keep polling, make it visibility-aware (8.1); friendships — redesign the data model (8.2); tag share/clone — redesign the data model and fix two genuine bugs (8.3); the rest — a fix-list that becomes rewrite constraints (8.4, 8.5). All recommendations target the rewrite; the current repo is unchanged.*

### 8.1 Notification delivery — keep polling, make it visibility-aware

**Current state** (verified): a global 90s `setInterval` poll (`MainView.tsx:67-75`, hook `useInterval.tsx:3-25`) runs whenever the authenticated shell is mounted — no `document.visibilityState` handling, so it keeps firing while the tab is hidden. Every poll ships the user's **entire notification history including dismissed rows** (`GET /api/notifications/getNotifications`, `notificationController.ts:227-235`), and the unread badge is filtered client-side from that array (`Header.tsx:200-204`) — stale between polls. `NotificationHub` re-fetches the same full list on mount and after every local mutation via a `changedNotificationList` effect (`NotificationHub.tsx:46,59-64`). Poll failures are silent (the interval callback ignores the rejected thunk), and each tick re-runs `JSON.parse(localStorage.getItem("user")!)` (`MainView.tsx:69`) — a throw on corrupt JSON; the inline comment even says "60 seconds" while the code says 90 (`MainView.tsx:73`). Notifications are created **client-side** through the generic `POST /api/notifications` for both `friendRequest` (`FriendSearchModal.tsx:184-192`) and `shareTagRequest` (`Account.tsx:216-223`) — the backend never creates them itself.

**Options**: (a) visibility-aware polling — pure HTTP, works on any host; (b) SSE — near-realtime push but requires a persistent process: the current backend is one (`backend/api/index.js:52` calls `app.listen()`; no serverless export), yet Vercel serverless cannot hold connections, so SSE **forces the Railway path**; (c) websockets — bidirectional, heaviest, same hosting constraint, no bidirectional need exists.

**Recommendation — (a), with SSE as a documented contingent upgrade.** Notifications here are infrequent and low-priority; ≤90s latency is acceptable, and the platform is undecided — the default must not lock it. Concrete shape: one `['notifications']` query with `refetchInterval: 90_000`, `refetchIntervalInBackground: false` (pauses while hidden), `refetchOnWindowFocus: 'always'`, TanStack's default retry + an `onError` toast (fixes silent failures); the list endpoint gains `?unreadOnly=&since=` cursor params so the poll ships deltas, not history; dismiss/snooze become mutations updating the cache via `setQueryData`. If Railway is later chosen, SSE (`/api/notifications/stream`, `Last-Event-ID` reconnect, EventSource feeding `setQueryData`) is a contained, documented upgrade — not built by default. Websockets rejected: worst complexity-to-value ratio for a badge refresh.

**Semantic change that rides along**: notifications become a *display-only inbox*. Pending actions (accept friend request, accept shared tag) render from domain queries (§8.2, §8.3), not by parsing notification JSONB — the client-side create paths and the Hub's mutation→refetch effects disappear.

### 8.2 Friendships — redesign the data model

**Verdict: not good enough — redesign.** The defects are structural:

- **No requester column.** `friendships` stores a sort-normalized `user1_id`/`user2_id` pair (`schema.ts:135-142`); requester identity exists only inside the separately-created notification's JSONB (`content.requesterId`, `FriendSearchModal.tsx:184-192`) and in FE request ordering — which the DB destroys: the controller re-sorts ids and returns `[user1Id, user2Id]`, so a returned `userIds[0]` is the lexicographically-smaller id, not the requester (`friendshipController.ts` `toUserColumns`/`toUserIdsArray`, ~115-130). Controllers then *guess* the caller's role positionally (`friendshipController.ts:418-432`).
- **No decline action.** The routes offer create / accept / delete-request / delete only (`friendshipRoutes.js:8-13`); a recipient who ignores a request leaves it `pending` forever. `status` is a nullable varchar whose values exist only by convention (`schema.ts:140`).
- **Duplicate requests possible.** The schema comment claims a CHECK constraint "prevents duplicates" (`schema.ts:132-133`), but neither a CHECK nor any UNIQUE exists (the migration emits only the two FKs), and the create handler never checks for an existing row (`friendshipController.ts:201-231`) — both users sending, or re-sending, inserts duplicate pending pairs.
- **Non-transactional compound endpoints.** `PUT /acceptRequestAndDeleteNotifications/:id` and `DELETE /deleteRequestAndNotifications/:id` each do a friendship write and a notification delete as two separate awaits (`friendshipController.ts:379-387, 425-437`) — partial failure leaves an accepted friendship with an orphaned notification, or vice versa.
- **Client-orchestrated send.** The FE issues *two* dispatches (POST notification, then POST friendship — `FriendSearchModal.tsx:466-469`) and confirms success via the dual-slice wait effect plus four per-action booleans (`FriendSearchModal.tsx:90-93,148-180`) — exactly the effect machinery §4 cataloged.

**Redesign**: a single `friendships` table with `requesterId`/`addresseeId` NOT NULL FKs and a NOT NULL `status` enum (`pending|accepted|declined|cancelled`); partial `UNIQUE (requesterId, addresseeId) WHERE status='pending'` (one outstanding request per direction) and an expression `UNIQUE (LEAST(requesterId,addresseeId), GREATEST(requesterId,addresseeId)) WHERE status='accepted'` (one friendship per unordered pair); the create handler double-checks both directions. One action per endpoint: `POST /api/friendships` (creates the friendRequest notification **server-side, in the same `db.transaction`**), `POST /:id/accept`, `POST /:id/decline` (new capability), `DELETE /:id` (cancel by requester while pending / unfriend by either participant once accepted), `GET` list + pending-inbox. The `friendship_partnerships` table (`schema.ts:149-156`) carries over unchanged. Drop the legacy `userIds`-array API shape — it was a Mongo compatibility shim; responses carry `requester`/`addressee` objects. FE: `useFriendships`/`useFriendRequests`; one mutation per action whose `onSuccess` invalidates `['friendships']` + `['notifications']` — the dual-slice effect, its four booleans, and Account's `triggerGetFriendships` refetch-flag effect (`Account.tsx:60,145-150`) are deleted by construction.

### 8.3 Tag share / clone / follow — redesign; two genuine bugs

**Verdict: redesign.** The share lifecycle uses a notification row as its state machine, and the clone path has two real bugs:

- **Share = notification-as-carrier.** Sending a tag POSTs a generic notification (`variant:'shareTagRequest'`, JSONB `{tagId, requesterId}` — `Account.tsx:213-221`; `notificationController.ts:232-244`); no accept/decline state exists anywhere — only the notification's `dismissed` boolean (`schema.ts:167`).
- **Bug — clone without authorization.** `POST /api/tags/addExternalTag` (`tagRoutes.js:24`) checks only that the tag exists (`tagController.ts:329-338`): any authenticated user can clone **any tag by id, including private ones, without having been sent it**. The only privacy guard is a FE render condition (`DisplayTag.tsx:189-191`); the NotificationHub accept path has none. Adjacent gaps: `getTagById` returns private tags + words by id (`tagController.ts:276-279`), `createTag` trusts `req.body.authorId` (`tagController.ts:421-426`), `followTag` has no visibility check (`tagController.ts:308-326`), `addTagsInBulkToWords` no ownership check (`tagController.ts:281-306`), `updateTag` lets the client move `authorId` (`tagController.ts:579`).
- **Bug — silent data loss on clone.** `addExternalTag` clones the tag and its words server-side but copies only `partOfSpeech` + `clue` per word (`tagController.ts:358-372`); `getWordsByIds` returns bare rows without translations/cases (`wordService.ts:238-247`) — an accepted shared tag arrives with every word's `translations: []`. The operation is also three sequential inserts with no transaction (`tagController.ts:348-382`) — partial clones possible.
- **Follow/unfollow state ambiguity.** One `followedTagResponse` slice slot is written identically by follow and unfollow (`tagSlice.ts:458-486`); the hook decides which happened by branching on stale component props (`useFollowUnfollowTag.tsx:13-59`). Bulk-add-tags-to-words's fulfilled handler is a state no-op with a TODO (`tagSlice.ts:441-446`) — dependent lists stay stale.

**Redesign**: an explicit `tag_shares` table (`tagId`, `senderId`, `recipientId`, status enum `pending|accepted|declined`, partial unique pending per `(tagId, recipientId)`); endpoints `POST /api/tags/:id/share`, `POST /api/tag-shares/:id/accept` and `/:id/decline`. Accept verifies `recipientId === req.user.id && status='pending'` and runs a server-side `cloneTag` **transaction** copying the tag, its `tag_words` links, and each word **with translations and translation cases** (fixes the data loss). A server-side authz helper (`canViewTag`: author | Public | Friends-Only-and-friends) is enforced on `getTagById`, `followTag`, and clone (pending share to the caller OR a Public tag); `createTag` always sets `authorId = req.user.id`; ownership checks on update/bulk-add. Rename the `public` column to `visibility` with a typed enum (`schema.ts:95` — a reserved word, and a loose varchar today). FE: `useTagShares`; distinct `useFollowTag`/`useUnfollowTag` mutations (the overloaded-flag hook dies); pending shares render from a domain query. Notifications remain the display inbox, created server-side in the same transactions — a single source of truth for pending state. (Alternative considered and rejected: acting on notifications with a `shareId` stored in content — two sources of truth for the same state.)

### 8.4 Cross-cutting frontend deficiencies (fix-list → rewrite constraints)

| # | Deficiency | Evidence (verified 2026-09-05) | Fix in the rewrite |
|---|------------|-------------------------------|--------------------|
| 1 | **No ErrorBoundary anywhere** — one render exception unmounts the whole SPA | zero `ErrorBoundary\|componentDidCatch\|getDerivedStateFromError` hits in `frontend/src`; `App.tsx` is a bare router | `react-error-boundary` per route from commit one |
| 2 | **Unpaginated lists** — `getWords`/`getWordsSimplified` return every accessible row; tag lists ship whole lists incl. words | `wordController.ts:455-458,546-548`; `tagController.ts:227-244` | cursor pagination (BE) + `useInfiniteQuery` (FE) |
| 3 | **Review filters are ephemeral** — never written back to the URL (only the tag param is read, once); a no-arg refetch drops all filters; row selection keyed by row index | `Review.tsx:79-98,104-109,232-260,280-285` | all filters in URL searchParams (TanStack Router); stable-id row selection |
| 4 | **One module-global debounce timer shared by all 15 word forms**, never cleared on unmount — cross-form interference + stale dispatches after navigating away | `generalUseFunctions.ts:544-550`; consumers e.g. `VerbFormEN.tsx:479` | per-instance `useDebouncedCallback` hook |
| 5 | **`x!!` double non-null assertion at 100+ sites**; optional callbacks invoked with `props.onChange!(...)` — a live crash vector | `RadioGroupFormHook.tsx:189,197`; `ExerciseCard.tsx:77-90`; `DnDSortableItem.tsx:36-52` | strict TS + lint rule banning non-null assertions |
| 6 | **Index keys on reorderable/refetching lists** (~40 sites) | worst: `DnDLanguageOrderSelector.tsx:232,320` (live drag-reorder keyed by index); `WordForm.tsx:572-576` | stable ids everywhere; lint guard |
| 7 | **Inline `sx={{...}}` object literals at hundreds of sites** — per-render churn, zero theming | `Review.tsx` ~25 blocks, `ExerciseCard.tsx` ~20, `Header.tsx` ~15 (grep-capped counts — lower bounds) | inherent to the MUI→Tailwind swap; class strings + `cva` |
| 8 | **Unguarded `JSON.parse(localStorage['user'])` at module import** — corrupt storage crashes app boot; re-parsed per mount elsewhere | `authSlice.ts:8`; `MainView.tsx:69`; `AuthVerify.tsx:20` | Zustand `persist` with guarded migration |
| 9 | **Clickable non-interactive containers** — no role/tabIndex/keyboard handling | `Review.tsx:353` (filter toggle on a `Grid onClick`); `Account.tsx:639`; `NotFound.tsx:134` | shadcn interactive primitives only |
| 10 | **Dead code** — unused thunk, large commented blocks, stale module vars | `tagSlice.ts:245-247`; `TagDataForm.tsx:53-58,97-110` | simply not copied |

Positive findings worth keeping: zero `console.log` in `frontend/src`; bcrypt and JWT expiry are handled correctly backend-side (`userController.ts:54-55,140-141,187`; `authMiddleware.ts:38`).

### 8.5 Backend hygiene for the copied backend (one-time fixes during the copy)

- **CORS**: `origin: '*'` combined with `credentials: true` (`app.js:7-14`) is a misconfiguration; serve FE+BE same-origin (removes CORS entirely) or use an explicit origin allowlist.
- **Error responses**: the error middleware ships `err.message` + `err.stack` whenever `NODE_ENV !== 'production'` (`errorMiddleware.js:6-9`), and several handlers return the raw error object (`exercisePerformanceController.js:121,155`; `userController.ts:473`); replace with stable error codes.
- **Legacy files**: drop the dead Mongoose `.js` controllers/models during the copy (the pending Phase-6 cleanup, folded into the rewrite).
- **Schema changes**: `public` → `visibility` typed enum (§8.3); friendships model (§8.2); `tag_shares` (§8.3); pagination (§8.4 #2).
- **Contract decisions**: the two TODO-marked routes (`GET /api/tags/filterTags`, `GET /api/words/getAllWordDataByWord`) get an explicit keep/delete decision during contract pinning (§2).

---

## 9. Flow catalog — the crown jewels (must-preserve regardless of path)

The ~25–30% of effects that encode real sequencing. Any approach must re-encode these explicitly; they are listed here so they are rediscovered from a document, not from a debugging session:

1. **Follow/unfollow tag cycle** — `useFollowUnfollowTag.tsx` + `useIsUserFollowingTag.tsx` + `TagInfoModal.tsx:105` + `DisplayTag` + `Account` cooperate through a shared flag and a `clearFollowedTagData()` payload consumed by sibling watchers. → Model: `followTag`/`unfollowTag` mutations invalidating `['tags','followed']` + `['tags']` (per-op follow/unfollow mutations — §8.3).
2. **Tag share / accept-and-clone** — `DisplayTag.tsx:107,114` and `NotificationHub.tsx:75` independently await `acceptExternalTag` → `clonedTagResponse`, then toast + delete the source notification (two entry points, one outcome). → Redesign per §8.3 (tag_shares table, transactional server-side clone): the two watcher chains collapse into one mutation.
3. **Friend request send/cancel/accept/delete** — `FriendSearchModal.tsx:148-165` toasts only after BOTH the notifications AND friendships slices report success after a combined delete-request-and-notifications call, then refetches friendships. → Redesign per §8.2 (requester/addressee model, server-side notification, decline action): the dual-slice wait disappears.
4. **Exercise performance save** — `ExerciseCard.tsx:378-389` splices the saved performance into the in-memory exercise list by `currentCardIndex`, then resets the slice. → `onSuccess`: `setQueryData` on the exercises query + invalidate metrics.
5. **WordForm save/delete orchestration** — create/update/delete must navigate, toast, and reset a many-field form in the right order, today gated by `recentlyModified/recentlyDeleted` flags. → Mutation `onSuccess` chains.
6. **Notification polling** — 90s interval + immediate first fetch (`MainView.tsx:67-75`). → Redesign per §8.1: visibility-aware polling (`refetchInterval` + `refetchIntervalInBackground: false` + `refetchOnWindowFocus`) over an unread-only cursor query; SSE upgrade contingent on the platform decision.
7. **Autocomplete** — 8 language×PoS variants, debounced arming via module-level `setTimerTriggerFunction` timers, Estonian result sanitization, not-found/partial-match statuses. → `useAutocompleteTranslation(lang, pos)` family with query-key factories; sanitization in query transforms.
8. **Bulk-add tags to words** — touches tags, words, and tag word counts simultaneously. → Invalidate `['tags',id,'wordCount']` + `['words']`.
9. **Auth wiring** — session in `localStorage['user']`; expiry check on route change (`AuthVerify`); logout clears session + (new) query cache. Known bug to fix, not port: Practice, Account, NotificationHub, DisplayTag render unauthenticated.
10. **Review table selection** — `Review.tsx:220` indexes into a refetched list by row key; rewrite must key by stable word id.

## 10. Risk comparison

| Risk | Refactor | Rewrite |
|------|----------|---------|
| Broken user-facing behavior mid-flight | Low (always shippable) — but the app is dormant, so the advantage is theoretical | Zero while building (v1 stays live); cutover is the only exposure, gated by the parity checklist |
| Preserved anti-patterns | **High** — faithful-port rules carry the flag machines over | None — constraint set enforced from commit one |
| Hidden implicit behavior rediscovered late | Low (it is being preserved, not re-derived) | Medium — mitigated by §9 catalog, the running PoC, and greppable v1 |
| Long half-migrated state (the classic strangler failure) | Medium — Phase 5 is 4–6 weeks of hybrid complexity | None — one stack, one codebase |
| Backend contract drift | Low (backend frozen, live) | Low (same) |
| Intentional behavior changes invalidate naive parity checks | n/a — a faithful refactor ports behavior as-is | Medium — the parity checklist carries an **intentional-deltas annex**: every §8 fix (decline action, visibility-aware polling, clone preserving translations, server-side authorization) listed as an expected delta with its own verification |
| Testing burden | Characterization of untestable timing behavior | Contract/integration tests of clean new code |
| Cost profile | Toolchain + coexistence + characterization tax on 32.4K existing lines | Generation of ~10–14K new lines against a paid-down discovery cost |
| Second-system overdesign | Low (constraints are the plan's own decisions) | Medium — mitigated by copying v1's UX verbatim except the §8 fix list; the only new user-facing capabilities are request decline (§8.2, §8.3) |

## 11. Verdict

**Re-implement.** The reasoning chain:

1. **~70–75% of the existing code should not survive**: ~2,700 lines of Redux/service plumbing are deletable boilerplate, ~8,700 lines are copy-paste form scaffolding a config engine collapses to ~2,000, and ~100 of 148 effects are status-watching/derived-copy patterns the target stack deletes by construction.
2. **The refactor's advantages are void in this situation**: the app is dormant (nothing to ship incrementally), the backend is final (no drift to shield from), and there are zero tests whose coverage would be interrupted. A rewrite keeps v1 live until cutover, matching the refactor's user-facing safety.
3. **The refactor's safety net is its weak point**: characterization tests would have to pin flag-machine timing — the flakiest test surface imaginable — while the one-pass rule guarantees the anti-patterns migrate intact.
4. **Agentic implementation inverts the cost ratio**: generation is cheap, discovery is expensive — and discovery is already paid for. The migration plan's durable outputs (contract catalog groundwork, Appendix B behavioral inventory, library decisions, invalidation graph design) transfer 1:1 to the rewrite. The plan is not wasted; it becomes the rewrite's specification.

5. **The rewrite is the cheapest moment to fix the domain models.** The §8.2/§8.3 redesigns are schema migrations + controller rewrites in a copied, not-yet-live backend with zero users to migrate; retrofitting them into the live repo would be a second migration project with real users on it.

**Kill-switch (conditions that flip the verdict back to the refactor plan)**: (a) product development must resume immediately with weekly shippable increments — the rewrite's cutover boundary conflicts; (b) after building the first vertical slice (auth shell + Dashboard), measured pace suggests the full rewrite exceeds ~2× the equivalent migration-plan effort — in that case the migration plan remains fully executable as corrected by the patches applied 2026-09-04.

**If the rewrite is chosen**, the next artifact is a build plan for the **new repository**: scaffold the monorepo (npm workspaces: `backend/` + `frontend/`) → copy the backend and apply the §8 backend changes (§8.2 friendships model, §8.3 `tag_shares` + authz + transactional clone, §8.5 hygiene, pagination) → auth + router shell → Dashboard vertical slice proving the form/chart/query stack → route-by-route parity per the checklist + intentional-deltas annex → deploy to a temporary domain (platform per `.context/production-migration-plan.md`, still undecided) → the user switches the real domain manually when satisfied. Deliberately out of scope here: this document is the evaluation.

## 12. Final review findings on `frontend-migration-plan.md`

Full review of the refactor plan against the codebase (2026-09-04). Factual items were patched into the plan directly; strategic items are recorded here because they are the substance of the refactor-vs-rewrite argument:

**Patched (plan file updated):**
1. Backend-migration status was stale (Decision 1, Phase 0 step 2, risk register) — the Drizzle/Postgres backend is complete and live; the "contract drift" risk is retired.
2. The auth-refresh conditional (Decision 2, Phase 4) is resolved: no refresh endpoint exists on the live backend; the TOKENS table serves verification/reset, not JWT refresh. 401→logout ships; structure stays refresh-ready.
3. Phase 5b's file list omitted `pages/Account.tsx`, which reads the friendships, tags, and notifications slices (Account.tsx:48-51) — its data reads must switch in 5b, not 5f.
4. A cross-reference note added at the top of the plan pointing to this study.

**Noted here (strategy-level, not patched):**
5. **No effect re-modeling workstream**: principles #2/#3 (characterization-first, one-pass, faithful behavior) port the ~100 mechanical effects and the boolean state machines rather than deleting them. If the refactor path is executed anyway, add an explicit per-cluster step: "status-watcher effects are deleted, not ported; flows from §9 are re-modeled as mutation callbacks" — and budget its test cost honestly.
6. **Per-language form duplication unaddressed**: 5d converts 15 near-duplicate forms individually (~8,700 lines), freezing the duplication. Under the refactor path, at minimum decide whether 5d unifies them via a config-driven engine; under the rewrite path this study already prescribes it (§7).
7. **Characterization-test cost underestimated**: pinning dual-success waits, chained flag effects, debounce timers, and 90s polling deterministically is the hard 20% of the test pyramid; the plan's estimates don't call it out.
8. **Minor inventory omissions**: `Review.tsx:220` index-keyed selection against refetched lists (fragile, absent from Appendix B); `TagDataForm.tsx:57-66` direct `tagService` bypass parallel to a dead thunk (both must collapse in any migration); `LoadingScreen.tsx:23` timeout without cleanup; two backend routes TODO-marked for removal (`filterTags`, `getAllWordDataByWord`) — confirm before pinning contracts.
9. **Verified numbers the plan approximated**: endpoint count is 54 (plan said ~50 across 10 services — close enough); effect count is 148 in 52 files; `@ts-ignore` count is 172 and `any` uses ~440 — the Phase 8 `noImplicitAny` flip is a larger tail than the plan's "fix remaining anys" phrasing suggests.
10. **Effort estimates are human-calibrated (2026-08-11) and predate the agentic-implementation framing** — under AI-assisted development both paths shrink, but the rewrite shrinks proportionally more because its cost is generation-dominated, while the refactor's cost is verification-and-coexistence-dominated.
