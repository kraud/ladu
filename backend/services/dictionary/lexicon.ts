/**
 * The local lexicon adapter (`lexemes` table; autocomplete-data-source-strategy.md Slice B) and
 * the fallback chain that puts it in front of the rule-based libraries.
 *
 * Lookup: same language, part of speech and search key (lib/lexicon/searchKey.ts — the load
 * script stores the key with the same function). Several rows can match (homographs, decision
 * D15): among the rows that fill at least HALF as many fields as the fullest one, the source's
 * main sense wins (lowest `entry_order`). So a stub entry never wins ("Tag" with 2 fields vs 9),
 * and a main sense that lacks one field still does (modal "can": 20 fields vs 21 for "to can",
 * past "could", not "canned"). The type-ahead (Slice E) lets the user choose between meanings:
 * its suggestions carry the row id, and a lookup with that `entryId` returns that exact row.
 */

import type { DictionaryAdapter, LookupResult } from './types';
const { and, asc, eq, like, sql }: typeof import('drizzle-orm') = require('drizzle-orm');
const { db }: typeof import('../../src/db') = require('../../src/db');
const { lexemes }: typeof import('../../src/db/schema') = require('../../src/db/schema');
const { searchKey }: typeof import('../../lib/lexicon/searchKey') = require('../../lib/lexicon/searchKey');
const { NOT_FOUND, toCases }: typeof import('./types') = require('./types');

const filled = (forms: Record<string, string>) => Object.values(forms).filter((word) => word !== '').length;

interface Row {
    forms: Record<string, string>;
    entryOrder: number;
}

/** The rows that are not stubs: they fill at least half as many fields as the fullest row (D15). */
function fullEntries<T extends Row>(rows: T[]): T[] {
    const most = Math.max(...rows.map((row) => filled(row.forms)));
    return rows.filter((row) => filled(row.forms) * 2 >= most);
}

const mainSense = <T extends Row>(rows: T[]): T => rows.reduce((a, b) => (b.entryOrder < a.entryOrder ? b : a));

/**
 * An adapter that answers from the `lexemes` table only: `found` or `not-found`.
 * With `entryId` (a type-ahead pick) it returns that row, if the row is still for this language,
 * part of speech and query; otherwise the usual D15 choice.
 */
export function lexiconAdapter(language: string, partOfSpeech: string): DictionaryAdapter {
    return async (query, { entryId }) => {
        const rows = await db
            .select({ id: lexemes.id, forms: lexemes.forms, entryOrder: lexemes.entryOrder })
            .from(lexemes)
            .where(and(eq(lexemes.language, language), eq(lexemes.partOfSpeech, partOfSpeech), eq(lexemes.searchKey, searchKey(query))));
        if (rows.length === 0) return NOT_FOUND;

        const best = rows.find((row) => row.id === entryId) ?? mainSense(fullEntries(rows));
        return { status: 'found', cases: toCases(Object.entries(best.forms)) };
    };
}

/** One item of the type-ahead list. `hint` tells homographs apart: the noun's article (der/die). */
export interface Suggestion {
    entryId: string;
    lemma: string;
    hint?: string;
}

const GENDER_CASE: Record<string, string> = { German: 'genderDE', Spanish: 'genderES' };
// Rows read per request before the stubs and duplicates are removed: more than `limit`, so the
// list stays full. A homograph group cut at this edge can show one stub; that is acceptable.
const OVERFETCH = 4;

/** `%` and `_` are LIKE wildcards and `\` is its escape character: a typed one must match itself. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

/**
 * The type-ahead list (Slice E): lemmas whose search key starts with `prefix`. Order: frequency
 * rank (unranked last), then shorter words, then alphabetical. Per search key, stubs are dropped
 * (D15), and entries with the same lemma and hint collapse to the main sense, so "See" shows
 * twice (der, die) but "Tag" once.
 */
export async function lexiconSuggestions(language: string, partOfSpeech: string, prefix: string, limit: number): Promise<Suggestion[]> {
    const rows = await db
        .select({ id: lexemes.id, lemma: lexemes.lemma, searchKey: lexemes.searchKey, forms: lexemes.forms, entryOrder: lexemes.entryOrder })
        .from(lexemes)
        .where(and(eq(lexemes.language, language), eq(lexemes.partOfSpeech, partOfSpeech), like(lexemes.searchKey, `${escapeLike(searchKey(prefix))}%`)))
        .orderBy(sql`${lexemes.frequencyRank} asc nulls last`, sql`length(${lexemes.searchKey})`, asc(lexemes.searchKey), asc(lexemes.entryOrder))
        .limit(limit * OVERFETCH);

    const byKey = new Map<string, typeof rows>();
    for (const row of rows) byKey.set(row.searchKey, [...(byKey.get(row.searchKey) ?? []), row]);

    const genderCase = partOfSpeech === 'Noun' ? GENDER_CASE[language] : undefined;
    const hintOf = (row: Row) => (genderCase ? row.forms[genderCase] || undefined : undefined);
    const suggestions: Suggestion[] = [];
    for (const group of byKey.values()) {
        const byLemmaAndHint = new Map<string, typeof rows>();
        for (const row of fullEntries(group)) {
            const id = `${row.lemma}\u0000${hintOf(row) ?? ''}`;
            byLemmaAndHint.set(id, [...(byLemmaAndHint.get(id) ?? []), row]);
        }
        for (const same of byLemmaAndHint.values()) {
            const row = mainSense(same);
            suggestions.push({ entryId: row.id, lemma: row.lemma, ...(hintOf(row) ? { hint: hintOf(row) } : {}) });
        }
    }
    return suggestions.slice(0, limit);
}

/**
 * Lexicon first; on a miss, the fallback.
 * - `fallback: 'guess'` (default): a rule-based library. Its answer is a guess, not a dictionary
 *   entry, so its `found` becomes `partial` — the form shows the "not fully sure" notice (D2).
 * - `fallback: 'dictionary'`: an online dictionary (Ekilex). Its `found` stays `found`.
 * A search by English word (`searchInEnglish`) goes straight to the fallback: the lexicon is
 * keyed by the word in its own language.
 */
export function lexiconFirst(
    lexicon: DictionaryAdapter,
    fallback: DictionaryAdapter,
    { fallbackIs = 'guess' }: { fallbackIs?: 'guess' | 'dictionary' } = {},
): DictionaryAdapter {
    return async (query, options) => {
        if (!options.searchInEnglish) {
            const fromLexicon = await lexicon(query, options);
            if (fromLexicon.status === 'found') return fromLexicon;
        }
        const answer: LookupResult = await fallback(query, options);
        return fallbackIs === 'guess' && answer.status === 'found' ? { ...answer, status: 'partial' } : answer;
    };
}
