/**
 * Estonian adapters over the official Ekilex API of the Institute of the Estonian Language (EKI;
 * data CC BY 4.0). Decision D18 in autocomplete-data-source-strategy.md replaced the community
 * wrapper api.sonapi.ee, which serves the same Ekilex data.
 *
 * Lookup (2 calls): `api/word/ids/{word}/eki/est` → word ids → `api/paradigm/details/{id}` →
 * forms, each with a `morphCode` (SgN, PlP, IndPrSg1, …: the codes the old transforms read).
 * "Search in English" (Estonian verb only, 3 calls): `api/meaning/search/{word}` → the Estonian
 * verb (a "-ma" word) found in the most meanings → its paradigm.
 *
 * - Homonyms: the first word id whose paradigm has the wanted word class wins.
 * - Adjectives: Ekilex gives them the word class "noomen" like nouns, so they match by
 *   declension; there is no separate adjective check (D18).
 * - Several forms for one code ("häid", "heasid"): the first listed (D19).
 *
 * An unreachable service, a non-OK answer, a non-JSON body, a timeout or a missing key is an
 * HttpError 502: the form then shows the lookup as failed, not as "no such word".
 */

import type { DictionaryAdapter, LookupCase, LookupResult } from './types';
const { NOT_FOUND, toCases }: typeof import('./types') = require('./types');
const { HttpError }: typeof import('../../lib/httpError') = require('../../lib/httpError');

const TIMEOUT_MS = 5_000;
/**
 * `EKILEX_API_URL` overrides the base URL: the e2e run points it at a local stub
 * (e2e/fixtures/eki-stub). Do not set it in the local repo-root .env, which overrides what
 * Playwright passes. `EKILEX_API_KEY` is the account's API key (a secret).
 */
const DEFAULT_URL = 'https://ekilex.ee';
const MAX_HOMONYMS = 3;

export interface ParadigmForm { morphCode: string; value: string; questionable?: boolean }
export interface Paradigm { wordClass?: string; paradigmForms?: ParadigmForm[] }
interface MeaningSearch { results?: { meaningWords?: { wordValue: string; lang: string }[] }[] }

