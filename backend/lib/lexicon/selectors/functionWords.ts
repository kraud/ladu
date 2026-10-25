/**
 * Selectors for conjunctions and adpositions (conjunctions-and-prepositions plan, slice 3b).
 * Shared by German, English and Spanish: the case names differ only in the language code.
 *
 * Nothing is guessed (decisions Q8, Q9): a fact is filled only when the Wiktionary entry states it.
 * - Conjunction type: the entry's categories or sense tags say "coordinating" or "subordinating".
 *   When they say both ("weil": the obsolete sense is coordinating), no type is filled.
 * - Pair: a headword with an ellipsis ("sowohl ... als auch", "neither … nor") is split into the
 *   first part, `correlative` "true" and the second part. A slash is no pair marker ("and/or").
 * - Position: the entry is a preposition (`prep`) or a postposition (`postp`). Both entries of one
 *   word are merged later (`lib/lexicon/adpositions.ts`).
 * - Governed case (German only): the entry's categories "German prepositions governing the dative"
 *   (or "postpositions governing ..." for a `postp` entry).
 *
 * The values are the option values of the frontend forms (`configs/conjunctions.ts`, `prepositions.ts`).
 */

import type { CaseSelector, LexiconEntry } from '../select';

export const BEFORE_THE_NOUN = 'Before the noun';
export const AFTER_THE_NOUN = 'After the noun';
export const BEFORE_OR_AFTER = 'Before or after the noun';

/** Every category of the entry and of its senses, lower case. */
function categoriesOf(entry: LexiconEntry): string[] {
    return [...(entry.categories ?? []), ...(entry.senses ?? []).flatMap((sense) => sense.categories ?? [])].map((category) => category.toLowerCase());
}

/** "Coordinating" or "Subordinating" when the entry says exactly one of them. */
function conjunctionType(entry: LexiconEntry): string | undefined {
    const text = [...categoriesOf(entry), ...(entry.tags ?? []), ...(entry.senses ?? []).flatMap((sense) => sense.tags ?? [])].map((part) => part.toLowerCase());
    const coordinating = text.some((part) => part.includes('coordinating'));
    const subordinating = text.some((part) => part.includes('subordinating'));
    if (coordinating === subordinating) return undefined;
    return coordinating ? 'Coordinating' : 'Subordinating';
}

/** "sowohl ... als auch" -> ["sowohl", "als auch"]; a headword without an ellipsis -> [headword]. */
export function pairParts(word: string): string[] {
    const parts = word.split(/\s*(?:…|\.\.\.)\s*/).map((part) => part.trim()).filter(Boolean);
    return parts.length === 2 ? parts : [word.trim()];
}

export function conjunctionSelectors(code: string): CaseSelector[] {
    return [
        { kind: 'property', caseName: `conjunction${code}`, extract: (entry) => pairParts(entry.word)[0] },
        { kind: 'property', caseName: `conjunctionType${code}`, extract: conjunctionType },
        { kind: 'property', caseName: `correlative${code}`, extract: (entry) => (pairParts(entry.word).length === 2 ? 'true' : undefined) },
        { kind: 'property', caseName: `secondPart${code}`, extract: (entry) => pairParts(entry.word)[1] },
    ];
}

export function prepositionSelectors(code: string): CaseSelector[] {
    return [
        { kind: 'property', caseName: `preposition${code}`, extract: (entry) => entry.word },
        { kind: 'property', caseName: `position${code}`, extract: (entry) => (entry.pos === 'postp' ? AFTER_THE_NOUN : BEFORE_THE_NOUN) },
    ];
}

/** The letters of the governed-case value, in the order the German form encodes them. */
const CASE_LETTER: [word: string, letter: string][] = [['accusative', 'A'], ['dative', 'D'], ['genitive', 'G']];

/**
 * German: "AD" for an entry whose categories name the accusative and the dative. A `postp` entry reads
 * its own "postpositions governing" list, any other entry the "prepositions governing" list, because
 * Wiktionary puts both lists on the page of a word that is both ("zufolge").
 */
export function governedCaseDE(entry: LexiconEntry): string | undefined {
    const kind = entry.pos === 'postp' ? 'postpositions' : 'prepositions';
    const governed = categoriesOf(entry).flatMap((category) => {
        const match = new RegExp(`^german ${kind} governing the (\\w+)$`).exec(category);
        return match ? [match[1]] : [];
    });
    const letters = CASE_LETTER.filter(([word]) => governed.includes(word)).map(([, letter]) => letter).join('');
    return letters === '' ? undefined : letters;
}
