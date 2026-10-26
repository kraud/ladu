/**
 * French selector table: app case field → where its value is in a kaikki entry.
 * Case names: frontend/src/ts/enums.ts (NounCases, AdjectiveCases, AdverbCases …). Engine: ../select.ts.
 * Research and decisions: .context/plans/language-french.md, "Slice 8 results".
 *
 * Slice 9a: nouns, adjectives, adverbs, conjunctions and prepositions. Slice 9b: verbs.
 *
 * - Nothing is guessed. Wiktionary has no French conjunction type or mood, no preposition position
 *   (beyond the entry kind), no adverb gradability (beyond a degree row) and no adjective position.
 *   Those fields stay empty (review-log A5).
 * - The superlative is never sent. The form locks it and derives it from the comparative ("le " + comparative).
 * - French elision (l'arbre) is a display rule: the gender is stored as "le", "la" or "le/la".
 */

import type { CaseSelector, LexiconEntry } from '../select';
const { selectForm }: typeof import('../select') = require('../select');
const { conjunctionSelectors, prepositionSelectors }: typeof import('./functionWords') = require('./functionWords');

/** Sense tag that says a word has one shape for singular and plural ("une souris", "des souris"; "marron"). */
const isInvariable = (entry: LexiconEntry): boolean => (entry.senses ?? []).some((sense) => sense.tags?.includes('invariable'));

/** The value of the first form row that has all `tags` and none of `excludeTags`. */
const row = (entry: LexiconEntry, tags: string[], excludeTags: string[] = []): string | undefined =>
    selectForm(entry, { kind: 'form', caseName: '', tags, excludeTags });

/** Gender of the first sense that has one. Both genders in one sense ("enfant", "collègue") → "le/la" (GenderFR.N). */
function genderFR(entry: LexiconEntry): string | undefined {
    for (const sense of entry.senses ?? []) {
        const masculine = sense.tags?.includes('masculine');
        const feminine = sense.tags?.includes('feminine');
        if (masculine && feminine) return 'le/la';
        if (masculine) return 'le';
        if (feminine) return 'la';
    }
    return undefined;
}

export const NOUN_SELECTORS_FR: CaseSelector[] = [
    { kind: 'property', caseName: 'genderFR', extract: genderFR },
    // French noun entries list only the plural (and the feminine counterpart, "chat" → "chatte", which is not stored); the lemma is the singular.
    { kind: 'property', caseName: 'singularFR', extract: (entry) => entry.word },
    // An invariable noun has no plural row: "souris" → "souris".
    { kind: 'property', caseName: 'pluralFR', extract: (entry) => row(entry, ['plural']) ?? (isInvariable(entry) ? entry.word : undefined) },
];

/**
 * Adjectives. Wiktionary lists the feminine, the masculine plural and the feminine plural. An adjective
 * with one shape for both genders ("facile", "rouge") has a single `plural` row: the feminine singular is the
 * lemma, and both plurals are that row. An invariable adjective ("marron") is the lemma in all four cells.
 */
const sharedPlural = (entry: LexiconEntry): string | undefined =>
    row(entry, ['feminine']) === undefined ? row(entry, ['plural'], ['feminine', 'masculine']) : undefined;

const femaleSingularFR = (entry: LexiconEntry): string | undefined =>
    row(entry, ['feminine'], ['plural', 'masculine']) ?? (sharedPlural(entry) !== undefined || isInvariable(entry) ? entry.word : undefined);
const malePluralFR = (entry: LexiconEntry): string | undefined =>
    row(entry, ['masculine', 'plural'], ['feminine']) ?? sharedPlural(entry) ?? (isInvariable(entry) ? entry.word : undefined);
const femalePluralFR = (entry: LexiconEntry): string | undefined =>
    row(entry, ['feminine', 'plural'], ['masculine']) ?? sharedPlural(entry) ?? (isInvariable(entry) ? entry.word : undefined);

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const comparative = (entry: LexiconEntry): string | undefined => row(entry, ['comparative']);
/** "plus vite": the prefix, then the word itself. The form's "Uses plus" box derives the phrase, so the box is sent and no comparative. */
const usesPlus = (entry: LexiconEntry): boolean => new RegExp(`^plus\\s+${escapeRegex(entry.word)}$`, 'i').test(comparative(entry) ?? '');

