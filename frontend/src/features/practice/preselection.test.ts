import { describe, expect, it } from 'vitest';
import type { WordSimpleBE } from '@/features/words/types';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { availablePartsOfSpeech, toPreselectedWord, type PreselectedWord } from './preselection';

const row = (overrides: Partial<WordSimpleBE> = {}): WordSimpleBE => ({
    id: 'w1',
    user: 'u1',
    partOfSpeech: PartOfSpeech.noun,
    tags: [],
    createdAt: '',
    updatedAt: '',
    storedLanguages: [Lang.EN, Lang.DE],
    dataEN: 'house',
    dataDE: 'Haus',
    ...overrides,
});

const word = (partOfSpeech: PartOfSpeech): PreselectedWord => ({ id: partOfSpeech, partOfSpeech, label: 'x', languages: [] });

describe('toPreselectedWord', () => {
    it('labels the word with the first headline in the Review column order', () => {
        expect(toPreselectedWord(row(), ['DE', 'EN'])).toEqual({
            id: 'w1',
            partOfSpeech: PartOfSpeech.noun,
            label: 'Haus',
            languages: ['DE', 'EN'],
        });
    });

    it('keeps only the languages the word has, and skips a language without a headline', () => {
        const result = toPreselectedWord(row({ storedLanguages: [Lang.DE], dataEN: undefined }), ['EN', 'ES', 'DE']);
        expect(result.languages).toEqual(['DE']);
        expect(result.label).toBe('Haus');
    });

    it('gives an empty label when no language has a headline', () => {
        const result = toPreselectedWord(row({ dataEN: undefined, dataDE: undefined }), ['EN', 'DE']);
        expect(result.label).toBe('');
    });
});

describe('availablePartsOfSpeech', () => {
    it('has no limit without words', () => {
        expect(availablePartsOfSpeech(null)).toBeNull();
        expect(availablePartsOfSpeech([])).toBeNull();
    });

    it('returns the word types of the words, in screen order', () => {
        expect(availablePartsOfSpeech([word(PartOfSpeech.verb), word(PartOfSpeech.noun)])).toEqual([
            PartOfSpeech.noun,
            PartOfSpeech.verb,
        ]);
    });

    it('has no limit when no word has a type the screen offers', () => {
        expect(availablePartsOfSpeech([word(PartOfSpeech.pronoun)])).toBeNull();
    });
});
