/**
 * English selector table: app case field → where its value is in a kaikki entry.
 * Case names: frontend/src/ts/enums.ts (NounCases, VerbCases). Engine: ../select.ts.
 *
 * - Many English verbs have no full table, only head forms ("bakes", "baking", "baked").
 *   Person-specific rows are tried first, then the general row (`fallbackTags`), then the
 *   lemma: present 1s/2s/plural is the bare verb in every verb except "be".
 * - Future and conditional store the bare verb (parity with today: the form shows
 *   "will"/"would" itself, and the controller removed the auxiliary). So they are the lemma.
 */

import type { CaseSelector, FormSelector, LexiconEntry } from '../select';
const { selectForm, senseTags }: typeof import('../select') = require('../select');

const NOT_FINITE = ['participle', 'subjunctive', 'imperative', 'infinitive'];

/** `irregular` sense tag, else the rule "past and past participle both end in -ed". */
function regularityEN(entry: LexiconEntry): string | undefined {
    if (senseTags(entry).includes('irregular')) return 'irregular';
    const past = selectForm(entry, { kind: 'form', caseName: '', tags: ['past'], excludeTags: NOT_FINITE });
    const participle = selectForm(entry, { kind: 'form', caseName: '', tags: ['participle', 'past'] });
    if (!past || !participle) return undefined;
    return past.endsWith('ed') && participle.endsWith('ed') ? 'regular' : 'irregular';
}

const SLOTS: [string, string[]][] = [
    ['1s', ['first-person', 'singular']],
    ['2s', ['second-person', 'singular']],
    ['3s', ['third-person', 'singular']],
    ['1pl', ['plural']],
    ['3pl', ['plural']],
];

function present(slot: string, personTags: string[]): FormSelector {
    return {
        kind: 'form',
        caseName: `simplePresent${slot}EN`,
        tags: ['present', ...personTags],
        excludeTags: NOT_FINITE,
        // 3s has no safe default ("runs" ≠ lemma); every other slot is the bare verb.
        fallbackToLemma: slot !== '3s',
    };
}

function past(slot: string, personTags: string[]): FormSelector {
    return {
        kind: 'form',
        caseName: `simplePast${slot}EN`,
        tags: ['past', ...personTags],
        fallbackTags: ['past'],
        excludeTags: NOT_FINITE,
    };
}

const bareVerb = (caseName: string): CaseSelector => ({ kind: 'property', caseName, extract: (entry) => entry.word });

/**
 * Adjectives and adverbs (Slice H). kaikki lists "uniquer | comparative" before "more unique", and
 * "quicklier" before "more quickly". The "more/most" row wins for adverbs in -ly and for words of
 * three or more syllables (vowel groups); every other word takes the first row ("bigger").
 */
function usesMore(word: string): boolean {
    return word.endsWith('ly') || (word.match(/[aeiouy]+/g) ?? []).length >= 3;
}

function degreeEN(degree: 'comparative' | 'superlative') {
    const more = degree === 'comparative' ? 'more ' : 'most ';
    return (entry: LexiconEntry): string | undefined => {
        const selector = { kind: 'form' as const, caseName: '', tags: [degree] };
        if (usesMore(entry.word)) {
            const periphrastic = selectForm({ ...entry, forms: entry.forms?.filter((row) => row.form.startsWith(more)) }, selector);
            if (periphrastic) return periphrastic;
        }
        return selectForm(entry, selector);
    };
}

export const ADJECTIVE_SELECTORS_EN: CaseSelector[] = [
    { kind: 'property', caseName: 'positiveEN', extract: (entry) => entry.word },
    { kind: 'property', caseName: 'comparativeEN', extract: degreeEN('comparative') },
    { kind: 'property', caseName: 'superlativeEN', extract: degreeEN('superlative') },
];

export const ADVERB_SELECTORS_EN: CaseSelector[] = [
    { kind: 'property', caseName: 'adverbEN', extract: (entry) => entry.word },
    { kind: 'property', caseName: 'comparativeEN', extract: degreeEN('comparative') },
    { kind: 'property', caseName: 'superlativeEN', extract: degreeEN('superlative') },
];

export const NOUN_SELECTORS_EN: CaseSelector[] = [
    { kind: 'property', caseName: 'singularEN', extract: (entry) => entry.word },
    { kind: 'form', caseName: 'pluralEN', tags: ['plural'] },
];

export const VERB_SELECTORS_EN: CaseSelector[] = [
    { kind: 'property', caseName: 'regularityEN', extract: regularityEN },
    ...SLOTS.map(([slot, tags]) => present(slot, tags)),
    ...SLOTS.map(([slot, tags]) => past(slot, tags)),
    ...SLOTS.map(([slot]) => bareVerb(`simpleFuture${slot}EN`)),
    ...SLOTS.map(([slot]) => bareVerb(`simpleConditional${slot}EN`)),
];
