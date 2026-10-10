/**
 * German selector table: app case field → where its value is in a kaikki entry.
 * Case names: frontend/src/ts/enums.ts (NounCases, VerbCases). Engine: ../select.ts.
 *
 * Format decisions (parity with today's german-verbs / german-words output):
 * - Perfect and Futur I store the main verb only. The form shows the auxiliary itself
 *   (deAdornment in the form config), so "habe getanzt" → "getanzt", "werde gehen" → "gehen".
 * - Separable verbs store the joined form ("anruft", "anrief"), which kaikki tags
 *   `subordinate-clause`. Main-clause rows ("ruft an") are the second choice.
 * - `caseTypeDE` (which case a verb governs) has no source in kaikki and is not here.
 */

import type { CaseSelector, FormSelector, LexiconEntry } from '../select';
const { selectForm, senseTags }: typeof import('../select') = require('../select');

const GENDER_ARTICLE: Record<string, string> = { masculine: 'der', feminine: 'die', neuter: 'das' };

/** Mirrors PrefixesVerbDE in frontend/src/ts/enums.ts. Keep the two equal. */
const SEPARABLE_PREFIXES = [
    'ab', 'an', 'auf', 'aus', 'bei', 'da', 'dar', 'durch', 'ein', 'fern', 'fest', 'fort', 'gegen',
    'her', 'hin', 'los', 'mit', 'nach', 'nieder', 'um', 'vor', 'weg', 'wieder', 'zu', 'zusammen', 'zurück',
];

/** First gender tag in sense order. A noun with several genders gets the first one. */
function genderDE(entry: LexiconEntry): string | undefined {
    const tag = senseTags(entry).find((t) => t in GENDER_ARTICLE);
    return tag ? GENDER_ARTICLE[tag] : undefined;
}

/** First single auxiliary ("haben" or "sein"). The row "haben or sein" is skipped; the next rows name each. */
function auxVerbDE(entry: LexiconEntry): string | undefined {
    return entry.forms?.find((row) => row.tags?.includes('auxiliary') && ['haben', 'sein'].includes(row.form))?.form;
}

/** Wiktionary marks German verbs `weak` (regular) or `strong` / `irregular`. A verb with both is irregular. */
function regularityDE(entry: LexiconEntry): string | undefined {
    const tags = senseTags(entry);
    if (tags.includes('strong') || tags.includes('irregular')) return 'irregular';
    if (tags.includes('weak')) return 'regular';
    return undefined;
}

/** The separable prefix is the last word of the main-clause present form: "ruft an" → "an". */
function prefixDE(entry: LexiconEntry): string | undefined {
    const mainClause = selectForm(entry, {
        kind: 'form', caseName: '', tags: ['indicative', 'present', 'third-person', 'singular'], excludeTags: ['subordinate-clause'],
    });
    const parts = mainClause?.split(' ') ?? [];
    const prefix = parts.length === 2 ? parts[1] : undefined;
    return prefix && SEPARABLE_PREFIXES.includes(prefix) && entry.word.startsWith(prefix) ? prefix : undefined;
}

/**
 * kaikki lists three 1s forms for -ern/-eln verbs with equal tags, elided first ("sichre, sichere, sicher";
 * "sammle, sammele, sammel"). Standard German (and today's library): -ern keeps the e ("ich sichere"),
 * -eln drops it ("ich sammle"). So -ern takes the longest row, everything else the first row.
 * Not on other cells: there "longest" picks rarer doublets ("melkte" over "molk", "liket" over "likt").
 */
function present1sDE(entry: LexiconEntry): string | undefined {
    return selectForm(entry, {
        kind: 'form',
        caseName: 'indicativePresent1sDE',
        tags: ['indicative', 'present', 'first-person', 'singular'],
        ...SIMPLE,
        preferLongest: entry.word.endsWith('ern'),
    });
}

const PERSONS: [string, string[]][] = [
    ['1s', ['first-person', 'singular']],
    ['2s', ['second-person', 'singular']],
    ['3s', ['third-person', 'singular']],
    ['1pl', ['first-person', 'plural']],
    ['2pl', ['second-person', 'plural']],
    ['3pl', ['third-person', 'plural']],
];

