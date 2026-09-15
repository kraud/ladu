/**
 * Pure derivations over `BasicUserMetricsBE` — no React, no formatting for
 * display (components own their own number/percent formatting). This is
 * where the phase's actual risk lives (D1/D6/D8/D9 in the phase plan), so
 * every function here has a matching `selectors.test.ts` case rather than
 * being verified only by eyeballing a rendered chart.
 *
 * Two zero-filling decisions worth flagging up front, both because the
 * backend "no row for a count of zero" behaviour (`metricController.ts`)
 * would otherwise silently drop a real, useful signal:
 *   - `pieSeries('words')` always returns all 4 creatable parts of speech
 *     (Noun/Verb/Adjective/Adverb — the only ones the form engine builds;
 *     see `data-model.md`), even ones the account has zero words of. A part
 *     of speech the user hasn't touched at all IS their worst category, and
 *     the pie's whole point is a clickable link to `/addWord/<pos>`.
 *   - `pieSeries('translations')` always returns all 4 UI languages
 *     (`UI_LANGUAGES`), same reasoning.
 *   - `barSeriesByMonth`/`barSeriesByLanguage` zero-fill every X-value's PoS
 *     series the same way, so every bar column/group has the same 4 stacked
 *     segments regardless of which months/languages happen to have data.
 */
import { PartOfSpeech } from '@/ts/enums';
import { UI_LANGUAGES } from '@/lib/language';
import type { BasicUserMetricsBE } from './types';

/** The only 4 parts of speech the form engine can create (`data-model.md`, `word-cases-data.md`). */
export const CREATABLE_POS: readonly PartOfSpeech[] = [
    PartOfSpeech.noun,
    PartOfSpeech.verb,
    PartOfSpeech.adjective,
    PartOfSpeech.adverb,
];

/** Sum of `translationsPerLanguage[].count` — `getUserMetrics` has no such scalar directly. */
export function totalTranslations(metrics: BasicUserMetricsBE): number {
    return metrics.translationsPerLanguage.reduce((sum, row) => sum + row.count, 0);
}

/** `"YYYY-MM"` for a given date (UTC-agnostic: uses local year/month, matching the stat card's "this month"). */
export function monthLabel(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Words created in the current calendar month, summed across every
 * `wordsPerMonth` row (which is split by `partOfSpeech`) matching that label.
 */
export function wordsAddedThisMonth(metrics: BasicUserMetricsBE, now: Date = new Date()): number {
    const label = monthLabel(now);
    return metrics.wordsPerMonth.filter((row) => row.label === label).reduce((sum, row) => sum + row.count, 0);
}

/** Average translations per word, or `0` on a fresh account (avoids a `NaN` div-by-zero). */
export function translationsPerWord(metrics: BasicUserMetricsBE): number {
    if (metrics.totalWords === 0) return 0;
    return totalTranslations(metrics) / metrics.totalWords;
}

/**
 * `incompleteWordsCount` as a percentage of `totalWords`, rounded. `0` on a
 * fresh account. Note this does NOT decide the "language-less account" (D10)
 * display — `metricController.ts` returns `incompleteWordsCount: 0`
 * unconditionally when `user.languages` is empty, which is indistinguishable
 * from "genuinely complete" at this layer. The caller (`UserInfoPanel`,
 * Slice 3) checks the account's own language count (from `authStore`, not
 * this response) to choose between this percentage and the "—" state.
 */
export function incompletePercent(metrics: BasicUserMetricsBE): number {
    if (metrics.totalWords === 0) return 0;
    return Math.round((metrics.incompleteWordsCount / metrics.totalWords) * 100);
}

/** One pie slice: a stable key (PoS enum value or language label) plus its count. */
export interface PieSegment {
    key: string;
    count: number;
}

/**
 * `mode: 'words'` → `wordsPerPOS`, zero-filled across `CREATABLE_POS`.
 * `mode: 'translations'` → `translationsPerLanguage`, zero-filled across
 * `UI_LANGUAGES`. Order is always the canonical one (POS/language display
 * order), never the backend's — `wordsPerPOS`/`translationsPerLanguage` rows
 * arrive in an unspecified SQL `GROUP BY` order.
 */
export function pieSeries(metrics: BasicUserMetricsBE, mode: 'words' | 'translations'): PieSegment[] {
    if (mode === 'words') {
        const counts = new Map(metrics.wordsPerPOS.map((row) => [row.partOfSpeech, row.count]));
        return CREATABLE_POS.map((pos) => ({ key: pos, count: counts.get(pos) ?? 0 }));
    }
    const counts = new Map(metrics.translationsPerLanguage.map((row) => [row.language, row.count]));
    return UI_LANGUAGES.map((lang) => ({ key: lang.label, count: counts.get(lang.label) ?? 0 }));
}

/**
 * The smallest segment (ties broken by keeping the first one found, matching
 * the mockup's `reduce`, `MOCKUPS/dashboard.html:303`). `null` for an empty
 * list — `pieSeries` never returns one, but an empty account is handled by
 * `MetricsPanel`'s empty state before either chart renders.
 */
export function worstSegment(segments: PieSegment[]): PieSegment | null {
    if (segments.length === 0) return null;
    return segments.reduce((worst, seg) => (seg.count < worst.count ? seg : worst), segments[0]!);
}

/** One X-axis group of the bar chart: a label plus one zero-filled count per creatable PoS. */
export interface BarGroup {
    xLabel: string;
    series: Array<{ pos: PartOfSpeech; count: number }>;
}

function seriesFromCounts(counts: Map<PartOfSpeech, number>): Array<{ pos: PartOfSpeech; count: number }> {
    return CREATABLE_POS.map((pos) => ({ pos, count: counts.get(pos) ?? 0 }));
}

/**
 * "By month" bar data: the last `monthsBack` calendar months (default 12),
 * oldest first, ending on `now`'s month — zero-filled, since `wordsPerMonth`
 * only contains rows for months that actually had activity (D8). Counts are
 * **words** (D9) — `wordsPerMonth` has no translation/language dimension.
 */
export function barSeriesByMonth(
    metrics: BasicUserMetricsBE,
    monthsBack = 12,
    now: Date = new Date(),
): BarGroup[] {
    const byLabel = new Map<string, Map<PartOfSpeech, number>>();
    for (const row of metrics.wordsPerMonth) {
        const forMonth = byLabel.get(row.label) ?? new Map<PartOfSpeech, number>();
        forMonth.set(row.partOfSpeech, row.count);
        byLabel.set(row.label, forMonth);
    }

    const groups: BarGroup[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = monthLabel(d);
        groups.push({ xLabel: label, series: seriesFromCounts(byLabel.get(label) ?? new Map()) });
    }
    return groups;
}

/**
 * "By language" bar data: one group per `UI_LANGUAGES` entry, in display
 * order, zero-filled. Counts are **translations** (D9) — since a word holds
 * at most one translation per language, this is equivalently "words that
 * have a translation in this language", which is why v1's own i18n label for
 * this view is "Words per language", not "Translations per language".
 */
export function barSeriesByLanguage(metrics: BasicUserMetricsBE): BarGroup[] {
    const byLabel = new Map<string, Map<PartOfSpeech, number>>();
    for (const row of metrics.translationsPerLanguageAndPOS) {
        const forLang = byLabel.get(row.label) ?? new Map<PartOfSpeech, number>();
        forLang.set(row.partOfSpeech, row.count);
        byLabel.set(row.label, forLang);
    }

    return UI_LANGUAGES.map((lang) => ({
        xLabel: lang.label,
        series: seriesFromCounts(byLabel.get(lang.label) ?? new Map()),
    }));
}
