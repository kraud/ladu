/**
 * Estonian adapters over the official Ekilex API of the Institute of the Estonian Language (EKI;
 * data CC BY 4.0). Decision D18 in autocomplete-data-source-strategy.md replaced the community
 * wrapper api.sonapi.ee, which serves the same Ekilex data.
 *
 * Lookup (2 calls): `api/word/ids/{word}/eki/est` → word ids → `api/paradigm/details/{id}` →
 * forms, each with a `morphCode` (SgN, PlP, IndPrSg1, …: the codes the old transforms read).
 * "Search in English" (Estonian verb only): `estonianVerbFor` reads `api/meaning/search/{word}` → the
 * Estonian verb (a "-ma" word) found in the most meanings. Since step F3 it is the fallback after
 * the local translation table, and the verb's forms then come from the usual lookup (registry.ts).
 *
 * - Homonyms: the first word id whose paradigm has the wanted word class wins.
 * - Adjectives (Slice D3, 3 calls): the paradigm's word class is "noomen" like a noun's, so a
 *   third call, `api/word/details/{id}`, checks the part of speech (`adj`) and reads the
 *   comparison relations: group `komp` (comparative) and `superl` (superlative). A one-word
 *   superlative ("suurim") fills `ulivorreEE` and sends `periphrasticSuperlativeEE: "false"`;
 *   when only "kõige …" exists, no superlative is sent and the flag is "true" (the form then
 *   shows "kõige " + the comparative). An adjective with no comparison relations
 *   ("eestikeelne") sends neither.
 * - Adverbs (Slice H4, 3 calls): the paradigm's word class is "muutumatu" (indeclinable; its one
 *   form, code `ID`, is the word). Like an adjective, `api/word/details/{id}` checks the part of
 *   speech (`adv`; "muutumatu" also holds conjunctions and interjections) and gives the relation
 *   groups `komp` and `superl`. Decision D27: "kõige …" is the normal superlative of an adverb
 *   ("kõige paremini"; the one-word "parimini" is rare), so when any "kõige …" form is listed the
 *   flag `periphrasticSuperlativeEE` is "true" and no superlative is sent. Only when none is
 *   listed does a one-word superlative fill `superlativeEE` (flag "false"). Any degree form also sends
 *   `gradableEE: "Gradable"`. No relations: nothing, not even the radio (no proof of "Non-gradable").
 * - Conjunctions and adpositions (conjunctions-and-prepositions plan, slice 3a, 3 calls): also
 *   "muutumatu" with one form `ID`. The part-of-speech codes of `api/word/details/{id}` are `konj`
 *   (conjunction), `prep` and `postp` (a lexeme can carry both). Ekilex gives a conjunction no type.
 *   An adposition's `governments` are question words: "mille" / "kelle/mille" = genitive, "mida" /
 *   "keda/mida" = partitive, "millest" = elative, and so on (`CASE_OF_QUESTION_WORD`). Position and
 *   cases per word, over all its adposition lexemes: prep only = "Before the noun", postp only =
 *   "After the noun", both = "Before or after the noun". The case before the noun comes from the
 *   `prep` lexemes, the case after it from the `postp` ones; a lexeme with both codes counts for
 *   both positions, but only where no single-position lexeme gives a case. Several cases for one
 *   position: the most frequent, ties to the first listed. A question word without a case in the
 *   form ("mis ajast", "millel") leaves the case empty, and so does no government at all.
 * - Several forms for one code ("häid", "heasid"): the first listed (D19).
 * - Translations (Slice F2, D22): `estonianEquivalents` reads the Estonian words of the meanings
 *   that list the query word in its own language. It fills the Estonian gap of the translate route.
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
/** The parts of `api/word/details/{id}` the adjective adapter reads. */
export interface WordDetails {
    lexemes?: { pos?: { code: string }[]; governments?: { value?: string }[] }[];
    wordRelationDetails?: { level1WordRelationGroups?: { groupTypeCode: string; members?: { wordValue: string }[] }[] };
}
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

