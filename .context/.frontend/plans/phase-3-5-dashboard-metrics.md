# Phase 3.5 — Dashboard + user metrics

*Stub. Created 2026-09-10 when the Dashboard/metrics work was split out of Phase 1 Slice 4. The full slice breakdown is written when this phase actually starts — it depends on Phases 2–3 (a word model + words of every PoS in the DB), which do not exist yet.*

## Why this is its own phase

Phase 1 Slice 4 originally bundled the app shell with a Dashboard reading `GET /api/users/getUserMetrics`. That endpoint aggregates **`words` + `translations` only** (`backend/controllers/metricController.ts:15,47-157`) — it never reads `exercise_performances`. On a fresh account with no way to create a word, every number it returns is structurally zero, so the feature cannot be meaningfully built or verified until words exist. Slice 4 now ships only the shell + a welcome-banner Home page; everything word-derived on the Dashboard lands here.

This is also the **first phase to exercise the read path** (`useQuery` / `staleTime` policy) against the real backend — Phase 2 introduces `useQuery` for words; this phase is the first `getUserMetrics` read.

Phase 5 keeps exercises + performance only. Any mastery / forgetting-curve visualization Phase 5 wants is its own scope and needs a **new** backend aggregation endpoint — `getUserMetrics` will not reflect a practice session.

## Backend surface (confirmed 2026-09-10)

- Route: `GET /api/users/getUserMetrics`, `protect`-guarded — `backend/routes/userRoutes.js:18`.
- Handler: `getBasicUserMetrics` in `backend/controllers/userController.ts:454-474`, delegating to `calculateBasicUserMetrics` in `backend/controllers/metricController.ts` (which no route uses directly).
- Already `id`-only — the `_id` alias was stripped in the Phase 1 Slice 3 Option-B sweep.
- **No Jest coverage at all.** `backend/tests/` has nothing for this endpoint. Add it in this phase: the six fields, fresh-account zeros, per-user isolation.
- Response shape (`interface BasicUserMetrics`, `metricController.ts:17-33`):
  | Field | Shape |
  |---|---|
  | `totalWords` | `number` |
  | `wordsPerPOS` | `{ partOfSpeech, type: "partOfSpeech", count }[]` |
  | `translationsPerLanguage` | `{ language, count, type: "language" }[]` |
  | `translationsPerLanguageAndPOS` | `{ label (=language), type: "language", partOfSpeech, count }[]` |
  | `wordsPerMonth` | `{ label: "YYYY-MM", partOfSpeech, count }[]` |
  | `incompleteWordsCount` | `number` — always `0` when `user.languages` is empty (`metricController.ts:139`) |

## Frontend scope (from `snapshot/ui/02-dashboard.md`)

- `features/metrics/{api,keys,hooks}.ts` — `getUserMetrics`, `useUserMetrics` with `staleTime: 5 * 60_000`. Grow the existing `features/metrics/` folder (Slice 4 put `pages/DashboardPage.tsx` there as the welcome-banner-only Home page).
- `UserInfoPanel` — stat cards. `MetricsPanel` — pie (words per PoS, colours from `chartColors`) + bar (translations per language / per month, grouped-by toggle), each with a words↔translations metric toggle. Charts **code-split behind the route**.
- Wire the `charts.*` keys in `dashboard.json` (already translated in all four locales).
- States: skeleton cards + chart placeholders while loading; zero-words empty state ("Add your first words to see statistics") with CTA → `/addWord`; chart worst-category click → `/addWord/<pos>`.
- Invalidation edge: word CRUD ⇒ `['metrics']` — declared in the Phase 2 invalidation graph, no consumer until now.
- MSW metrics handlers (deferred out of Phase 1) land here.

## i18n split (already on disk, all four locales)

`frontend/public/locales/*/dashboard.json`:
- **Word-count half (Slice 4 already uses `welcome.*`):** `welcome.title`, `welcome.spinning`, `userInfoCards.{totalWords,incompleteWords,languages}`.
- **Chart half (this phase):** the entire `charts.*` subtree (`charts.pie.*`, `charts.bar.*`).
- Chart toggle button labels live in `common.json` (`buttons.{groupByType,separateByType,distributionByWordType,distributionByLanguage,byMonth,byLanguage}`), plus `common.partOfSpeech.*` / `common.languages.*` for axes/legends.

## Open questions to resolve when this phase starts

1. **Third stat card contradicts itself.** The blueprint says "total translations" (`snapshot/ui/02-dashboard.md:26`); the old app rendered `translationsPerLanguage.length` — a *language* count (`snapshot/pages-review-practice.md:144-145`); the i18n key is `userInfoCards.languages`. Decide which the card shows. `getUserMetrics` returns no raw total-translations scalar — it would be `sum(translationsPerLanguage[].count)` if a true count is wanted.
2. **Charting library.** `c3@^0.7.20` + `d3@^7.4.4` (+ `@types/*`) are already in `frontend/package.json`; no `recharts`. Keep c3/D3 (study §98 verdict "keep, code-split") or swap for Recharts (blueprint allows "visually equivalent").
3. **Language-less account.** `incompleteWordsCount` is always `0` when `user.languages` is empty. Decide how that account presents (it is also the fresh-account empty-state path).
4. **Wrong path in the blueprint.** `snapshot/ui/02-dashboard.md:40` writes `GET /api/metrics/getUserMetrics`, which does not exist. The real path is `/api/users/getUserMetrics`. (`snapshot/**` is frozen at 2026-09-05 by its own maintenance rule, so the correction is recorded here rather than edited into the snapshot.)

## e2e

`e2e/tests/phase-3-5-dashboard.spec.ts` (hyphenated, no dot before `.spec.ts`): log in on an account holding words across ≥2 PoS and ≥2 languages → Dashboard totals and both charts match the data; a fresh account shows the empty state.
