/**
 * Wrong options for multi-language multiple-choice exercises.
 * Spec: .context/plans/phase-5-practice.md §A.6 (levels 0–3). An exercise that finds no
 * distractor is dropped.
 */

import { isPropertyCase } from './catalogue';
import { shuffle } from './rng';
import type { CaseValue, ExerciseWord, RawExercise, Rng, WordTranslation } from './types';

const REQUIRED_DISTRACTORS = 2;

const hasCorrectValue = (cases: CaseValue[], caseName: string, value: string): boolean =>
    cases.some((c) => c.caseName === caseName && c.word === value);

const writtenForms = (translation: WordTranslation): CaseValue[] =>
    translation.cases.filter((c) => !isPropertyCase(c.caseName));

/** Values one candidate word can give for this answer at this difficulty. */
function valuesFromWord(
    difficulty: number,
    candidate: ExerciseWord,
    answer: { case: string; value: string; language: string },
    answerPartOfSpeech: string,
    required: number,
    rng: Rng,
): string[] {
    const translations = shuffle([...candidate.translations], rng);
    const found: string[] = [];
    const sameOrigin = (t: WordTranslation) => hasCorrectValue(t.cases, answer.case, answer.value);
    const oneRandomForm = (t: WordTranslation) => {
        const forms = shuffle(writtenForms(t), rng);
        if (forms.length > 0) found.push(forms[0].word);
    };

    switch (difficulty) {
        case 0: {
            // Any language, from the first translation that is not the answer's own.
            for (const t of translations) {
                if (sameOrigin(t)) continue;
                const forms = writtenForms(t);
                if (forms.length > 0) {
                    found.push(shuffle(forms, rng)[0].word);
                    break;
                }
            }
            break;
        }
        case 1: {
            const t = translations.find((x) => x.language === answer.language);
            if (t && !sameOrigin(t)) oneRandomForm(t);
            break;
        }
        case 2: {
            if (candidate.partOfSpeech !== answerPartOfSpeech) break;
            const t = translations.find((x) => x.language === answer.language);
            if (t && !sameOrigin(t)) oneRandomForm(t);
            break;
        }
        case 3: {
            if (candidate.partOfSpeech !== answerPartOfSpeech) break;
            const t = translations.find((x) => x.language === answer.language);
            if (!t) break;
            const others = shuffle(writtenForms(t).filter((c) => c.word !== answer.value), rng);
            if (answerPartOfSpeech === 'Verb' && sameOrigin(t)) {
                // Verbs: other forms of the same verb.
                others.slice(0, others.length < required ? undefined : required).forEach((c) => found.push(c.word));
            } else if (answerPartOfSpeech !== 'Verb' && !sameOrigin(t) && others.length > 0) {
                found.push(others[0].word);
            }
            break;
        }
    }
    return found;
}

/**
 * Fill `otherValues` on multi-language MC exercises from `pool` (the candidate words).
 * Exercises with no distractor are removed. Other exercises pass through.
 */
export function addDistractors<T extends RawExercise>(
    exercises: T[],
    pool: ExerciseWord[],
    difficulty: number | undefined,
    rng: Rng,
): T[] {
    const level = difficulty !== undefined ? difficulty : 0;
    const out: T[] = [];

    for (const exercise of exercises) {
        if (exercise.type !== 'Multiple-Choice' || !exercise.multiLang) {
            out.push(exercise);
            continue;
        }
        const answer = exercise.matchingTranslations.itemB;
        const options: string[] = [];
        for (const word of shuffle([...pool], rng)) {
            if (REQUIRED_DISTRACTORS <= options.length) break;
            options.push(
                ...valuesFromWord(
                    level, word,
                    { case: answer.case, value: answer.value, language: answer.language },
                    exercise.partOfSpeech, REQUIRED_DISTRACTORS, rng,
                ),
            );
        }
        if (options.length > 0) {
            out.push({
                ...exercise,
                matchingTranslations: {
                    ...exercise.matchingTranslations,
                    itemB: { ...answer, otherValues: options },
                },
            });
        }
    }
    return out;
}
