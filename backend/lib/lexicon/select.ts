/**
 * Selector engine: picks the value of each app case field from one Wiktextract (kaikki)
 * entry. Plan: .context/plans/autocomplete-data-source-strategy.md §5.1 and Slice 0.
 *
 * A case field is filled in one of two ways:
 * - a FORM selector finds a row in `entry.forms[]` by its tags ("the form whose tags
 *   include indicative, present, first-person, singular");
 * - a PROPERTY selector reads something that is not a form (gender, auxiliary verb,
 *   regularity, separable prefix) with a small named function.
 *
 * The per-language tables (selectors/<lang>.ts) are data. This file holds the only logic.
 */

/** The parts of a kaikki entry the selectors read (the shape written by scripts/lexicon/extract.ts). */
export interface LexiconEntry {
    word: string;
    pos: string;
    tags?: string[];
    forms?: { form: string; tags?: string[] }[];
    senses?: { tags?: string[]; form_of?: string[]; gloss?: string }[];
}

export interface FormSelector {
    kind: 'form';
    caseName: string;
    /** Every tag must be on the form row. */
    tags: string[];
    /** Tried when no row matches `tags` (English "walked | past" when no per-person row exists). */
    fallbackTags?: string[];
    /** None of these may be on the form row (added to EXCLUDED_TAGS). */
    excludeTags?: string[];
    /** Among the matching rows, the first row that also has all these tags wins. */
    preferTags?: string[];
    /** Among equal candidates, take the longest: German "sichere" over "sichre" and "sicher". */
    preferLongest?: boolean;
    /** Remove this many leading words: the auxiliary in "habe getanzt" → "getanzt". */
    dropLeadingWords?: number;
    /** Remove these whole words anywhere: reflexive pronouns, "uns sputen" → "sputen" (decision D8). */
    removeWords?: string[];
    /** Use the entry's own word when no row matches (the lemma is this case). */
    fallbackToLemma?: boolean;
}

export interface PropertySelector {
    kind: 'property';
    caseName: string;
    extract: (entry: LexiconEntry) => string | undefined;
}

export type CaseSelector = FormSelector | PropertySelector;

/**
 * Rows with these tags are never used: table metadata (`table-tags`, `inflection-template`,
 * `class`) and forms a learner should not get as the default (strategy doc §5.1 Caveat A).
 * `informal` and `formal` are NOT here: in Spanish they separate two app cases.
 */
export const EXCLUDED_TAGS = [
    'table-tags', 'inflection-template', 'class',
    'archaic', 'obsolete', 'dated', 'rare', 'poetic', 'nonstandard', 'misspelling',
    'dialectal', 'regional', 'colloquial', 'alternative', 'diminutive',
];

export function selectForm(entry: LexiconEntry, selector: FormSelector): string | undefined {
    const excluded = [...EXCLUDED_TAGS, ...(selector.excludeTags ?? [])];
    const rowsWith = (required: string[]) => (entry.forms ?? []).filter((row) => {
        const tags = row.tags ?? [];
        return row.form && row.form !== '-'
            && required.every((tag) => tags.includes(tag))
            && !excluded.some((tag) => tags.includes(tag));
    });
    let matches = rowsWith(selector.tags);
    if (matches.length === 0 && selector.fallbackTags) matches = rowsWith(selector.fallbackTags);

    const preferred = selector.preferTags
        ? matches.filter((row) => selector.preferTags!.every((tag) => row.tags?.includes(tag)))
        : [];
    const candidates = preferred.length > 0 ? preferred : matches;
    const row = selector.preferLongest
        ? candidates.reduce<typeof candidates[number] | undefined>((best, r) => (!best || r.form.length > best.form.length ? r : best), undefined)
        : candidates[0];
    if (!row) return selector.fallbackToLemma ? entry.word : undefined;

    const words = row.form
        .split(' ')
        .slice(selector.dropLeadingWords ?? 0)
        .filter((word) => !selector.removeWords?.includes(word));
    return words.length > 0 ? words.join(' ') : undefined;
}

/** Applies every selector. A case with no value is left out of the result. */
export function selectCases(entry: LexiconEntry, selectors: CaseSelector[]): Map<string, string> {
    const cases = new Map<string, string>();
    for (const selector of selectors) {
        const value = selector.kind === 'form' ? selectForm(entry, selector) : selector.extract(entry);
        if (value) cases.set(selector.caseName, value);
    }
    return cases;
}

/** All tags of all senses, in sense order (gender, regularity and similar live here). */
export function senseTags(entry: LexiconEntry): string[] {
    return [...(entry.tags ?? []), ...(entry.senses ?? []).flatMap((sense) => sense.tags ?? [])];
}
