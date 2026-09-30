/**
 * Request validation and summary for saved practice sessions (pure, no Express, no DB).
 * Spec: .context/plans/phase-5-5-saved-practice.md §3–§5.
 *
 * The client sends its whole session as `snapshot` (resume must show the same
 * exercises). The server checks the parts it depends on — the shape, the counts and
 * the values the summary reads — and the size. It never uses a client-written summary:
 * `summarizeSnapshot` builds it. Nothing in a snapshot changes other data: performance
 * rows are only written through `/exercises/answers`.
 */

import { ANSWER_RESULTS, LANGUAGES, MAX_AMOUNT, PARTS_OF_SPEECH, type Validation } from './validate';

/** Saved sessions per user. A new one over the limit deletes the oldest. */
export const MAX_SAVED_SESSIONS = 10;
/** Days a saved session lives; every update starts the period again. */
export const SESSION_TTL_DAYS = 7;
/** Largest accepted snapshot (JSON bytes). 100 exercises with a pre-selection are far below it. */
export const MAX_SNAPSHOT_BYTES = 1_000_000;

const CARD_TYPES = ['Multiple-Choice', 'Text-Input'] as const;

export interface SessionSummary {
    /** Exercises with an answer. */
    answered: number;
    /** Answered exercises that are correct or partial. */
    correct: number;
    total: number;
    /** Languages that appear in the exercises, the settings' order first. */
    languages: string[];
    partsOfSpeech: string[];
    cardTypes: string[];
}

export interface SessionRequest {
    snapshot: Record<string, unknown>;
    summary: SessionSummary;
}

const fail = (code: string, message: string): { ok: false; code: string; message: string } => ({
    ok: false,
    code,
    message,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isOneOf = (value: unknown, allowed: readonly string[]): value is string =>
    typeof value === 'string' && allowed.includes(value);

const unique = <T>(values: T[]): T[] => [...new Set(values)];

export function validateSessionRequest(body: unknown): Validation<SessionRequest> {
    if (!isPlainObject(body)) return fail('invalid_body', 'Request body must be an object.');
    const { snapshot } = body;
    if (!isPlainObject(snapshot)) return fail('invalid_snapshot', 'snapshot must be an object.');

    if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > MAX_SNAPSHOT_BYTES) {
        return fail('snapshot_too_large', 'The session is too large to save.');
    }

    const { exercises, answers, current, view } = snapshot;
    if (!Array.isArray(exercises) || exercises.length < 1 || exercises.length > MAX_AMOUNT) {
        return fail('invalid_snapshot', `A session has 1 to ${MAX_AMOUNT} exercises.`);
    }
    const exercisesValid = exercises.every(
        (e) =>
            isPlainObject(e) &&
            isOneOf(e.type, CARD_TYPES) &&
            isOneOf(e.partOfSpeech, PARTS_OF_SPEECH) &&
            isPlainObject(e.prompt) &&
            isOneOf(e.prompt.language, LANGUAGES) &&
            isPlainObject(e.answer) &&
            isOneOf(e.answer.language, LANGUAGES),
    );
    if (!exercisesValid) return fail('invalid_snapshot', 'An exercise of the session is not valid.');

    if (!Array.isArray(answers) || answers.length !== exercises.length) {
        return fail('invalid_snapshot', 'answers must have one entry for each exercise.');
    }
    if (!answers.every((a) => a === null || (isPlainObject(a) && isOneOf(a.result, ANSWER_RESULTS)))) {
        return fail('invalid_snapshot', 'An answer of the session is not valid.');
    }

    if (typeof current !== 'number' || !Number.isInteger(current) || current < 0 || current >= exercises.length) {
        return fail('invalid_snapshot', 'current must point at an exercise.');
    }
    if (view !== 'exercises' && view !== 'results') return fail('invalid_snapshot', 'view is not valid.');
    if (!isPlainObject(snapshot.params)) return fail('invalid_snapshot', 'params must be an object.');

    return { ok: true, value: { snapshot, summary: summarizeSnapshot(snapshot) } };
}

/** The summary of a snapshot that passed `validateSessionRequest`. */
export function summarizeSnapshot(snapshot: Record<string, unknown>): SessionSummary {
    const exercises = snapshot.exercises as Array<Record<string, any>>;
    const answers = snapshot.answers as Array<Record<string, unknown> | null>;
    const params = snapshot.params as Record<string, unknown>;

    const used = new Set(exercises.flatMap((e) => [e.prompt.language as string, e.answer.language as string]));
    const settingsOrder = Array.isArray(params.languages)
        ? params.languages.filter((l): l is string => typeof l === 'string' && used.has(l))
        : [];
    const languages = unique([...settingsOrder, ...used]);

    const given = answers.filter((a): a is Record<string, unknown> => a !== null);
    return {
        answered: given.length,
        correct: given.filter((a) => a.result !== 'wrong').length,
        total: exercises.length,
        languages,
        partsOfSpeech: unique(exercises.map((e) => e.partOfSpeech as string)),
        cardTypes: unique(exercises.map((e) => e.type as string)),
    };
}