export const ADJECTIVE_SELECTORS_FR: CaseSelector[] = [
    { kind: 'property', caseName: 'maleSingularFR', extract: (entry) => entry.word },
    { kind: 'property', caseName: 'femaleSingularFR', extract: femaleSingularFR },
    { kind: 'property', caseName: 'malePluralFR', extract: malePluralFR },
    { kind: 'property', caseName: 'femalePluralFR', extract: femalePluralFR },
    // Irregular only (bon → meilleur): Wiktionary lists a comparative for 0.1% of the adjectives.
    { kind: 'property', caseName: 'comparativeFR', extract: (entry) => (usesPlus(entry) ? undefined : comparative(entry)) },
    { kind: 'property', caseName: 'periphrasticFR', extract: (entry) => (usesPlus(entry) ? 'true' : undefined) },
    // beau → bel, nouveau → nouvel, vieux → vieil. The box and the form have two names (see forms-french.md).
    { kind: 'property', caseName: 'vowelFormFR', extract: (entry) => row(entry, ['before-vowel', 'masculine', 'singular']) },
    { kind: 'property', caseName: 'hasVowelFormFR', extract: (entry) => (row(entry, ['before-vowel', 'masculine', 'singular']) ? 'true' : undefined) },
];

/**
 * Adverbs, as the Spanish ones: "Gradable" only when a degree row exists, and the "plus" box instead of a
 * typed "plus vite". Only irregular degrees have rows (bien → mieux). The superlative is locked in the form.
 */
export const ADVERB_SELECTORS_FR: CaseSelector[] = [
    { kind: 'property', caseName: 'gradableFR', extract: (entry) => (comparative(entry) || row(entry, ['superlative']) ? 'Gradable' : undefined) },
    { kind: 'property', caseName: 'adverbFR', extract: (entry) => entry.word },
    { kind: 'property', caseName: 'comparativeFR', extract: (entry) => (usesPlus(entry) ? undefined : comparative(entry)) },
    { kind: 'property', caseName: 'periphrasticFR', extract: (entry) => (usesPlus(entry) ? 'true' : undefined) },
];

/** Conjunctions and adpositions: see selectors/functionWords.ts. French Wiktionary states no type, mood or position. */
export const CONJUNCTION_SELECTORS_FR: CaseSelector[] = conjunctionSelectors('FR');
export const PREPOSITION_SELECTORS_FR: CaseSelector[] = prepositionSelectors('FR');

/**
 * Verbs (slice 9b). A French verb entry holds one conjugation table per use: the plain one ("aimer") and, for a verb
 * that is also used with a pronoun, a pronominal one ("s'appeler"). A new table starts at each `table-tags` row.
 * The pronominal table is not always tagged `reflexive` ("appeler" has a second table with no such tag), so a table
 * is pronominal when its infinitive starts with "se " or "s'".
 *
 * - The plain table is used when there is one. A verb with only a pronominal table ("se souvenir") uses that table,
 *   and its forms lose the leading pronoun ("me souviens" → "souviens"): the form shows the pronoun as a hint.
 *   The infinitive keeps its "se": that is how the form writes it (decision of slice 9b).
 * - Auxiliary: from the text row "present indicative of avoir". A table that names both avoir and être (partir,
 *   tomber) leaves it empty (decision Q1). A verb with only a pronominal table takes être.
 * - Verb group: derived from the infinitive (Wiktionary has no group): -er → 1er (aller → 3e), -ir with a present
 *   participle in -issant → 2e, all others → 3e (review-log A4).
 * - The passé composé has no row per person. All six boxes get the masculine singular past participle (decision Q2).
 * - Only what the form uses is stored: present, imperfect and simple future, both participles (decision Q3).
 */
type FormRow = NonNullable<LexiconEntry['forms']>[number];

