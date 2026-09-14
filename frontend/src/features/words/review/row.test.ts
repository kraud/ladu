import { describe, expect, it } from 'vitest';
import { PartOfSpeech } from '@/ts/enums';
import type { WordSimpleBE } from '@/features/words/types';
import { genderValue, hasTranslation, headlineWord, registeredCases } from './row';

function baseRow(overrides: Partial<WordSimpleBE> = {}): WordSimpleBE {
    return {
        id: 'w1',
        user: 'u1',
        partOfSpeech: PartOfSpeech.noun,
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        storedLanguages: [],
        ...overrides,
    };
}

describe('headlineWord', () => {
    it('reads the per-language dataXX field', () => {
        const row = baseRow({ dataEN: 'house', storedLanguages: ['English'] });
        expect(headlineWord(row, 'EN')).toBe('house');
    });

    it('is undefined for a language with no headline case, even when stored', () => {
        // A Spanish noun that only ever got its gender case filled in — real,
        // reachable shape per `getRequiredFieldsData` (see WordSimpleBE's doc).
        const row = baseRow({ genderES: 'la', registeredCasesES: 1, storedLanguages: ['Spanish'] });
        expect(headlineWord(row, 'ES')).toBeUndefined();
    });
});

describe('registeredCases', () => {
    it('reads the count, defaulting to 0 for an unstored language', () => {
        const row = baseRow({ registeredCasesDE: 5 });
        expect(registeredCases(row, 'DE')).toBe(5);
        expect(registeredCases(row, 'EE')).toBe(0);
    });
});

describe('genderValue', () => {
    it('only ES/DE carry a gender value', () => {
        const row = baseRow({ genderES: 'la', genderDE: 'die' });
        expect(genderValue(row, 'ES')).toBe('la');
        expect(genderValue(row, 'DE')).toBe('die');
        expect(genderValue(row, 'EN')).toBeUndefined();
        expect(genderValue(row, 'EE')).toBeUndefined();
    });
});

describe('hasTranslation', () => {
    it('reads storedLanguages, not the headline field', () => {
        const row = baseRow({ storedLanguages: ['German'], registeredCasesDE: 1 });
        expect(hasTranslation(row, 'DE')).toBe(true);
        expect(hasTranslation(row, 'EN')).toBe(false);
    });

    it('is true even when the language has no headline word (the three-state cell case)', () => {
        const row = baseRow({ genderES: 'la', registeredCasesES: 1, storedLanguages: ['Spanish'] });
        expect(hasTranslation(row, 'ES')).toBe(true);
        expect(headlineWord(row, 'ES')).toBeUndefined();
    });
});