/** Read at call time, so tests and the e2e stub can point it elsewhere. */
async function get<T>(path: string): Promise<T> {
    const key = process.env.EKILEX_API_KEY;
    if (!key) {
        console.error('Estonian dictionary lookup failed: EKILEX_API_KEY is not set');
        throw new HttpError(502, 'Estonian dictionary is not configured');
    }
    const base = process.env.EKILEX_API_URL || DEFAULT_URL;
    try {
        const response = await fetch(`${base}/${path}`, {
            headers: { 'ekilex-api-key': key },
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) throw new Error(`answered ${response.status}`);
        return (await response.json()) as T;
    } catch (error) {
        console.error('Estonian dictionary lookup failed:', error);
        throw new HttpError(502, 'Estonian dictionary lookup failed');
    }
}

/** The paradigm of the first homonym with the wanted word class, or undefined. */
async function paradigmOf(word: string, wordClass: 'noomen' | 'verb'): Promise<Paradigm | undefined> {
    const ids = await get<number[]>(`api/word/ids/${encodeURIComponent(word)}/eki/est`);
    for (const id of (Array.isArray(ids) ? ids : []).slice(0, MAX_HOMONYMS)) {
        const paradigms = await get<Paradigm[]>(`api/paradigm/details/${id}`);
        const match = (Array.isArray(paradigms) ? paradigms : []).find((p) => p.wordClass === wordClass);
        if (match) return match;
    }
    return undefined;
}

/** First listed form for a code (D19); a form Ekilex marks questionable only if there is no other. */
function formOf(paradigm: Paradigm, code: string): string {
    const forms = (paradigm.paradigmForms ?? []).filter((form) => form.morphCode === code && form.value);
    return (forms.find((form) => !form.questionable) ?? forms[0])?.value ?? '';
}

const DECLENSION: [code: string, caseName: string][] = [
    ['PlN', 'pluralNimetavEE'],
    ['SgG', 'singularOmastavEE'],
    ['PlG', 'pluralOmastavEE'],
    ['SgP', 'singularOsastavEE'],
    ['PlP', 'pluralOsastavEE'],
];

function found(cases: LookupCase[]): LookupResult {
    return cases.length > 0 ? { status: 'found', cases } : NOT_FOUND;
}

export function transformNoun(paradigm: Paradigm | undefined): LookupResult {
    if (!paradigm) return NOT_FOUND;
    return found(toCases([
        ['singularNimetavEE', formOf(paradigm, 'SgN')],
        ...DECLENSION.map(([code, caseName]): [string, string] => [caseName, formOf(paradigm, code)]),
        ['shortFormEE', formOf(paradigm, 'SgAdt')],
    ]));
}

export function transformAdjective(paradigm: Paradigm | undefined): LookupResult {
    if (!paradigm) return NOT_FOUND;
    return found(toCases([
        ['algvorreEE', formOf(paradigm, 'SgN')],
        ...DECLENSION.map(([code, caseName]): [string, string] => [caseName, formOf(paradigm, code)]),
    ]));
}

const PERSONS: [code: string, slot: string][] = [
    ['Sg1', '1s'], ['Sg2', '2s'], ['Sg3', '3s'], ['Pl1', '1pl'], ['Pl2', '2pl'], ['Pl3', '3pl'],
];

export function transformVerb(paradigm: Paradigm | undefined): LookupResult {
    if (!paradigm) return NOT_FOUND;
    return found(toCases([
        ['infinitiveMaEE', formOf(paradigm, 'Sup')],
        ['infinitiveDaEE', formOf(paradigm, 'Inf')],
        ...PERSONS.map(([code, slot]): [string, string] => [`kindelPresent${slot}EE`, formOf(paradigm, `IndPr${code}`)]),
        ...PERSONS.map(([code, slot]): [string, string] => [`kindelSimplePast${slot}EE`, formOf(paradigm, `IndIpf${code}`)]),
        // Past perfect: the same participle for all six persons (the form shows the auxiliary). Old app behaviour.
        ...PERSONS.map(([, slot]): [string, string] => [`kindelPastPerfect${slot}EE`, formOf(paradigm, 'PtsPtPs')]),
    ]));
}

/**
 * "Search in English": the Estonian "-ma" verb that appears in the MOST meanings of the English
 * word, ties to the first listed. Ekilex's first meaning is not always the common one: for "run"
 * it lists "astuma" (to step) first, but "jooksma" is in two meanings, "astuma" in one.
 */
async function estonianVerbFor(english: string): Promise<string | undefined> {
    const search = await get<MeaningSearch>(`api/meaning/search/${encodeURIComponent(english)}`);
    const counts = new Map<string, number>(); // insertion order = first-listed order, for ties
    for (const meaning of search.results ?? []) {
        const verbs = new Set((meaning.meaningWords ?? []).filter((w) => w.lang === 'est' && w.wordValue.endsWith('ma')).map((w) => w.wordValue));
        for (const verb of verbs) counts.set(verb, (counts.get(verb) ?? 0) + 1);
    }
    let best: string | undefined;
    for (const [verb, count] of counts) if (best === undefined || count > counts.get(best)!) best = verb;
    return best;
}

export const estonianNoun: DictionaryAdapter = async (query) => transformNoun(await paradigmOf(query, 'noomen'));
export const estonianAdjective: DictionaryAdapter = async (query) => transformAdjective(await paradigmOf(query, 'noomen'));
export const estonianVerb: DictionaryAdapter = async (query, options) => {
    const word = options.searchInEnglish ? await estonianVerbFor(query) : query;
    return word ? transformVerb(await paradigmOf(word, 'verb')) : NOT_FOUND;
};