const PRONOMINAL_INFINITIVE = /^(se |s['’])/;
const LEADING_PRONOUN = /^(?:(?:me|te|se|nous|vous)\s+|[mts]['’])(?:en\s+|y\s+)?/;
const AUXILIARY_FR = { avoir: 'avoir', etre: 'être' };

const infinitiveRow = (table: FormRow[]): string | undefined =>
    table.find((row) => row.tags?.includes('infinitive') && !row.tags.includes('multiword-construction') && row.form !== '-')?.form;

interface VerbTable {
    /** The forms of the table in use, as an entry of their own (the selectors work on entries). */
    entry: LexiconEntry;
    pronominal: boolean;
    /** The entry also has the other kind of table. */
    hasBoth: boolean;
}

/** The table a French verb is read from, or undefined when the entry has no conjugation table with an infinitive. */
function verbTable(entry: LexiconEntry): VerbTable | undefined {
    const tables: FormRow[][] = [];
    for (const row of entry.forms ?? []) {
        if (tables.length === 0 || row.tags?.includes('table-tags')) tables.push([]);
        tables[tables.length - 1].push(row);
    }
    const plain = tables.find((table) => { const infinitive = infinitiveRow(table); return infinitive !== undefined && !PRONOMINAL_INFINITIVE.test(infinitive); });
    const pronominal = tables.find((table) => { const infinitive = infinitiveRow(table); return infinitive !== undefined && PRONOMINAL_INFINITIVE.test(infinitive); });
    const used = plain ?? pronominal;
    if (!used) return undefined;
    return { entry: { ...entry, forms: used }, pronominal: !plain, hasBoth: plain !== undefined && pronominal !== undefined };
}

/** Removes the reflexive pronoun of a pronominal table's form: "me souviens" → "souviens", "m'en vais" → "vais". */
const withoutPronoun = (table: VerbTable, value: string | undefined): string | undefined =>
    value === undefined || !table.pronominal ? value : value.replace(LEADING_PRONOUN, '') || undefined;

/** A form of the table in use. `multiword-construction` rows are text ("avoir + past participle"), not forms. */
function verbForm(entry: LexiconEntry, tags: string[], keepPronoun = false): string | undefined {
    const table = verbTable(entry);
    if (!table) return undefined;
    const value = selectForm(table.entry, { kind: 'form', caseName: '', tags, excludeTags: ['multiword-construction'] });
    return keepPronoun ? value : withoutPronoun(table, value);
}

const infinitiveFR = (entry: LexiconEntry): string | undefined => verbForm(entry, ['infinitive'], true);
const pastParticipleFR = (entry: LexiconEntry): string | undefined => verbForm(entry, ['participle', 'past']);
const presentParticipleFR = (entry: LexiconEntry): string | undefined => verbForm(entry, ['participle', 'present']);

function auxVerbFR(entry: LexiconEntry): string | undefined {
    const table = verbTable(entry);
    if (!table) return undefined;
    if (table.pronominal) return AUXILIARY_FR.etre;
    const texts = (table.entry.forms ?? [])
        .filter((row) => ['indicative', 'multiword-construction', 'perfect', 'present'].every((tag) => row.tags?.includes(tag)))
        .map((row) => row.form);
    const avoir = texts.some((text) => /(^|\s)avoir(\s|$)/.test(text));
    const etre = texts.some((text) => /(^|\s)être(\s|$)/.test(text));
    return avoir === etre ? undefined : avoir ? AUXILIARY_FR.avoir : AUXILIARY_FR.etre;
}

function verbGroupFR(entry: LexiconEntry): string | undefined {
    const infinitive = infinitiveFR(entry);
    if (!infinitive) return undefined;
    const bare = infinitive.replace(PRONOMINAL_INFINITIVE, '').replace(/^en\s+/, '');
    if (bare === 'aller') return '3e groupe';
    if (/er$/.test(bare)) return '1er groupe';
    if (/ir$/.test(bare)) {
        const participle = presentParticipleFR(entry);
        return participle === undefined ? undefined : /issant$/.test(participle) ? '2e groupe' : '3e groupe';
    }
    return '3e groupe';
}

/**
 * "Always reflexive": only a pronominal table ("se souvenir"). "Optionally reflexive": both tables ("laver" / "se laver"),
 * or a sense tagged `reflexive` or `pronominal`. Everything else is "Not reflexive", which means "no evidence".
 */
function reflexivityFR(entry: LexiconEntry): string {
    const table = verbTable(entry);
    if (table?.pronominal) return 'Always reflexive';
    const reflexiveSense = (entry.senses ?? []).some((sense) => !sense.form_of && (sense.tags?.includes('reflexive') || sense.tags?.includes('pronominal')));
    return table?.hasBoth || reflexiveSense ? 'Optionally reflexive' : 'Not reflexive';
}

const PERSONS_FR: [slot: string, tags: string[]][] = [
    ['1s', ['first-person', 'singular']], ['2s', ['second-person', 'singular']], ['3s', ['third-person', 'singular']],
    ['1pl', ['first-person', 'plural']], ['2pl', ['second-person', 'plural']], ['3pl', ['third-person', 'plural']],
];

function tenseFR(prefix: string, tags: string[]): CaseSelector[] {
    return PERSONS_FR.map(([slot, person]) => ({
        kind: 'property',
        caseName: `${prefix}${slot}FR`,
        extract: (entry: LexiconEntry) => verbForm(entry, [...tags, ...person]),
    }));
}

export const VERB_SELECTORS_FR: CaseSelector[] = [
    { kind: 'property', caseName: 'infinitiveFR', extract: infinitiveFR },
    { kind: 'property', caseName: 'verbGroupFR', extract: verbGroupFR },
    { kind: 'property', caseName: 'auxVerbFR', extract: auxVerbFR },
    { kind: 'property', caseName: 'reflexivityFR', extract: reflexivityFR },
    { kind: 'property', caseName: 'pastParticipleFR', extract: pastParticipleFR },
    { kind: 'property', caseName: 'presentParticipleFR', extract: presentParticipleFR },
    ...tenseFR('indicativePresent', ['indicative', 'present']),
    ...tenseFR('indicativeImperfect', ['indicative', 'imperfect']),
    ...tenseFR('indicativeSimpleFuture', ['indicative', 'future']),
    // The passé composé: the participle in each person's box; the auxiliary is the form's adornment.
    ...PERSONS_FR.map(([slot]): CaseSelector => ({ kind: 'property', caseName: `indicativePerfect${slot}FR`, extract: pastParticipleFR })),
];
