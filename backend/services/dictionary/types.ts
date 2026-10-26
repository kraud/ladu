/**
 * The one response shape of GET /api/dictionary/:language/:partOfSpeech/:query
 * (autocomplete-data-source-strategy.md, Slice A). Every adapter returns it.
 *
 * - found: a real dictionary entry.
 * - partial: a guess from a rule-based library, after a lexicon miss (decision D2);
 *   the form shows the "not fully sure" notice.
 * - not-found: nothing to fill.
 */
export type LookupStatus = 'found' | 'partial' | 'not-found';

export interface LookupCase {
    caseName: string;
    word: string;
}

export interface LookupResult {
    status: LookupStatus;
    /** Only cases with a non-empty word. */
    cases: LookupCase[];
}

export interface LookupOptions {
    /** A type-ahead pick (Slice E): the `lexemes` row to return, instead of the D15 choice. */
    entryId?: string;
    /**
     * A translation's noun gender (Slice G draft): der / die / das, el / la. Among the lexicon rows of
     * a homograph ("See", "mano"), the row with this article wins; with no match the usual choice stays.
     */
    gender?: string;
}

/** One data source for one (language, part of speech) pair. */
export type DictionaryAdapter = (query: string, options: LookupOptions) => Promise<LookupResult>;

export const NOT_FOUND: LookupResult = { status: 'not-found', cases: [] };

/** Drops empty and placeholder ("-") words, so `cases` holds only what can fill a field. */
export function toCases(entries: [caseName: string, word: string | undefined | null][]): LookupCase[] {
    return entries
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '' && entry[1] !== '-')
        .map(([caseName, word]) => ({ caseName, word }));
}
