import { describe, expect, it } from 'vitest';
import { PartOfSpeech } from '@/ts/enums';
import {
    hasActiveFilters,
    resolveLanguageOrder,
    reviewSearchToFilters,
    validateReviewSearch,
} from './search';

describe('validateReviewSearch', () => {
    it('accepts a repeated key (already an array via the router\'s own decoder)', () => {
        expect(validateReviewSearch({ pos: ['Noun', 'Verb'] })).toMatchObject({
            pos: [PartOfSpeech.noun, PartOfSpeech.verb],
        });
    });

    it('accepts a single comma-joined value', () => {
        expect(validateReviewSearch({ pos: 'Noun,Verb' })).toMatchObject({
            pos: [PartOfSpeech.noun, PartOfSpeech.verb],
        });
    });

    it('accepts an already-decoded array (what the router\'s own JSON-array round-trip produces)', () => {
        // The router's `defaultParseSearch` JSON-parses a `?pos=["Noun","Verb"]`
        // URL value BEFORE `validateSearch` ever runs, so `validateReviewSearch`
        // itself only ever sees the real array below — never the raw JSON string.
        expect(validateReviewSearch({ pos: ['Noun', 'Verb'] as unknown })).toMatchObject({
            pos: [PartOfSpeech.noun, PartOfSpeech.verb],
        });
    });

    it('drops unrecognised pos values but keeps the recognised ones', () => {
        expect(validateReviewSearch({ pos: 'Noun,Garbage' })).toMatchObject({ pos: [PartOfSpeech.noun] });
    });

    it('drops unrecognised lang keys', () => {
        expect(validateReviewSearch({ lang: 'EN,XX,DE' })).toMatchObject({ lang: ['EN', 'DE'] });
    });

    it('omits pos/gender/lang entirely when empty or absent', () => {
        const result = validateReviewSearch({});
        expect(result.pos).toBeUndefined();
        expect(result.gender).toBeUndefined();
        expect(result.lang).toBeUndefined();
        expect(result.q).toBeUndefined();
    });

    it('un-coerces a numeric-looking q back to a string (the router\'s qss.toValue trap)', () => {
        // The router hands validateSearch a REAL number here, matching what
        // `qss.toValue` does to a query string like `?q=2024` before this
        // function ever sees it.
        expect(validateReviewSearch({ q: 2024 as unknown as string })).toMatchObject({ q: '2024' });
    });

    it('un-coerces a boolean-looking q back to a string', () => {
        expect(validateReviewSearch({ q: true as unknown as string })).toMatchObject({ q: 'true' });
    });

    it('trims q and treats a whitespace-only value as absent', () => {
        expect(validateReviewSearch({ q: '  cat  ' })).toMatchObject({ q: 'cat' });
        expect(validateReviewSearch({ q: '   ' }).q).toBeUndefined();
    });

    it('passes gender values through verbatim, with no vocabulary filtering', () => {
        expect(validateReviewSearch({ gender: 'der,Maskulin,el/la' })).toMatchObject({
            gender: ['der', 'Maskulin', 'el/la'],
        });
    });
});

describe('reviewSearchToFilters', () => {
    it('drops lang — it is a display concern, not a query concern', () => {
        expect(reviewSearchToFilters({ q: 'cat', pos: [PartOfSpeech.noun], lang: ['EN', 'DE'] })).toEqual({
            q: 'cat',
            pos: [PartOfSpeech.noun],
            gender: undefined,
        });
    });
});

describe('hasActiveFilters', () => {
    it('is false with no q/pos/gender', () => {
        expect(hasActiveFilters({ lang: ['EN'] })).toBe(false);
        expect(hasActiveFilters({})).toBe(false);
    });

    it('is true when any of q/pos/gender is set', () => {
        expect(hasActiveFilters({ q: 'cat' })).toBe(true);
        expect(hasActiveFilters({ pos: [PartOfSpeech.noun] })).toBe(true);
        expect(hasActiveFilters({ gender: ['der'] })).toBe(true);
    });
});

describe('resolveLanguageOrder', () => {
    const userLanguages = ['German', 'English', 'Spanish'];

    it('uses the account order when the URL supplies nothing', () => {
        expect(resolveLanguageOrder(undefined, userLanguages)).toEqual(['DE', 'EN', 'ES']);
    });

    it('the URL order wins for the keys it names', () => {
        expect(resolveLanguageOrder(['EN', 'DE'], userLanguages)).toEqual(['EN', 'DE', 'ES']);
    });

    it('appends anything the URL omits, in the account order', () => {
        expect(resolveLanguageOrder(['ES'], userLanguages)).toEqual(['ES', 'DE', 'EN']);
    });

    it('drops a stale/unknown key from the URL rather than losing a column', () => {
        expect(resolveLanguageOrder(['EE', 'EN'], userLanguages)).toEqual(['EN', 'DE', 'ES']);
    });

    it('returns an empty order when the account has no configured languages', () => {
        expect(resolveLanguageOrder(['EN'], [])).toEqual([]);
    });
});
