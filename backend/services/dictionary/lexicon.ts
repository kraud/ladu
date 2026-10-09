/**
 * The local lexicon adapter (`lexemes` table; autocomplete-data-source-strategy.md Slice B) and
 * the fallback chain that puts it in front of the rule-based libraries.
 *
 * Lookup: same language, part of speech and search key (lib/lexicon/searchKey.ts — the load
 * script stores the key with the same function). Several rows can match (homographs, decision
 * D15): among the rows that fill at least HALF as many fields as the fullest one, the source's
 * main sense wins (lowest `entry_order`). So a stub entry never wins ("Tag" with 2 fields vs 9),
 * and a main sense that lacks one field still does (modal "can": 20 fields vs 21 for "to can",
 * past "could", not "canned"). Choosing between meanings comes with the type-ahead (Slice E).
 */

import type { DictionaryAdapter, LookupResult } from './types';
const { and, eq }: typeof import('drizzle-orm') = require('drizzle-orm');
const { db }: typeof import('../../src/db') = require('../../src/db');
const { lexemes }: typeof import('../../src/db/schema') = require('../../src/db/schema');
const { searchKey }: typeof import('../../lib/lexicon/searchKey') = require('../../lib/lexicon/searchKey');
const { NOT_FOUND, toCases }: typeof import('./types') = require('./types');

const filled = (forms: Record<string, string>) => Object.values(forms).filter((word) => word !== '').length;

/** An adapter that answers from the `lexemes` table only: `found` or `not-found`. */
export function lexiconAdapter(language: string, partOfSpeech: string): DictionaryAdapter {
    return async (query) => {
        const rows = await db
            .select({ forms: lexemes.forms, entryOrder: lexemes.entryOrder })
            .from(lexemes)
            .where(and(eq(lexemes.language, language), eq(lexemes.partOfSpeech, partOfSpeech), eq(lexemes.searchKey, searchKey(query))));
        if (rows.length === 0) return NOT_FOUND;

        const most = Math.max(...rows.map((row) => filled(row.forms)));
        const best = rows
            .filter((row) => filled(row.forms) * 2 >= most)
            .reduce((a, b) => (b.entryOrder < a.entryOrder ? b : a));
        return { status: 'found', cases: toCases(Object.entries(best.forms)) };
    };
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
