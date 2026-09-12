import { describe, expect, it } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import type { TranslationBE } from '@/features/words/types';
import { filterTranslationsByUserLanguages, primaryCaseWord } from './words';

const enTranslation: TranslationBE = {
    id: 't-en',
    language: Lang.EN,
    cases: [{ caseName: 'singularEN', word: 'house' }],
};
const esTranslation: TranslationBE = {
    id: 't-es',
    language: Lang.ES,
    cases: [{ caseName: 'singularES', word: 'casa' }],
};
const deTranslation: TranslationBE = {
    id: 't-de',
    language: Lang.DE,
    cases: [{ caseName: 'singularNominativDE', word: 'Haus' }],
};

describe('filterTranslationsByUserLanguages', () => {
    it('keeps only translations in the given language list, stamped complete and clean', () => {
        const result = filterTranslationsByUserLanguages(
            [enTranslation, esTranslation, deTranslation],
            [Lang.EN, Lang.ES],
        );

        expect(result).toEqual([
            { language: Lang.EN, cases: enTranslation.cases, completionState: true, isDirty: false },
            { language: Lang.ES, cases: esTranslation.cases, completionState: true, isDirty: false },
        ]);
    });

    it('drops a language no longer in userLanguages', () => {
        const result = filterTranslationsByUserLanguages([enTranslation, deTranslation], [Lang.EN]);
        expect(result).toHaveLength(1);
        expect(result[0]?.language).toBe(Lang.EN);
    });

    it('returns an empty array for no translations', () => {
        expect(filterTranslationsByUserLanguages([], [Lang.EN, Lang.ES])).toEqual([]);
    });
});

describe('primaryCaseWord', () => {
    it("returns the required singular case's word for EN", () => {
        expect(primaryCaseWord(PartOfSpeech.noun, enTranslation)).toBe('house');
    });

    it("returns the required singular-nominative case's word for DE", () => {
        expect(primaryCaseWord(PartOfSpeech.noun, deTranslation)).toBe('Haus');
    });

    it('returns an empty string when the case is missing', () => {
        expect(primaryCaseWord(PartOfSpeech.noun, { language: Lang.EN, cases: [] })).toBe('');
    });

    it('returns an empty string for an unshipped part of speech', () => {
        expect(primaryCaseWord(PartOfSpeech.verb, enTranslation)).toBe('');
    });
});
