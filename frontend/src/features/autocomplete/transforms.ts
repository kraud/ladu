/**
 * The dictionary response -> `AutocompleteResult`, plus the registry that says which
 * `(language, pos)` pairs have autocomplete and which RHF field holds the query.
 *
 * Which data source answers a pair is the backend's business (`services/dictionary/registry.ts`);
 * every pair answers the same `{ status, cases }` shape, so one transform covers all of them.
 * The Estonian response transforms moved to the backend in Slice A
 * (`.context/plans/autocomplete-data-source-strategy.md`).
 */
import type { AutocompleteResult, DictionaryResponse } from './types';
import { matchesVisibility, type CaseName, type FieldConfig } from '@/features/words/form-engine/configs/types';
import { Lang, PartOfSpeech } from '@/ts/enums';

export function toAutocompleteResult(response: DictionaryResponse): AutocompleteResult {
    const cases = new Map<CaseName, string>();
    for (const { caseName, word } of response.cases) {
        if (word !== '') cases.set(caseName as CaseName, word);
    }
    return { status: response.status, cases };
}

export interface AutocompleteEndpoint {
    /** RHF field name (not `caseName` — the Estonian `searchInEnglish` checkbox has no `caseName` at all) whose value is the query. */
    queryFieldName: string;
    /**
     * Other fields that can hold the query, when a card shows different fields per branch (the Spanish
     * adjective: `maleSingular` on the M/F branch, `neutralSingular` on the Neutral branch). The query
     * field is the first of `queryFieldName` + these that is visible (`activeQueryField`).
     */
    alternativeQueryFieldNames?: string[];
    /** RHF field name of a sibling boolean field that toggles English-language search (Estonian verb only). */
    extraFieldName?: string;
}

export const AUTOCOMPLETE_REGISTRY: Partial<Record<Lang, Partial<Record<PartOfSpeech, AutocompleteEndpoint>>>> = {
    [Lang.EN]: {
        // Slice H3: adjectives and adverbs come from the lexicon only (no library behind them).
        [PartOfSpeech.adjective]: { queryFieldName: 'positive' },
        [PartOfSpeech.adverb]: { queryFieldName: 'adverb' },
        // English has no stored infinitive case — `simplePresent1s` doubles as the query (D#: see Outcome).
        [PartOfSpeech.verb]: { queryFieldName: 'simplePresent1s' },
        // Slice C2: English nouns from the lexicon (the plural); no library behind them.
        [PartOfSpeech.noun]: { queryFieldName: 'singular' },
    },
    [Lang.ES]: {
        // The Spanish adjective form is split by its gender radio: the lemma goes into the male singular
        // (M/F) or the neutral singular (Neutral), whichever the card shows.
        [PartOfSpeech.adjective]: { queryFieldName: 'maleSingular', alternativeQueryFieldNames: ['neutralSingular'] },
        [PartOfSpeech.adverb]: { queryFieldName: 'adverb' },
        [PartOfSpeech.verb]: { queryFieldName: 'infinitiveNonFiniteSimple' },
        [PartOfSpeech.noun]: { queryFieldName: 'singular' },
    },
    [Lang.DE]: {
        [PartOfSpeech.adjective]: { queryFieldName: 'positive' },
        [PartOfSpeech.adverb]: { queryFieldName: 'adverb' },
        [PartOfSpeech.verb]: { queryFieldName: 'infinitive' },
        [PartOfSpeech.noun]: { queryFieldName: 'singularNominativ' },
    },
    [Lang.EE]: {
        [PartOfSpeech.verb]: { queryFieldName: 'infinitiveMa', extraFieldName: 'searchInEnglish' },
        // No `searchInEnglish` checkbox exists on the noun/adjective configs (only the verb config has
        // one, added in Slice 2 for its pattern-relaxation feature) — these two always search natively.
        [PartOfSpeech.noun]: { queryFieldName: 'singularNimetav' },
        [PartOfSpeech.adjective]: { queryFieldName: 'algvorre' },
        // Slice H4: Ekilex only, like the adjective; no type-ahead list (no local lexicon for it).
        [PartOfSpeech.adverb]: { queryFieldName: 'adverb' },
    },
};

/**
 * The RHF field that holds the query right now: the first of `queryFieldName` and its alternatives
 * that the card currently shows. With none shown (a Spanish adjective before a gender is chosen) it
 * is `queryFieldName`, which then has no input to type in.
 */
export function activeQueryField(endpoint: AutocompleteEndpoint, fields: FieldConfig[], values: Record<string, unknown>): string {
    const names = [endpoint.queryFieldName, ...(endpoint.alternativeQueryFieldNames ?? [])];
    const shown = names.find((name) => {
        const field = fields.find((candidate) => candidate.name === name);
        return field !== undefined && (!field.visibleWhen || matchesVisibility(field.visibleWhen, values[field.visibleWhen.field]));
    });
    return shown ?? endpoint.queryFieldName;
}

export function getAutocompleteEndpoint(language: Lang, pos: PartOfSpeech): AutocompleteEndpoint | undefined {
    return AUTOCOMPLETE_REGISTRY[language]?.[pos];
}
