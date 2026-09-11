# Frontend `src/` Structure & Component Breakdown

*2026-09-07. Proposal for the reimplementation frontend's file layout, derived from the UI-blueprint (`snapshot/ui/00–06`, behaviour) and `MOCKUPS/` (design language). Review target — nothing scaffolded yet. Pairs with the frontend invariants in [`.context/README.md`](../README.md) and [`.context/plans/new-repo-build-plan.md`](../plans/new-repo-build-plan.md) §5 (phases).*

---

## 0. Resolved decisions (2026-09-07)

| # | Decision | Resolution |
|---|----------|-----------|
| D1 | Routing style | **Code-based route tree** in `app/router.tsx` (no `@tanstack/router-plugin`). Small route set, still fully typed. Revisit file-based later if the tree grows. |
| D2 | Design-system source | **Port `MOCKUPS/assets/app.css`** (warm paper `--bg`, teal `--accent`, serif display / sans UI / mono numerics, 36px controls, 4px grid, per-language `--lang-*` tints) into Tailwind v4 `@theme` tokens + a thin component-class layer. The blueprint's "neutral / shadcn defaults" note is subordinate — MOCKUPS is authoritative for look. |
| D3 | shadcn/Base UI depth | **Add primitives per phase.** Phase-1 set: button, input, textarea, label, form (RHF bridge), dialog, alert-dialog, select, checkbox, radio-group, sheet, skeleton, dropdown-menu, toast host. |
| D4 | Route files vs pages | **Thin `routes/*` files** compose `features/*/pages/*`. Guards, search-param schemas, and code-split boundaries live in `routes/` + `app/router.tsx`, never in feature code. |
| D5 | Shared-logic folder | **`lib/`** (focused modules). Port from the old `generalUseFunctions.ts` only what a live feature needs, each with a test. |

---

## 1. Guiding principles

1. **Feature-first.** Each domain (auth, words, autocomplete, exercises, tags, social) owns its API layer, query hooks, key factory, types, components, and pages in one folder under `features/`. Cross-feature primitives live in `components/`; cross-feature logic in `lib/`.
2. **Thin routes.** `app/router.tsx` + `routes/*` only wire URL → view: guard, search-param schema, code-split boundary. They import a feature page and render it.
3. **No server state outside TanStack Query.** Every `features/*/api.ts` is plain typed `axios` calls; every `features/*/hooks.ts` wraps them in `useQuery`/`useMutation`. No slices, no status booleans. Toasts fire from mutation `onSuccess`/`onError`.
4. **Three client-state stores only** (`stores/`): `authStore` (session), `uiStore` (selectedPoS, sidebar collapsed, etc.), and practice's pre-selected-words hand-off (route state or `uiStore`).
5. **The form engine is one subsystem** (`features/words/form-engine/`): one renderer + per-PoS×language field configs derived from `ts/wordCasesDataByPoS.ts` + `ts/enums.ts`. Nouns first (Phase 2), the rest slot in as configs (Phase 3).
6. **Design tokens are centralised** (`styles/`): the `MOCKUPS/app.css` `:root` tokens become Tailwind v4 `@theme` + CSS variables; component-level classes from the mockup (`.btn`, `.tcard`, `.dtable`, `.chip`, `.ring`, …) either become shadcn components or a thin `@layer components` file — decided per component as it's built.

---

## 2. Directory tree

