import { describe, expect, it } from 'vitest';
import { makeExercise } from '@/test/msw/practiceHandlers';
import { defaultParams } from './params';
import {
    allAnswered,
    answerCaseStat,
    createSession,
    hasSaveInProgress,
    isLastExercise,
    sessionReducer,
    sessionScore,
    shortfall,
    unsavedIndexes,
    type Session,
    type SessionAction,
} from './session';
import type { PerformanceSummary } from './types';

const params = { ...defaultParams(['English', 'Spanish']), amount: 3 };

const exercises = [
    makeExercise({ key: 'a', wordId: 'w1', translationId: 't1' }),
    makeExercise({ key: 'b', wordId: 'w2', translationId: 't2' }),
    makeExercise({ key: 'c', wordId: 'w3', translationId: 't1' }), // same translation as `a`
];

const fresh = (overrides: Partial<Parameters<typeof createSession>[0]> = {}): Session =>
    createSession({ userId: 'u1', params, wordIds: null, exercises, ...overrides });

const run = (session: Session, ...actions: SessionAction[]) => actions.reduce(sessionReducer, session);

const answer = (index: number, result: 'correct' | 'partial' | 'wrong' = 'correct', given = 'x'): SessionAction => ({
    type: 'answer', index, result, given,
});

const performance = (translationId: string, lastDate: string, extra: Partial<PerformanceSummary> = {}): PerformanceSummary => ({
    translationId,
    modifier: null,
    reviseCounter: 0,
    cases: [{ caseName: 'singularES', record: [true], knowledge: 25, lastDate }],
    ...extra,
});

describe('createSession', () => {
    it('starts at the first card with nothing answered', () => {
        const s = fresh();
        expect(s).toMatchObject({ userId: 'u1', current: 0, view: 'exercises', returnToResults: false, requested: 3 });
        expect(s.answers).toEqual([null, null, null]);
        expect(s.wordIds).toBeNull();
    });

    it('keeps a real pre-selection and treats an empty one as none', () => {
        expect(fresh({ wordIds: ['w1', 'w2'] }).wordIds).toEqual(['w1', 'w2']);
        expect(fresh({ wordIds: [] }).wordIds).toBeNull();
    });
});

describe('answer', () => {
    it('stores the result and the given text, and marks the save as running', () => {
        const s = run(fresh(), answer(0, 'partial', 'Casa'));
        expect(s.answers[0]).toEqual({ result: 'partial', given: 'Casa', saveStatus: 'saving' });
        expect(hasSaveInProgress(s)).toBe(true);
    });

    it('allows one try only', () => {
        const s = run(fresh(), answer(0, 'wrong', 'first'), answer(0, 'correct', 'second'));
        expect(s.answers[0]).toMatchObject({ result: 'wrong', given: 'first' });
    });

    it('ignores an index that does not exist', () => {
        const s = fresh();
        expect(run(s, answer(9))).toBe(s);
        expect(run(s, answer(-1))).toBe(s);
        expect(run(s, answer(1.5))).toBe(s);
    });

    it('does not mutate the previous state', () => {
        const s = fresh();
        run(s, answer(0));
        expect(s.answers[0]).toBeNull();
    });
});

describe('saving', () => {
    it('saveSucceeded marks saved and copies the performance to every card of that translation', () => {
        const perf = performance('t1', '2026-09-29T10:00:00.000Z');
        const s = run(fresh(), answer(0), { type: 'saveSucceeded', index: 0, performance: perf });
        expect(s.answers[0]?.saveStatus).toBe('saved');
        expect(s.exercises[0].performance).toEqual(perf);
        expect(s.exercises[2].performance).toEqual(perf); // same translation
        expect(s.exercises[1].performance).toBeNull();
    });

    it('a failed save is kept, flagged and retryable — and never blocks anything', () => {
        let s = run(fresh(), answer(0), { type: 'saveFailed', index: 0 });
        expect(s.answers[0]?.saveStatus).toBe('unsaved');
        expect(unsavedIndexes(s)).toEqual([0]);
        expect(hasSaveInProgress(s)).toBe(false);

        s = run(s, { type: 'goTo', index: 1 }, answer(1), { type: 'saveRetry', index: 0 });
        expect(s.current).toBe(1);
        expect(s.answers[0]?.saveStatus).toBe('saving');
        expect(unsavedIndexes(s)).toEqual([]);
    });

    it('retry only applies to an unsaved answer', () => {
        const s = run(fresh(), answer(0), { type: 'saveSucceeded', index: 0, performance: performance('t1', '2026-09-29T10:00:00.000Z') });
        expect(run(s, { type: 'saveRetry', index: 0 }).answers[0]?.saveStatus).toBe('saved');
    });

    it('ignores save results for an exercise that was never answered', () => {
        const s = fresh();
        expect(run(s, { type: 'saveFailed', index: 1 }).answers[1]).toBeNull();
        expect(run(s, { type: 'saveSucceeded', index: 1, performance: performance('t2', '2026-09-29T10:00:00.000Z') }).answers[1]).toBeNull();
    });

    it('a slow, older response never rolls a card back', () => {
        const newer = performance('t1', '2026-09-29T10:05:00.000Z', { cases: [{ caseName: 'singularES', record: [true, true], knowledge: 47, lastDate: '2026-09-29T10:05:00.000Z' }] });
        const older = performance('t1', '2026-09-29T10:00:00.000Z');
        const s = run(
            fresh(),
            answer(0), answer(2),
            { type: 'saveSucceeded', index: 2, performance: newer },
            { type: 'saveSucceeded', index: 0, performance: older },
        );
        expect(s.exercises[0].performance).toEqual(newer);
        expect(s.answers[0]?.saveStatus).toBe('saved');
    });
});

