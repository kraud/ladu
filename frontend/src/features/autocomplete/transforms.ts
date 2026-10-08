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
import type { CaseName } from '@/features/words/form-engine/configs/types';
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
    /** RHF field name of a sibling boolean field that toggles English-language search (Estonian verb only). */
    extraFieldName?: string;
}

export const AUTOCOMPLETE_REGISTRY: Partial<Record<Lang, Partial<Record<PartOfSpeech, AutocompleteEndpoint>>>> = {
    [Lang.EN]: {
        // English has no stored infinitive case — `simplePresent1s` doubles as the query (D#: see Outcome).
        [PartOfSpeech.verb]: { queryFieldName: 'simplePresent1s' },
    },
    [Lang.ES]: {
        [PartOfSpeech.verb]: { queryFieldName: 'infinitiveNonFiniteSimple' },
        [PartOfSpeech.noun]: { queryFieldName: 'singular' },
    },
    [Lang.DE]: {
        [PartOfSpeech.verb]: { queryFieldName: 'infinitive' },
        [PartOfSpeech.noun]: { queryFieldName: 'singularNominativ' },
    },
    [Lang.EE]: {
        [PartOfSpeech.verb]: { queryFieldName: 'infinitiveMa', extraFieldName: 'searchInEnglish' },
        // No `searchInEnglish` checkbox exists on the noun/adjective configs (only the verb config has
        // one, added in Slice 2 for its pattern-relaxation feature) — these two always search natively.
        [PartOfSpeech.noun]: { queryFieldName: 'singularNimetav' },
        [PartOfSpeech.adjective]: { queryFieldName: 'algvorre' },
    },
};

export function getAutocompleteEndpoint(language: Lang, pos: PartOfSpeech): AutocompleteEndpoint | undefined {
    return AUTOCOMPLETE_REGISTRY[language]?.[pos];
}
