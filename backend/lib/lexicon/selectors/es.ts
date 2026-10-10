/**
 * Spanish selector table: app case field → where its value is in a kaikki entry.
 * Case names: frontend/src/ts/enums.ts (NounCases, VerbCases). Engine: ../select.ts.
 *
 * - 2nd person is tú (singular) and USTEDES (plural), decision D10: vosotros is not used outside
 *   Spain, and ustedes takes the 3rd-person plural form ("bailan", imperative "bailen"). The form
 *   labels these slots "Tú" and "Ustedes". `vos-form` rows ("bailás"), clitic `combined-form` rows
 *   ("bailarlo") and `negative` imperatives ("no bailes") are excluded. A UI setting for the Spanish
 *   variety (Spain / voseo) is a later decision.
 * - Conditional and imperative are in the case registry but not in the v2 form
 *   (configs/verbs.ts buildEsConfig). They are here so Slice 0 can measure them.
 * - `imperative1sES` has no form in Spanish. The compound non-finites
 *   (`infinitiveNonFiniteCompound`, `gerundNonFiniteCompound`) are not in the v2 form and
 *   kaikki does not list them; they are not here.
 */

import type { CaseSelector, FormSelector, LexiconEntry } from '../select';
const { selectForm }: typeof import('../select') = require('../select');

/**
 * `class` alternations that only change the SPELLING (buscar → busqué, llegar → llegué) or only add
 * an ACCENT (enviar → envío). Spanish grammar counts these verbs as regular. Every other alternation
 * (stem changes e-ie, o-ue, e-i, …, the -zc of conozco, the e-í of río) makes a verb irregular.
 */
const REGULAR_ALTERNATIONS = new Set([
    'c-z alternation', 'c-qu alternation', 'g-gu alternation', 'g-j alternation', 'gu-gü alternation',
    'c-ç alternation', 'hard-soft alternation', 'i-í alternation', 'u-ú alternation',
]);

/**
 * Wiktionary's es-conj table names fully irregular verbs in a `table-tags` row whose text is
 * "irregular" (ser, ir, tener), and stem-changing verbs in `class` rows ("e-ie alternation").
 * Both count as irregular; spelling- and accent-only classes do not (decision D16).
 */
