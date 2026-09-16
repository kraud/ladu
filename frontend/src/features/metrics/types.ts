/**
 * `GET /api/users/getUserMetrics` wire contract — mirrors `BasicUserMetrics`
 * (`backend/controllers/metricController.ts:17-33`) verbatim. Already `id`-only
 * (no `_id` ever existed on this surface).
 *
 * **Key-naming trap**: `translationsPerLanguage` keys the language value under
 * `language`, but `translationsPerLanguageAndPOS` keys the SAME kind of value
 * under `label` instead — a backend quirk, not a typo here. Don't "fix" one to
 * match the other; the field names below are deliberately different to match
 * the real response.
 *
 * `wordsPerMonth` counts **words** (not translations), split by `partOfSpeech`,
 * unbounded history with no gap-filling — `selectors.ts` windows and zero-fills
 * it for the bar chart. `translationsPerLanguageAndPOS` counts **translations**;
 * it has no month dimension at all (see `selectors.ts` for how the bar chart's
 * two X-modes reconcile that).
 */
import type { PartOfSpeech } from '@/ts/enums';

/** One `wordsPerPOS` row. `type` is always the literal `"partOfSpeech"`. */
export interface WordsPerPosRow {
    partOfSpeech: PartOfSpeech;
    type: 'partOfSpeech';
    count: number;
}

/** One `translationsPerLanguage` row. `type` is always the literal `"language"`. */
export interface TranslationsPerLanguageRow {
    language: string;
    count: number;
    type: 'language';
}

/**
 * One `translationsPerLanguageAndPOS` row. The language value rides under
 * `label`, not `language` — see the file-level doc comment.
 */
export interface TranslationsPerLanguageAndPosRow {
    label: string;
    type: 'language';
    partOfSpeech: PartOfSpeech;
    count: number;
}

/** One `wordsPerMonth` row. `label` is `"YYYY-MM"`; no `type` field on this array. */
export interface WordsPerMonthRow {
    label: string;
    partOfSpeech: PartOfSpeech;
    count: number;
}

/**
 * The full response. A fresh account returns `totalWords: 0`,
 * `incompleteWordsCount: 0`, and every array empty (never omitted).
 */
export interface BasicUserMetricsBE {
    totalWords: number;
    incompleteWordsCount: number;
    translationsPerLanguage: TranslationsPerLanguageRow[];
    translationsPerLanguageAndPOS: TranslationsPerLanguageAndPosRow[];
    wordsPerPOS: WordsPerPosRow[];
    wordsPerMonth: WordsPerMonthRow[];
}