```
frontend/src/
├── main.tsx                     # entry — mounts <Providers/>
├── env.ts                       # (exists) all import.meta.env access
├── i18n.ts                      # (exists) i18next init (4 UI langs, http-backend from /locales)
│
├── app/                         # app-wide wiring (not feature code)
│   ├── Providers.tsx            # QueryClientProvider + RouterProvider + ToastHost + root ErrorBoundary + I18nextProvider
│   ├── router.tsx               # route tree: root, _public / _protected layout routes, all leaf routes, code-split
│   ├── query-client.ts          # QueryClient factory + default options + staleTime policy table
│   └── feature-flags.ts         # env-based flags (tags / search / notifications / friends), default on
│
├── routes/                      # thin per-route view modules (composed by router.tsx)
│   ├── protected-layout.tsx     # ProtectedRoute gate (reads authStore) + <AppShell/> + <Outlet/>
│   ├── public-layout.tsx        # bare centered layout, no header
│   ├── dashboard.tsx            # "/"                         → features/metrics
│   ├── add-word.tsx             # "/addWord/$partOfSpeech?"   → features/words
│   ├── word.tsx                 # "/word/$wordId"             → features/words
│   ├── review.tsx               # "/review/$filtersURL?"     (search-param schema lives here)
│   ├── practice.tsx             # "/practice"                 → features/exercises
│   ├── account.tsx             # "/user"                     → features/social (deferred)
│   ├── notifications.tsx        # "/user/$userId/notifications" (deferred)
│   ├── tag.tsx                  # "/tag/$tagId"               (Phase 4)
│   ├── login.tsx  register.tsx  verify.tsx  reset-password.tsx
│   └── not-found.tsx
│
├── api/
│   ├── client.ts                # single axios instance; baseURL from env; request interceptor (Bearer from authStore);
│   │                            #   response interceptor: 401 → authStore.clearSession() + redirect /login
│   │                            #   (retry-once refresh leg present but disabled — no refresh endpoint)
│   └── types.ts                 # shared wire primitives: ApiError shape, CursorPage<T>, Id
│
├── stores/
│   ├── authStore.ts             # Zustand + persist; { user, token }; setSession / clearSession; ONE normalized shape
│   │                            #   (migrates the old localStorage['user'] key, guarded parse)
│   └── uiStore.ts               # selectedPoS, review sidebar collapsed, practice pre-selected word ids, search mode
│
├── components/
│   ├── ui/                      # shadcn / Base UI primitives (added per phase) — button, input, textarea, label,
│   │                            #   form (RHF bridge), select, checkbox, radio-group, dialog, alert-dialog, sheet,
│   │                            #   tooltip, card, badge, skeleton, switch, dropdown-menu, toast host
│   ├── layout/
│   │   ├── AppShell.tsx         # sticky header + centered container (max-w-5xl; Review uses wide)
│   │   ├── AppHeader.tsx        # logo, primary nav (Add Word / Practice / Review), ≥2-language gate on nav items
│   │   ├── GlobalSearch.tsx     # input + word/tag mode Switch; result → /word/:id or /tag/:id
│   │   ├── LanguageSelector.tsx # EN/ES/DE/EE dropdown → persists uiLanguage via profile update
│   │   ├── UserMenu.tsx         # avatar (initials, deterministic bg) + unread badge; menu: Dashboard/Account/Notifications/Logout
│   │   └── VerifyEmailBanner.tsx# persistent "verify your email" banner while unverified
│   └── common/                  # cross-feature widgets (not primitives)
│       ├── FlagIcon.tsx         # per-language flag (GB/DE/ES/EE) + optional native name (LanguageIdentity)
│       ├── PartOfSpeechSelector.tsx  # 4 radio cards (Noun/Verb/Adjective/Adverb) — Add Word step 1 + inline
│       ├── CompletionRing.tsx   # conic-gradient ring + "x/y cases" detail
│       ├── DualListDnD.tsx      # @dnd-kit two-container sortable + ± fallback; min-2 invariant; native-language pin
│       ├── TagPicker.tsx        # AutocompleteMultiple — search tags, add-new, chip removal
│       ├── ConfirmDialog.tsx    # AlertDialog wrapper for destructive confirms
│       ├── EmptyState.tsx  ErrorState.tsx  LoadingScreen.tsx
│       └── PageTransition.tsx   # CSS fade/slide wrapper (`.page` keyframe from the mockup)
│
├── features/
│   ├── auth/
│   │   ├── api.ts               # login, register, verifyEmail, requestPasswordReset, setPassword, getMe, updateProfile
│   │   ├── hooks.ts             # useLogin, useRegister, useVerifyEmail, useRequestReset, useSetPassword, useUpdateProfile
│   │   ├── schemas.ts           # yup: loginSchema, registerSchema, resetSchema (mode-conditional)
│   │   ├── components/          # LoginForm, RegisterForm, ResetPasswordForm, VerifyEmailStatus
│   │   └── pages/               # LoginPage, RegisterPage, VerifyEmailPage, ResetPasswordPage
│   │
│   ├── metrics/
│   │   ├── api.ts hooks.ts      # getUserMetrics → useUserMetrics (staleTime ~5min)
│   │   ├── components/          # UserInfoPanel (stat cards), MetricsPanel, charts/{PieChart,BarChart,chartColors}
│   │   └── pages/DashboardPage.tsx   # welcome banner (cycling greeting) + info + metrics panels
│   │
│   ├── words/
│   │   ├── api.ts               # getWords (cursor), getWordById, createWord, updateWord, deleteWord, deleteMany
│   │   ├── hooks.ts             # useWordsInfinite, useWord, useCreateWord, useUpdateWord, useDeleteWord, useBulkDeleteWords
│   │   ├── keys.ts              # ['words'], ['words', filters], ['words', id] key factory
│   │   ├── types.ts             # WordData, TranslationItem, TableWordData (real dataXX simplified shape)
│   │   ├── form-engine/
│   │   │   ├── WordForm.tsx         # orchestrator: PoS step → translation grid → clue → tags → sticky save bar
│   │   │   ├── TranslationCard.tsx  # one language: tinted top border, header+ring, config-driven body,
│   │   │   │                        #   autocomplete row, Clear / Remove (disabled at 2), in-place language switch
│   │   │   ├── FieldRenderer.tsx    # FieldConfig → text input / radio group (regularity, gender) / checkbox
│   │   │   ├── useWordFormState.ts  # RHF wiring, per-translation completionState, dirty tracking, save gating
│   │   │   └── configs/
│   │   │       ├── index.ts         # getFormConfig(pos, lang) → TranslationFormConfig
│   │   │       ├── types.ts         # FieldConfig, TranslationFormConfig
│   │   │       ├── nouns.ts         # 4 lang configs (Phase 2) — from NounCasesData registry
│   │   │       ├── verbs.ts adjectives.ts adverbs.ts   # Phase 3 — registry (verbs) / enums (adj/adv); NO EE adverb
│   │   ├── review/
│   │   │   ├── ReviewTable.tsx      # TanStack Table instance; stable-id row selection
│   │   │   ├── columns.tsx          # column factory: select/owner → Type → per-language (primary case, sortable,
│   │   │   │                        #   optional gender chip, hover ring) → Tags
│   │   │   ├── FilterSidebar.tsx    # collapsible; gender / PoS / tags chips + language-order DualListDnD; state ↔ URL
│   │   │   ├── BulkActionBar.tsx    # Create exercises / View / Assign tag / Delete — gated by selection count
│   │   │   └── CellDialog.tsx       # click a cell → Dialog with the full translation editor (reuses form-engine)
│   │   ├── components/WordSimpleList.tsx   # compact read-only word list (tag view, pre-selected panel)
│   │   └── pages/               # AddWordPage, WordPage (view/edit toggle, owner vs read-only), ReviewPage
│   │
│   ├── autocomplete/
│   │   ├── api.ts               # the 8 lang×PoS endpoint variants
│   │   ├── hooks.ts             # useAutocompleteTranslation(lang, pos, query) family; per-instance debounce
│   │   ├── keys.ts              # ['autocompleteTranslation', lang, pos, query]
│   │   └── transforms.ts        # sanitizeDataStructureEENoun / EEAdjective / EEVerb / ESVerb + the 4 inline sanitizers
│   │
│   ├── exercises/              # Phase 5
│   │   ├── api.ts hooks.ts keys.ts types.ts   # getUserExercises; saveTranslationPerformance / master / forget mutations
│   │   ├── lib/evaluateAnswer.ts  # TI strictness L1–L3 (accent/case normalization) + MC checking
│   │   ├── components/          # ParameterMenu, ScoreHeader, ExerciseCard, TextInputCard, MultipleChoiceCard,
│   │   │                        #   PerformanceControls (%, thumbs, Master/Forget), EndScreen, ResultRow
│   │   └── pages/PracticePage.tsx  # state machine: parameters → cards → results
│   │
│   ├── tags/                   # Phase 4
│   │   ├── api.ts hooks.ts keys.ts
│   │   ├── components/          # TagInfoModal (create/edit/review, mode-driven), TagWordList
│   │   └── pages/TagPage.tsx
│   │
│   └── social/                 # Phases 6–7 — DEFERRED. Placeholder folder only.
│       ├── friendships/  notifications/  users/   # api + hooks per domain (redesigned models §8.1/§8.2)
│       ├── components/          # FriendSearchModal, NotificationInbox, UserBadge, FriendList
│       └── pages/               # AccountPage, NotificationsPage
│
├── lib/
│   ├── cn.ts                    # class-merge helper for shadcn
│   ├── useDebouncedCallback.ts  # per-instance debounce (kills the old module-global timer)
│   ├── useMediaQuery.ts
│   ├── avatar.ts                # stringAvatar / deterministic colour (from generalUseFunctions)
│   ├── language.ts              # langKeyByLabel, flag URL, native names, ordering helpers
│   ├── words.ts                 # getChipFieldsByPoS, primary-case extraction, completion (cases filled / max)
│   └── sort.ts                  # deterministicSort
│
├── styles/
│   ├── tokens.css              # MOCKUPS/app.css :root tokens → Tailwind v4 @theme + CSS vars (palette, type, spacing,
│   │                           #   radius, per-language --lang-* tints, state colours)
│   └── globals.css             # @layer base reset + @layer components for classes not worth a shadcn component
│
├── ts/                         # (exists) ported verbatim — DO NOT edit casually
│   ├── enums.ts  interfaces.ts  wordCasesDataByPoS.ts
│
└── test/
    ├── setup.ts                # (exists)
    ├── smoke.test.ts           # (exists)
    ├── msw/{handlers.ts,server.ts}   # MSW — handlers added per phase from endpoints.md
    └── render.tsx              # renderWithProviders (QueryClient + Router + i18n) for component/integration tests
```

