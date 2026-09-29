import { describe, expect, it } from 'vitest';
import { Lang, PartOfSpeech } from '@/ts/enums';
import {
    defaultParams,
    knownLanguages,
    narrowPartsOfSpeech,
    onlyPartsWithoutExercises,
    relevantSettings,
    toGenerateBody,
    validateParams,
} from './params';

const base = defaultParams(['English', 'Spanish']);

describe('defaultParams', () => {
    it('matches the documented defaults (A.3)', () => {
        expect(base).toEqual({
            languages: [Lang.EN, Lang.ES],
            partsOfSpeech: [PartOfSpeech.noun, PartOfSpeech.verb],
            amount: 10,
            type: 'Text-Input',
            multiLang: 'Random',
            difficultyMC: 1,
            strictnessTI: 2,
            wordSelection: 'Exercise-Performance',
            excludeNative: false,
        });
    });

    it('drops unknown or repeated languages and keeps the account order', () => {
        expect(knownLanguages(['German', 'Klingon', 'English', 'German'])).toEqual([Lang.DE, Lang.EN]);
        expect(defaultParams(['Estonian', 'German']).languages).toEqual([Lang.EE, Lang.DE]);
    });
});

describe('validateParams', () => {
    it('accepts the defaults', () => {
        expect(validateParams(base)).toEqual({});
    });

    it('needs a language, and two for "different languages"', () => {
        expect(validateParams({ ...base, languages: [] }).languages).toBe('languagesRequired');
        expect(validateParams({ ...base, languages: [Lang.EN], multiLang: 'Multi-Language' }).languages).toBe('languagesMinTwo');
        expect(validateParams({ ...base, languages: [Lang.EN], multiLang: 'Random' })).toEqual({});
        expect(validateParams({ ...base, languages: [Lang.EN], multiLang: 'Single-Language' })).toEqual({});
    });

    it('needs a word type', () => {
        expect(validateParams({ ...base, partsOfSpeech: [] }).partsOfSpeech).toBe('partsOfSpeechRequired');
    });

    it.each([
        [NaN, 'amountRequired'],
        [1.5, 'amountInteger'],
        [0, 'amountPositive'],
        [-3, 'amountPositive'],
        [101, 'amountTooLarge'],
    ])('amount %p -> %s', (amount, error) => {
        expect(validateParams({ ...base, amount }).amount).toBe(error);
    });

    it('accepts the bounds 1 and 100', () => {
        expect(validateParams({ ...base, amount: 1 })).toEqual({});
        expect(validateParams({ ...base, amount: 100 })).toEqual({});
    });
});

describe('relevantSettings', () => {
    it('choice difficulty only matters for multi-language choices', () => {
        expect(relevantSettings({ type: 'Text-Input', multiLang: 'Random' }, null).mcDifficulty).toBe(false);
        expect(relevantSettings({ type: 'Multiple-Choice', multiLang: 'Single-Language' }, null).mcDifficulty).toBe(false);
        expect(relevantSettings({ type: 'Multiple-Choice', multiLang: 'Multi-Language' }, null).mcDifficulty).toBe(true);
        expect(relevantSettings({ type: 'Random', multiLang: 'Random' }, null).mcDifficulty).toBe(true);
    });

    it('typing strictness is hidden for choice-only sessions', () => {
        expect(relevantSettings({ type: 'Multiple-Choice', multiLang: 'Random' }, null).tiStrictness).toBe(false);
        expect(relevantSettings({ type: 'Text-Input', multiLang: 'Random' }, null).tiStrictness).toBe(true);
        expect(relevantSettings({ type: 'Random', multiLang: 'Random' }, null).tiStrictness).toBe(true);
    });

    it('the native-language switch needs a native language and a same-language mode', () => {
        expect(relevantSettings({ type: 'Text-Input', multiLang: 'Random' }, 'Spanish').nativeLanguage).toBe(true);
        expect(relevantSettings({ type: 'Text-Input', multiLang: 'Single-Language' }, 'Spanish').nativeLanguage).toBe(true);
        expect(relevantSettings({ type: 'Text-Input', multiLang: 'Multi-Language' }, 'Spanish').nativeLanguage).toBe(false);
        expect(relevantSettings({ type: 'Text-Input', multiLang: 'Random' }, null).nativeLanguage).toBe(false);
    });
});

describe('onlyPartsWithoutExercises', () => {
    it('is true only when every chosen type has no exercises', () => {
        expect(onlyPartsWithoutExercises([PartOfSpeech.adjective, PartOfSpeech.adverb])).toBe(true);
        expect(onlyPartsWithoutExercises([PartOfSpeech.adjective, PartOfSpeech.noun])).toBe(false);
        expect(onlyPartsWithoutExercises([])).toBe(false);
    });
});

describe('toGenerateBody', () => {
    it('never sends the typing strictness', () => {
        expect(toGenerateBody({ ...base, strictnessTI: 3 })).not.toHaveProperty('strictnessTI');
    });

    it('adds wordIds only for a real pre-selection', () => {
        expect(toGenerateBody(base)).not.toHaveProperty('wordIds');
        expect(toGenerateBody(base, [])).not.toHaveProperty('wordIds');
        expect(toGenerateBody(base, ['a', 'b']).wordIds).toEqual(['a', 'b']);
    });

    it('copies every server-side setting', () => {
        expect(toGenerateBody({ ...base, excludeNative: true, difficultyMC: 3, wordSelection: 'Random' })).toMatchObject({
            languages: [Lang.EN, Lang.ES],
            partsOfSpeech: [PartOfSpeech.noun, PartOfSpeech.verb],
            amount: 10,
            type: 'Text-Input',
            multiLang: 'Random',
            difficultyMC: 3,
            wordSelection: 'Random',
            excludeNative: true,
        });
    });
});

describe('narrowPartsOfSpeech', () => {
    const { noun, verb, adjective } = PartOfSpeech;

    it('keeps the chosen types that are available', () => {
        expect(narrowPartsOfSpeech([noun, verb], [verb, adjective])).toEqual([verb]);
    });

    it('selects every available type when none of the chosen ones is left', () => {
        expect(narrowPartsOfSpeech([noun], [verb, adjective])).toEqual([verb, adjective]);
    });
});
