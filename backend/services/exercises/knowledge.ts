/**
 * Knowledge math and scores. Spec: .context/plans/phase-5-practice.md §A.8 and §A.9.
 * By design (decision D2a) the /4 window and the double aging stay exactly as in the old app.
 */

import type { CaseStat, Modifier, RawExercise, TranslationPerformance } from './types';

export const RECORD_LENGTH = 4;
export const REVISE_COUNTER_THRESHOLD = 5;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Forgetting curve: knowledge × e^(−0.01 × whole days since lastDate). */
export function calculateAging(knowledge: number, lastDate: Date, now: Date = new Date()): number {
    const days = Math.floor((now.getTime() - lastDate.getTime()) / MS_PER_DAY);
    return knowledge * Math.exp(-0.01 * days);
}

/**
 * New knowledge after an answer. `record` already contains the new answer.
 * The window is always divided by 4, so one correct answer is 25 %.
 */
export function calculateNewPercentageOfKnowledge(previous: number, record: boolean[]): number {
    if (record.length === 0) return previous;
    const window = (record.filter(Boolean).length / RECORD_LENGTH) * 100;
    if (previous > 0) return (0.5 * previous + 3.5 * window) / 4;
    return window;
}

/** Push one answer onto a case stat (or create it). Returns a new object. */
export function applyAnswer(
    existing: CaseStat | undefined,
    caseName: string,
    correct: boolean,
    now: Date = new Date(),
): CaseStat {
    const record = [...(existing?.record ?? []), correct].slice(-RECORD_LENGTH);
    return {
        caseName,
        record,
        knowledge: calculateNewPercentageOfKnowledge(existing?.knowledge || 0, record),
        lastDate: now,
    };
}

/** Mean of the aged knowledge of all cases (cases without a date count as 0, but still in the divisor). */
export function translationAverage(cases: CaseStat[], now: Date = new Date()): number {
    if (cases.length === 0) return 0;
    let sum = 0;
    for (const c of cases) {
        if (c.lastDate) sum += calculateAging(c.knowledge || 0, c.lastDate, now);
    }
    return sum / cases.length;
}

/** Revise counter rule: a correct answer while `Revise` adds 1; at 5 the modifier clears. */
export function nextReviseState(
    modifier: string | null,
    reviseCounter: number | null | undefined,
    correct: boolean,
): { performanceModifier: string | null; reviseCounter: number } {
    let counter = reviseCounter || 0;
    let performanceModifier = modifier;
    if (correct && modifier === 'Revise') {
        counter += 1;
        if (counter >= REVISE_COUNTER_THRESHOLD) {
            performanceModifier = null;
            counter = 0;
        }
    }
    return { performanceModifier, reviseCounter: counter };
}

/** `savePerformanceAction`: no action clears the modifier. The counter always resets. */
export function modifierForAction(action: 'master' | 'forget' | undefined): {
    performanceModifier: Modifier | null;
    reviseCounter: number;
} {
    if (action === undefined) return { performanceModifier: null, reviseCounter: 0 };
    return { performanceModifier: action === 'master' ? 'Mastered' : 'Revise', reviseCounter: 0 };
}

function agedTranslationKnowledge(perf: TranslationPerformance, now: Date): number {
    if (!perf.lastDateModifiedTranslation) return 0;
    return calculateAging(perf.averageTranslationKnowledge || 0, perf.lastDateModifiedTranslation, now);
}

/**
 * Word score (lower = weaker = shown first). Mean over the performances whose language
 * is in the user's profile languages: Mastered → 100, Revise → 0, else aged average. No rows → 0.
 */
export function wordScore(
    performances: TranslationPerformance[],
    userLanguages: string[],
    now: Date = new Date(),
): number {
    const valid = performances.filter(
        (p) => p.translationLanguage !== null && userLanguages.includes(p.translationLanguage),
    );
    if (valid.length === 0) return 0;
    let sum = 0;
    for (const perf of valid) {
        if (perf.performanceModifier === 'Mastered') sum += 100;
        else if (perf.performanceModifier === 'Revise') sum += 0;
        else sum += agedTranslationKnowledge(perf, now);
    }
    return sum / valid.length;
}

/** Score of one exercise, taken on the answer side (itemB translation + case). */
export function exerciseScore(
    exercise: RawExercise,
    performances: TranslationPerformance[],
    now: Date = new Date(),
): { knowledge: number; performance?: TranslationPerformance } {
    const itemB = exercise.matchingTranslations.itemB;
    const performance = itemB.translationId
        ? performances.find((p) => p.translationId === itemB.translationId)
        : undefined;
    if (!performance) return { knowledge: 0 };
    if (performance.performanceModifier === 'Mastered') return { knowledge: 100, performance };
    if (performance.performanceModifier === 'Revise') return { knowledge: 0, performance };
    const stat = performance.statsByCase.find((s) => s.caseName === itemB.case);
    if (stat && stat.lastDate) {
        return { knowledge: calculateAging(stat.knowledge || 0, stat.lastDate, now), performance };
    }
    return { knowledge: 0, performance };
}
