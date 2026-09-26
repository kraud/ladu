import { describe, expect, it } from 'vitest';
import { Lang, NounCases, PartOfSpeech } from '@/ts/enums';
import { cellDialogHeadword } from './cellTitle';

const EN = { language: 'English', cases: [{ caseName: NounCases.singularEN, word: 'house' }] };
const ES = {
    language: 'Spanish',
    cases: [
        { caseName: NounCases.genderES, word: 'el' },
        { caseName: NounCases.singularES, word: 'casa' },
    ],
};
const DE = {
    language: 'German',
    cases: [
        { caseName: NounCases.genderDE, word: 'das' },
        { caseName: NounCases.singularNominativDE, word: 'Haus' },
    ],
};
const noun = PartOfSpeech.noun;

describe('cellDialogHeadword — an existing translation (view / edit)', () => {
    it("is that translation's own main case, not the word's first translation", () => {
        expect(cellDialogHeadword(noun, [EN, ES, DE], Lang.ES, { isAdd: false })).toBe('casa');
        expect(cellDialogHeadword(noun, [EN, ES, DE], Lang.DE, { isAdd: false })).toBe('Haus');
        expect(cellDialogHeadword(noun, [EN, ES, DE], Lang.EN, { isAdd: false })).toBe('house');
    });

    it('ignores the native language and the account languages', () => {
        expect(
            cellDialogHeadword(noun, [EN, ES], Lang.ES, {
                isAdd: false,
                nativeLanguage: 'English',
                userLanguages: ['English', 'Spanish'],
            }),
        ).toBe('casa');
    });

    it('is empty when that translation has no main case yet', () => {
        const emptyEn = { language: 'English', cases: [] };
        expect(cellDialogHeadword(noun, [emptyEn, ES], Lang.EN, { isAdd: false })).toBe('');
    });
});

describe('cellDialogHeadword — creating a translation', () => {
    it("uses the native language's main case when the word has a translation in it", () => {
        expect(
            cellDialogHeadword(noun, [EN, ES], Lang.DE, {
                isAdd: true,
                nativeLanguage: 'Spanish',
                userLanguages: ['English', 'Spanish', 'German'],
            }),
        ).toBe('casa');
    });

    it('falls back to the first account language the word has, in account order', () => {
        const opts = { isAdd: true, nativeLanguage: null, userLanguages: ['Spanish', 'English', 'German'] };
        expect(cellDialogHeadword(noun, [EN, ES], Lang.DE, opts)).toBe('casa'); // Spanish comes first in the account
        expect(
            cellDialogHeadword(noun, [EN, ES], Lang.DE, { ...opts, userLanguages: ['English', 'Spanish', 'German'] }),
        ).toBe('house');
    });

    it('falls back too when the native language has no translation on the word yet', () => {
        expect(
            cellDialogHeadword(noun, [EN, ES], Lang.DE, {
                isAdd: true,
                nativeLanguage: 'German', // the very language being added
                userLanguages: ['English', 'Spanish', 'German'],
            }),
        ).toBe('house');
        expect(
            cellDialogHeadword(noun, [EN], Lang.DE, {
                isAdd: true,
                nativeLanguage: 'Estonian',
                userLanguages: ['English', 'Spanish'],
            }),
        ).toBe('house');
    });

    it('skips a translation that has no main case yet and takes the next one', () => {
        const emptyEn = { language: 'English', cases: [] };
        expect(
            cellDialogHeadword(noun, [emptyEn, ES], Lang.DE, { isAdd: true, userLanguages: ['English', 'Spanish'] }),
        ).toBe('casa');
    });

    it('takes any translation the word has when none is in the account languages', () => {
        expect(cellDialogHeadword(noun, [ES], Lang.DE, { isAdd: true, userLanguages: ['English', 'German'] })).toBe('casa');
    });

    it('works with no native language and no account languages given (the plain dialog)', () => {
        expect(cellDialogHeadword(noun, [EN, ES], Lang.DE, { isAdd: true })).toBe('house');
    });

    it('is empty when no translation has a main case', () => {
        expect(cellDialogHeadword(noun, [{ language: 'English', cases: [] }], Lang.DE, { isAdd: true })).toBe('');
    });
});
