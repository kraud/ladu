import { describe, expect, it } from 'vitest';
import { PartOfSpeech } from '@/ts/enums';
import type { BasicUserMetricsBE } from './types';
import {
    availableBarMonthRanges,
    barSeriesByLanguage,
    barSeriesByMonth,
    CREATABLE_POS,
    earliestWordsPerMonthLabel,
    incompletePercent,
    monthLabel,
    monthsOfHistory,
    pieSeries,
    totalTranslations,
    translationsPerWord,
    worstSegment,
    wordsAddedThisMonth,
} from './selectors';

const EMPTY: BasicUserMetricsBE = {
    totalWords: 0,
    incompleteWordsCount: 0,
    translationsPerLanguage: [],
    translationsPerLanguageAndPOS: [],
    wordsPerPOS: [],
    wordsPerMonth: [],
};

const POPULATED: BasicUserMetricsBE = {
    totalWords: 10,
    incompleteWordsCount: 3,
    translationsPerLanguage: [
        { language: 'English', count: 10, type: 'language' },
        { language: 'Spanish', count: 7, type: 'language' },
    ],
    translationsPerLanguageAndPOS: [
        { label: 'English', type: 'language', partOfSpeech: PartOfSpeech.verb, count: 6 },
        { label: 'English', type: 'language', partOfSpeech: PartOfSpeech.noun, count: 4 },
        { label: 'Spanish', type: 'language', partOfSpeech: PartOfSpeech.verb, count: 5 },
        { label: 'Spanish', type: 'language', partOfSpeech: PartOfSpeech.noun, count: 2 },
    ],
    wordsPerPOS: [
        { partOfSpeech: PartOfSpeech.verb, type: 'partOfSpeech', count: 6 },
        { partOfSpeech: PartOfSpeech.noun, type: 'partOfSpeech', count: 4 },
    ],
    wordsPerMonth: [
        { label: '2026-08', partOfSpeech: PartOfSpeech.verb, count: 2 },
        { label: '2026-09', partOfSpeech: PartOfSpeech.verb, count: 4 },
        { label: '2026-09', partOfSpeech: PartOfSpeech.noun, count: 4 },
    ],
};

describe('totalTranslations', () => {
    it('sums translationsPerLanguage counts', () => {
        expect(totalTranslations(POPULATED)).toBe(17);
    });

    it('is 0 for a fresh account', () => {
        expect(totalTranslations(EMPTY)).toBe(0);
    });
});

describe('monthLabel', () => {
    it('formats as YYYY-MM, zero-padded', () => {
        expect(monthLabel(new Date(2026, 0, 15))).toBe('2026-01');
        expect(monthLabel(new Date(2026, 10, 1))).toBe('2026-11');
    });
});

describe('wordsAddedThisMonth', () => {
    it('sums every PoS row matching the current month label', () => {
        expect(wordsAddedThisMonth(POPULATED, new Date(2026, 8, 20))).toBe(8); // 2026-09: 4 + 4
    });

    it('is 0 for a month with no rows', () => {
        expect(wordsAddedThisMonth(POPULATED, new Date(2026, 0, 1))).toBe(0);
    });
});

describe('translationsPerWord', () => {
    it('divides total translations by total words', () => {
        expect(translationsPerWord(POPULATED)).toBeCloseTo(1.7);
    });

    it('is 0 on a fresh account, not NaN', () => {
        expect(translationsPerWord(EMPTY)).toBe(0);
    });
});

describe('incompletePercent', () => {
    it('rounds incompleteWordsCount / totalWords to a percentage', () => {
        expect(incompletePercent(POPULATED)).toBe(30);
    });

    it('is 0 on a fresh account, not NaN', () => {
        expect(incompletePercent(EMPTY)).toBe(0);
    });
});

describe('pieSeries', () => {
    it('zero-fills all 4 creatable parts of speech in canonical order', () => {
        expect(pieSeries(POPULATED, 'words')).toEqual([
            { key: PartOfSpeech.noun, count: 4 },
            { key: PartOfSpeech.verb, count: 6 },
            { key: PartOfSpeech.adjective, count: 0 },
            { key: PartOfSpeech.adverb, count: 0 },
        ]);
    });

    it('zero-fills all 4 UI languages in canonical order for translations mode', () => {
        expect(pieSeries(POPULATED, 'translations')).toEqual([
            { key: 'English', count: 10 },
            { key: 'Spanish', count: 7 },
            { key: 'German', count: 0 },
            { key: 'Estonian', count: 0 },
        ]);
    });

    it('returns all-zero segments (not an empty array) for a fresh account', () => {
        const segments = pieSeries(EMPTY, 'words');
        expect(segments).toHaveLength(CREATABLE_POS.length);
        expect(segments.every((s) => s.count === 0)).toBe(true);
    });
});