function tense(prefix: string, tags: string[], options: Partial<FormSelector> = {}): FormSelector[] {
    return PERSONS.map(([slot, personTags]) => ({
        kind: 'form',
        caseName: `${prefix}${slot}DE`,
        tags: ['indicative', ...tags, ...personTags],
        ...options,
    }));
}

const CASES: [string, string][] = [
    ['Nominativ', 'nominative'],
    ['Akkusativ', 'accusative'],
    ['Genitiv', 'genitive'],
    ['Dativ', 'dative'],
];

export const NOUN_SELECTORS_DE: CaseSelector[] = [
    { kind: 'property', caseName: 'genderDE', extract: genderDE },
    ...CASES.flatMap(([app, tag]): FormSelector[] => [
        { kind: 'form', caseName: `singular${app}DE`, tags: [tag, 'singular'], fallbackToLemma: tag === 'nominative' },
        { kind: 'form', caseName: `plural${app}DE`, tags: [tag, 'plural'] },
    ]),
];

/**
 * Adjectives and adverbs (Slice H). The app form has three degrees and no declension. The head rows
 * come first in the entry ("besser | comparative", "am besten | superlative"), before the declension
 * tables, so the first matching row is the predicative form. The superlative is stored WITHOUT "am"
 * (decision D25): the form shows "am " itself.
 */
const COMPARATIVE_DE = { tags: ['comparative'] };
const SUPERLATIVE_DE = { tags: ['superlative'], removeWords: ['am'] };

/** A German adverb with a comparative is gradable ("oft → öfter"); one without is not ("hier"). */
function gradableDE(entry: LexiconEntry): string {
    return selectForm(entry, { kind: 'form', caseName: '', ...COMPARATIVE_DE }) ? 'Gradable' : 'Non-gradable';
}

export const ADJECTIVE_SELECTORS_DE: CaseSelector[] = [
    { kind: 'property', caseName: 'positiveDE', extract: (entry) => entry.word },
    { kind: 'form', caseName: 'komparativDE', ...COMPARATIVE_DE },
    { kind: 'form', caseName: 'superlativDE', ...SUPERLATIVE_DE },
];

export const ADVERB_SELECTORS_DE: CaseSelector[] = [
    { kind: 'property', caseName: 'gradableDE', extract: gradableDE },
    { kind: 'property', caseName: 'adverbDE', extract: (entry) => entry.word },
    { kind: 'form', caseName: 'comparativeDE', ...COMPARATIVE_DE },
    { kind: 'form', caseName: 'superlativeDE', ...SUPERLATIVE_DE },
];

/** Decision D8: verb forms are stored without the reflexive pronoun ("uns sputen" → "sputen"). */
const REFLEXIVE_PRONOUNS = ['mich', 'dich', 'sich', 'uns', 'euch', 'mir', 'dir'];

const SIMPLE = { excludeTags: ['multiword-construction'], preferTags: ['subordinate-clause'], removeWords: REFLEXIVE_PRONOUNS };
// Subordinate compound rows put the auxiliary last ("angerufen habe"), so dropping the first word would be wrong.
const COMPOUND = { excludeTags: ['subordinate-clause'], dropLeadingWords: 1, removeWords: REFLEXIVE_PRONOUNS };

export const VERB_SELECTORS_DE: CaseSelector[] = [
    { kind: 'form', caseName: 'infinitiveDE', tags: ['infinitive'], excludeTags: ['multiword-construction'], removeWords: REFLEXIVE_PRONOUNS, fallbackToLemma: true },
    { kind: 'property', caseName: 'auxVerbDE', extract: auxVerbDE },
    { kind: 'property', caseName: 'prefixDE', extract: prefixDE },
    { kind: 'property', caseName: 'regularityDE', extract: regularityDE },
    { kind: 'property', caseName: 'indicativePresent1sDE', extract: present1sDE },
    ...tense('indicativePresent', ['present'], SIMPLE).filter((s) => s.caseName !== 'indicativePresent1sDE'),
    ...tense('indicativePerfect', ['perfect', 'multiword-construction'], COMPOUND),
    ...tense('indicativeSimpleFuture', ['future-i', 'multiword-construction'], COMPOUND),
    ...tense('indicativeSimplePast', ['preterite'], SIMPLE),
];
