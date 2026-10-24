/**
 * Wire contract of `GET /api/dictionary/:language/:partOfSpeech/:query` and of the type-ahead
 * list `GET /api/dictionary/:language/:partOfSpeech?prefix=` (backend `services/dictionary/`), plus the shape everything downstream (`hooks.ts`,
 * `AutocompleteRow`) consumes.
 */
import type { CaseName } from '@/features/words/form-engine/configs/types';

/** found: a dictionary entry. partial: a guess, shown with the "not fully sure" notice. */
export type AutocompleteStatus = 'found' | 'partial' | 'not-found';

/** One `{caseName, word}` slot, verbatim from the response. */
export interface LookupCase {
    caseName: string;
    word: string;
}

/** The one response shape for every language and part of speech. */
export interface DictionaryResponse {
    status: AutocompleteStatus;
    cases: LookupCase[];
}

/** One item of the type-ahead list (Slice E). `hint` tells homographs apart: the noun's article. */
export interface Suggestion {
    entryId: string;
    lemma: string;
    hint?: string;
}

/** `GET /api/dictionary/:language/:partOfSpeech?prefix=`. */
export interface SuggestionsResponse {
    suggestions: Suggestion[];
}

export interface AutocompleteResult {
    status: AutocompleteStatus;
    /**
     * Only case names the lookup actually returned a non-empty word for. A
     * `Map`, not a `Partial<Record<CaseName, string>>` — `CaseName` unions
     * four separate enums that share string values across each other (e.g.
     * both `NounCases.regularityEN` and `VerbCases.regularityEN` are
     * `"regularityEN"`), which breaks a `Record`'s indexing under `tsc`
     * (`element implicitly has an 'any' type`). `TranslationCard.tsx`'s own
     * `casesToFieldValues` hits the same shape and already uses a `Map` for
     * exactly this reason.
     */
    cases: Map<CaseName, string>;
}

// --- Slice G: start from a word (autocomplete-slice-g-one-term-to-word.md) ---

/** Which sense of an English entry (the `key` of a sense suggestion). */
export interface SenseKey {
    englishLemma: string;
    entryOrder: number;
    senseOrder: number;
}

/** One line of the sense type-ahead (G1): a word of the start language, in one of its senses. */
export interface SenseSuggestion {
    word: string;
    partOfSpeech: string;
    /** Nouns: der / die / das, el / la. */
    gender?: string;
    /** The English word whose entry holds the sense (the word itself when the start is English). */
    english: string;
    /** Wiktionary's label for the sense; may be empty. */
    sense: string;
    key: SenseKey;
    /** The languages the sense has a word in (English always: it is the hub). */
    languages: string[];
}

export interface SenseSuggestionsResponse {
    suggestions: SenseSuggestion[];
}

export interface TranslationWord {
    word: string;
    gender?: string;
}

/** `GET /api/dictionary/translate/sense/:partOfSpeech` (G2). A language not asked has no key. */
export interface SenseResponse {
    sense: { english: string; sense: string; words: Partial<Record<string, TranslationWord[]>> };
    /** Only when Estonian was asked and the sense has none. */
    ekilex?: { estonian: TranslationWord[] } | { unavailable: true };
}

export interface DraftPick {
    language: string;
    word: string;
    gender?: string;
}

/** `POST /api/dictionary/draft` (G3): one entry per pick, in order. */
export interface DraftTranslation {
    language: string;
    word: string;
    gender?: string;
    status: AutocompleteStatus | 'error';
    cases: LookupCase[];
}

/** What the start section hands to the page: the part of speech and the looked-up words. */
export interface WordDraft {
    partOfSpeech: string;
    translations: DraftTranslation[];
}
