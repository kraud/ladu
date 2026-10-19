/**
 * Builds every candidate exercise for one word. Spec: .context/plans/phase-5-practice.md §A.5.
 * No scoring and no distractors here (see select.ts and distractors.ts).
 */

import { MULTI_LANGUAGE, SINGLE_LANGUAGE } from './catalogue';
import { shuffle } from './rng';
import type {
    CardType, CardTypeParam, ExerciseItem, ExerciseWord, Language, LanguageMode,
    ExerciseHint, PartOfSpeech, RawExercise, Rng,
} from './types';

/**
 * The native-language form shown as a hint: the value of `caseName` in the user's native translation.
 * When that exact case is missing, the base form (`baseCase`) stands in and the hint is marked `approximate`.
 */
function nativeHint(
    word: ExerciseWord,
    hintLanguage: string | undefined,
    caseName: string | undefined,
    baseCase: string | undefined,
): ExerciseHint | undefined {
    if (!hintLanguage) return undefined;
    const cases = word.translations.find((t) => t.language === hintLanguage)?.cases ?? [];
    const valueOf = (name: string | undefined) => {
        const value = name ? cases.find((c) => c.caseName === name)?.word : undefined;
        return value?.trim() ? value : undefined;
    };
    const exact = valueOf(caseName);
    if (exact) return { language: hintLanguage, value: exact };
    const base = valueOf(baseCase);
    return base ? { language: hintLanguage, value: base, approximate: true } : undefined;
}

/** For a drill (one language): the native form of the word's first slot (singular nominative, 1st person singular present). */
function headwordCase(word: ExerciseWord, hintLanguage: string): string | undefined {
    const catalogue = MULTI_LANGUAGE[word.partOfSpeech as PartOfSpeech];
    const firstGroup = catalogue && Object.values(catalogue)[0];
    const firstSlot = firstGroup && Object.values(firstGroup)[0];
    return firstSlot?.[hintLanguage as Language];
}

const CARD_TYPES: CardType[] = ['Multiple-Choice', 'Text-Input'];

export function uniqueLanguagePairs(languages: string[]): Array<[string, string]> {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < languages.length; i++) {
        for (let j = i + 1; j < languages.length; j++) pairs.push([languages[i], languages[j]]);
    }
    return pairs;
}

function multiLanguageExercises(
    validLanguages: string[],
    word: ExerciseWord,
    type: CardTypeParam,
    rng: Rng,
    hintLanguage?: string,
): RawExercise[] {
    const catalogue = MULTI_LANGUAGE[word.partOfSpeech as PartOfSpeech];
    if (!catalogue) return [];
    const pairs = uniqueLanguagePairs(validLanguages);
    const out: RawExercise[] = [];

    for (const slots of Object.values(catalogue)) {
        for (const byLanguage of Object.values(slots)) {
            for (const [langA, langB] of pairs) {
                const caseA = byLanguage[langA as Language];
                const caseB = byLanguage[langB as Language];
                if (!caseA || !caseB) continue;
                const transA = word.translations.find((t) => t.language === langA);
                const transB = word.translations.find((t) => t.language === langB);
                const valueA = transA?.cases.find((c) => c.caseName === caseA);
                const valueB = transB?.cases.find((c) => c.caseName === caseB);
                if (!valueA || !valueB) continue;

                const resolved: CardType =
                    type === 'Random' ? (rng() < 0.5 ? 'Multiple-Choice' : 'Text-Input') : type;
                const itemA: ExerciseItem = { language: langA, case: caseA, value: valueA.word };
                const itemB: ExerciseItem = { language: langB, case: caseB, value: valueB.word, translationId: transB?.id };
                if (resolved === 'Multiple-Choice') itemB.otherValues = [];
                const hint = hintLanguage === langA || hintLanguage === langB
                    ? undefined
                    : nativeHint(word, hintLanguage, byLanguage[hintLanguage as Language], hintLanguage && headwordCase(word, hintLanguage));
                out.push({ partOfSpeech: word.partOfSpeech, type: resolved, multiLang: true, matchingTranslations: { itemA, itemB }, ...(hint && { hint }) });
            }
        }
    }
    return out;
}

function singleLanguageExercises(
    validLanguages: string[],
    word: ExerciseWord,
    type: CardTypeParam,
    nativeLanguage: string,
    hintLanguage?: string,
): RawExercise[] {
    const catalogue = SINGLE_LANGUAGE[word.partOfSpeech as PartOfSpeech];
    if (!catalogue) return [];
    const out: RawExercise[] = [];

    for (const language of validLanguages.filter((l) => l !== nativeLanguage)) {
        const drillsByType = catalogue[language as Language];
        if (!drillsByType) continue;
        const translation = word.translations.find((t) => t.language === language);
        const types = type === 'Random' ? CARD_TYPES : [type];

        for (const cardType of types) {
            for (const drill of drillsByType[cardType] ?? []) {
                const question = translation?.cases.find((c) => c.caseName === drill.questionWord);
                const correct = translation?.cases.find((c) => c.caseName === drill.correctValue);
                if (!question || !correct) continue;
                const itemB: ExerciseItem = { language, case: drill.correctValue, value: correct.word, translationId: translation?.id };
                if (cardType === 'Multiple-Choice') itemB.otherValues = drill.otherValues ?? [];
                const hint = hintLanguage === language
                    ? undefined
                    : nativeHint(word, hintLanguage, hintLanguage && headwordCase(word, hintLanguage), undefined);
                out.push({
                    partOfSpeech: word.partOfSpeech,
                    type: cardType,
                    multiLang: false,
                    matchingTranslations: { itemA: { language, case: drill.questionWord, value: question.word }, itemB },
                    ...(hint && { hint }),
                });
            }
        }
    }
    return out;
}

/**
 * All exercises one word can give. Languages are shuffled first, so the direction
 * (which language is the prompt) is random per word.
 */
export function generateExercisesForWord(
    word: ExerciseWord,
    opts: { languages: string[]; type: CardTypeParam; multiLang: LanguageMode; nativeLanguage?: string; hintLanguage?: string },
    rng: Rng,
): RawExercise[] {
    const available = word.translations.map((t) => t.language);
    const valid = shuffle([...opts.languages], rng).filter((l) => available.includes(l));
    const native = opts.nativeLanguage || '';

    switch (opts.multiLang) {
        case 'Multi-Language':
            return multiLanguageExercises(valid, word, opts.type, rng, opts.hintLanguage);
        case 'Single-Language':
            return singleLanguageExercises(valid, word, opts.type, native, opts.hintLanguage);
        case 'Random':
            return [
                ...multiLanguageExercises(valid, word, opts.type, rng, opts.hintLanguage),
                ...singleLanguageExercises(valid, word, opts.type, native, opts.hintLanguage),
            ];
        default:
            return [];
    }
}
