/**
 * Turns domain objects into the API response shapes (no `_id`, no Mongo legacy).
 * Spec: .context/plans/phase-5-practice.md §B.3 "Response shapes".
 */

import { shuffle } from './rng';
import type { CardType, Modifier, Rng, ScoredExercise, TranslationPerformance } from './types';

export interface PerformanceSummary {
    translationId: string;
    modifier: Modifier | null;
    reviseCounter: number;
    cases: { caseName: string; record: boolean[]; knowledge: number; lastDate: string }[];
}

export interface ExerciseDto {
    key: string;
    type: CardType;
    multiLang: boolean;
    partOfSpeech: string;
    wordId: string;
    translationId: string;
    prompt: { language: string; caseName: string; value: string };
    answer: { language: string; caseName: string; value: string };
    /** Multiple-Choice only. Answer included, no duplicates. */
    options?: string[];
    performance: PerformanceSummary | null;
}

export function toPerformanceSummary(perf: TranslationPerformance): PerformanceSummary {
    return {
        translationId: perf.translationId as string,
        modifier: perf.performanceModifier === 'Mastered' || perf.performanceModifier === 'Revise'
            ? perf.performanceModifier
            : null,
        reviseCounter: perf.reviseCounter || 0,
        cases: perf.statsByCase
            .filter((c) => c.lastDate !== null)
            .map((c) => ({
                caseName: c.caseName,
                record: c.record,
                knowledge: c.knowledge || 0,
                lastDate: (c.lastDate as Date).toISOString(),
            })),
    };
}

/**
 * The answer plus the wrong options, compared without case (the same rule the
 * client uses to check a choice), answer first in the dedupe so it always survives.
 */
export function uniqueOptions(answer: string, others: string[] = []): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const value of [answer, ...others]) {
        const key = value.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(value);
    }
    return out;
}

/**
 * Multi-language choices are shuffled. Single-language choices keep the catalogue
 * order (der/die/das, regular/irregular…), so the user can rely on position.
 */
export function buildOptions(exercise: ScoredExercise, rng: Rng): string[] {
    const answer = exercise.matchingTranslations.itemB;
    const others = answer.otherValues ?? [];
    if (exercise.multiLang) return shuffle(uniqueOptions(answer.value, others), rng);

    const norm = (v: string) => v.trim().toLowerCase();
    const fixedList = others.some((v) => norm(v) === norm(answer.value)) ? others : [answer.value, ...others];
    return uniqueOptions(fixedList[0], fixedList.slice(1));
}

export function toExerciseDto(exercise: ScoredExercise, index: number, rng: Rng): ExerciseDto {
    const { itemA, itemB } = exercise.matchingTranslations;
    const dto: ExerciseDto = {
        key: `${exercise.wordId}:${itemA.language}.${itemA.case}>${itemB.language}.${itemB.case}:${index}`,
        type: exercise.type,
        multiLang: exercise.multiLang,
        partOfSpeech: exercise.partOfSpeech,
        wordId: exercise.wordId,
        translationId: itemB.translationId as string,
        prompt: { language: itemA.language, caseName: itemA.case, value: itemA.value },
        answer: { language: itemB.language, caseName: itemB.case, value: itemB.value },
        performance: exercise.performance ? toPerformanceSummary(exercise.performance) : null,
    };
    if (exercise.type === 'Multiple-Choice') dto.options = buildOptions(exercise, rng);
    return dto;
}
