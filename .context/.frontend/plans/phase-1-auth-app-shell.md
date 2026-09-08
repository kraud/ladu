# Phase 1 — Auth + app shell

## Context

`keelapp-v2` is a from-scratch frontend rebuild. Phase 0 (monorepo scaffold, backend copy, verbatim asset port) is done and committed at `c030b68`; the tree is clean on `main`. The frontend today is a bare scaffold — 8 source files, a placeholder `App.tsx`, `@import 'tailwindcss'` as the entire stylesheet, and no routing, API client, store, or UI components. Every target dependency is already declared in `frontend/package.json` but nothing consumes them.

Phase 1 is the **first vertical slice**: it proves the whole stack end-to-end (router → query → axios → backend → store → i18n → design system) on the auth flow, and it is the **kill-switch measurement point** — if pace here suggests the rewrite will exceed ~2× the in-place migration, we stop and execute `frontend-migration-plan.md` instead (study §11b).

It also fixes four §8.4 defects on day one: unguarded protected routes, unguarded `JSON.parse(localStorage['user'])`, three divergent session write shapes, and per-page auth guards instead of one centralised gate.

**Decisions taken with the user (2026-09-08):**

1. **Unverified users are blocked.** The blueprint contradicts itself — `ui/01-auth.md` says login-while-unverified keeps the user on `/login`, but register success lands them on `/` "logged in but unverified". We resolve it the strict way: login with `verified !== true` shows a warning toast and writes **no** session; register (which returns no token anyway) shows an info toast naming the email and redirects to `/login`. **Consequence: `VerifyEmailBanner` becomes unreachable and is dropped from Phase 1** — it is documented as a deliberate deviation from `frontend-structure.md` §5.
2. **Full shadcn CLI init** (decision D3, taken literally) — but rethemed by *bridging* shadcn's semantic tokens onto the Ladu tokens via `@theme inline`, not by hand-editing generated components. Lucide imports are swapped for Phosphor.
3. **Two backend leaks fixed** this phase: the bcrypt hash returned by `GET /api/users/getUser/:id`, and `passwordTokens` returned by `GET /me` / `PUT /updateUser`. The account-existence leak on `requestPasswordReset` is **left alone** and logged for Phase 7.
4. **New i18n keys land in all four locales** (en/es/de/ee), translated in-place. Estonian strings get flagged for the user to sanity-check.

Work proceeds in **five reviewable slices**, each independently runnable. The user commits between slices, and **confirms before each new slice starts** — no slice begins without an explicit go-ahead.

---

## Slice 0 — Persist this plan into the repo

Copy this plan verbatim to **`.context/.frontend/plans/phase-1-auth-app-shell.md`** (the directory exists and is currently empty). It becomes the tracked record of what was intended, so the finished work can be diffed against it at the phase gate and the deliberate deviations in Slice 5 are auditable. Subsequent phases add their own file alongside it.

---

## Slice 1 — Design system + UI primitives ✅ done (2026-09-08)

**Goal:** Ladu's visual language exists in Tailwind v4, and shadcn primitives render in it without per-component retheming.

### Outcome — what actually landed, and where it diverged from the plan below