describe('performanceChanged (Master / Revise)', () => {
    it('shows the new status on every card of the translation', () => {
        const perf = performance('t1', '2026-09-29T10:00:00.000Z', { modifier: 'Mastered' });
        const s = run(fresh(), { type: 'performanceChanged', performance: perf });
        expect(s.exercises[0].performance?.modifier).toBe('Mastered');
        expect(s.exercises[2].performance?.modifier).toBe('Mastered');
        expect(s.exercises[1].performance).toBeNull();
    });

    it('returns the same object when no card uses that translation', () => {
        const s = fresh();
        expect(run(s, { type: 'performanceChanged', performance: performance('other', '2026-09-29T10:00:00.000Z') })).toBe(s);
    });
});

describe('navigation', () => {
    it('goTo moves inside the range only', () => {
        const s = fresh();
        expect(run(s, { type: 'goTo', index: 2 }).current).toBe(2);
        expect(run(s, { type: 'goTo', index: 3 })).toBe(s);
        expect(run(s, { type: 'goTo', index: -1 })).toBe(s);
    });

    it('unanswered cards can be answered in any order', () => {
        const s = run(fresh(), { type: 'goTo', index: 2 }, answer(2), { type: 'goTo', index: 0 }, answer(0));
        expect(s.answers.map((a) => a !== null)).toEqual([true, false, true]);
    });

    it('isLastExercise', () => {
        expect(isLastExercise(fresh())).toBe(false);
        expect(isLastExercise(run(fresh(), { type: 'goTo', index: 2 }))).toBe(true);
    });
});

describe('finish and results', () => {
    const answeredAll = () => run(fresh(), answer(0, 'correct'), answer(1, 'partial'), answer(2, 'wrong'));

    it('results are locked until every exercise is answered', () => {
        const s = run(fresh(), answer(0));
        expect(allAnswered(s)).toBe(false);
        expect(run(s, { type: 'finish' }).view).toBe('exercises');
    });

    it('finish opens the results when all are answered', () => {
        const s = answeredAll();
        expect(allAnswered(s)).toBe(true);
        expect(run(s, { type: 'finish' }).view).toBe('results');
    });

    it('opening a card from the results and going back returns to the results', () => {
        let s = run(answeredAll(), { type: 'finish' }, { type: 'openFromResults', index: 1 });
        expect(s).toMatchObject({ view: 'exercises', current: 1, returnToResults: true });
        s = run(s, { type: 'backToResults' });
        expect(s).toMatchObject({ view: 'results', returnToResults: false });
    });

    it('backToResults does nothing when no card was opened from the results', () => {
        const s = fresh();
        expect(run(s, { type: 'backToResults' })).toBe(s);
    });

    it('openFromResults ignores a bad index', () => {
        const s = run(answeredAll(), { type: 'finish' });
        expect(run(s, { type: 'openFromResults', index: 7 })).toBe(s);
    });

    it('an empty session is never "all answered"', () => {
        expect(allAnswered(fresh({ exercises: [] }))).toBe(false);
    });
});

describe('sessionScore', () => {
    it('counts partial as correct and reports it separately', () => {
        const s = run(fresh(), answer(0, 'correct'), answer(1, 'partial'), answer(2, 'wrong'));
        expect(sessionScore(s)).toEqual({ total: 3, answered: 3, correct: 2, partial: 1, wrong: 1, percent: 67 });
    });

    it('is based on the total, so unanswered cards lower the percentage', () => {
        expect(sessionScore(run(fresh(), answer(0)))).toMatchObject({ answered: 1, correct: 1, percent: 33 });
    });

    it('handles an empty session', () => {
        expect(sessionScore(fresh({ exercises: [] }))).toEqual({ total: 0, answered: 0, correct: 0, partial: 0, wrong: 0, percent: 0 });
    });
});

describe('shortfall', () => {
    it('reports how many fewer exercises than asked were created', () => {
        expect(shortfall(fresh())).toBe(0);
        expect(shortfall(fresh({ params: { ...params, amount: 10 } }))).toBe(7);
        expect(shortfall(fresh({ params: { ...params, amount: 2 } }))).toBe(0);
    });
});

describe('answerCaseStat', () => {
    it('finds the stat of the answer case, and is null for a form never practised', () => {
        const stat = { caseName: 'singularES', record: [true, false], knowledge: 30, lastDate: '2026-09-29T10:00:00.000Z' };
        expect(answerCaseStat(makeExercise({ performance: { translationId: 't', modifier: null, reviseCounter: 0, cases: [stat] } }))).toEqual(stat);
        expect(answerCaseStat(makeExercise({ performance: { translationId: 't', modifier: null, reviseCounter: 0, cases: [{ ...stat, caseName: 'pluralES' }] } }))).toBeNull();
        expect(answerCaseStat(makeExercise())).toBeNull();
    });
});
