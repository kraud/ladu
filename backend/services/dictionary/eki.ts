/**
 * Estonian adapters over api.sonapi.ee (a community wrapper of EKI's Ekilex data, CC BY 4.0).
 * The response transforms are ported from the frontend (features/autocomplete/transforms.ts,
 * originally the old app's `sanitizeDataStructureEE*`), with the same code → case mapping.
 *
 * An unreachable service, a non-OK answer, a non-JSON body or a timeout is an HttpError 502:
 * the form then shows the lookup as failed, not as "no such word".
 */

import type { DictionaryAdapter, LookupCase, LookupResult } from './types';
const { NOT_FOUND, toCases }: typeof import('./types') = require('./types');
const { HttpError }: typeof import('../../lib/httpError') = require('../../lib/httpError');

const TIMEOUT_MS = 5_000;
/**
 * A public URL, not a secret, so it has a default. `URL_EESTI_LANG_API` overrides it: the
 * deploy secrets set it, and the e2e run points it at a local stub (e2e/fixtures/eki-stub).
 * Do not set it in the local repo-root .env: that file overrides what Playwright passes.
 */
const DEFAULT_URL = 'https://api.sonapi.ee/v2';

interface WordForm { code: string; value: string }
export interface SonapiResponse {
    searchResult?: {
        wordClasses?: string[];
        wordForms?: WordForm[];
        meanings?: { partOfSpeech?: { code: string }[] }[];
    }[];
}

/** Read at call time, so tests and the e2e stub can point it elsewhere. */
async function search(query: string, searchInEnglish: boolean | undefined): Promise<SonapiResponse> {
    const base = process.env.URL_EESTI_LANG_API || DEFAULT_URL;
    const url = `${base}/${encodeURIComponent(query)}${searchInEnglish ? '?lg=en' : ''}`;
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!response.ok) throw new Error(`answered ${response.status}`);
        return (await response.json()) as SonapiResponse;
    } catch (error) {
        console.error('Estonian dictionary lookup failed:', error);
        throw new HttpError(502, 'Estonian dictionary lookup failed');
    }
}

function formOf(forms: WordForm[], code: string): string {
    return forms.find((form) => form.code === code)?.value ?? '';
}

const DECLENSION: [code: string, suffix: string][] = [
    ['PlN', 'pluralNimetavEE'],
    ['SgG', 'singularOmastavEE'],
    ['PlG', 'pluralOmastavEE'],
    ['SgP', 'singularOsastavEE'],
    ['PlP', 'pluralOsastavEE'],
];

function found(cases: LookupCase[]): LookupResult {
    return { status: 'found', cases };
}

export function transformNoun(response: SonapiResponse): LookupResult {
    const result = response.searchResult?.[0];
    if (!result || result.wordClasses?.[0] !== 'noomen') return NOT_FOUND;
    const forms = result.wordForms ?? [];
    return found(toCases([
        ['singularNimetavEE', formOf(forms, 'SgN')],
        ...DECLENSION.map(([code, caseName]): [string, string] => [caseName, formOf(forms, code)]),
        // The short form is the first comma-separated entry of "SgAdt" (old app convention).
        ['shortFormEE', formOf(forms, 'SgAdt').split(',')[0]],
    ]));
}

export function transformAdjective(response: SonapiResponse): LookupResult {
    const result = response.searchResult?.[0];
    if (!result || result.meanings?.[0]?.partOfSpeech?.[0]?.code !== 'adj') return NOT_FOUND;
    const forms = result.wordForms ?? [];
    return found(toCases([
        ['algvorreEE', formOf(forms, 'SgN')],
        ...DECLENSION.map(([code, caseName]): [string, string] => [caseName, formOf(forms, code)]),
    ]));
}

const PERSONS: [code: string, slot: string][] = [
    ['Sg1', '1s'], ['Sg2', '2s'], ['Sg3', '3s'], ['Pl1', '1pl'], ['Pl2', '2pl'], ['Pl3', '3pl'],
];

export function transformVerb(response: SonapiResponse): LookupResult {
    const result = response.searchResult?.[0];
    if (!result || result.wordClasses?.[0] !== 'verb') return NOT_FOUND;
    const forms = result.wordForms ?? [];
    return found(toCases([
        ['infinitiveMaEE', formOf(forms, 'Sup')],
        ['infinitiveDaEE', formOf(forms, 'Inf')],
        ...PERSONS.map(([code, slot]): [string, string] => [`kindelPresent${slot}EE`, formOf(forms, `IndPr${code}`)]),
        ...PERSONS.map(([code, slot]): [string, string] => [`kindelSimplePast${slot}EE`, formOf(forms, `IndIpf${code}`)]),
        // Past perfect: the same participle for all six persons (the form shows the auxiliary). Old app behaviour.
        ...PERSONS.map(([, slot]): [string, string] => [`kindelPastPerfect${slot}EE`, formOf(forms, 'PtsPtPs')]),
    ]));
}

export const estonianNoun: DictionaryAdapter = async (query) => transformNoun(await search(query, false));
export const estonianAdjective: DictionaryAdapter = async (query) => transformAdjective(await search(query, false));
export const estonianVerb: DictionaryAdapter = async (query, options) => transformVerb(await search(query, options.searchInEnglish));