/** The word id and paradigm of the first homonym with the wanted word class, or undefined. */
async function paradigmOf(word: string, wordClass: 'noomen' | 'verb' | 'muutumatu'): Promise<{ id: number; paradigm: Paradigm } | undefined> {
    const ids = await get<number[]>(`api/word/ids/${encodeURIComponent(word)}/eki/est`);
    for (const id of (Array.isArray(ids) ? ids : []).slice(0, MAX_HOMONYMS)) {
        const paradigms = await get<Paradigm[]>(`api/paradigm/details/${id}`);
        const match = (Array.isArray(paradigms) ? paradigms : []).find((p) => p.wordClass === wordClass);
        if (match) return { id, paradigm: match };
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

const PERIPHRASTIC = 'kõige ';

/**
 * Comparative and superlative from the word's relation groups (decision D20). The first listed
 * comparative; the first one-word superlative, else the "kõige …" flag. Nothing when the word
 * has no comparison relations.
 */
export function comparisonCases(details: WordDetails): [string, string][] {
    const groups = details.wordRelationDetails?.level1WordRelationGroups ?? [];
    const members = (code: string) => (groups.find((g) => g.groupTypeCode === code)?.members ?? []).map((m) => m.wordValue).filter(Boolean);
    const comparative = members('komp')[0];
    const superlatives = members('superl');
    if (!comparative && superlatives.length === 0) return [];
    const synthetic = superlatives.find((word) => !word.startsWith(PERIPHRASTIC));
    return [
        ['keskvorreEE', comparative ?? ''],
        ...(synthetic
            ? ([['ulivorreEE', synthetic], ['periphrasticSuperlativeEE', 'false']] as [string, string][])
            : ([['periphrasticSuperlativeEE', 'true']] as [string, string][])),
    ];
}

export function transformAdjective(paradigm: Paradigm | undefined, details: WordDetails = {}): LookupResult {
    if (!paradigm) return NOT_FOUND;
    return found(toCases([
        ['algvorreEE', formOf(paradigm, 'SgN')],
        ...comparisonCases(details),
        ...DECLENSION.map(([code, caseName]): [string, string] => [caseName, formOf(paradigm, code)]),
    ]));
}

/** The adverb's comparative and superlative from its relation groups (decision D27, see the file header). */
export function adverbComparisonCases(details: WordDetails): [string, string][] {
    const groups = details.wordRelationDetails?.level1WordRelationGroups ?? [];
    const members = (code: string) => (groups.find((g) => g.groupTypeCode === code)?.members ?? []).map((m) => m.wordValue).filter(Boolean);
    const comparative = members('komp')[0];
    const superlatives = members('superl');
    if (!comparative && superlatives.length === 0) return [];
    if (superlatives.some((word) => word.startsWith(PERIPHRASTIC))) {
        return [['comparativeEE', comparative ?? ''], ['periphrasticSuperlativeEE', 'true']];
    }
    return [
        ['comparativeEE', comparative ?? ''],
        ...(superlatives.length > 0
            ? ([['superlativeEE', superlatives[0]], ['periphrasticSuperlativeEE', 'false']] as [string, string][])
            : []),
    ];
}

export function transformAdverb(paradigm: Paradigm | undefined, details: WordDetails = {}): LookupResult {
    if (!paradigm) return NOT_FOUND;
    const comparison = adverbComparisonCases(details);
    return found(toCases([
        // Gradable only when a degree form exists: no relation does not prove a non-gradable adverb.
        ...(comparison.length > 0 ? ([['gradableEE', 'Gradable']] as [string, string][]) : []),
        ['adverbEE', formOf(paradigm, 'ID')],
        ...comparison,
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
export async function estonianVerbFor(english: string): Promise<string | undefined> {
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

/** Ekilex's language codes for the languages a translation can start from (besides Estonian). */
const EKILEX_LANGUAGE: Record<string, string> = { English: 'eng', German: 'deu', Spanish: 'spa' };

/**
 * The Estonian words of every Ekilex meaning that lists `word` in `language` (letter case ignored),
 * first-listed order, each word once. Meaning search matches words in any language ("lake" is
 * also an Estonian word), hence the language check. Ekilex gives no part of speech here, and an
 * English noun ("need") also matches verb meanings: a verb keeps only "-ma" words (the Estonian
 * infinitive), other parts of speech drop them. A few real nouns end in "-ma" ("ema") and are lost;
 * one call per word would be needed to tell them apart.
 */
export async function estonianEquivalents(word: string, language: string, partOfSpeech: string): Promise<string[]> {
    const code = EKILEX_LANGUAGE[language];
    if (!code) return [];
    const search = await get<MeaningSearch>(`api/meaning/search/${encodeURIComponent(word)}`);
    const wanted = word.trim().toLowerCase();
    const words = new Set<string>();
    for (const meaning of search.results ?? []) {
        const meaningWords = meaning.meaningWords ?? [];
        if (!meaningWords.some((w) => w.lang === code && w.wordValue.toLowerCase() === wanted)) continue;
        for (const w of meaningWords) {
            if (w.lang === 'est' && w.wordValue.endsWith('ma') === (partOfSpeech === 'Verb')) words.add(w.wordValue);
        }
    }
    return [...words];
}

export const estonianNoun: DictionaryAdapter = async (query) => transformNoun((await paradigmOf(query, 'noomen'))?.paradigm);
export const estonianAdjective: DictionaryAdapter = async (query) => {
    const match = await paradigmOf(query, 'noomen');
    if (!match) return NOT_FOUND;
    const details = await get<WordDetails>(`api/word/details/${match.id}`);
    const isAdjective = (details.lexemes ?? []).some((lexeme) => (lexeme.pos ?? []).some((pos) => pos.code === 'adj'));
    return isAdjective ? transformAdjective(match.paradigm, details) : NOT_FOUND;
};
export const estonianAdverb: DictionaryAdapter = async (query) => {
    const match = await paradigmOf(query, 'muutumatu');
    if (!match) return NOT_FOUND;
    const details = await get<WordDetails>(`api/word/details/${match.id}`);
    const isAdverb = (details.lexemes ?? []).some((lexeme) => (lexeme.pos ?? []).some((pos) => pos.code === 'adv'));
    return isAdverb ? transformAdverb(match.paradigm, details) : NOT_FOUND;
};
/** The position values of the preposition form's radio (`configs/prepositions.ts` in the frontend uses the same words). */
const BEFORE_THE_NOUN = 'Before the noun';
const AFTER_THE_NOUN = 'After the noun';
const BEFORE_OR_AFTER = 'Before or after the noun';

/** Ekilex's question words for a government -> the case option of the Estonian preposition form (inanimate and animate spelling). */
const CASE_OF_QUESTION_WORD: Record<string, string> = {
    mille: 'Genitive', kelle: 'Genitive',
    mida: 'Partitive', keda: 'Partitive',
    millest: 'Elative', kellest: 'Elative',
    millele: 'Allative', kellele: 'Allative',
    millega: 'Comitative', kellega: 'Comitative',
    milleni: 'Terminative', kelleni: 'Terminative',
    milleta: 'Abessive', kelleta: 'Abessive',
};

/** The case of one lexeme's governments ("kelle/mille", "keda/mida"): the first question word with a case in the form. */
function governedCaseOf(lexeme: NonNullable<WordDetails['lexemes']>[number]): string | undefined {
    for (const government of lexeme.governments ?? []) {
        for (const word of (government.value ?? '').split('/')) {
            const governed = CASE_OF_QUESTION_WORD[word.trim().toLowerCase()];
            if (governed) return governed;
        }
    }
    return undefined;
}

/** The most frequent value; a tie goes to the first listed. */
function mostFrequent(values: string[]): string | undefined {
    const counts = new Map<string, number>(); // insertion order = first-listed order
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    let best: string | undefined;
    for (const [value, count] of counts) if (best === undefined || count > counts.get(best)!) best = value;
    return best;
}

const hasPos = (details: WordDetails, ...codes: string[]): boolean =>
    (details.lexemes ?? []).some((lexeme) => (lexeme.pos ?? []).some((pos) => codes.includes(pos.code)));

export function transformConjunction(paradigm: Paradigm | undefined, details: WordDetails = {}): LookupResult {
    if (!paradigm || !hasPos(details, 'konj')) return NOT_FOUND;
    return found(toCases([['conjunctionEE', formOf(paradigm, 'ID')]]));
}

export function transformPreposition(paradigm: Paradigm | undefined, details: WordDetails = {}): LookupResult {
    if (!paradigm) return NOT_FOUND;
    const adpositions = (details.lexemes ?? [])
        .map((lexeme) => {
            const codes = (lexeme.pos ?? []).map((pos) => pos.code);
            return { before: codes.includes('prep'), after: codes.includes('postp'), governed: governedCaseOf(lexeme) };
        })
        .filter((lexeme) => lexeme.before || lexeme.after);
    if (adpositions.length === 0) return NOT_FOUND;

    const before = adpositions.some((lexeme) => lexeme.before);
    const after = adpositions.some((lexeme) => lexeme.after);
    // A single-position lexeme speaks for its position; a lexeme with both codes only fills what is left.
    const governedAt = (side: 'before' | 'after'): string | undefined => {
        const other = side === 'before' ? 'after' : 'before';
        const cases = (lexemes: typeof adpositions) => lexemes.map((lexeme) => lexeme.governed).filter((governed): governed is string => !!governed);
        return mostFrequent(cases(adpositions.filter((lexeme) => lexeme[side] && !lexeme[other]))) ?? mostFrequent(cases(adpositions.filter((lexeme) => lexeme[side] && lexeme[other])));
    };
    return found(toCases([
        ['prepositionEE', formOf(paradigm, 'ID')],
        ['positionEE', before && after ? BEFORE_OR_AFTER : before ? BEFORE_THE_NOUN : AFTER_THE_NOUN],
        ['governedCasePreEE', (before && governedAt('before')) || ''],
        ['governedCasePostEE', (after && governedAt('after')) || ''],
    ]));
}

/** The first "muutumatu" homonym (up to `MAX_HOMONYMS`) whose part-of-speech codes `accepts`, with its paradigm and details. */
async function indeclinableWith(word: string, accepts: (details: WordDetails) => boolean): Promise<{ paradigm: Paradigm; details: WordDetails } | undefined> {
    const ids = await get<number[]>(`api/word/ids/${encodeURIComponent(word)}/eki/est`);
    for (const id of (Array.isArray(ids) ? ids : []).slice(0, MAX_HOMONYMS)) {
        const paradigms = await get<Paradigm[]>(`api/paradigm/details/${id}`);
        const paradigm = (Array.isArray(paradigms) ? paradigms : []).find((p) => p.wordClass === 'muutumatu');
        if (!paradigm) continue;
        const details = await get<WordDetails>(`api/word/details/${id}`);
        if (accepts(details)) return { paradigm, details };
    }
    return undefined;
}

export const estonianConjunction: DictionaryAdapter = async (query) => {
    const match = await indeclinableWith(query, (details) => hasPos(details, 'konj'));
    return match ? transformConjunction(match.paradigm, match.details) : NOT_FOUND;
};
export const estonianPreposition: DictionaryAdapter = async (query) => {
    const match = await indeclinableWith(query, (details) => hasPos(details, 'prep', 'postp'));
    return match ? transformPreposition(match.paradigm, match.details) : NOT_FOUND;
};
export const estonianVerb: DictionaryAdapter = async (query) => transformVerb((await paradigmOf(query, 'verb'))?.paradigm);
