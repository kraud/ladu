/**
 * The parameter model: defaults, validation, the request body, and which
 * settings matter for the current choices. Pure — no React, no storage.
 * Spec: phase-5-practice.md §A.3 and Part C §C.3.
 */
import { Lang, PartOfSpeech } from '@/ts/enums';
import type { GenerateBody, PracticeParams } from './types';

export const AMOUNT_MIN = 1;
export const AMOUNT_MAX = 100;
export const DEFAULT_AMOUNT = 10;

/** The only parts of speech that produce exercises today (catalogue parity, D1). */
export const PARTS_OF_SPEECH_WITH_EXERCISES: readonly PartOfSpeech[] = [PartOfSpeech.noun, PartOfSpeech.verb];

/** The four the parameters screen offers. */
export const SELECTABLE_PARTS_OF_SPEECH: readonly PartOfSpeech[] = [
    PartOfSpeech.noun,
    PartOfSpeech.verb,
    PartOfSpeech.adjective,
    PartOfSpeech.adverb,
];

const KNOWN_LANGUAGES = new Set<string>(Object.values(Lang));

/** Keep only supported languages, once each, in the given order. */
export function knownLanguages(labels: readonly string[]): Lang[] {
    return Array.from(new Set(labels.filter((label) => KNOWN_LANGUAGES.has(label)))) as Lang[];
}

/** First-visit settings: every language of the account, Noun + Verb, 10 typed exercises. */
export function defaultParams(userLanguages: readonly string[]): PracticeParams {
    return {
        languages: knownLanguages(userLanguages),
        partsOfSpeech: [PartOfSpeech.noun, PartOfSpeech.verb],
        amount: DEFAULT_AMOUNT,
        type: 'Text-Input',
        multiLang: 'Random',
        difficultyMC: 1,
        strictnessTI: 2,
        wordSelection: 'Exercise-Performance',
        excludeNative: false,
    };
}

export type ParamErrorKey =
    | 'languagesRequired'
    | 'languagesMinTwo'
    | 'partsOfSpeechRequired'
    | 'amountRequired'
    | 'amountInteger'
    | 'amountPositive'
    | 'amountTooLarge';

export type ParamErrors = Partial<Record<'languages' | 'partsOfSpeech' | 'amount', ParamErrorKey>>;

/** Field errors for the current settings. An empty object means Start is allowed. */
export function validateParams(params: Omit<PracticeParams, 'amount'> & { amount: number }): ParamErrors {
    const errors: ParamErrors = {};

    if (params.languages.length === 0) errors.languages = 'languagesRequired';
    else if (params.multiLang === 'Multi-Language' && params.languages.length < 2) errors.languages = 'languagesMinTwo';

    if (params.partsOfSpeech.length === 0) errors.partsOfSpeech = 'partsOfSpeechRequired';

    const { amount } = params;
    if (Number.isNaN(amount)) errors.amount = 'amountRequired';
    else if (!Number.isInteger(amount)) errors.amount = 'amountInteger';
    else if (amount < AMOUNT_MIN) errors.amount = 'amountPositive';
    else if (amount > AMOUNT_MAX) errors.amount = 'amountTooLarge';

    return errors;
}

/** Which advanced settings do anything for these choices (irrelevant ones are hidden or disabled). */
export function relevantSettings(
    params: Pick<PracticeParams, 'type' | 'multiLang'>,
    nativeLanguage: string | null,
): { mcDifficulty: boolean; tiStrictness: boolean; nativeLanguage: boolean } {
    return {
        // Distractor levels only exist for multi-language choices.
        mcDifficulty: params.type !== 'Text-Input' && params.multiLang !== 'Single-Language',
        tiStrictness: params.type !== 'Multiple-Choice',
        // "Different languages" never uses the native-language switch (A.3).
        nativeLanguage: nativeLanguage !== null && params.multiLang !== 'Multi-Language',
    };
}

/** True when no chosen part of speech can give an exercise (only adjectives and/or adverbs). */
export function onlyPartsWithoutExercises(partsOfSpeech: readonly PartOfSpeech[]): boolean {
    return (
        partsOfSpeech.length > 0 &&
        partsOfSpeech.every((pos) => !PARTS_OF_SPEECH_WITH_EXERCISES.includes(pos))
    );
}

/** `strictnessTI` stays on the client; `wordIds` only when the user pre-selected words. */
export function toGenerateBody(params: PracticeParams, wordIds?: readonly string[]): GenerateBody {
    const body: GenerateBody = {
        languages: params.languages,
        partsOfSpeech: params.partsOfSpeech,
        amount: params.amount,
        type: params.type,
        multiLang: params.multiLang,
        difficultyMC: params.difficultyMC,
        wordSelection: params.wordSelection,
        excludeNative: params.excludeNative,
    };
    if (wordIds && wordIds.length > 0) body.wordIds = [...wordIds];
    return body;
}