function regularityES(entry: LexiconEntry): string | undefined {
    const rows = entry.forms ?? [];
    const tableRows = rows.filter((row) => row.tags?.includes('table-tags'));
    if (tableRows.length === 0) return undefined;
    if (tableRows.some((row) => row.form === 'irregular')) return 'irregular';
    const classes = rows.filter((row) => row.tags?.includes('class')).map((row) => row.form);
    return classes.some((name) => !REGULAR_ALTERNATIONS.has(name)) ? 'irregular' : 'regular';
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

/**
 * Reflexivity of a verb (Slice H5, D33), the same three values as the German radio. "Always reflexive":
 * the lemma is a reflexive infinitive ("quejarse", "arrepentirse"); the lemma tells it better than the
 * tags (98 of the 252 such lemmas have no reflexive tag). Spanish lists "lavarse" as its own lemma next
 * to "lavar", so "lavar" is "Optionally reflexive": a sense is tagged `reflexive` ("estar", "dar") or
 * `pronominal` ("terminar", "llamar"; a judgement call, they are used with a pronoun). Everything else is
 * "Not reflexive", which means "no evidence". The ending must be a verb ending + "se": it leaves out "se",
 * "muse" and "ase". There is no pronoun-case value: me, te, se, nos are the same for dative and accusative.
 */
function reflexivityES(entry: LexiconEntry): string {
    if (/(ar|er|ir|ír)se$/.test(entry.word)) return 'Always reflexive';
    const reflexiveSense = (entry.senses ?? []).some((sense) => !sense.form_of
        && (sense.tags?.includes('reflexive') || sense.tags?.includes('pronominal')));
    return reflexiveSense ? 'Optionally reflexive' : 'Not reflexive';
}

const PERSONS: [string, string[]][] = [
    ['1s', ['first-person', 'singular']],
    ['2s', ['second-person', 'singular']],
    ['3s', ['third-person', 'singular']],
    ['1pl', ['first-person', 'plural']],
    // Ustedes, not vosotros (decision D10): the 3rd-person plural form.
    ['2pl', ['third-person', 'plural']],
    ['3pl', ['third-person', 'plural']],
];

const NOT_STANDARD = ['vos-form', 'combined-form', 'negative'];

/** Decision D8: verb forms are stored without the reflexive pronoun ("nos personamos" → "personamos"). */
const REFLEXIVE_PRONOUNS = ['me', 'te', 'se', 'nos', 'os'];

function tense(prefix: string, tags: string[], slots = PERSONS, excludeTags: string[] = []): FormSelector[] {
    return slots.map(([slot, personTags]) => ({
        kind: 'form',
        caseName: `${prefix}${slot}ES`,
        tags: [...tags, ...personTags],
        excludeTags: [...NOT_STANDARD, ...excludeTags],
        removeWords: REFLEXIVE_PRONOUNS,
    }));
}

/**
 * Adjectives (Slice H). The form has two branches. A Neutral adjective has one shape for both
 * genders ("feliz, felices"): its senses are tagged feminine AND masculine, and its plural row
 * carries both tags. Every other adjective is M/F ("rojo, roja, rojos, rojas"); the lemma is the
 * masculine singular. The Spanish form has no superlative field; "grandísimo" is not stored.
 */
function isNeutralES(entry: LexiconEntry): boolean {
    const bothInSense = (entry.senses ?? []).some((sense) => sense.tags?.includes('feminine') && sense.tags.includes('masculine'));
    const hasFeminineRow = (entry.forms ?? []).some((row) => row.tags?.includes('feminine') && !row.tags.includes('masculine') && !row.tags.includes('plural'));
    return bothInSense && !hasFeminineRow;
}

const whenNeutral = (extract: (entry: LexiconEntry) => string | undefined) =>
    (entry: LexiconEntry) => (isNeutralES(entry) ? extract(entry) : undefined);
const whenGendered = (extract: (entry: LexiconEntry) => string | undefined) =>
    (entry: LexiconEntry) => (isNeutralES(entry) ? undefined : extract(entry));
const row = (tags: string[], excludeTags: string[]) =>
    (entry: LexiconEntry) => selectForm(entry, { kind: 'form', caseName: '', tags, excludeTags });

export const ADJECTIVE_SELECTORS_ES: CaseSelector[] = [
    { kind: 'property', caseName: 'neutralSingularES', extract: whenNeutral((entry) => entry.word) },
    { kind: 'property', caseName: 'neutralPluralES', extract: whenNeutral(row(['feminine', 'masculine', 'plural'], [])) },
    { kind: 'property', caseName: 'maleSingularES', extract: whenGendered((entry) => entry.word) },
    { kind: 'property', caseName: 'malePluralES', extract: whenGendered(row(['masculine', 'plural'], ['feminine'])) },
    { kind: 'property', caseName: 'femaleSingularES', extract: whenGendered(row(['feminine'], ['masculine', 'plural'])) },
    { kind: 'property', caseName: 'femalePluralES', extract: whenGendered(row(['feminine', 'plural'], ['masculine'])) },
];

export const ADVERB_SELECTORS_ES: CaseSelector[] = [
    { kind: 'property', caseName: 'adverbES', extract: (entry) => entry.word },
    { kind: 'form', caseName: 'comparativeES', tags: ['comparative'] },
    { kind: 'form', caseName: 'superlativeES', tags: ['superlative'] },
];

export const NOUN_SELECTORS_ES: CaseSelector[] = [
    { kind: 'property', caseName: 'genderES', extract: genderES },
    // Spanish noun entries list only the plural; the lemma is the singular.
    { kind: 'property', caseName: 'singularES', extract: (entry) => entry.word },
    { kind: 'form', caseName: 'pluralES', tags: ['plural'] },
];

export const VERB_SELECTORS_ES: CaseSelector[] = [
    { kind: 'property', caseName: 'regularityES', extract: regularityES },
    { kind: 'property', caseName: 'reflexivityES', extract: reflexivityES },
    { kind: 'form', caseName: 'infinitiveNonFiniteSimpleES', tags: ['infinitive'], excludeTags: NOT_STANDARD, fallbackToLemma: true },
    { kind: 'form', caseName: 'gerundNonFiniteSimpleES', tags: ['gerund'], excludeTags: NOT_STANDARD },
    { kind: 'form', caseName: 'participleNonFiniteSimpleES', tags: ['participle', 'past'], excludeTags: NOT_STANDARD },
    ...tense('indicativePresent', ['indicative', 'present']),
    ...tense('indicativeImperfectPast', ['indicative', 'imperfect']),
    ...tense('indicativePerfectSimplePast', ['indicative', 'preterite']),
    ...tense('indicativeFuture', ['indicative', 'future']),
    ...tense('indicativeConditional', ['indicative', 'conditional']),
    // Imperative: 2s is tú ("baila") and excludes the `formal` usted rows; 3s is usted ("baile");
    // 2pl and 3pl are both ustedes ("bailen", decision D10).
    ...tense('imperative', ['imperative'], PERSONS.filter(([slot]) => slot === '2s'), ['formal']),
    ...tense('imperative', ['imperative'], PERSONS.filter(([slot]) => slot !== '1s' && slot !== '2s')),
];
