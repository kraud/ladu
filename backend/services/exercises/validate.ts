/**
 * Request validation for the exercise API (pure, no Express, no DB).
 * Spec: .context/plans/phase-5-practice.md §B.3 "Rules → Validation".
 * Every failure has a stable `code` the client can switch on.
 */

import type { CardTypeParam, LanguageMode, Modifier, WordSelection } from './types';

export const LANGUAGES = ['English', 'Spanish', 'German', 'Estonian'] as const;
export const PARTS_OF_SPEECH = ['Noun', 'Verb', 'Adjective', 'Adverb'] as const;
export const CARD_TYPE_PARAMS: CardTypeParam[] = ['Multiple-Choice', 'Text-Input', 'Random'];
export const LANGUAGE_MODES: LanguageMode[] = ['Multi-Language', 'Single-Language', 'Random'];
export const WORD_SELECTIONS: WordSelection[] = ['Exercise-Performance', 'Random'];
export const ANSWER_RESULTS = ['correct', 'partial', 'wrong'] as const;
export type AnswerResult = (typeof ANSWER_RESULTS)[number];

export const MIN_AMOUNT = 1;
export const MAX_AMOUNT = 100;
export const MAX_WORD_IDS = 500;
export const DEFAULT_DIFFICULTY_MC = 1;

export type Validation<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

const fail = (code: string, message: string): { ok: false; code: string; message: string } => ({
    ok: false,
    code,
    message,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** Non-empty array of distinct strings that all belong to `allowed`. */
function pickSet<T extends string>(value: unknown, allowed: readonly T[]): T[] | null {
    if (!Array.isArray(value) || value.length === 0) return null;
    if (!value.every((v) => typeof v === 'string' && (allowed as readonly string[]).includes(v))) return null;
    return [...new Set(value as T[])];
}

export interface GenerateRequest {
    languages: string[];
    partsOfSpeech: string[];
    amount: number;
    type: CardTypeParam;
    multiLang: LanguageMode;
    difficultyMC: number;
    wordSelection: WordSelection;
    excludeNative: boolean;
    /** Present only when the client pre-selected words. */
    wordIds?: string[];
}

export function validateGenerateRequest(body: unknown): Validation<GenerateRequest> {
    if (!isPlainObject(body)) return fail('invalid_body', 'Request body must be an object.');

    const languages = pickSet(body.languages, LANGUAGES);
    if (!languages) return fail('invalid_languages', 'Select at least one supported language.');

    const partsOfSpeech = pickSet(body.partsOfSpeech, PARTS_OF_SPEECH);
    if (!partsOfSpeech) return fail('invalid_parts_of_speech', 'Select at least one part of speech.');

    const { amount } = body;
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
        return fail('invalid_amount', `Amount must be a whole number from ${MIN_AMOUNT} to ${MAX_AMOUNT}.`);
    }

    if (!CARD_TYPE_PARAMS.includes(body.type as CardTypeParam)) return fail('invalid_type', 'Unknown card type.');
    if (!LANGUAGE_MODES.includes(body.multiLang as LanguageMode)) {
        return fail('invalid_language_mode', 'Unknown language mode.');
    }
    const multiLang = body.multiLang as LanguageMode;
    if (multiLang === 'Multi-Language' && languages.length < 2) {
        return fail('invalid_languages', 'Multi-Language exercises need at least two languages.');
    }

    let difficultyMC = DEFAULT_DIFFICULTY_MC;
    if (body.difficultyMC !== undefined) {
        const d = body.difficultyMC;
        if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 3) {
            return fail('invalid_difficulty', 'Multiple-choice difficulty must be 0, 1, 2 or 3.');
        }
        difficultyMC = d;
    }

    const wordSelection = (body.wordSelection ?? 'Exercise-Performance') as WordSelection;
    if (!WORD_SELECTIONS.includes(wordSelection)) return fail('invalid_word_selection', 'Unknown word selection.');

    if (body.excludeNative !== undefined && typeof body.excludeNative !== 'boolean') {
        return fail('invalid_exclude_native', 'excludeNative must be true or false.');
    }

    let wordIds: string[] | undefined;
    if (body.wordIds !== undefined) {
        const ids = body.wordIds;
        if (!Array.isArray(ids) || ids.length > MAX_WORD_IDS || !ids.every(isUuid)) {
            return fail('invalid_word_ids', `wordIds must be a list of at most ${MAX_WORD_IDS} valid ids.`);
        }
        // An empty list means "no pre-selection" (whole vocabulary).
        if (ids.length > 0) wordIds = [...new Set(ids as string[])];
    }

    return {
        ok: true,
        value: {
            languages,
            partsOfSpeech,
            amount,
            type: body.type as CardTypeParam,
            multiLang,
            difficultyMC,
            wordSelection,
            excludeNative: body.excludeNative === true,
            wordIds,
        },
    };
}

export interface AnswerRequest {
    translationId: string;
    caseName: string;
    result: AnswerResult;
}

export function validateAnswerRequest(body: unknown): Validation<AnswerRequest> {
    if (!isPlainObject(body)) return fail('invalid_body', 'Request body must be an object.');
    if (!isUuid(body.translationId)) return fail('invalid_translation_id', 'translationId must be a valid id.');
    if (typeof body.caseName !== 'string' || body.caseName.length === 0 || body.caseName.length > 100) {
        return fail('invalid_case_name', 'caseName is required.');
    }
    if (!(ANSWER_RESULTS as readonly unknown[]).includes(body.result)) {
        return fail('invalid_result', 'result must be correct, partial or wrong.');
    }
    return {
        ok: true,
        value: { translationId: body.translationId, caseName: body.caseName, result: body.result as AnswerResult },
    };
}

/** Partial counts as correct for the score and is stored as `record: true` (A.7). */
export const resultToRecord = (result: AnswerResult): boolean => result !== 'wrong';

export function validateModifierRequest(body: unknown): Validation<{ modifier: Modifier | null }> {
    if (!isPlainObject(body)) return fail('invalid_body', 'Request body must be an object.');
    const { modifier } = body;
    if (modifier !== null && modifier !== 'Mastered' && modifier !== 'Revise') {
        return fail('invalid_modifier', 'modifier must be Mastered, Revise or null.');
    }
    return { ok: true, value: { modifier } };
}
