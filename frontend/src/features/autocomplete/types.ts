/**
 * Wire contract of `GET /api/dictionary/:language/:partOfSpeech/:query` (backend
 * `services/dictionary/`), plus the shape everything downstream (`hooks.ts`,
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
