/**
 * The running practice session as a pure reducer (C6) — no React, no storage,
 * no network. `sessionStore.ts` persists it; the components dispatch into it.
 * Spec: phase-5-practice.md Part C §C.4–C.5.
 *
 * Rules the reducer enforces:
 *  - One try: an answered exercise ignores a second answer.
 *  - Saving never blocks: a failed save marks the answer `unsaved` (retry
 *    possible) and navigation stays free (defect 9).
 *  - A performance (from a save or a Master/Revise call) is copied to every
 *    exercise of the same translation, so every card shows the same status.
 *  - Results are reachable only when every exercise is answered.
 */
import type { PartOfSpeech } from '@/ts/enums';
import type { PreselectedWord } from './preselection';
import type { AnswerResult, CaseStat, Exercise, PerformanceSummary, PracticeParams } from './types';

export type SaveStatus = 'saving' | 'saved' | 'unsaved';

export interface GivenAnswer {
    result: AnswerResult;
    /** What the user typed or picked (shown on the results row). */
    given: string;
    saveStatus: SaveStatus;
}

export interface Session {
    userId: string;
    params: PracticeParams;
    /** The pre-selected words the session was made from, if any. */
    wordIds: string[] | null;
    /** The same words with their labels, for the results screen; `null` when none were pre-selected. */
    preselected: PreselectedWord[] | null;
    /** The amount asked for; `exercises.length` can be lower (never silent, B.7). */
    requested: number;
    exercises: Exercise[];
    /** Same length and order as `exercises`; `null` = not answered yet. */
    answers: (GivenAnswer | null)[];
    current: number;
    view: 'exercises' | 'results';
    /** A card opened from the results list: "back" returns there. */
    returnToResults: boolean;
}

export type SessionAction =
    | { type: 'answer'; index: number; result: AnswerResult; given: string }
    | { type: 'saveSucceeded'; index: number; performance: PerformanceSummary }
    | { type: 'saveFailed'; index: number }
    | { type: 'saveRetry'; index: number }
    | { type: 'performanceChanged'; performance: PerformanceSummary }
    | { type: 'goTo'; index: number }
    | { type: 'finish' }
    | { type: 'openFromResults'; index: number }
    | { type: 'backToResults' };

export function createSession(input: {
    userId: string;
    params: PracticeParams;
    wordIds: readonly string[] | null;
    preselected?: PreselectedWord[] | null;
    exercises: Exercise[];
}): Session {
    return {
        userId: input.userId,
        params: input.params,
        wordIds: input.wordIds && input.wordIds.length > 0 ? [...input.wordIds] : null,
        preselected: input.preselected && input.preselected.length > 0 ? input.preselected : null,
        requested: input.params.amount,
        exercises: input.exercises,
        answers: input.exercises.map(() => null),
        current: 0,
        view: 'exercises',
        returnToResults: false,
    };
}

const inRange = (session: Session, index: number): boolean =>
    Number.isInteger(index) && index >= 0 && index < session.exercises.length;

/** The newest answer date of a performance, or 0 when it has none. */
function latestDate(performance: PerformanceSummary | null): number {
    if (!performance) return 0;
    return performance.cases.reduce((latest, c) => Math.max(latest, Date.parse(c.lastDate) || 0), 0);
}

/**
 * Copy `performance` to every exercise of its translation. A response that is
 * older than what a card already shows (two saves answered out of order) is
 * ignored, so a slow reply can never roll a card back.
 */
function applyPerformance(session: Session, performance: PerformanceSummary): Session {
    const incoming = latestDate(performance);
    let changed = false;
    const exercises = session.exercises.map((exercise) => {
        if (exercise.translationId !== performance.translationId) return exercise;
        if (latestDate(exercise.performance) > incoming) return exercise;
        changed = true;
        return { ...exercise, performance };
    });
    return changed ? { ...session, exercises } : session;
}