- **Build config** landed as planned: `@/` alias in `tsconfig.json` + `vite.config.ts`; `vitest.config.ts` folded into `vite.config.ts` (single config, `defineConfig` from `vitest/config`).
- **Tokens** (`src/styles/tokens.css`, `src/styles/globals.css`) — one deliberate design change from the sketch below: raw palette tokens kept their **original bare app.css names** (`--accent`, `--muted`, `--border`, …) instead of a `--color-` prefix. Reason found during implementation: shadcn's own semantic slots are *also* bare `--accent`/`--muted`/`--border`, and for `accent`/`muted` the meanings genuinely differ (shadcn's `accent` is a hover-fill slot, ours is brand teal; shadcn's `muted` is a bg-fill, ours is gray text) — a `--color-` prefix on our tokens plus a naïve alias would have silently let one clobber the other. The bridge instead lives entirely in one `@theme inline` block that maps shadcn's `--color-*` theme keys to the *correct* raw var per meaning (`--color-primary: var(--accent)`, `--color-accent: var(--fg-soft)`, `--color-muted-foreground: var(--muted)`, etc.) — see the file's own header comment. `--container-app`/`--container-wide`/`--gutter`/`--control-h` were dropped entirely: they exactly match Tailwind's stock `max-w-5xl`/`max-w-7xl`/`px-6`/`h-9`, so no custom tokens were needed. Caught and fixed one real gap in this plan: `.card`/`.card-pad` were never listed among the ported component classes, even though every MOCKUPS auth page depends on them (`class="card auth-card"`) — added.
- **shadcn init** ran as `npx shadcn@latest init -b base -p nova -y` — Base UI (`-b base`), not Radix as this plan assumed, matching CLAUDE.md's literal "shadcn/Base UI" phrasing; the `-p nova` preset choice is cosmetic (fully rethemed regardless). As the Risks section anticipated, init appended its own conflicting `:root`/`.dark`/`@theme inline` block plus a Geist variable-font import into `styles.css` — removed both; kept `tw-animate-css` and `shadcn/tailwind.css` (genuine plumbing: Base UI's data-state Tailwind variants). `iconLibrary` was hand-set to `"phosphor"` in `components.json` *before* generating components, so every generated file already imports `@phosphor-icons/react` — no lucide swap was needed. `components.json`'s `aliases.utils` stayed at the CLI's own default `@/lib/utils` (exporting `cn` from the separate `cn` npm package) rather than being renamed to `@/lib/cn` — not worth fighting on every future `shadcn add`.
- **`form` is an empty registry stub for the base-nova style** (no file content, CLI-side). Hand-authored `src/components/ui/form.tsx` against the well-known shadcn Radix `form.tsx` contract (`Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormDescription`/`FormMessage`/`useFormField`), substituting a small local `React.cloneElement`-based `Slot` for `@radix-ui/react-slot` (not installed) and our own plain `Label`.
- **Real bug caught by testing**: the generated `Input` wasn't wrapped in `React.forwardRef` (the base-nova preset appears to assume React 19's ref-as-prop; this project is pinned to React 18.3). Without it, `react-hook-form`'s `Controller`/`field.ref` — needed to focus the first invalid field on failed validation, per `ui/01-auth.md` — would have silently failed. Fixed in `input.tsx`; `select.tsx`/other primitives will need the same treatment whenever they're first wired to an RHF `Controller` in a later phase.
- **Geometry tweaks** applied as planned to `button.tsx`/`input.tsx` (36px, `rounded-md`, `disabled:opacity-45`, danger/accent-soft focus rings) and additionally to `select.tsx` (same height) and `skeleton.tsx` (swapped Tailwind's generic `animate-pulse` for our own `.skeleton` shimmer class, to match MOCKUPS' visual language).
- **Tests**: 9 passing — `button.test.tsx`, `input.test.tsx`, `form.test.tsx` (exercises the hand-authored bridge end to end with a real `useForm`, which is what caught the forwardRef bug), `App.test.tsx` (mounts the whole gallery). `npm run build -w frontend` and `npm test -w frontend` both green.
- **No visual screenshot was taken** — no browser tooling was available in this session (no `chromium-cli`; Claude in Chrome not connected). The dev server was confirmed to boot and serve; actual pixel fidelity against `MOCKUPS/index.html`'s component section is unverified and should be eyeballed by the user via `npm run dev -w frontend`.
- Deferred, unchanged from the plan: `dialog`, `alert-dialog`, `checkbox`, `radio-group`, `textarea` primitives (Phase 2).

