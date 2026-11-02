# Dashboard and user metrics

## Summary

The home page `/` shows how much the learner has: totals for words and translations, a meter of how many translations were practiced, and two charts (words by part of speech, and words by month or by language). The numbers update when the learner adds, changes or deletes a word.

Live spec. It replaces a finished plan (archive record: `.context/archive/2026-09-phase-3-5-dashboard.md`). Built 2026-09-16, changed 2026-10-23 and 2026-10-24 (practice coverage). Gate: `e2e/tests/phase-3-5-dashboard.spec.ts`.

Code map: backend `GET /api/users/getUserMetrics` (`backend/controllers/metricController.ts`; the old blueprint path `/api/metrics/...` is wrong); frontend `frontend/src/features/metrics/` (`api.ts`, `hooks.ts`, `selectors.ts`, `UserInfoPanel`, `StatCard`, `MetricsPanel`, `components/charts/`), `staleTime` 5 minutes, key `['metrics']`. Word create, update and delete invalidate `['metrics']`.

## 1. Decisions

| ID | Decision | Rejected option |
|---|---|---|
| M-1 | The bar chart has an X-axis toggle (Month or Language) and a grouping toggle (Group by type: one stacked bar per X value; Separate by type: one bar per part of speech side by side). No backend change: `wordsPerMonth` and `translationsPerLanguageAndPOS` already carry the part of speech. | A new aggregation. |
| M-2 | Charts are hand-rolled inline SVG (maths from the mockup). No chart library; `c3` and `d3` were dropped from `package.json`. There is nothing to code-split. | A chart library. |
| M-3 | Three stat cards: total words (plus N this month), total translations (N.N per word), and unpracticed words (see section 3). | The old app's language-count card. |
| M-4 | Chart toggle state is local component state, not the URL. | URL state. |
| M-5 | The i18n titles are authoritative for chart text. The mockup governs layout, spacing, type and colour only. | Mockup copy. |
| M-6 | The bar series is the part of speech in both X modes. Language is an X value, not a series. | Language-coloured bars. |
| M-7 | The pie's "worst category" links to `/addWord/<pos>` in word-type mode and to `/addWord` in language mode (the route has no language parameter). | A language link. |
| M-8 | The month axis shows the last 12 months, zero-filled, ending in the current month (one constant in `selectors.ts`). The window is client-side because `wordsPerMonth` is all-time history with no empty months. | Server-side fill. |
| M-9 | Units differ per X mode and that is accepted: months count words, languages count translations. A word has at most one translation per language, so "translations in English" equals "words that have English" (the label says "Words per language"). | Two metrics. |

## 2. Contract

`getUserMetrics` returns `totalWords`, `wordsPerPOS`, `translationsPerLanguage`, `translationsPerLanguageAndPOS`, `wordsPerMonth`, and the practice coverage fields below. It never reads tags, friends or `exercise_performances` for the charts. `totalWords` and the charts count the user's own words only.

## 3. Practice coverage (changed 2026-10-23, user feedback)

- Fields: `unpracticedWordsCount`, `translationsInPractice`, `practicedTranslations` (`calculatePracticeCoverage`). `incompleteWordsCount` is gone.
- Scope is the one practice uses: own words plus words of followed tags the user can still see, without a followed word the user has an own copy of.
- A case is practiced when the user's `exercise_performance_cases` row for the same translation and case name has a non-empty `record`. An answer for a case the word no longer stores does not count. A translation is practiced when at least one stored case is practiced (it counts once). A translation with no stored case cannot be practiced and is not counted. A word is unpracticed when none of its translations is practiced. Example: 2 words with 4 translations each, one case practiced in each of 2 languages: 2 of 8.
- The card shows the unpracticed count. The meter shows `practicedPercent` (practiced translations over all translations), named "Translations practiced" for assistive technology. The label ends with the counts, for example "(2/8)". Below 1% the percentage has one decimal and is never 0 while a translation is practiced. The bar is at least 2% wide while there is progress. With `translationsInPractice === 0` the card is a placeholder: "—" and a link to add words, no meter. The card is not amber.
- The first version counted cases. It was changed to translations because a translation is the unit the user sees and adds.

## 4. Traps

- `wordsPerMonth` uses the server's local time on a `timestamp without time zone` column, while "this month" is computed from the browser clock. A month-boundary off-by-one is cosmetic.
- Base UI `<Select.Value>` shows the raw option value unless you give it a children function that maps the value to a label. The month-range select showed "6" and "all" until that was fixed.
- `SegmentedToggle` has `allowDeselect` (default `true`). Do not change the default: the form engine uses it.
- Card-scoped locators are needed in the e2e spec: the counts can repeat on the page.

## 5. Open items

Closed 2026-11-02 (confirmed by the user): the review of the ES, DE and EE texts of `dashboard.json` `userInfoCards.*`.

1. Not built, on purpose: tag statistics (needs a new aggregation), social statistics, and mastery or forgetting-curve metrics (their own endpoint, see `.context/features/practice.md`).