---

## 3. Blueprint / mockup → module map

| Blueprint screen | Route file | Feature module(s) | Key components |
|------------------|-----------|-------------------|----------------|
| Shell (00) | `routes/protected-layout.tsx` | `components/layout` | AppShell, AppHeader, GlobalSearch, LanguageSelector, UserMenu, VerifyEmailBanner |
| Login / Register / Verify / Reset / 404 (01) | `routes/{login,register,verify,reset-password,not-found}.tsx` | `features/auth` | LoginForm, RegisterForm, VerifyEmailStatus, ResetPasswordForm |
| Dashboard (02) | `routes/dashboard.tsx` | `features/metrics` | DashboardPage, UserInfoPanel, MetricsPanel, PieChart, BarChart |
| Word editor (03) | `routes/{add-word,word}.tsx` | `features/words/form-engine` | WordForm, TranslationCard, FieldRenderer, PartOfSpeechSelector, TagPicker, autocomplete row |
| Review table (04) | `routes/review.tsx` | `features/words/review` (+ `autocomplete` via CellDialog) | ReviewTable, columns, FilterSidebar, BulkActionBar, CellDialog, DualListDnD, CompletionRing |
| Practice (05) | `routes/practice.tsx` | `features/exercises` | ParameterMenu, ExerciseCard, Text/MC cards, PerformanceControls, EndScreen, ResultRow |
| Account / Notifications / Tag view / modals (06) | `routes/{account,notifications,tag}.tsx` | `features/social`, `features/tags` | AccountPage, NotificationInbox, TagPage, TagInfoModal, FriendSearchModal, UserBadge, DualListDnD |

