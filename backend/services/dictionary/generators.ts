/**
 * Adapters over the rule-based npm libraries (EN, ES, DE). Moved from the old
 * autocompleteTranslationController (deleted in Slice A step A2) with the same output, plus
 * two fixes found by Slice 0 (.context/plans/autocomplete-coverage-report.md §8):
 * - a library that throws for a word it does not know gives `not-found`, not HTTP 500
 *   (20.6% of frequent German nouns and 7.6% of German verbs threw);
 * - each `is-word` list is loaded once, not on every request (~27 ms per request).
 *
 * `is-word` still gates every lookup: a word it does not know is `not-found`, except the
 * Spanish noun, whose gender is guessed and returned as `partial`.
 */

import type { DictionaryAdapter, LookupResult } from './types';
const { NOT_FOUND, toCases }: typeof import('./types') = require('./types');

const isWord = require('is-word');
const SpanishVerbs = require('spanish-verbs');
const SpanishGender = require('rosaenlg-gender-es');
const GermanVerbsLib = require('german-verbs');
const GermanWords = require('german-words');
const GermanVerbsDict = require('german-verbs-dict/dist/verbs.json');
const GermanWordsList = require('german-words-dict/dist/words.json');
const EnglishVerbs = require('english-verbs-helper');
const Irregular = require('english-verbs-irregular/dist/verbs.json');
const Gerunds = require('english-verbs-gerunds/dist/gerunds.json');
const EnglishVerbsData = EnglishVerbs.mergeVerbsData(Irregular, Gerunds);

const wordLists = new Map<string, { check: (word: string) => boolean }>();
/** `isWord(list)` reads and indexes the whole list file; do it once per list. */
function knows(list: 'american-english' | 'spanish' | 'ngerman', word: string): boolean {
    let checker = wordLists.get(list);
    if (!checker) wordLists.set(list, (checker = isWord(list)));
    return checker!.check(word);
}

/** Runs the library calls; a library error means the word is not in its dictionary. */
function fromLibrary(build: () => LookupResult): LookupResult {
    try {
        return build();
    } catch {
        return NOT_FOUND;
    }
}

const SPANISH_ARTICLE: Record<string, string> = { f: 'la', m: 'el' };
const GERMAN_ARTICLE: Record<string, string> = { F: 'die', M: 'der', N: 'das' };

/** Pronoun index used by the libraries: 0 I · 1 you · 2 he/she/it · 3 we · 4 you (pl) · 5 they. */
const PERSONS: [slot: string, index: number][] = [['1s', 0], ['2s', 1], ['3s', 2], ['1pl', 3], ['2pl', 4], ['3pl', 5]];
/** English has no 2pl case in the app. */
const PERSONS_EN = PERSONS.filter(([slot]) => slot !== '2pl');

export const englishVerb: DictionaryAdapter = async (query) => {
    if (!knows('american-english', query)) return NOT_FOUND;
    const conjugate = (tense: string, person: number): string =>
        EnglishVerbs.getConjugation(EnglishVerbsData, query, tense, person);
    // Future and conditional store the bare verb: the form shows "will"/"would" itself.
    const bareVerb = (person: number): string => conjugate('SIMPLE_FUTURE', person).split(' ')[1];
    return fromLibrary(() => ({
        status: 'found',
        cases: toCases([
            ...PERSONS_EN.map(([slot, p]): [string, string] => [`simplePresent${slot}EN`, conjugate('SIMPLE_PRESENT', p)]),
            ...PERSONS_EN.map(([slot, p]): [string, string] => [`simplePast${slot}EN`, conjugate('SIMPLE_PAST', p)]),
            ...PERSONS_EN.map(([slot, p]): [string, string] => [`simpleFuture${slot}EN`, bareVerb(p)]),
            ...PERSONS_EN.map(([slot, p]): [string, string] => [`simpleConditional${slot}EN`, bareVerb(p)]),
        ]),
    }));
};

