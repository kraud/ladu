# Frontend `src/` Structure & Component Breakdown

*2026-09-07, trimmed 2026-11-02. The rules for the layout of `frontend/src/`: decisions D1 to D5, the principles, the shape of a feature folder and the conventions. The directory tree and the screen-to-module map of the first proposal were removed (the code is the truth). Pairs with the frontend invariants in [`.context/README.md`](../README.md) and [`.context/plans/new-repo-build-plan.md`](../plans/new-repo-build-plan.md) §5 (phases).*

---

## 0. Resolved decisions (2026-09-07)

| # | Decision | Resolution |
|---|----------|-----------|
| D1 | Routing style | **Code-based route tree** in `app/router.tsx` (no `@tanstack/router-plugin`). Small route set, still fully typed. Revisit file-based later if the tree grows. |
| D2 | Design-system source | **Port `MOCKUPS/assets/app.css`** (`--bg` paper, `--accent` — teal in the mockup, brand blue `#007AFF` since the 2026-09-21 brand pass, with `--accent-strong` for small text — serif display / sans UI / mono numerics, 36px controls, 4px grid, per-language `--lang-*` tints) into Tailwind v4 `@theme` tokens + a thin component-class layer. The blueprint's "neutral / shadcn defaults" note is subordinate — MOCKUPS is authoritative for look. |
| D3 | shadcn/Base UI depth | **Add primitives per phase.** Phase-1 set: button, input, textarea, label, form (RHF bridge), dialog, alert-dialog, select, checkbox, radio-group, sheet, skeleton, dropdown-menu, toast host. |
| D4 | Route files vs pages | **Thin `routes/*` files** compose `features/*/pages/*`. Guards, search-param schemas, and code-split boundaries live in `routes/` + `app/router.tsx`, never in feature code. |
| D5 | Shared-logic folder | **`lib/`** (focused modules). Port from the old `generalUseFunctions.ts` only what a live feature needs, each with a test. |

---

## 1. Guiding principles

1. **Feature-first.** Each domain (auth, words, autocomplete, exercises, tags, social) owns its API layer, query hooks, key factory, types, components, and pages in one folder under `features/`. Cross-feature primitives live in `components/`; cross-feature logic in `lib/`.
2. **Thin routes.** `app/router.tsx` + `routes/*` only wire URL → view: guard, search-param schema, code-split boundary. They import a feature page and render it.
3. **No server state outside TanStack Query.** Every `features/*/api.ts` is plain typed `axios` calls; every `features/*/hooks.ts` wraps them in `useQuery`/`useMutation`. No slices, no status booleans. Toasts fire from mutation `onSuccess`/`onError`.
4. **Three client-state stores only** (`stores/`): `authStore` (session), `uiStore` (selectedPoS, sidebar collapsed, etc.), and practice's pre-selected-words hand-off (route state or `uiStore`).
5. **The form engine is one subsystem** (`features/words/form-engine/`): one renderer + per-PoS×language field configs derived from `ts/wordCasesDataByPoS.ts` + `ts/enums.ts`. Nouns landed first (Phase 2); Verb, Adjective and Adverb configs landed in Phase 3, alongside `select`/`multi-select` field kinds, `group`/`layout` (paired-row and tense-column grids), `visibleWhen`/`pattern` — see [`.context/features/word-form-engine.md`](../features/word-form-engine.md) for the full addition list.
6. **Design tokens are centralised** (`styles/`): the `MOCKUPS/app.css` `:root` tokens become Tailwind v4 `@theme` + CSS variables; component-level classes from the mockup (`.btn`, `.tcard`, `.dtable`, `.chip`, `.ring`, …) either become shadcn components or a thin `@layer components` file — decided per component as it's built.

---

## 2. Directory layout

The tree in `frontend/src/` is the truth. The original proposal listed about 100 files; 25 of them were never built or were built under other names, so the list was removed (read it with `git log -- .context/.frontend/frontend-structure.md`). The rule is the shape of the top level:

- `api/` — the one axios client and its interceptor.
- `app/` — the router, the query client (with the `staleTime` policy), the feature flags.
- `components/` — `ui/` (shadcn and Base UI primitives), `common/` (shared pieces), `layout/` (shell, header, sidebar).
- `features/<x>/` — one folder for each domain: `access`, `account`, `auth`, `autocomplete`, `captcha`, `demo`, `metrics`, `onboarding`, `practice`, `tags`, `words`. The anatomy is in section 4.
- `lib/` — focused shared modules (D5).
- `routes/` — thin route files (D4): `ProtectedRoute`, the layouts, the 404.
- `stores/` — the client-state stores of principle 4.
- `styles/`, `i18n.ts`, `env.ts`, `main.tsx` — tokens and global CSS, i18next, the typed environment, the entry point.
- `test/` — MSW handlers and test helpers.
- `ts/` — the ported enums, interfaces and case registry (`wordCasesDataByPoS.ts`): extend them with new modules, never rewrite them.

## 3. Screen-to-module map

Removed. It named files that were built under other names. To find the code of a screen, open the feature folder in the list above, or look at the README table of `.context/README.md`.

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
