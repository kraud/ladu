/**
 * Spanish selector table: app case field → where its value is in a kaikki entry.
 * Case names: frontend/src/ts/enums.ts (NounCases, VerbCases). Engine: ../select.ts.
 *
 * - Only standard peninsular/tú forms: `vos-form` rows ("bailás"), clitic `combined-form`
 *   rows ("bailarlo") and `negative` imperatives ("no bailes") are excluded.
 * - Conditional and imperative are in the case registry but not in the v2 form
 *   (configs/verbs.ts buildEsConfig). They are here so Slice 0 can measure them.
 * - `imperative1sES` has no form in Spanish. The compound non-finites
 *   (`infinitiveNonFiniteCompound`, `gerundNonFiniteCompound`) are not in the v2 form and
 *   kaikki does not list them; they are not here.
 */

import type { CaseSelector, FormSelector, LexiconEntry } from '../select';

/** Wiktionary's es-conj table names irregular verbs in a `table-tags` row whose text is "irregular". */
function regularityES(entry: LexiconEntry): string | undefined {
    const tableRows = (entry.forms ?? []).filter((row) => row.tags?.includes('table-tags'));
    if (tableRows.length === 0) return undefined;
    return tableRows.some((row) => row.form === 'irregular') ? 'irregular' : 'regular';
}

/** Gender of the first sense that has one. Both genders in one sense ("estudiante") → "el/la" (GenderES.N). */
function genderES(entry: LexiconEntry): string | undefined {
    for (const sense of entry.senses ?? []) {
        const masculine = sense.tags?.includes('masculine');
        const feminine = sense.tags?.includes('feminine');
        if (masculine && feminine) return 'el/la';
        if (masculine) return 'el';
        if (feminine) return 'la';
    }
    return undefined;
}

const PERSONS: [string, string[]][] = [
    ['1s', ['first-person', 'singular']],
    ['2s', ['second-person', 'singular']],
    ['3s', ['third-person', 'singular']],
    ['1pl', ['first-person', 'plural']],
    ['2pl', ['second-person', 'plural']],
    ['3pl', ['third-person', 'plural']],
];

const NOT_STANDARD = ['vos-form', 'combined-form', 'negative'];

function tense(prefix: string, tags: string[], slots = PERSONS, excludeTags: string[] = []): FormSelector[] {
    return slots.map(([slot, personTags]) => ({
        kind: 'form',
        caseName: `${prefix}${slot}ES`,
        tags: [...tags, ...personTags],
        excludeTags: [...NOT_STANDARD, ...excludeTags],
    }));
}

export const NOUN_SELECTORS_ES: CaseSelector[] = [
    { kind: 'property', caseName: 'genderES', extract: genderES },
    // Spanish noun entries list only the plural; the lemma is the singular.
    { kind: 'property', caseName: 'singularES', extract: (entry) => entry.word },
    { kind: 'form', caseName: 'pluralES', tags: ['plural'] },
];

export const VERB_SELECTORS_ES: CaseSelector[] = [
    { kind: 'property', caseName: 'regularityES', extract: regularityES },
    { kind: 'form', caseName: 'infinitiveNonFiniteSimpleES', tags: ['infinitive'], excludeTags: NOT_STANDARD, fallbackToLemma: true },
    { kind: 'form', caseName: 'gerundNonFiniteSimpleES', tags: ['gerund'], excludeTags: NOT_STANDARD },
    { kind: 'form', caseName: 'participleNonFiniteSimpleES', tags: ['participle', 'past'], excludeTags: NOT_STANDARD },
    ...tense('indicativePresent', ['indicative', 'present']),
    ...tense('indicativeImperfectPast', ['indicative', 'imperfect']),
    ...tense('indicativePerfectSimplePast', ['indicative', 'preterite']),
    ...tense('indicativeFuture', ['indicative', 'future']),
    ...tense('indicativeConditional', ['indicative', 'conditional']),
    // Imperative: 2s/2pl are tú/vosotros ("baila", "bailad") and exclude the `formal` usted rows;
    // 3s/3pl are usted/ustedes ("baile", "bailen"), which carry both `formal` and `third-person`.
    ...tense('imperative', ['imperative'], PERSONS.filter(([slot]) => slot === '2s' || slot === '2pl'), ['formal']),
    ...tense('imperative', ['imperative'], PERSONS.filter(([slot]) => slot === '3s' || slot === '1pl' || slot === '3pl')),
];
