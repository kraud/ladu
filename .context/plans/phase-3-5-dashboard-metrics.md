# Phase 3.5 — Dashboard + user metrics

## Context

Phase 3 is done and committed (`c181e7e`); work continues on branch `dashboard-metrics` with a clean
tree. Phase 3.5 is the last piece of the core solo loop's *read* surface: the Dashboard at `/`
currently renders only the welcome banner plus an **unconditional** empty state
(`DashboardPage.tsx:22-33`), because `getUserMetrics` had nothing to aggregate until words existed
(Phases 2–3).

Now they do. This phase turns `/` into the real Dashboard: the `getUserMetrics` query, three stat
cards, and the two word-derived charts — and it is the **first `useQuery` read against the metrics
endpoint**, the first per-query `staleTime` override, and the first consumer of the `['metrics']`
invalidation edge that word CRUD has been firing into the void since Phase 2
(`features/words/hooks.ts:33`, `app/query-client.ts:20-27`).

This file replaces the original 2026-09-10 stub (backend surface confirmation + four open
questions) with the executable slice plan. All four original open questions are resolved below,
plus the chart-design questions the `MOCKUPS/dashboard.html` mockup raised once it was available
(added 2026-09-16).

### Correction to the brief

The user asked to check the old repo's `UserMetrics.tsx` for the chart control set. **It is not on
disk** — `../keelapp` (sibling repo) contains only an empty `init-test-db.sh` directory; the v1
frontend was deliberately left out of this workspace (`CLAUDE.md` §2, to avoid re-importing its
mistakes). The control set below was instead reconstructed from the two frozen sources, which agree
exactly with the behaviour the user described from memory:

- `snapshot/pages-review-practice.md:153-154` — *"BarChart props `{data, xType, title, currentType,
  onTypeChange}` … groupBy/separate toggle; byMonth/byLanguage buttons. PieChart … worstCategory +
  redirect `addWord/<category>`. UserMetrics reads state.metrics → Pie + Bar w/ independent
  MetricsType toggles."*
- The already-translated i18n keys present in all four locales, which pin the exact semantics:
  `dashboard:charts.pie.title.wordMetric` = "Distribution of word types",
  `.translationMetric` = "Distribution of languages"; `dashboard:charts.bar.title.wordMetric` =
  "Words per month", `.translationMetric` = "Words per language"; and the control labels
  `common:buttons.{byMonth,byLanguage,groupByType,separateByType,distributionByWordType,distributionByLanguage}`.

If any chart detail still feels wrong once it's on screen, the live v1 app remains the tiebreaker
per `.context/README.md`'s spec-authority table.

## Decisions taken with the user (2026-09-16)

- **D1 — Bar chart: X-axis toggle (Month | Language) × a PoS grouping toggle. No backend change.**
  `wordsPerMonth` is `{label: "YYYY-MM", partOfSpeech, count}[]` and
  `translationsPerLanguageAndPOS` is `{label: language, partOfSpeech, count}[]` — **both already
  carry the PoS dimension**, so the design needs no new aggregation. "Group by type" renders one
  stacked bar per X-value; "Separate by type" renders one bar per PoS side by side (the reading is
  fixed by `snapshot/ui/02-dashboard.md:29`).
- **D2 — Charts are hand-rolled inline SVG.** Ported from the mockup's own maths
  (`MOCKUPS/dashboard.html:289-398`: `donutSeg`/`renderPie`/`renderBar`). Zero dependencies,
  pixel-faithful, themeable through the existing CSS variables, and assertable in jsdom.
  `c3`, `d3`, `@types/c3`, `@types/d3` are dropped from `frontend/package.json` — they are installed
  but imported nowhere in `frontend/src`, and `c3@0.7.20` bundles its own `d3@5`, so the top-level
  `d3@7` was never even reachable from it. This resolves original open question #2.
- **D3 — Three stat cards with the mockup's sub-lines**: total words (+N this month) / total
  translations (N.N per word on average) / incomplete words (percentage meter, amber). Every
  sub-value derives from the existing response. `dashboard:userInfoCards.languages` is retired in
  favour of a new `...totalTranslations` key in all four locales. This resolves original open
  question #1 (mockup's "total translations" wins over the old app's language-count card).
- **D4 — Chart toggle state is local component state.** Ephemeral view preference on a read-only
  landing page; the "URL is state" invariant (`.context/README.md` invariant 5) was written for the
  Review table's filters, where reload/share genuinely matters.
- **D5 — The mockup's chart labels/copy are ignored** (explicit user instruction). The i18n titles
  above are authoritative; the mockup governs layout, spacing, type and colour only, consistent with
  `.context/README.md`'s "MOCKUPS = visual lens, blueprint = behaviour" split.

### Calls made by the agent rather than asked — each reversible

- **D6 — The mockup's language-coloured bars become PoS-coloured series.** The bar's series
  dimension is PoS in both X-modes (D1); language is an X-axis value, not a series, in the language
  mode.
- **D7 — Pie "worst category" links to `/addWord/<pos>` in word-type mode, and to plain `/addWord`
  in language mode.** The route is `/addWord/{-$partOfSpeech}` — it has no language param, so the
  `charts.pie.tooltip.newWordByLanguage` string can be shown as a caption but cannot be
  parameterised into a URL.
- **D8 — The month axis shows the last 12 months, zero-filled, ending on the current month.**
  `wordsPerMonth` is unbounded all-time history with gap months simply absent from the response; the
  window and the fill are client-side, one constant in `selectors.ts`.
- **D9 — Units differ per X-mode and that is accepted.** `wordsPerMonth` counts *words*;
  `translationsPerLanguageAndPOS` counts *translations*. Since a word holds at most one translation
  per language, "translations in English" is the same number as "words that have English" — which
  is why v1's own i18n label for that view is "Words per language", not "Translations per language".
- **D10 — A language-less account shows `—` on the incomplete card**, with a link to `/user`,
  instead of a misleading `0`. `metricController.ts:139` returns `0` unconditionally when
  `user.languages` is empty. This is an edge case (registration and profile edit both enforce ≥2
  languages) but it is the one number on the dashboard that would otherwise silently lie. Resolves
  original open question #3.
- **D11 — "Code-split behind the route" (build plan §4, §5 Phase 3.5) is reinterpreted, not
  implemented.** That requirement existed because the charts meant c3/D3. With D2 there is no chart
  bundle to split, and adding the app's first `React.lazy` boundary purely to satisfy the wording
  would add a loading state for ~6 KB of hand-written SVG with no payload to justify it. Recorded
  the way Phase 3's D44 reinterpreted its own gate line rather than implementing it literally.
- **D12 — Original open question #4 (wrong path `/api/metrics/getUserMetrics` in
  `snapshot/ui/02-dashboard.md:39`) stands as previously recorded**: the real path is
  `/api/users/getUserMetrics`; the frozen snapshot is not edited per its own maintenance rule.

## What the exploration established

**Backend — verified against source, no production change needed beyond tests.**

- `GET /api/users/getUserMetrics`, `protect`-guarded (`backend/routes/userRoutes.js:18`) → handler
  `getBasicUserMetrics` (`backend/controllers/userController.ts:561-581`) → `calculateBasicUserMetrics`
  (`backend/controllers/metricController.ts:38-167`). Already `id`-only; **no `_id` anywhere** in
  this surface, so this phase carries no `_id` strip.
- The six fields, with their real semantics:
  | Field | Shape | Counts | Notes |
  |---|---|---|---|
  | `totalWords` | `number` | words | all-time |
  | `wordsPerPOS` | `{partOfSpeech, type:"partOfSpeech", count}[]` | words | no zero rows for unused PoS |
  | `translationsPerLanguage` | `{language, count, type:"language"}[]` | translations | key is `language` |
  | `translationsPerLanguageAndPOS` | `{label, type:"language", partOfSpeech, count}[]` | translations | key is **`label`**, not `language` |
  | `wordsPerMonth` | `{label:"YYYY-MM", partOfSpeech, count}[]` | words | **no language dimension**; multiple rows share one label; unbounded, gaps absent |
  | `incompleteWordsCount` | `number` | words | word missing any of `user.languages`; **always 0 when `user.languages` is empty** (`:139`) |
- No total-translations scalar exists — it is `sum(translationsPerLanguage[].count)`.
- **Zero Jest coverage today.** Confirmed by grep across `backend/tests/`.
- Two latent semantics worth pinning with a test rather than "fixing": a word with *zero*
  translation rows never enters `langsByWord`, so it is silently counted complete
  (`metricController.ts:146-156`); and `wordsPerMonth`'s `orderBy` omits `partOfSpeech`, so row
  order within a month is unspecified by SQL.

**Frontend — the conventions this phase must follow.**

- Per-feature shape is `api.ts` / `keys.ts` / `hooks.ts` / `types.ts` + `components/` + `pages/`,
  tests co-located. `features/metrics/` today holds only `WelcomeBanner.tsx` (+test) and
  `DashboardPage.tsx` — the four data files are a fill-in-the-blanks exercise against
  `features/words/`.
- `features/words/hooks.ts:28-33` declares a **contract to close**: `const METRICS_KEY = ['metrics']`
  exists only "until that module grows a `keys.ts`". Four call sites
  (`useCreateWord`/`useUpdateWord`/`useDeleteWord`/`useBulkDeleteWords`) switch to `metricsKeys.all`.
- `app/query-client.ts:4-7` pre-authorises exactly one per-query `staleTime` override — metrics,
  5 min. It will be the first in the codebase.
- CSS porting rule (`styles/globals.css:1-10`): anything with an exact Tailwind equivalent stays a
  utility in TSX; only branded surfaces get a ported class, in a dated
  `/* ─── … ─── */` section inside `@layer components`. `.btn` is never ported (use `buttonVariants()`).
  Already available: `.card`/`.card-pad`, `.skeleton`, `.empty`/`.e-icon`, `.h1`/`.h2`/`.h3`,
  `.meta`, `.num` (mono + tabular-nums), `.page`. **Missing and to be ported**: `.meter`,
  `.dash-grid`, `.stat-card` family, `.metrics`/`.chart-block`/`.chart-head`, `.pie-*`/`.legend-row`,
  `.bar-*`.
- `components/ui/segmented-toggle.tsx` is the ported equivalent of the mockup's page-scoped `.seg`.
  It takes **exactly two options** (all three chart toggles are binary, so it fits) but clicking the
  active option clears the value — wrong for a chart toggle, so it needs an `allowDeselect` prop.
- `test/msw/*Handlers.ts` use a factory pattern (`makeXHandlers()` → isolated per-test store);
  `handlers.ts` is still empty and its comment reserves the slot: *"metrics in Phase 3.5"*.
  `test/setup.ts` sets `onUnhandledRequest: 'error'`, so an unmocked metrics call fails the test.
- `test/render.tsx` already imports `dashboard.json`; `renderWithProviders` has **no router
  context**, so anything rendering a `<Link>` must be tested through `renderApp({ initialEntry })`.
- Colours: `--lang-gb/de/es/ee` already exist in `tokens.css:36-41` and are byte-identical to the
  mockup's language palette. The mockup's PoS palette (`dashboard.html:247`) maps onto existing
  tokens: noun `--accent`, verb `#b8352f` (= `--lang-es`), adjective `--warning`, adverb `--lang-gb`.
- Route `/` is `dashboardRoute` (`app/router.tsx:110-114`), eagerly imported; there is **no
  `React.lazy` anywhere in the app** today (per D11, this phase does not introduce one either).

## Architecture

```
frontend/src/features/metrics/
├── api.ts          getUserMetrics()  → GET /api/users/getUserMetrics
├── keys.ts         metricsKeys = { all: ['metrics'] as const }
├── hooks.ts        useUserMetrics()  → useQuery, staleTime 5 * 60_000
├── types.ts        BasicUserMetricsBE + the five row shapes (mind `label` vs `language`)
├── selectors.ts    pure derivations, fully unit-tested (no React)
├── components/
│   ├── UserInfoPanel.tsx   3 × StatCard + skeletons
│   ├── StatCard.tsx        number + label + optional sub-line or meter
│   ├── MetricsPanel.tsx    the card holding both chart blocks + empty state
│   └── charts/
│       ├── chartColors.ts  PoS → token, Lang → token
│       ├── PieChart.tsx    donut + legend rows + worst-category link
│       └── BarChart.tsx    grouped/stacked bars + gridlines + axis + legend
└── pages/DashboardPage.tsx  banner + panels, gated on totalWords
```

`selectors.ts` is where all the risk lives, so it is pure and tested in isolation:
`totalTranslations`, `wordsAddedThisMonth`, `translationsPerWord`, `incompletePercent`,
`pieSeries(metrics, mode)`, `barSeries(metrics, xMode)` (including the 12-month window + zero-fill
and a stable PoS ordering, since SQL does not guarantee one).

**The three controls, verbatim from the i18n keys:**

| Chart | Control | Options (i18n key) | Data source |
|---|---|---|---|
| Pie | distribution | `buttons.distributionByWordType` / `buttons.distributionByLanguage` | `wordsPerPOS` / `translationsPerLanguage` |
| Bar | X axis | `buttons.byMonth` / `buttons.byLanguage` | `wordsPerMonth` / `translationsPerLanguageAndPOS` |
| Bar | PoS split | `buttons.groupByType` / `buttons.separateByType` | stacked single bar / side-by-side bars |

## Slices

Each ends runnable; the user commits and re-confirms between them.

| Slice | Status |
|---|---|
| 0 — persist the plan | ✅ done |
| 1 — backend: `tests/metrics.test.js` | ✅ done 2026-09-16 — 10 tests, all green (backend 165 → 175); no production code change |
| 2 — `features/metrics` data layer + selectors + MSW handlers + close `METRICS_KEY` contract | ✅ done 2026-09-16 — frontend 540 → 564; build green |
| 3 — Dashboard CSS port + `StatCard`/`UserInfoPanel` + skeletons | not started |
| 4 — `chartColors.ts` + `PieChart` + distribution toggle | not started |
| 5 — `BarChart` + both toggles + `SegmentedToggle.allowDeselect`; drop c3/d3 | not started |
| 6 — `MetricsPanel` composition, empty/error states, i18n | not started |
| 7 — phase gate: `phase-3-5-dashboard.spec.ts` + docs + full green run | not started |

**Slice 1 — backend tests.** New `backend/tests/metrics.test.js`, following `words-simple.test.js`
exactly: `jest.mock('../utils/sendEmail')`, `beforeAll(connectDB)` / `beforeEach(clearDB)` /
`afterAll(closeDB + pool.end())`, a local `registerAndLogin`, `POST /api/words` fixtures, and direct
`db.update(words)` to backdate `created_at` for the month buckets. Cover: 401 unauthenticated;
fresh-account zeros and empty arrays; all six fields against a known fixture set; per-user
isolation; `incompleteWordsCount` with a complete word, a word missing a language, and a
`languages: []` account (always 0); `wordsPerMonth` across two months with the `"YYYY-MM"` label
format. No production code change — the endpoint is correct, it was just untested.

**Slice 2 — data layer.** `types.ts` mirrors `BasicUserMetrics` verbatim, with a doc comment
flagging the `label`-vs-`language` key split. `api.ts` and `keys.ts` clone the `features/words/`
header style. `hooks.ts` exports `useUserMetrics()` with `staleTime: 5 * 60_000`. `selectors.ts` +
`selectors.test.ts` carry the derivations. `test/msw/metricsHandlers.ts` follows the factory pattern.
Finally, delete `METRICS_KEY` from `features/words/hooks.ts` and import `metricsKeys.all` at all four
call sites, updating the four assertions in `hooks.test.tsx` and the `query-client.ts` comment.

**Slice 3 — stat cards.** New `/* ─── dashboard (Phase 3.5) ─── */` block in `globals.css`:
`.meter` (from `MOCKUPS/assets/app.css:329-330`), `.dash-grid` (1fr 2fr, collapsing at 920px),
`.stat-card`/`.s-num`/`.s-label`/`.s-sub`/`.stat-card.warn`, and the `.sk-num`/`.sk-label` skeleton
sizes — all from `MOCKUPS/dashboard.html:45-62`. `StatCard` renders number + label + an optional
sub-line or meter; `UserInfoPanel` composes the three and owns the skeleton state. `DashboardPage`
calls `useUserMetrics()` and renders the panel. The mockup's `prefers-reduced-motion` rule
(`dashboard.html:39-42`) is honoured for the shimmer.

**Slice 4 — pie.** `chartColors.ts` maps PoS and Lang onto the existing tokens. `PieChart` is a
props-only SVG component (`segments`, `total`, `unitLabel`, `worst`, `onWorstClick`) porting
`donutSeg`/`polar` from the mockup: donut, centre total + unit, dashed stroke on the smallest
segment, and the legend grid (dot / name / count / percent) with the worst row as a link. Tested
with Testing Library on the accessible names and the legend text, not on path geometry.

**Slice 5 — bar.** `BarChart` ports `renderBar`: gridlines + y labels at five steps, a "nice max"
rounded up, side-by-side or stacked bars per group, x labels, `<title>` per bar for the native
tooltip, and the series legend. Add `allowDeselect?: boolean` to `SegmentedToggle` (default `true`,
so existing form usage is untouched) and pass `false` for all three chart toggles. Remove `c3`,
`d3`, `@types/c3`, `@types/d3` from `frontend/package.json`.

**Slice 6 — composition and states.** `MetricsPanel` holds both chart blocks with their
`.chart-head` + toggles. Gate on `totalWords === 0` → the existing `EmptyState` with the `home.*`
keys (the current unconditional one becomes conditional); on query error → `ErrorState`. New i18n
keys in all four locales: `userInfoCards.totalTranslations`, `userInfoCards.sub.{wordsThisMonth,
perWordAverage,incompleteShare}`, `userInfoCards.noLanguages`, and aria-labels for the three toggle
groups. `DashboardPage.test.tsx` via `renderApp({ initialEntry: '/' })` + `metricsHandlers`: loaded
numbers, empty state on zeros, both toggles flipping the rendered content.

**Slice 7 — gate.** `e2e/tests/phase-3-5-dashboard.spec.ts` following `phase-3-review.spec.ts`:
local `registerAndVerify`, seed words of ≥2 PoS across ≥2 languages through `POST /api/words`, log
in through the real form, assert the stat-card numbers and both charts against the seeded data,
flip each toggle, then a second fresh account showing the empty state; `afterAll` →
`deleteUsersByEmail` + `closePool`. Update `e2e/README.md`'s spec list, the build plan's §9 status
table and §5 Phase 3.5 entry, `.context/README.md`'s roadmap row, and
`.context/.frontend/frontend-structure.md`'s metrics row.

## Deferred / future scope (recorded, not built here)

- **Tag statistics** — words per tag, tag coverage, followed-vs-owned. Needs a new backend
  aggregation; `getUserMetrics` never reads `tags`/`tag_words`. Lands with or after **Phase 4**.
- **Social / friendship statistics** — shared tags, friend activity. **Phases 6–7**.
- **Mastery / forgetting-curve metrics** — `getUserMetrics` never reads `exercise_performances`, so
  a practice session does not move a single number on this Dashboard. Its own endpoint, **Phase 5**
  (already noted in build plan §5 Phase 5 and `overview.md` §3.6 "Mastery Metrics").

## Files

**New** — `backend/tests/metrics.test.js`; `frontend/src/features/metrics/{api,keys,hooks,types,selectors}.ts`
(+ `selectors.test.ts`); `frontend/src/features/metrics/components/{StatCard,UserInfoPanel,MetricsPanel}.tsx`
(+tests); `frontend/src/features/metrics/components/charts/{chartColors.ts,PieChart.tsx,BarChart.tsx}`
(+tests); `frontend/src/test/msw/metricsHandlers.ts`; `frontend/src/features/metrics/pages/DashboardPage.test.tsx`;
`e2e/tests/phase-3-5-dashboard.spec.ts`.

**Modified** — `frontend/src/features/metrics/pages/DashboardPage.tsx`; `frontend/src/features/words/hooks.ts`
(+ `hooks.test.tsx`); `frontend/src/app/query-client.ts` (comment); `frontend/src/styles/globals.css`;
`frontend/src/components/ui/segmented-toggle.tsx`; `frontend/package.json`;
`frontend/public/locales/{en,es,de,ee}/dashboard.json`; `.context/plans/new-repo-build-plan.md`;
`.context/README.md`; `.context/.frontend/frontend-structure.md`; `e2e/README.md`.

**Reuse rather than rewrite** — `components/common/{EmptyState,ErrorState}.tsx`,
`components/ui/{skeleton,segmented-toggle,tooltip}.tsx`, `buttonVariants()`,
`lib/words.ts` (`partOfSpeechLabelKey`, `partOfSpeechFromRouteParam` — add only its inverse),
`lib/language.ts` (`UI_LANGUAGES`), `api/client.ts`, `test/render.tsx` (`renderApp`),
`e2e/fixtures/db.ts`, and the `.card`/`.skeleton`/`.empty`/`.num`/`.meta` classes already in
`globals.css`.

## Verification

```bash
# per slice
npm test -w backend -- tests/metrics.test.js     # slice 1
npm test -w frontend                              # slices 2-6
npm run build -w frontend                         # tsc -b + vite build

