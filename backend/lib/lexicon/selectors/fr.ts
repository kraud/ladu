/**
 * French selector table: app case field → where its value is in a kaikki entry.
 * Case names: frontend/src/ts/enums.ts (NounCases, AdjectiveCases, AdverbCases …). Engine: ../select.ts.
 * Research and decisions: .context/plans/language-french.md, "Slice 8 results".
 *
 * Slice 9a: nouns, adjectives, adverbs, conjunctions and prepositions. The verb table comes in slice 9b.
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
