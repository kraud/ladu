/**
 * Picks which exercises go into a session. Spec: .context/plans/phase-5-practice.md §A.9.
 */

import { addDistractors } from './distractors';
import { generateExercisesForWord } from './generate';
import { exerciseScore, wordScore } from './knowledge';
import { shuffle } from './rng';
import type { ExerciseParams, ExerciseWord, RawExercise, Rng, ScoredExercise } from './types';

export interface WordExercises {
    word: ExerciseWord;
    exercises: RawExercise[];
    score: number;
}

const sameExerciseIdentity = (a: RawExercise, b: RawExercise): boolean =>
    a.partOfSpeech === b.partOfSpeech &&
    a.type === b.type &&
    a.multiLang === b.multiLang &&
    a.matchingTranslations.itemA.case === b.matchingTranslations.itemA.case &&
    a.matchingTranslations.itemB.case === b.matchingTranslations.itemB.case;

/** One round: each word gives its weakest exercise (random one in Random mode) and drops that identity. */
function pickOnePerWord(
    entries: WordExercises[],
    random: boolean,
    rng: Rng,
    now: Date,
): ScoredExercise[] {
    const picked: ScoredExercise[] = [];
    for (const entry of entries) {
        if (entry.exercises.length === 0) continue;
        const scored: ScoredExercise[] = entry.exercises.map((exercise) => ({
            ...exercise,
            ...exerciseScore(exercise, entry.word.performances, now),
            wordId: entry.word.id,
        }));
        if (random) shuffle(scored, rng);
        else scored.sort((a, b) => a.knowledge - b.knowledge);
        const chosen = scored[0];
        entry.exercises = entry.exercises.filter((e) => !sameExerciseIdentity(e, chosen));
        picked.push(chosen);
    }
    return picked;
}

/** Take `amount` exercises from the words, one per word per round. */
export function pickExercises(
    entries: WordExercises[],
    amount: number,
    random: boolean,
    rng: Rng,
    now: Date,
): ScoredExercise[] {
    // Work on copies: rounds remove exercises from the entries.
    let pool = entries.map((e) => ({ ...e, exercises: [...e.exercises] }));

    if (amount <= pool.length) {
        if (random) shuffle(pool, rng);
        return pickOnePerWord(pool.slice(0, amount), random, rng, now);
    }

    const selected: ScoredExercise[] = [];
    while (selected.length < amount) {
        if (random) shuffle(pool, rng);
        const round = pickOnePerWord(pool, random, rng, now);
        selected.push(...round.slice(0, amount - selected.length));
        pool = pool.filter((e) => e.exercises.length > 0);
        if (pool.length === 0) break;
    }
    return selected;
}

/**
 * The whole pipeline: generate → rank words → pick → add MC distractors.
 * `words` is the candidate pool (already filtered by part of speech and visibility).
 */
export function buildExerciseSet(
    words: ExerciseWord[],
    params: ExerciseParams,
    userLanguages: string[],
    rng: Rng,
    now: Date = new Date(),
): ScoredExercise[] {
    const random = params.wordSelection === 'Random';

    const entries: WordExercises[] = [];
    for (const word of words) {
        const exercises = generateExercisesForWord(word, params, rng);
        if (exercises.length === 0) continue;
        entries.push({ word, exercises, score: random ? 0 : wordScore(word.performances, userLanguages, now) });
    }
    if (!random) entries.sort((a, b) => a.score - b.score);

    const picked = pickExercises(entries, params.amount, random, rng, now);

    const needsDistractors =
        (params.type === 'Multiple-Choice' || params.type === 'Random') && params.multiLang !== 'Single-Language';
    if (!needsDistractors) return picked;
    return addDistractors(picked, words, params.difficultyMC, rng);
}