export const spanishVerb: DictionaryAdapter = async (query) => {
    if (!knows('spanish', query)) return NOT_FOUND;
    const conjugate = (tense: string, person: number): string => SpanishVerbs.getConjugation(query, tense, person);
    return fromLibrary(() => ({
        status: 'found',
        cases: toCases([
            ['infinitiveNonFiniteSimpleES', query],
            // The gerund has no source here; the participle is the second word of "he bailado".
            ['participleNonFiniteSimpleES', conjugate('INDICATIVE_PRETERITE_PERFECT', 0).split(' ')[1]],
            ...PERSONS.map(([slot, p]): [string, string] => [`indicativePresent${slot}ES`, conjugate('INDICATIVE_PRESENT', p)]),
            ...PERSONS.map(([slot, p]): [string, string] => [`indicativeImperfectPast${slot}ES`, conjugate('INDICATIVE_IMPERFECT', p)]),
            ...PERSONS.map(([slot, p]): [string, string] => [`indicativePerfectSimplePast${slot}ES`, conjugate('INDICATIVE_PRETERITE', p)]),
            ...PERSONS.map(([slot, p]): [string, string] => [`indicativeFuture${slot}ES`, conjugate('INDICATIVE_FUTURE', p)]),
        ]),
    }));
};

/**
 * The gender library always answers "m" or "f", even for a word that does not exist. So a
 * word `is-word` does not know still gets the guess, as `partial`.
 */
export const spanishNoun: DictionaryAdapter = async (query) => {
    const result = fromLibrary(() => ({
        status: 'found',
        cases: toCases([
            ['genderES', SPANISH_ARTICLE[SpanishGender(query)]],
            ['singularES', query],
        ]),
    }));
    if (result.status === 'found' && !knows('spanish', query)) return { ...result, status: 'partial' };
    return result;
};

export const germanVerb: DictionaryAdapter = async (query) => {
    const verb = query.toLowerCase();
    if (!knows('ngerman', verb)) return NOT_FOUND;
    // [0] is the single form; for compound tenses [1] is the main verb after the auxiliary ("habe", "getanzt").
    const conjugate = (tense: string, person: number, number: 'S' | 'P', aux?: string): string[] =>
        GermanVerbsLib.getConjugation(GermanVerbsDict, verb, tense, person, number, aux);
    const slots: [slot: string, person: number, number: 'S' | 'P'][] = [
        ['1s', 1, 'S'], ['2s', 2, 'S'], ['3s', 3, 'S'], ['1pl', 1, 'P'], ['2pl', 2, 'P'], ['3pl', 3, 'P'],
    ];
    return fromLibrary(() => ({
        status: 'found',
        cases: toCases([
            ['infinitiveDE', query],
            ...slots.map(([slot, p, n]): [string, string] => [`indicativePresent${slot}DE`, conjugate('PRASENS', p, n)[0]]),
            ...slots.map(([slot, p, n]): [string, string] => [`indicativePerfect${slot}DE`, conjugate('PERFEKT', p, n, 'HABEN')[1]]),
            ...slots.map(([slot, p, n]): [string, string] => [`indicativeSimpleFuture${slot}DE`, conjugate('FUTUR1', p, n)[1]]),
            ...slots.map(([slot, p, n]): [string, string] => [`indicativeSimplePast${slot}DE`, conjugate('PRATERITUM', p, n)[0]]),
        ]),
    }));
};

export const germanNoun: DictionaryAdapter = async (query) => {
    const noun = query.length > 1 ? query[0].toUpperCase() + query.slice(1) : query;
    if (!knows('ngerman', noun)) return NOT_FOUND;
    const decline = (grammaticalCase: string, number: 'S' | 'P'): string =>
        GermanWords.getCaseGermanWord(null, GermanWordsList, noun, grammaticalCase, number);
    const cases: [app: string, library: string][] = [
        ['Nominativ', 'NOMINATIVE'], ['Akkusativ', 'ACCUSATIVE'], ['Genitiv', 'GENITIVE'], ['Dativ', 'DATIVE'],
    ];
    return fromLibrary(() => ({
        status: 'found',
        cases: toCases([
            ['genderDE', GERMAN_ARTICLE[GermanWords.getGenderGermanWord(null, GermanWordsList, noun)]],
            ...cases.flatMap(([app, library]): [string, string][] => [
                [`singular${app}DE`, decline(library, 'S')],
                [`plural${app}DE`, decline(library, 'P')],
            ]),
        ]),
    }));
};
