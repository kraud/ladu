/**
 * Shared types for the pure exercise domain module.
 *
 * Nothing in `services/exercises/` reads the database or the clock directly:
 * callers pass in data, an `Rng` and (where time matters) a `now`.
 * Spec: .context/plans/phase-5-practice.md Part A.
 */

export type Language = 'English' | 'Spanish' | 'German' | 'Estonian';
export type PartOfSpeech = 'Noun' | 'Verb' | 'Adjective' | 'Adverb';
export type CardType = 'Multiple-Choice' | 'Text-Input';
export type CardTypeParam = CardType | 'Random';
export type LanguageMode = 'Multi-Language' | 'Single-Language' | 'Random';
export type WordSelection = 'Exercise-Performance' | 'Random';
export type Modifier = 'Mastered' | 'Revise';

/** Returns a number in [0, 1), like Math.random. */
export type Rng = () => number;

export interface CaseValue {
    caseName: string;
    word: string;
}

export interface WordTranslation {
    id: string;
    language: string;
    cases: CaseValue[];
}

export interface CaseStat {
    caseName: string;
    record: boolean[];
    knowledge: number | null;
    lastDate: Date | null;
}

export interface TranslationPerformance {
    translationId: string | null;
    translationLanguage: string | null;
    performanceModifier: string | null;
    reviseCounter?: number | null;
    averageTranslationKnowledge: number | null;
    lastDateModifiedTranslation: Date | null;
    statsByCase: CaseStat[];
}

/** One word with everything the generator needs. */
export interface ExerciseWord {
    id: string;
    partOfSpeech: string;
    translations: WordTranslation[];
    performances: TranslationPerformance[];
}

export interface ExerciseItem {
    language: string;
    case: string;
    value: string;
    translationId?: string;
    otherValues?: string[];
}

/** An exercise before scoring. */
export interface RawExercise {
    partOfSpeech: string;
    type: CardType;
    multiLang: boolean;
    matchingTranslations: {
        itemA: ExerciseItem;
        itemB: ExerciseItem;
    };
}

/** An exercise after selection: carries the answer-side knowledge and performance. */
export interface ScoredExercise extends RawExercise {
    knowledge: number;
    performance?: TranslationPerformance;
    wordId: string;
}

export interface ExerciseParams {
    languages: string[];
    type: CardTypeParam;
    multiLang: LanguageMode;
    amount: number;
    wordSelection: WordSelection;
    difficultyMC?: number;
    nativeLanguage?: string;
}
