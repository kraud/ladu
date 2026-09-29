import { describe, expect, it } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { defaultParams } from './params';
import { paramsToSearch, searchToParams, validatePracticeSearch } from './search';

const account = ['English', 'Spanish', 'German'];
const base = defaultParams(account);

describe('validatePracticeSearch', () => {
    it('returns nothing for an empty URL', () => {
        expect(validatePracticeSearch({})).toEqual({
            lang: undefined, pos: undefined, n: undefined, card: undefined, mode: undefined,
            mc: undefined, ti: undefined, order: undefined, native: undefined,
        });
    });

    it('reads a full valid URL', () => {
        expect(
            validatePracticeSearch({
                lang: 'EN,ES', pos: ['Noun', 'Verb'], n: 20, card: 'choice', mode: 'same',
                mc: 3, ti: 1, order: 'random', native: 'exclude',
            }),
        ).toEqual({
            lang: ['EN', 'ES'], pos: ['Noun', 'Verb'], n: 20, card: 'choice', mode: 'same',
            mc: 3, ti: 1, order: 'random', native: 'exclude',
        });
    });

    it('accepts repeated keys, comma lists and the router JSON round-trip for arrays', () => {
        expect(validatePracticeSearch({ lang: ['EN', 'DE'] }).lang).toEqual(['EN', 'DE']);
        expect(validatePracticeSearch({ lang: 'EN,DE' }).lang).toEqual(['EN', 'DE']);
        expect(validatePracticeSearch({ pos: 'Noun' }).pos).toEqual(['Noun']);
    });

    it('undoes the router number coercion and reads numeric strings', () => {
        expect(validatePracticeSearch({ n: '15', mc: '0', ti: '3' })).toMatchObject({ n: 15, mc: 0, ti: 3 });
    });

    it('drops invalid values instead of failing', () => {
        expect(
            validatePracticeSearch({
                lang: 'FR,EN', pos: ['Noun', 'Pronoun'], n: 0, card: 'drag', mode: 'both',
                mc: 4, ti: 0, order: 'newest', native: 'maybe',
            }),
        ).toEqual({
            lang: ['EN'], pos: ['Noun'], n: undefined, card: undefined, mode: undefined,
            mc: undefined, ti: undefined, order: undefined, native: undefined,
        });
    });

    it.each([101, 1.5, 'abc', '', null, NaN])('drops the amount %p', (n) => {
        expect(validatePracticeSearch({ n }).n).toBeUndefined();
    });

    it('keeps the bounds and de-duplicates lists', () => {
        expect(validatePracticeSearch({ n: 1 }).n).toBe(1);
        expect(validatePracticeSearch({ n: 100 }).n).toBe(100);
        expect(validatePracticeSearch({ lang: 'EN,EN,ES' }).lang).toEqual(['EN', 'ES']);
    });
});

describe('searchToParams', () => {
    it('falls back to the base for every missing field', () => {
        expect(searchToParams({}, base, account)).toEqual(base);
    });

    it('overlays the URL on the base', () => {
        const result = searchToParams(
            { lang: ['DE', 'EN'], pos: [PartOfSpeech.verb], n: 5, card: 'random', mode: 'different', mc: 2, ti: 3, order: 'random', native: 'exclude' },
            base,
            account,
        );
        expect(result).toEqual({
            languages: [Lang.DE, Lang.EN],
            partsOfSpeech: [PartOfSpeech.verb],
            amount: 5,
            type: 'Random',
            multiLang: 'Multi-Language',
            difficultyMC: 2,
            strictnessTI: 3,
            wordSelection: 'Random',
            excludeNative: true,
        });
    });

    it("limits languages to the account's own and keeps the base when none survive", () => {
        expect(searchToParams({ lang: ['EN', 'EE'] }, base, account).languages).toEqual([Lang.EN]);
        expect(searchToParams({ lang: ['EE'] }, base, account).languages).toEqual(base.languages);
    });

    it('native=include switches the exclusion off even if the base excluded', () => {
        expect(searchToParams({ native: 'include' }, { ...base, excludeNative: true }, account).excludeNative).toBe(false);
    });
});

describe('paramsToSearch', () => {
    it('round-trips every setting through the URL contract', () => {
        const params = {
            languages: [Lang.ES, Lang.DE],
            partsOfSpeech: [PartOfSpeech.noun],
            amount: 42,
            type: 'Multiple-Choice' as const,
            multiLang: 'Single-Language' as const,
            difficultyMC: 3 as const,
            strictnessTI: 1 as const,
            wordSelection: 'Random' as const,
            excludeNative: true,
        };
        const url = validatePracticeSearch(paramsToSearch(params) as Record<string, unknown>);
        expect(searchToParams(url, defaultParams(account), account)).toEqual(params);
    });

    it('never writes an invalid amount', () => {
        expect(paramsToSearch({ ...base, amount: NaN }).n).toBeUndefined();
        expect(paramsToSearch({ ...base, amount: 500 }).n).toBeUndefined();
        expect(paramsToSearch({ ...base, amount: 7 }).n).toBe(7);
    });
});
