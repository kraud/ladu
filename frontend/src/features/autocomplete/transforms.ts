/**
 * Raw endpoint response -> `AutocompleteResult`, plus the registry that maps
 * a `(language, pos)` pair to the RHF field its query comes from and the
 * lookup to run.
 *
 * Only 4 transforms exist, not 8: `getVerbEN`/`getVerbES`/`getVerbDE`/
 * `getNounDE`/`getNounGenderES` all share one wire shape (`GenericLookupResponse`
 * — a `found<Type>` flag plus an optional `<type>Data.cases` array), verified
 * directly against `autocompleteTranslationController.ts` rather than assumed
 * from the old frontend. Only the three Estonian endpoints — a raw dictionary-
 * API passthrough with no such envelope — need a bespoke transform each,
 * ported from the old repo's `autocompleteFormFunctions.ts` (`sanitizeDataStructureEENoun`
 * / `EEAdjective` / `EEVerb`). That old file's fourth sanitizer,
 * `sanitizeDataStructureESVerb`, assumed a deeply-nested `verbData.indicative...`
 * shape that the current backend's `getVerbES` does not produce — it already
 * returns the same flat `{caseName, word}[]` shape as every other non-Estonian
 * endpoint, so it needs no bespoke transform, just the generic one.
 */
import { getAdjectiveEE, getNounDE, getNounEE, getNounGenderES, getVerbDE, getVerbEE, getVerbEN, getVerbES } from './api';
import type {
    AutocompleteResult,
    EstonianSearchResult,
    EstonianWordForm,
    GenericLookupResponse,
    LookupCase,
} from './types';
import type { CaseName } from '@/features/words/form-engine/configs/types';
import { AdjectiveCases, Lang, NounCases, PartOfSpeech, VerbCases } from '@/ts/enums';

function casesFromLookup(cases: LookupCase[]): Map<CaseName, string> {
    const result = new Map<CaseName, string>();
    for (const { caseName, word } of cases) {
        if (word !== '') result.set(caseName as CaseName, word);
    }
    return result;
}

/** Shared by every EN/ES/DE endpoint (see file header). Exported for direct unit testing. */
export function transformGenericLookup(
    response: GenericLookupResponse,
    foundKey: 'foundVerb' | 'foundNoun',
    dataKey: 'verbData' | 'nounData'
): AutocompleteResult {
    const data = response[dataKey];
    if (response[foundKey]) {
        return { status: 'found', cases: data ? casesFromLookup(data.cases) : new Map() };
    }
    if (data) {
        // Spanish noun-gender only: `possibleMatch` alongside a guessed `nounData` even when not found.
        return { status: 'partial', cases: casesFromLookup(data.cases) };
    }
    return { status: 'not-found', cases: new Map() };
}

// ---------------------------------------------------------------------------
// Estonian — bespoke transforms, ported from the old repo's sanitizers
// ---------------------------------------------------------------------------

function eeWordForm(wordForms: EstonianWordForm[], code: string): string {
    return wordForms.find((form) => form.code === code)?.value ?? '';
}

function setEeCase(target: Map<CaseName, string>, wordForms: EstonianWordForm[], code: string, caseName: CaseName): void {
    const word = eeWordForm(wordForms, code);
    if (word !== '') target.set(caseName, word);
}

function firstResult(response: { searchResult?: EstonianSearchResult[] }): EstonianSearchResult | undefined {
    return response.searchResult?.[0];
}

export function transformEENoun(response: { searchResult?: EstonianSearchResult[] }): AutocompleteResult {
    const result = firstResult(response);
    if (!result || result.wordClasses?.[0] !== 'noomen') return { status: 'not-found', cases: new Map() };

    const cases = new Map<CaseName, string>();
    setEeCase(cases, result.wordForms, 'SgN', NounCases.singularNimetavEE);
    setEeCase(cases, result.wordForms, 'PlN', NounCases.pluralNimetavEE);
    setEeCase(cases, result.wordForms, 'SgG', NounCases.singularOmastavEE);
    setEeCase(cases, result.wordForms, 'PlG', NounCases.pluralOmastavEE);
    setEeCase(cases, result.wordForms, 'SgP', NounCases.singularOsastavEE);
    setEeCase(cases, result.wordForms, 'PlP', NounCases.pluralOsastavEE);
    // The short form is the first comma-separated entry of "SgAdt" (the old sanitizer's own convention).
    const shortForm = eeWordForm(result.wordForms, 'SgAdt').split(',')[0];
    if (shortForm !== '') cases.set(NounCases.shortFormEE, shortForm);

    return { status: 'found', cases };
}

export function transformEEAdjective(response: { searchResult?: EstonianSearchResult[] }): AutocompleteResult {
    const result = firstResult(response);
    if (!result || result.meanings?.[0]?.partOfSpeech?.[0]?.code !== 'adj') return { status: 'not-found', cases: new Map() };

    const cases = new Map<CaseName, string>();
    setEeCase(cases, result.wordForms, 'SgN', AdjectiveCases.algvorreEE);
    setEeCase(cases, result.wordForms, 'PlN', AdjectiveCases.pluralNimetavEE);
    setEeCase(cases, result.wordForms, 'SgG', AdjectiveCases.singularOmastavEE);
    setEeCase(cases, result.wordForms, 'PlG', AdjectiveCases.pluralOmastavEE);
    setEeCase(cases, result.wordForms, 'SgP', AdjectiveCases.singularOsastavEE);
    setEeCase(cases, result.wordForms, 'PlP', AdjectiveCases.pluralOsastavEE);

    return { status: 'found', cases };
}

