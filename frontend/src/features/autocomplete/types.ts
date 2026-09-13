/**
 * Wire contracts for the 8 `autocompleteTranslationController` endpoints, plus
 * the one normalized shape everything downstream (the registry in
 * `transforms.ts`, `hooks.ts`, `AutocompleteRow`) actually consumes.
 *
 * `AutocompleteResult` is intentionally endpoint-agnostic: whichever raw shape
 * a lookup responds with, a `transforms.ts` function reduces it to
 * `{ status, cases }` before anything else touches it.
 */
import type { CaseName } from '@/features/words/form-engine/configs/types';

export type AutocompleteStatus = 'found' | 'partial' | 'not-found';

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

/** One `{caseName, word}` slot, verbatim from a non-Estonian endpoint's `verbData`/`nounData.cases`. */
export interface LookupCase {
    caseName: string;
    word: string;
}

/**
 * The shared envelope every EN/ES/DE lookup responds with (English/Spanish/
 * German verbs, German noun, Spanish noun-gender): a `found<Type>` flag, an
 * optional `<type>Data` payload, and — Spanish noun only — `possibleMatch`
 * alongside `nounData` even when `foundNoun` is `false` (a guessed gender for
 * a word `isWord` doesn't recognise).
 */
export interface GenericLookupResponse {
    foundVerb?: boolean;
    foundNoun?: boolean;
    possibleMatch?: boolean;
    verbData?: { language: string; cases: LookupCase[] };
    nounData?: { language: string; cases: LookupCase[] };
}

/** One `wordForms` slot from the Estonian dictionary API (`Sõnaveeb`). */
export interface EstonianWordForm {
    code: string;
    value: string;
}

/** One `searchResult` entry from the Estonian dictionary API — shape is the same across the verb/noun/adjective endpoints, only the fields we read differ. */
export interface EstonianSearchResult {
    wordClasses?: string[];
    wordForms: EstonianWordForm[];
    meanings?: { partOfSpeech?: { code: string }[] }[];
}

/** Raw passthrough response from all three `estonian/*` endpoints. */
export interface EstonianLookupResponse {
    searchResult?: EstonianSearchResult[];
}
