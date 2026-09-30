import { describe, expect, it } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { configToParams, narrowToPickable } from './configs';
import { defaultParams } from './params';
import type { PreselectedWord } from './preselection';

const account = ['English', 'Spanish'];
const word = (partOfSpeech: PartOfSpeech): PreselectedWord => ({ id: 'w', partOfSpeech, label: 'x', languages: ['EN'] });

describe('narrowToPickable', () => {
    it('drops word types without exercises', () => {
        const params = { ...defaultParams(account), partsOfSpeech: [PartOfSpeech.noun, PartOfSpeech.adjective] };
        expect(narrowToPickable(params, null).partsOfSpeech).toEqual([PartOfSpeech.noun]);
    });

    it('limits the word types to the ones the pre-selected words have', () => {
        const params = { ...defaultParams(account), partsOfSpeech: [PartOfSpeech.noun, PartOfSpeech.verb] };
        expect(narrowToPickable(params, [word(PartOfSpeech.verb)]).partsOfSpeech).toEqual([PartOfSpeech.verb]);
    });

    it('selects every available type when none of the chosen ones is left', () => {
        const params = { ...defaultParams(account), partsOfSpeech: [PartOfSpeech.noun] };
        expect(narrowToPickable(params, [word(PartOfSpeech.verb)]).partsOfSpeech).toEqual([PartOfSpeech.verb]);
    });
});

describe('configToParams', () => {
    it('keeps valid stored settings', () => {
        const stored = {
            ...defaultParams(account),
            amount: 25,
            type: 'Multiple-Choice' as const,
            difficultyMC: 3 as const,
            strictnessTI: 3 as const,
            wordSelection: 'Random' as const,
            excludeNative: true,
        };
        expect(configToParams(stored, account, null)).toEqual(stored);
    });

    it('drops a language the account no longer has', () => {
        const stored = { ...defaultParams(account), languages: [Lang.EN, Lang.DE] };
        expect(configToParams(stored, account, null).languages).toEqual([Lang.EN]);
    });

    it('falls back to the defaults for values that are not valid', () => {
        const stored = { ...defaultParams(account), amount: 500, type: 'Nope', difficultyMC: 9 } as never;
        const result = configToParams(stored, account, null);
        expect(result.amount).toBe(defaultParams(account).amount);
        expect(result.type).toBe(defaultParams(account).type);
        expect(result.difficultyMC).toBe(defaultParams(account).difficultyMC);
    });

    it('narrows the word types to the pre-selected words', () => {
        const stored = { ...defaultParams(account), partsOfSpeech: [PartOfSpeech.noun, PartOfSpeech.verb] };
        expect(configToParams(stored, account, [word(PartOfSpeech.noun)]).partsOfSpeech).toEqual([PartOfSpeech.noun]);
    });
});