describe('worstSegment', () => {
    it('picks the smallest count', () => {
        const segments = pieSeries(POPULATED, 'words');
        expect(worstSegment(segments)?.key).toBe(PartOfSpeech.adjective); // first 0-count, ties broken by order
    });

    it('returns null for an empty list', () => {
        expect(worstSegment([])).toBeNull();
    });

    it('breaks ties by keeping the first occurrence', () => {
        const tied = [
            { key: 'a', count: 5 },
            { key: 'b', count: 5 },
        ];
        expect(worstSegment(tied)?.key).toBe('a');
    });
});

describe('barSeriesByMonth', () => {
    it('returns monthsBack groups, oldest first, ending on the given month', () => {
        const groups = barSeriesByMonth(POPULATED, 3, new Date(2026, 8, 20));
        expect(groups.map((g) => g.xLabel)).toEqual(['2026-07', '2026-08', '2026-09']);
    });

    it('zero-fills a month with no data at all', () => {
        const groups = barSeriesByMonth(POPULATED, 3, new Date(2026, 8, 20));
        const july = groups.find((g) => g.xLabel === '2026-07')!;
        expect(july.series.every((s) => s.count === 0)).toBe(true);
    });

    it('zero-fills PoS values missing from a month that does have other data', () => {
        const groups = barSeriesByMonth(POPULATED, 3, new Date(2026, 8, 20));
        const august = groups.find((g) => g.xLabel === '2026-08')!;
        expect(august.series).toEqual([
            { pos: PartOfSpeech.noun, count: 0 },
            { pos: PartOfSpeech.verb, count: 2 },
            { pos: PartOfSpeech.adjective, count: 0 },
            { pos: PartOfSpeech.adverb, count: 0 },
        ]);
    });

    it('defaults to a 12-month window ending on the real current month', () => {
        expect(barSeriesByMonth(EMPTY)).toHaveLength(12);
    });

    it('"all" widens the window to the account\'s full history', () => {
        const groups = barSeriesByMonth(POPULATED, 'all', new Date(2026, 8, 20));
        // Earliest row is 2026-08 — 2026-08 through 2026-09 is 2 months.
        expect(groups.map((g) => g.xLabel)).toEqual(['2026-08', '2026-09']);
    });
});

describe('earliestWordsPerMonthLabel', () => {
    it('finds the chronologically earliest label, regardless of row order', () => {
        expect(earliestWordsPerMonthLabel(POPULATED)).toBe('2026-08');
    });

    it('is null for an account with no word-creation history', () => {
        expect(earliestWordsPerMonthLabel(EMPTY)).toBeNull();
    });
});

describe('monthsOfHistory', () => {
    it('counts whole months from the earliest label through now, inclusive', () => {
        expect(monthsOfHistory(POPULATED, new Date(2026, 8, 20))).toBe(2); // 2026-08, 2026-09
    });

    it('is 1 (not 0) for an account with no history yet', () => {
        expect(monthsOfHistory(EMPTY, new Date(2026, 8, 20))).toBe(1);
    });
});

describe('availableBarMonthRanges', () => {
    it('only offers ranges the account actually has data reaching back to', () => {
        // Earliest row 2026-08, "now" is October 2026: 3 months of history
        // (2026-08, 2026-09, 2026-10) — 12 and 6 are excluded, 3 and 1 remain.
        expect(availableBarMonthRanges(POPULATED, new Date(2026, 9, 20))).toEqual([3, 1]);
    });

    it('always includes 1, even for a brand-new account', () => {
        expect(availableBarMonthRanges(EMPTY, new Date(2026, 8, 20))).toEqual([1]);
    });

    it('offers every range once history covers a full year', () => {
        const yearOld: BasicUserMetricsBE = {
            ...EMPTY,
            wordsPerMonth: [{ label: '2025-09', partOfSpeech: PartOfSpeech.noun, count: 1 }],
        };
        expect(availableBarMonthRanges(yearOld, new Date(2026, 8, 20))).toEqual([12, 6, 3, 1]);
    });
});

describe('barSeriesByLanguage', () => {
    it('returns one group per UI language, in display order, zero-filled', () => {
        const groups = barSeriesByLanguage(POPULATED);
        expect(groups.map((g) => g.xLabel)).toEqual(['English', 'Spanish', 'German', 'Estonian']);

        const german = groups.find((g) => g.xLabel === 'German')!;
        expect(german.series.every((s) => s.count === 0)).toBe(true);

        const english = groups.find((g) => g.xLabel === 'English')!;
        expect(english.series).toEqual([
            { pos: PartOfSpeech.noun, count: 4 },
            { pos: PartOfSpeech.verb, count: 6 },
            { pos: PartOfSpeech.adjective, count: 0 },
            { pos: PartOfSpeech.adverb, count: 0 },
        ]);
    });

    it('returns all-zero groups (not an empty array) for a fresh account', () => {
        const groups = barSeriesByLanguage(EMPTY);
        expect(groups).toHaveLength(4);
        expect(groups.every((g) => g.series.every((s) => s.count === 0))).toBe(true);
    });
});