### Build config
- `frontend/tsconfig.json` — add `"baseUrl": "."` + `"paths": { "@/*": ["./src/*"] }`. Everything else stays; `include: ["src"]` means the Vite config itself is not type-checked, so the `test:` block below cannot break `tsc -b`.
- **Consolidate `vitest.config.ts` into `vite.config.ts`** and delete it. The two files today differ only by the `test:` block — they duplicate the identical `[react(), tailwindcss()]` plugin list, and the new `@/` alias would otherwise have to be maintained in both. The consolidated file must import `defineConfig` from **`vitest/config`** (which re-exports Vite's) for the `test` field to type-check, keeping the `/// <reference types="vitest/config" />` pragma.
- `vite.config.ts` — add `resolve.alias` `'@' → path.resolve(__dirname, './src')`, preserving the existing `/api` → `:5001` proxy.

### Tokens — `src/styles/tokens.css`
Port `MOCKUPS/assets/app.css:6-61` verbatim in meaning, split three ways:

- **`@theme`** — everything that should generate utilities, using Tailwind v4 namespaces: the 6 seeds + `accent-ink` + state colours + the four `--lang-*` tints as `--color-*`; `--font-display/-body/-mono`; the type scale as `--text-h1 … --text-meta`; `--radius-md: 8px` / `--radius-lg: 12px`; `--container-app: 1024px` / `--container-wide: 1280px`.
- **plain `:root`** — the `color-mix(in oklch, …)` derived tones (`--color-accent-soft`, `-soft2`, `--color-fg-soft`, `-soft2`, `--color-hover`, `--color-*-soft` states) plus **`--color-border-strong`**, which `app.css` references only via a fallback (`.cb`, `.cell-add`) and never declares. These can't live in `@theme` (build-time-static values only) — consume them as `bg-(--color-accent-soft)`.
- **`@theme inline` bridge** — map shadcn's semantic names onto Ladu tokens so generated components are correct with zero edits:
  `--color-background: var(--color-bg)`, `--color-foreground: var(--color-fg)`, `--color-primary: var(--color-accent)`, `--color-primary-foreground: var(--color-accent-ink)`, `--color-card: var(--color-surface)`, `--color-muted-foreground: var(--color-muted)`, `--color-ring: var(--color-accent)`, `--color-destructive: var(--color-danger)`, `--radius: 8px`.

Keep the file structured so a future dark mode only has to reassign the 6 seeds.

### Base + component layer — `src/styles/globals.css`
- `@layer base` — the reset from `app.css:64-84`, including `body` (bg, fg, `--font-body`, 14px, line-height 1.5, `optimizeLegibility`, antialiased), `svg { flex: none }`, unstyled `button`, `h1–h4 { text-wrap: balance }`, and the global `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px }`.
- `@layer components` — the classes worth keeping as CSS rather than React: `.h1/.h2/.h3/.meta/.eyebrow/.num`, `.app-header*`, `.logo`/`.logo-mark`, `.app-nav`, `.searchbox`, `.mode-switch`, `.avatar`(+`.has-badge`), `.icon-btn`, `.auth-shell/.auth-banner/.auth-card/.auth-links`, `.banner.warning`, `.spinner` + `@keyframes spin`, `.page` + `@keyframes page-in`, `.skeleton` + `@keyframes shimmer`, `.empty`, `.rule`, `.field/.label/.err/.hint`, and the `@media (max-width: 920px)` block. Layout primitives (`.row`, `.stack-md`, `.grow`, `.container`) are expressible as Tailwind utilities — do **not** port them; use utilities in TSX.
- `src/styles.css` becomes the entry: `@import 'tailwindcss'; @import './styles/tokens.css'; @import './styles/globals.css';`

### shadcn
Baseline confirmed on disk: no `components.json` anywhere, no `lucide-react` / `class-variance-authority` / `tailwind-merge` / `tw-animate-css`; `clsx` exists only as a transitive hoist from `@dnd-kit/utilities` and must be declared explicitly. Toolchain is node 24.19 / npm 11.17, so `npx shadcn@latest` is current.

- `npx shadcn@latest init` against the existing single `tsconfig.json`; reconcile `components.json` aliases to `@/components`, `@/lib/cn`. Do **not** let init overwrite `styles.css` — keep our token files authoritative. Note `tailwindcss` sits in `devDependencies` here (with `@tailwindcss/vite`); that is correct for v4 and shadcn's detection, but worth watching if init complains.
- New deps: `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, plus the Radix packages the chosen primitives pull in (`react-slot`, `react-label`, `react-dropdown-menu`, `react-dialog` for Sheet, `react-select`).
- Add **only the primitives Phase 1 consumes**: `button`, `input`, `label`, `form`, `skeleton`, `dropdown-menu`, `sheet`, `select`. `dialog`, `alert-dialog`, `checkbox`, `radio-group`, `textarea` are deferred to Phase 2, where the word forms first need them — this is D3's own "add primitives per phase" rule, and a deliberate narrowing of the §5 list.
- shadcn's `form` is resolver-agnostic (it imports `react-hook-form`, not zod), so it drops onto our yup + `@hookform/resolvers` setup unchanged.
- **Icon swap** — init installs `lucide-react` and the generated `dropdown-menu`, `select` and `sheet` reference `Check`, `ChevronDown`, `ChevronUp`, `ChevronRight`, `Circle`, `X`. Replace each with its `@phosphor-icons/react` equivalent (`Check`, `CaretDown`, `CaretUp`, `CaretRight`, `Circle`, `X`), then remove `lucide-react` from `package.json`.
- Geometry tweaks the bridge can't cover: `button` → `h-9` (36px), `gap-[7px]`, `rounded-md`, `active:translate-y-px`, `disabled:opacity-45`; `input` → `h-9`, `px-[11px]`, focus `ring-3 ring-(--color-accent-soft)`, `aria-invalid` → danger border + danger-soft ring.
- `src/lib/cn.ts` — the `clsx`+`tailwind-merge` helper (shadcn defaults to `lib/utils.ts`; point `components.json`'s `aliases.utils` at `@/lib/cn` to match `frontend-structure.md`).

### i18n
- `src/i18n.ts` — no change to the runtime config; the Suspense boundary is added in Slice 2 (`Providers`). Add `ns`/`defaultNS` only if lazy loading proves flaky.

**Runnable:** `App.tsx` temporarily renders a primitives gallery (buttons in all five variants, inputs incl. invalid state, card, skeleton, spinner, banner, toast) so fidelity against `MOCKUPS/index.html`'s component section can be eyeballed side by side. Removed in Slice 4.

**Tests:** `npm run build -w frontend` green (proves `tsc -b` + alias + v4 compile); one render test per primitive asserting variant classes.

---

## Slice 2 — App plumbing: client, store, router, guard ✅ done (2026-09-08)

**Goal:** an unauthenticated visit to any protected route redirects to `/login`; the 404 page is real; zero `JSON.parse(localStorage`.

### Outcome — what actually landed, and where it diverged from the plan below

- **Everything in the plan shipped**, plus tests: `src/api/{client,types}.ts`, `src/stores/{authStore,uiStore}.ts`, `src/lib/jwt.ts`, `src/app/{query-client,feature-flags,router}.tsx`, `src/app/Providers.tsx`, `src/routes/{public-layout,protected-layout,not-found}.tsx`, `src/components/common/{LoadingScreen,PageTransition,ErrorState,EmptyState}.tsx`, `src/test/{render.tsx,tokens.ts,msw/{server,handlers}.ts}`, slimmed `main.tsx`. Frontend suite **9 → 42 tests**, `tsc -b` + `vite build` green.
- **`authStore` — `verified` normalization.** The plan's sketch (`raw.verified ?? true ? … : false`) resolves to: a missing/`null` flag becomes `true`, only an explicit `false` is unverified. Rationale confirmed during implementation — `users.verified` is a nullable column, and login/verify already gate the unverified path (decision 1), so a `getMe` refresh that returns a null flag must not silently log the user out.
- **`authStore` — storage adapter.** Used a hand-written `PersistStorage` (try/catch around the parse, `removeItem` on failure) instead of `createJSONStorage`, so a hand-planted/garbage blob is caught *and cleared* rather than only swallowed by zustand's rehydrate `.catch`. `onRehydrateStorage` then additionally drops an expired token or an invalid-shape user. Note: on the malformed-blob path `clearSession()` re-persists a clean empty blob, so the key is not strictly absent afterward — the test asserts the garbage is gone and the remainder is valid JSON, not `=== null`.
- **`router.tsx` — optional path params.** TanStack Router is **1.170.33** (hoisted at the workspace root, not the `^1.51` in `package.json`), which supports the `{-$param}` optional-segment syntax — used for `/addWord/{-$partOfSpeech}` and `/resetPassword/{-$userId}/{-$tokenId}` rather than registering paired routes. All 12 blueprint routes (`ui/00-global.md` §2) are registered; every protected leaf and every public auth leaf is an inline `Placeholder` / `PublicPlaceholder` stub defined in `router.tsx` (Slice 3 moves auth leaves to `features/auth/pages/*`, Slice 4 the dashboard). Exported `createAppRouter(history?)` alongside the singleton `router` so tests build their own with `createMemoryHistory`.
- **`client.ts` — refresh leg.** Left as a prose comment only (not a disabled `if (false)` block) — there is no refresh endpoint, and a dead branch would just be noise.
- **`query-client.ts`.** Stock v5 defaults + `retry: false` + `refetchOnWindowFocus: false` (deterministic tests; same-origin backend makes a failed request a real error worth surfacing). The metrics 5-min `staleTime` override is deferred to Slice 4 where the query is actually created. Invalidation-graph doc comment seeded with the Phase-1 edges + one stub line per later phase.
- **`Providers.tsx`.** Order: `ErrorBoundary > QueryClientProvider > I18nextProvider > Suspense > (RouterProvider + ToastContainer)`. The 401→redirect subscriber is a null-rendering `UnauthorizedRedirect` component that registers `onUnauthorized(() => router.navigate({ to: '/login' }))` in an effect. `react-toastify/dist/ReactToastify.css` imported here.
- **`test/render.tsx` — no router.** The plan said "a fresh in-memory router" per test; deferred. `renderWithProviders` gives a fresh retry-off `QueryClient`, a synchronous i18n instance built from the real `public/locales/en/*.json` bundles (`useSuspense: false`), and an optional `session` seed. Tests that need routing build it directly (`createAppRouter(createMemoryHistory(...))`) — this is what the guard test does. Full router-in-render can come in Slice 3 when the auth pages need `<Link>`/navigation context.
- **`test/tokens.ts`** — not in the plan's file list; added because the jwt / store / router tests all need to mint tokens with a controlled `exp`. Unsigned (`header.payload.testsignature`) — only `getTokenExpiry` reads them.
- **`test/setup.ts`** — now boots one MSW server (`onUnhandledRequest: 'error'`), and per test does `resetHandlers()` + RTL `cleanup()` + `clearSession()` + `localStorage.clear()`. Also stubs `window.scrollTo` (jsdom throws "Not implemented"; TanStack Router's scroll restoration calls it on every navigation and floods stderr otherwise).
- **`main.tsx`** stopped rendering `<App/>`; the Slice-1 primitives gallery (`App.tsx` + `App.test.tsx`) stays on disk until Slice 4 per the plan.
- **`.gitignore`** — added `.playwright-mcp/` (interactive browser-verification scratch from the `@playwright/mcp` server).
- **Visual check done this time.** Booted the dev server and drove it with `@playwright/mcp`: `/` → `/login?redirect=%2F` (guard fires in a real browser), `/nonexistent` → the real 404 (serif numeral, hairline divider, cycling multilingual line, "Go to login" CTA with no session). Only console noise is a `favicon.ico` 404 — pre-existing (`index.html` has no favicon link), not in scope.
- Deferred, unchanged: real auth pages (Slice 3), `AppShell`/`AppHeader` (Slice 4), MSW auth + metrics handlers (Slice 3 / 4).

### `src/api/`
- `client.ts` — one axios instance, `baseURL: '/api'` (relative; the Vite proxy already forwards to `:5001`). Request interceptor attaches `Bearer` from `authStore.getState().token`. Response interceptor on 401: `clearSession()` then notify registered handlers. **Avoid the circular import** (client → router → routes → hooks → client) by exporting an `onUnauthorized(handler)` registry from `client.ts`; `app/Providers.tsx` registers `() => router.navigate({ to: '/login' })`. A retry-once refresh leg is written but disabled — no refresh endpoint exists.
- `types.ts` — `ApiError` (`{ message: string }`, the only shape `backend/middleware/errorMiddleware.js` ever emits), `CursorPage<T>`, `Id`.

### `src/stores/`
- `authStore.ts` — Zustand + `persist` under a new key (`ladu.session`), **one** normalized shape:
  ```ts
  type SessionUser = { id, name, email, username, languages, uiLanguage, nativeLanguage, verified }
  type AuthState = { user: SessionUser | null; token: string | null; setSession; clearSession }
  ```
  A single `toSessionUser(raw)` normalizer absorbs all four backend shapes: `id: raw.id ?? ''` (**`id` only — `_id` is a MongoDB artifact, `new-repo-build-plan.md` §4**; the backend auth serializers still emit an `_id` alias, stripped in Slice 5, and this normalizer never reads it), `nativeLanguage: raw.nativeLanguage ?? null` (login omits the key when null), `verified: raw.verified ?? true ? … : false` (the column is nullable). `onRehydrateStorage` guards the parse and drops malformed or expired state — this is what makes the `grep "JSON.parse(localStorage"` gate pass.
- `uiStore.ts` — `selectedPoS`, search mode, review sidebar collapsed (unused until later phases; created now so the "only three stores" rule is visible).
- `src/lib/jwt.ts` — `getTokenExpiry(token): number | null`, base64url-safe, **returns null on any malformed input instead of throwing** (the old `parseJwt` returned null and the caller then dereferenced `.exp`; study §8.4 #5). This plus `beforeLoad` is the *one* expiry-check seam.

### `src/app/`
- `query-client.ts` — `QueryClient` factory. Defaults stay at TanStack v5 stock (`staleTime: 0`) per migration-plan §5.3; the metrics query overrides to 5 min. **Carries the invalidation-graph doc comment**, seeded from migration-plan §5.2 and extended each phase. Phase-1 edge: `login / logout → queryClient.clear()`.
- `feature-flags.ts` — env-derived flags. `globalSearch` and `notifications` default **off** in Phase 1 (no data source until Phases 3 and 6); `tags`/`friends` default on. Note `frontend/src/env.ts` currently reads `VITE_*` while the root `.env` still uses CRA-era `REACT_APP_*`, so every flag resolves via its default today — that is fine and intended.
- `router.tsx` — code-based typed tree (D1). Root → `_public` layout and `_protected` layout → leaves. `_protected.beforeLoad` reads `authStore` + `isTokenExpired`, and `throw redirect({ to: '/login', search: { redirect: location.href } })` when unauthenticated. Every route from the `ui/00-global.md` table is registered now, with **thin placeholder pages** for `/addWord`, `/word/$wordId`, `/review`, `/practice`, `/user` — the Phase-1 gate is literally "visiting *any* protected route unauthenticated redirects", which needs those routes to exist.
- `Providers.tsx` — `QueryClientProvider` + `I18nextProvider` + **`<Suspense fallback={<LoadingScreen/>}>`** (critical: i18next `useSuspense` defaults to true and today's `main.tsx` has no boundary — a second namespace would throw) + `RouterProvider` + `ToastContainer` (bottom-center, matching `.toast-stack`) + root `ErrorBoundary`.
- `main.tsx` shrinks to mounting `<Providers/>`: the inline `new QueryClient()` at `main.tsx:8` moves into `app/query-client.ts`, and `<App/>` is retired once the router owns rendering. Keep the `./i18n` and `./styles.css` side-effect imports.

### `src/routes/` + `src/components/common/`
- `public-layout.tsx` (bare centered, no header — this is what replaces the old regex table *and* `NotFound`'s render-phase `onHideHeader` callback), `protected-layout.tsx`, `not-found.tsx`.
- `LoadingScreen`, `PageTransition` (wraps `.page`), `ErrorState`, `EmptyState`.
- **404 built for real** from `MOCKUPS/auth/404.html`: serif `clamp(64px,12vw,120px)` numeral, hairline divider, `aria-live="polite"` line cycling the four languages every 2600 ms with a 300 ms fade, and a single CTA — "Go to dashboard" when a session exists, "Go to login" otherwise.

### Test infrastructure
- `test/msw/{server.ts,handlers.ts}`, wired into `test/setup.ts` (`listen`/`resetHandlers`/`close`).
- `test/render.tsx` — `renderWithProviders`, giving each test a **fresh** `QueryClient` (retry off), a fresh in-memory router, a reset `authStore`, and an i18n instance built from **inline resources imported from `public/locales/en/*.json`** with `useSuspense: false`. The app's http-backend must not fetch over the network in tests.

**Runnable:** `/nonexistent` renders the real 404; `/` redirects to a stub `/login`; a hand-planted malformed `localStorage` value is discarded rather than crashing the boot.

**Tests:** `authStore` normalization across all four backend shapes + guarded rehydration; `getTokenExpiry` on malformed/base64url/expired input; the 401 interceptor clearing the session and firing the handler; `_protected.beforeLoad` redirect.

---

## Slice 3 — Auth pages

**Goal:** register → verify → login → logout works end to end against the real backend.

### `src/features/auth/`
- `api.ts` — `login`, `register`, `verifyEmail`, `requestPasswordReset`, `setPassword`, `getMe`, `updateProfile`. Two contracts to preserve exactly:
  - `PUT /api/users/updatePassword` takes **`{ userId, password, token }`** — not `{ tokenId }`.
  - `PUT /api/users/updateUser` requires `email` as a self-confirmation field it never updates, and **clears `nativeLanguage` whenever the key is omitted** — `updateProfile` must always send it explicitly.
- `types.ts` — request/response interfaces re-pinned against `snapshot/endpoints.md` and the live controller.
- `schemas.ts` — yup: `loginSchema`, `registerSchema` (password ≥ 8, `password2` matches and is **not** sent to the API), `resetSchema` **mode-conditional** on whether both route params are present.
- `hooks.ts` — `useLogin`, `useRegister`, `useVerifyEmail`, `useRequestReset`, `useSetPassword`. Toasts fire from `onSuccess`/`onError`; `queryClient.clear()` on login and logout. No status booleans anywhere — `isPending` drives the disabled+spinner button state.
- `errors.ts` — maps the backend's message strings ("Invalid credentials", "Email already in use", "Username already in use", "Invalid Link (no user match)", …) onto i18n keys, falling back to `common.errors.somethingWrong`. The backend emits `{ message }` and nothing else, so string matching is the only option available; isolating it in one file keeps that ugliness contained.
- `components/` + `pages/` — `LoginForm`, `RegisterForm`, `ResetPasswordForm`, `VerifyEmailStatus`; one page each.

### Behaviour, per `ui/01-auth.md` + the mockups
- **Login** — email + password, full-width primary, links "Not registered? · Forgot password?". Success **and `verified === true`** → `setSession` → redirect to the `redirect` search param or `/`. Success but `verified !== true` → `toast.warning` and **stay on `/login` with no session written** (decision 1). 400 → mapped error toast.
- **Register** — the two-column grid from `MOCKUPS/auth/register.html` (Name | Username, Email spanning, Password | Confirm) with `.req` stars; "Create account" (grow) + "Reset" (secondary, clears values *and* errors and refocuses field 1); both disabled while pending. Success → `toast.info` naming the email → `/login` (decision 1).
- **Verify** — the three states from `MOCKUPS/auth/verify.html` in one 420px card: spinner ring / success check + live "Entering Ladu in *n*s" countdown from 3 with an "Enter now" skip / failure ×. This is the one response carrying both a profile and a token, so success writes the session and enters the app. Missing or malformed params → 404 + error toast.
- **Reset password** — one route, two modes keyed on `userId && tokenId`. Request mode: email + "Send reset link". Set mode: new + confirm password + "Update password". Both → success toast → `/login`.

### i18n
Add the missing keys to **all four** locales (decision 4): backend-error mappings, unverified-account warning, `common.appTitle`, the 404 cycling lines, and a fix for `loginRegister.userVerification.validating`, which currently reads "Password reset" in every language. Estonian additions flagged in the slice summary for review.

**Runnable:** with `npm run dev` and a local Postgres, a real account can be registered, verified from the emailed link, logged in, and logged out.

**Tests:** the Phase-1 gate integration suite over MSW — register → verify → login → logout → expired-token → protected-redirect; plus yup schema unit tests (including reset's mode-conditional branch) and `errors.ts` mapping.

---

## Slice 4 — App shell + Dashboard

**Goal:** logging in lands on a real Dashboard inside the real header.

### `src/components/layout/`
- `AppShell` — sticky 52px translucent header (`color-mix(in oklch, var(--color-bg) 90%, transparent)` + `backdrop-blur-[10px]`) over `.container.page`; Review will later opt into `.container-wide`.
- `AppHeader` — logo (24px teal rounded-square mono "L" + serif wordmark) · nav pills Add Word / Practice / Review with `.active` styling from TanStack Router's active state · `.grow` · GlobalSearch · LanguageSelector · notification `icon-btn` · UserMenu.
  - **Nav gating:** Add Word and Review require ≥2 configured languages; otherwise a toast with a "Go to Account" action → `/user`.
  - `GlobalSearch` and the notification button are **flag-gated off** in Phase 1. Below 920px the searchbox hides and nav collapses into a `Sheet`.
- `LanguageSelector` — EN/ES/DE/EE with flags, persisting `uiLanguage` through `updateProfile` → `setSession`; an effect on `user.uiLanguage` calls `i18n.changeLanguage(...)`.
- `UserMenu` — Radix dropdown on the initials avatar. Items keyed by **stable ids, not translated strings** (the old app dispatched on translated labels — `pages-auth-shell.md:220`). Logout → `clearSession()` + `queryClient.clear()` + `/login`.
- **No `VerifyEmailBanner`** — unreachable under decision 1; documented in `CLAUDE.md`.

### `src/components/common/` + `src/lib/`
- `FlagIcon` (serves `public/{GB,DE,ES,EE}.svg`), `lib/avatar.ts` (deterministic initials + colour, ported from `generalUseFunctions`), `lib/language.ts` (`langKeyByLabel`, native names, ordering).

### `src/features/metrics/`
- `api.ts` / `keys.ts` / `hooks.ts` — `getUserMetrics` at **`GET /api/users/getUserMetrics`** (note: the blueprint writes `/api/metrics/...`, which does not exist), `staleTime: 5 * 60_000`. Invalidated only by word CRUD, which arrives in Phase 2.
- `pages/DashboardPage.tsx` — welcome banner ("Welcome back, {name}" + the greeting cycling through the four languages), `UserInfoPanel` stat cards (total words, total translations, incomplete words) using the existing `dashboard.json` keys, and `MetricsPanel` with **stubbed chart placeholders**. Charts are explicitly Phase 5 (`frontend-structure.md:227`), and no Dashboard mockup exists — `MOCKUPS/index.html` is a prototype-kit index, not a dashboard, so the layout follows `ui/02-dashboard.md`'s ASCII sketch rendered in the MOCKUPS language.
- Loading → skeleton cards; empty (a fresh account, where `incompleteWordsCount` is always 0 because `languages` is empty) → `EmptyState` with an "Add your first words" CTA.

Remove the Slice-1 primitives gallery from `App.tsx`.

**Runnable:** the full loop — register, verify, log in, see the Dashboard with real numbers, switch UI language, log out.

**Tests:** header nav gating at <2 languages; UserMenu logout clearing session + cache; LanguageSelector sending a complete `updateProfile` payload (guarding the `nativeLanguage` trap); metrics loading/loaded/empty states.

---

## Slice 5 — Backend hygiene + phase gate

### Backend fixes (decision 3)
- **Strip the `_id` alias** (`new-repo-build-plan.md` §4 standing rule) from the auth responses this phase consumes: `serializeUser` (drop the `_id: user.id` line — the `...user` spread already carries `id`), `serializeLoginUser` and `publicUserResponse` (return `id`, not `_id`), and `authMiddleware`'s `req.user` shape (drop `_id: user.id`). One internal reader to switch to `id`: `metricController.ts:38-42` (`calculateBasicUserMetrics` takes `{ _id, languages }` — used by `getUserMetrics`, this phase's Slice 4); also drop the `_id: req.user.id` output alias in `getUserMetrics` (`userController.ts:458`). Update `backend/tests/auth.test.js` (`_id` assertions at :56, :264, :280) to `id`. The frontend already expects `id`-only responses (`authStore` normalizer), so Slice 3's login/register wiring depends on this landing.
- `backend/controllers/userController.ts:318-333` — `getUserById` returns the bcrypt hash because `serializeUser` spreads a raw row without the `delete userWithToken.password` that `verifyUser` does. Strip it.
- `backend/middleware/authMiddleware.ts:8-20` — drop `passwordTokens` from `userColumnsWithoutPassword`, so it stops reaching the client through `/me` and `updateUser`. **Grep for `req.user.passwordTokens` consumers first** — `requestPasswordReset` and `updatePassword` read the column via their own queries and should be unaffected, but this must be verified, not assumed.
- Update `backend/tests/auth.test.js` accordingly; the suite must stay at 11/11 green.
- Log the untouched account-existence leak on `requestPasswordReset`, plus the `sendEmail` issues (swallowed errors, `Boolean("false") === true`), as known issues for Phase 7.

### Gate verification
- `grep -r "JSON.parse(localStorage" frontend/src` → **0 hits**.
- Unauthenticated visits to `/`, `/addWord`, `/word/x`, `/review`, `/practice`, `/user` all redirect to `/login`.
- `npm test` (backend Jest), `npm test -w frontend` (Vitest), `npm run build -w frontend` all green.
- Update `CLAUDE.md` §9 with the new state, and record the deliberate deviations: no `VerifyEmailBanner`; five shadcn primitives deferred to Phase 2; the `/api/users/getUserMetrics` path correction.
- **Record elapsed effort for the kill-switch evaluation** (study §11b). Worth flagging now: the docs mandate "record pace" but define no metric and no Phase-1-equivalent baseline in the migration plan — we will record wall-clock and slice count, and the comparison will be a judgement call.

---

## Verification

Per slice, before handing back for commit:

```bash
npm run build -w frontend     # tsc -b + vite build
npm test -w frontend          # vitest
npm test                      # backend jest (slice 5)
```

End-to-end, after Slice 4:

```bash
npm run docker:up && npm run db:migrate
npm run dev                   # backend :5001 + vite
```

Then, in the browser: register a new account → open the verification link from the email (or read the `tokens` row via `npm run db:studio`) → land in the app verified → see Dashboard metrics → switch UI language → log out → confirm `/` redirects to `/login`.

## Risks

- **shadcn init may clobber `styles.css` or fork the tsconfig.** Run it after committing Slice 1's config changes so any damage is a visible diff, and keep our token files authoritative over anything it generates.
- **`@theme` cannot hold `color-mix()` values.** The derived-tone split above is load-bearing; if a derived tone is needed as a real utility rather than an arbitrary value, it must be flattened to a literal.
- **`noUnusedLocals` + `noUnusedParameters` are on and `build` runs `tsc -b`.** shadcn-generated components occasionally carry unused destructured props or imports, which will fail the build rather than warn. Expect to trim a few generated files; do not relax the compiler options to work around it.
- **i18next Suspense.** The moment a second namespace is used without the boundary from Slice 2, the app throws. Slice 2 must land before Slice 3.
- **`ee` is not a valid ISO code for Estonian** (`et` is). `LanguageDetector` will never auto-detect it. Carried over deliberately from the old app; do not "fix" it without a migration.