**Design-language carry-over from `MOCKUPS/app.css`** (into `styles/` + `components/ui`):
`--bg` warm paper / `--surface` / `--fg` ink / `--muted` / `--border` hairline / `--accent` teal (#0f766e); serif display font for headings & word titles, system sans for UI, mono for numerics/cases/badges; 36px controls, 4px spacing grid, `--radius` 8/12; per-language tints `--lang-gb/de/es/ee` used as 2px card-top borders and column-header accents; bottom-centre toasts; `.page` fade/slide keyframe for route transitions; skeleton shimmer; dense no-chrome tables.

---

## 4. Per-feature anatomy (the repeating shape)

Every `features/<x>/` folder follows the same contract so the codebase stays predictable:

```
api.ts       — typed axios calls on api/client.ts. No React, no store access, no query logic.
keys.ts      — query-key factory (one export object). Imported by hooks + invalidation edges.
hooks.ts     — useQuery / useMutation wrappers. Mutations declare onSuccess/onError (toasts) and
               queryClient.invalidateQueries per the invalidation graph. This is the ONLY place
               server state is read/written.
types.ts     — request/response interfaces, re-pinned against the live backend (endpoints.md).
schemas.ts   — yup schemas (forms only).
components/  — presentational + container components for this feature.
pages/       — route-level compositions; imported by routes/*.
```

Shared, one per app (not per feature): `app/query-client.ts` holds the **staleTime policy table** and `app/` also carries the **invalidation graph** as a doc comment / typed map, seeded from `frontend-migration-plan.md` §5.2 and extended each phase.

> Per-phase scope (what each phase actually creates) lives in [`.context/plans/new-repo-build-plan.md`](../plans/new-repo-build-plan.md) §5 and the per-phase files in [`.context/plans/`](../plans/) — this document stays scope-agnostic so it does not drift as the roadmap changes.

---

## 5. Conventions

- **Files:** components `PascalCase.tsx`; hooks/utils `camelCase.ts`; one component per file; colocate a component's small subparts in the same file only if trivial.
- **Imports:** absolute from `src/` via a `@/` alias (add to `tsconfig.json` `paths` + `vite.config.ts` `resolve.alias`). No deep relative `../../../`.
- **No barrel `index.ts`** re-export files except `components/ui` and `form-engine/configs` (explicit public surface).
- **Server state → hooks only.** A component never imports `api/client.ts` or a `features/*/api.ts` directly.
- **i18n:** all user-facing strings through `useTranslation(ns)`; namespaces mirror the old app's 11 (auth, common, wordRelated, caseDescription, …). Locale JSONs already in `public/locales/`.
- **Strict TS, no `!`, no `@ts-ignore`.** `ts/` files are the ported source of truth for enums/interfaces/case data — extend via new modules, don't rewrite them.