function setAnswer(session: Session, index: number, update: (answer: GivenAnswer) => GivenAnswer): Session {
    const answer = session.answers[index];
    if (!inRange(session, index) || !answer) return session;
    const answers = [...session.answers];
    answers[index] = update(answer);
    return { ...session, answers };
}

export function sessionReducer(session: Session, action: SessionAction): Session {
    switch (action.type) {
        case 'answer': {
            if (!inRange(session, action.index) || session.answers[action.index]) return session;
            const answers = [...session.answers];
            answers[action.index] = { result: action.result, given: action.given, saveStatus: 'saving' };
            return { ...session, answers };
        }
        case 'saveSucceeded':
            return applyPerformance(
                setAnswer(session, action.index, (a) => ({ ...a, saveStatus: 'saved' })),
                action.performance,
            );
        case 'saveFailed':
            return setAnswer(session, action.index, (a) => ({ ...a, saveStatus: 'unsaved' }));
        case 'saveRetry':
            return setAnswer(session, action.index, (a) =>
                a.saveStatus === 'unsaved' ? { ...a, saveStatus: 'saving' } : a,
            );
        case 'performanceChanged':
            return applyPerformance(session, action.performance);
        case 'goTo': {
            if (!inRange(session, action.index)) return session;
            return { ...session, current: action.index };
        }
        case 'finish':
            return allAnswered(session) ? { ...session, view: 'results', returnToResults: false } : session;
        case 'openFromResults': {
            if (!inRange(session, action.index)) return session;
            return { ...session, view: 'exercises', current: action.index, returnToResults: true };
        }
        case 'backToResults':
            return session.returnToResults ? { ...session, view: 'results', returnToResults: false } : session;
    }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const allAnswered = (session: Session): boolean =>
    session.exercises.length > 0 && session.answers.every((a) => a !== null);

export const isLastExercise = (session: Session): boolean => session.current === session.exercises.length - 1;

/** Indexes of answers whose save failed (results screen: "retry all"). */
export const unsavedIndexes = (session: Session): number[] =>
    session.answers.flatMap((a, i) => (a?.saveStatus === 'unsaved' ? [i] : []));

export const hasSaveInProgress = (session: Session): boolean =>
    session.answers.some((a) => a?.saveStatus === 'saving');

export interface Score {
    total: number;
    answered: number;
    /** correct + partial */
    correct: number;
    partial: number;
    wrong: number;
    /** 0–100, whole number, of `total` */
    percent: number;
}

export function sessionScore(session: Session): Score {
    const given = session.answers.filter((a): a is GivenAnswer => a !== null);
    const partial = given.filter((a) => a.result === 'partial').length;
    const wrong = given.filter((a) => a.result === 'wrong').length;
    const correct = given.length - wrong;
    const total = session.exercises.length;
    return {
        total,
        answered: given.length,
        correct,
        partial,
        wrong,
        percent: total === 0 ? 0 : Math.round((correct / total) * 100),
    };
}

/**
 * What the session really covered: the languages that appear in its exercises (the
 * account's order first) and the word types it asked about. The settings may allow
 * more; the results describe what was practised.
 */
export function sessionCoverage(session: Session): { languages: string[]; partsOfSpeech: PartOfSpeech[] } {
    const used = new Set(session.exercises.flatMap((e) => [e.prompt.language, e.answer.language] as string[]));
    const ordered = session.params.languages.filter((language) => used.has(language));
    const extra = [...used].filter((language) => !ordered.includes(language as never));
    return {
        languages: [...ordered, ...extra],
        partsOfSpeech: [...new Set(session.exercises.map((e) => e.partOfSpeech))],
    };
}

/** How many fewer exercises than asked the server could make (0 = none). */
export const shortfall = (session: Session): number => Math.max(0, session.requested - session.exercises.length);

/** The knowledge record of the exercise's answer case, or `null` = never practised ("new"). */
export function answerCaseStat(exercise: Exercise): CaseStat | null {
    return exercise.performance?.cases.find((c) => c.caseName === exercise.answer.caseName) ?? null;
}
