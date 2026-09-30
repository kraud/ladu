/**
 * Practice wire types + the parameter model. Mirrors `POST /api/exercises/*`
 * (phase-5-practice.md §B.3). Enum strings are the old app's, on purpose.
 */
import type { Lang, PartOfSpeech } from '@/ts/enums';

export type CardType = 'Multiple-Choice' | 'Text-Input';
export type CardTypeParam = CardType | 'Random';
export type LanguageMode = 'Multi-Language' | 'Single-Language' | 'Random';
export type WordSelection = 'Exercise-Performance' | 'Random';
export type Modifier = 'Mastered' | 'Revise';

/** What the client sends after checking an answer itself (C1). `partial` counts as correct. */
export type AnswerResult = 'correct' | 'partial' | 'wrong';

/** 0–3, see the slider texts in `practice.json`. */
export type DifficultyMC = 0 | 1 | 2 | 3;
/** 1–3. Frontend only: the server never sees it. */
export type StrictnessTI = 1 | 2 | 3;

/** Everything the parameters screen configures. */
export interface PracticeParams {
    /** `Lang` labels ("English", …), in the user's chosen order. */
    languages: Lang[];
    partsOfSpeech: PartOfSpeech[];
    amount: number;
    type: CardTypeParam;
    multiLang: LanguageMode;
    difficultyMC: DifficultyMC;
    strictnessTI: StrictnessTI;
    wordSelection: WordSelection;
    excludeNative: boolean;
}

/** Body of `POST /api/exercises/generate`. `strictnessTI` stays on the client. */
export interface GenerateBody {
    languages: Lang[];
    partsOfSpeech: PartOfSpeech[];
    amount: number;
    type: CardTypeParam;
    multiLang: LanguageMode;
    difficultyMC: DifficultyMC;
    wordSelection: WordSelection;
    excludeNative: boolean;
    /** Only when the user came from Review with words selected. */
    wordIds?: string[];
}

export interface ExerciseSide {
    language: Lang;
    caseName: string;
    value: string;
}

export interface CaseStat {
    caseName: string;
    /** Last up to 4 answers, oldest first. */
    record: boolean[];
    /** 0–100 */
    knowledge: number;
    /** ISO date */
    lastDate: string;
}

export interface PerformanceSummary {
    translationId: string;
    modifier: Modifier | null;
    /** Correct answers since `Revise` was set; the modifier clears at 5. */
    reviseCounter: number;
    cases: CaseStat[];
}

export interface Exercise {
    /** Stable client key. */
    key: string;
    type: CardType;
    multiLang: boolean;
    partOfSpeech: PartOfSpeech;
    wordId: string;
    /** The answer-side translation: performance is stored against it. */
    translationId: string;
    prompt: ExerciseSide;
    answer: ExerciseSide;
    /** Multiple-Choice only. Answer included, no duplicates. */
    options?: string[];
    performance: PerformanceSummary | null;
}

export interface GenerateResponse {
    exercises: Exercise[];
}

export interface SaveAnswerBody {
    translationId: string;
    caseName: string;
    result: AnswerResult;
}

export interface SetModifierBody {
    modifier: Modifier | null;
}

/** A saved configuration as `GET /api/practice/configs` sends it (phase-5-5-saved-practice.md §5). */
export interface SavedConfig {
    id: string;
    name: string;
    description: string | null;
    /** Stored settings. They are checked again on load (`configToParams`), never trusted. */
    params: PracticeParams;
    /** The pre-selected words, or `null` when the configuration has none. */
    wordIds: string[] | null;
    /** Saved words the user can no longer see. */
    missingCount: number;
    createdAt: string;
    updatedAt: string;
}

/** Body of `POST` / `PUT /api/practice/configs`. `PUT` replaces every field. */
export interface SaveConfigBody {
    name: string;
    description: string | null;
    params: PracticeParams;
    wordIds: string[] | null;
}