export function transformEEVerb(response: { searchResult?: EstonianSearchResult[] }): AutocompleteResult {
    const result = firstResult(response);
    if (!result || result.wordClasses?.[0] !== 'verb') return { status: 'not-found', cases: new Map() };

    const cases = new Map<CaseName, string>();
    const w = result.wordForms;
    setEeCase(cases, w, 'Sup', VerbCases.infinitiveMaEE);
    setEeCase(cases, w, 'Inf', VerbCases.infinitiveDaEE);
    setEeCase(cases, w, 'IndPrSg1', VerbCases.kindelPresent1sEE);
    setEeCase(cases, w, 'IndPrSg2', VerbCases.kindelPresent2sEE);
    setEeCase(cases, w, 'IndPrSg3', VerbCases.kindelPresent3sEE);
    setEeCase(cases, w, 'IndPrPl1', VerbCases.kindelPresent1plEE);
    setEeCase(cases, w, 'IndPrPl2', VerbCases.kindelPresent2plEE);
    setEeCase(cases, w, 'IndPrPl3', VerbCases.kindelPresent3plEE);
    setEeCase(cases, w, 'IndIpfSg1', VerbCases.kindelSimplePast1sEE);
    setEeCase(cases, w, 'IndIpfSg2', VerbCases.kindelSimplePast2sEE);
    setEeCase(cases, w, 'IndIpfSg3', VerbCases.kindelSimplePast3sEE);
    setEeCase(cases, w, 'IndIpfPl1', VerbCases.kindelSimplePast1plEE);
    setEeCase(cases, w, 'IndIpfPl2', VerbCases.kindelSimplePast2plEE);
    setEeCase(cases, w, 'IndIpfPl3', VerbCases.kindelSimplePast3plEE);
    // Past perfect: the same auxiliary+participle form for all six pronoun slots — verbatim old-app behaviour.
    setEeCase(cases, w, 'PtsPtPs', VerbCases.kindelPastPerfect1sEE);
    setEeCase(cases, w, 'PtsPtPs', VerbCases.kindelPastPerfect2sEE);
    setEeCase(cases, w, 'PtsPtPs', VerbCases.kindelPastPerfect3sEE);
    setEeCase(cases, w, 'PtsPtPs', VerbCases.kindelPastPerfect1plEE);
    setEeCase(cases, w, 'PtsPtPs', VerbCases.kindelPastPerfect2plEE);
    setEeCase(cases, w, 'PtsPtPs', VerbCases.kindelPastPerfect3plEE);

    return { status: 'found', cases };
}

// ---------------------------------------------------------------------------
// Registry — the only place that knows which (language, PoS) pairs have a
// lookup endpoint at all, and which RHF field name feeds its query.
// ---------------------------------------------------------------------------

export interface AutocompleteEndpoint {
    /** RHF field name (not `caseName` — the Estonian `searchInEnglish` checkbox this depends on for one entry has no `caseName` at all) whose current value is the lookup query. */
    queryFieldName: string;
    /** RHF field name of a sibling boolean field that toggles English-language search (Estonian only). */
    extraFieldName?: string;
    fetch: (query: string, extra?: boolean) => Promise<AutocompleteResult>;
}

export const AUTOCOMPLETE_REGISTRY: Partial<Record<Lang, Partial<Record<PartOfSpeech, AutocompleteEndpoint>>>> = {
    [Lang.EN]: {
        // English has no stored infinitive case — `simplePresent1s` doubles as the query (D#: see Outcome).
        [PartOfSpeech.verb]: {
            queryFieldName: 'simplePresent1s',
            fetch: (query) => getVerbEN(query).then((r) => transformGenericLookup(r, 'foundVerb', 'verbData')),
        },
    },
    [Lang.ES]: {
        [PartOfSpeech.verb]: {
            queryFieldName: 'infinitiveNonFiniteSimple',
            fetch: (query) => getVerbES(query).then((r) => transformGenericLookup(r, 'foundVerb', 'verbData')),
        },
        [PartOfSpeech.noun]: {
            queryFieldName: 'singular',
            fetch: (query) => getNounGenderES(query).then((r) => transformGenericLookup(r, 'foundNoun', 'nounData')),
        },
    },
    [Lang.DE]: {
        [PartOfSpeech.verb]: {
            queryFieldName: 'infinitive',
            fetch: (query) => getVerbDE(query).then((r) => transformGenericLookup(r, 'foundVerb', 'verbData')),
        },
        [PartOfSpeech.noun]: {
            queryFieldName: 'singularNominativ',
            fetch: (query) => getNounDE(query).then((r) => transformGenericLookup(r, 'foundNoun', 'nounData')),
        },
    },
    [Lang.EE]: {
        [PartOfSpeech.verb]: {
            queryFieldName: 'infinitiveMa',
            extraFieldName: 'searchInEnglish',
            fetch: (query, extra) => getVerbEE(query, extra).then(transformEEVerb),
        },
        // No `searchInEnglish` checkbox exists on the noun/adjective configs (only the verb config has
        // one, added in Slice 2 for its pattern-relaxation feature) — these two always search natively.
        [PartOfSpeech.noun]: {
            queryFieldName: 'singularNimetav',
            fetch: (query) => getNounEE(query).then(transformEENoun),
        },
        [PartOfSpeech.adjective]: {
            queryFieldName: 'algvorre',
            fetch: (query) => getAdjectiveEE(query).then(transformEEAdjective),
        },
    },
};

export function getAutocompleteEndpoint(language: Lang, pos: PartOfSpeech): AutocompleteEndpoint | undefined {
    return AUTOCOMPLETE_REGISTRY[language]?.[pos];
}