# end to end (slice 7)
npm run docker:up && npm run db:migrate
npm test && npm test -w frontend && npm run build -w frontend
npm run test:e2e
```

In the browser (`npm run dev`), logged in on an account with words across ≥2 PoS and ≥2 languages:

1. `/` shows three stat cards whose numbers match the DB, each with its sub-line, and the incomplete
   card in amber with a filled meter.
2. The pie starts on "Word type"; switching to "Language" changes the slices, the legend and the
   centre unit. The smallest slice and its legend row are links; the word-type one lands on
   `/addWord/<pos>` with that type preselected.
3. The bar starts on "Month" with the last 12 months zero-filled; "Language" swaps the axis to the
   four languages. "Group by type" stacks the PoS into one bar per column; "Separate by type" splits
   them side by side. Both toggles keep exactly one option selected.
4. Narrow the window past 920px — the grid collapses to one column and nothing scrolls sideways.
5. A brand-new account shows zeros and the "Add your first words" empty state instead of the charts.
6. Adding a word from `/addWord` and returning to `/` shows the new totals (the `['metrics']`
   invalidation edge finally has a consumer).

**Gate:** backend **165 → ~175** green (new `metrics.test.js`), frontend **540 → ~600** green,
`npm run test:e2e` **10 → 11** green, `npm run build -w frontend` clean; `grep -rn "c3\|from 'd3'"
frontend/src frontend/package.json` = 0; `grep -n "METRICS_KEY" frontend/src` = 0.

## Risks

- **Hand-rolled SVG regressions.** Mitigation: the geometry is ported verbatim from a mockup that
  already renders correctly, and all numeric work lives in `selectors.ts` where it is unit-tested;
  the chart components are asserted on accessible names and legend text, never on path data.
- **Sparse or clock-skewed month data.** `wordsPerMonth` has no gaps filled and uses the server's
  local time on a `timestamp without time zone` column, while "this month" is computed from the
  browser clock. Mitigation: the window and zero-fill are one tested selector; a month-boundary
  off-by-one is cosmetic on a stat sub-line, and Slice 1 pins the label format.
- **Scope creep into a backend extension.** D1 establishes that no new aggregation is needed.
  If a chart still wants something the endpoint cannot give, that is a new field with its own tests,
  not a quiet widening — and it is the designated cut line for this phase.
- **`SegmentedToggle` change touching Phase 3 forms.** Mitigation: `allowDeselect` defaults to
  `true`, so every existing call site keeps its current behaviour; the form-engine tests are the
  regression check.
