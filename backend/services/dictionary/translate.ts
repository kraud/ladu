/**
 * The translate lookup (autocomplete-data-source-strategy.md Slice F, step F2; decision D22):
 * one word in any of the four languages → the senses it belongs to → for each sense, the words in
 * every language. Reads `lexeme_translations` (English Wiktionary translation tables).
 *
 * English is the hub. From English: the senses of that English word. From another language
 * (reverse lookup): the English senses that list the word, then the other words of those senses.
 * Every sense lists all four languages (the English word too), an empty list where the data has
 * none: no language is "primary" (design commandment 4).
 *
 * Order of the senses:
 * - From English: Wiktionary's own order (entry, then sense: the main sense first).
 * - Reverse: first the senses where the word is listed first (the common translation), then the
 *   more frequent English word (`lexemes` rank, nouns and verbs only), then Wiktionary's order.
 * Words in a sense: as listed (`word_order`, the common one first).
 *
 * Estonian is thin in Wiktionary (D22): when no sense has an Estonian word, the route also asks
 * Ekilex (meaning search) and returns its Estonian words apart, under `ekilex` — they come from
 * Ekilex meanings, not from these senses. An Ekilex failure does not fail the route: `ekilex`
 * then says so.
 */

const { and, asc, eq, inArray, like, min, notLike }: typeof import('drizzle-orm') = require('drizzle-orm');
const { db }: typeof import('../../src/db') = require('../../src/db');
const { lexemes, lexemeTranslations }: typeof import('../../src/db/schema') = require('../../src/db/schema');
const { searchKey }: typeof import('../../lib/lexicon/searchKey') = require('../../lib/lexicon/searchKey');
const { estonianEquivalents }: typeof import('./eki') = require('./eki');

export const TRANSLATE_LANGUAGES = ['English', 'Spanish', 'German', 'Estonian'] as const;
export const TRANSLATE_PARTS_OF_SPEECH = ['Noun', 'Verb', 'Adjective', 'Adverb'] as const;
type Language = (typeof TRANSLATE_LANGUAGES)[number];

/** Senses returned at most; a common word ("run", "set") has dozens. */
const MAX_SENSES = 20;

export interface TranslationWord {
    word: string;
    /** Nouns: der / die / das, el / la / "el/la", as the form stores it. */
    gender?: string;
}

export interface TranslationSense {
    /** The English word whose Wiktionary entry holds this sense. */
    english: string;
    /** Wiktionary's label for the sense ("body of water"); may be empty. */
    sense: string;
    words: Record<Language, TranslationWord[]>;
}

export interface TranslateResult {
    senses: TranslationSense[];
    /** Only when Ekilex was asked (no sense has an Estonian word, and the start is not Estonian). */
    ekilex?: { estonian: TranslationWord[] } | { unavailable: true };
}

const senseId = (row: { englishLemma: string; entryOrder: number; senseOrder: number }) =>
    `${row.englishLemma}\u0000${row.entryOrder}\u0000${row.senseOrder}`;

/** Compares two sort keys of equal length, item by item. */
function compareOrder(a: number[], b: number[]): number {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
}

const emptyWords = (): Record<Language, TranslationWord[]> => ({ English: [], Spanish: [], German: [], Estonian: [] });

export async function translate(fromLanguage: Language, partOfSpeech: string, query: string): Promise<TranslateResult> {
    const key = searchKey(query);
    const t = lexemeTranslations;

    // 1. The senses the word belongs to, with the word's own position in each (reverse lookup).
    const matches = await db
        .select({ englishLemma: t.englishLemma, englishSearchKey: t.englishSearchKey, entryOrder: t.entryOrder, senseOrder: t.senseOrder, wordOrder: t.wordOrder })
        .from(t)
        .where(
            fromLanguage === 'English'
                ? and(eq(t.partOfSpeech, partOfSpeech), eq(t.englishSearchKey, key))
                : and(eq(t.language, fromLanguage), eq(t.partOfSpeech, partOfSpeech), eq(t.searchKey, key)),
        );

    const wordOrderIn = new Map<string, number>();
    for (const match of matches) {
        const id = senseId(match);
        const order = fromLanguage === 'English' ? 0 : match.wordOrder;
        wordOrderIn.set(id, Math.min(order, wordOrderIn.get(id) ?? order));
    }

    const senses: (TranslationSense & { order: number[] })[] = [];
    if (wordOrderIn.size > 0) {
        // 2. Every word of those senses.
        const englishKeys = [...new Set(matches.map((match) => match.englishSearchKey))];
        const rows = await db
            .select({
                englishLemma: t.englishLemma, entryOrder: t.entryOrder, sense: t.sense, senseOrder: t.senseOrder,
                language: t.language, word: t.word, gender: t.gender,
            })
            .from(t)
            .where(and(eq(t.partOfSpeech, partOfSpeech), inArray(t.englishSearchKey, englishKeys)))
            .orderBy(asc(t.entryOrder), asc(t.senseOrder), asc(t.wordOrder));

        // The English word's frequency rank orders a reverse lookup ("banco": bank before bench).
        const ranks = new Map<string, number>();
        if (fromLanguage !== 'English') {
            const ranked = await db
                .select({ searchKey: lexemes.searchKey, rank: min(lexemes.frequencyRank) })
                .from(lexemes)
                .where(and(eq(lexemes.language, 'English'), eq(lexemes.partOfSpeech, partOfSpeech), inArray(lexemes.searchKey, englishKeys)))
                .groupBy(lexemes.searchKey);
            for (const { searchKey: rankedKey, rank } of ranked) if (rank !== null) ranks.set(rankedKey, rank);
        }

        const byId = new Map<string, TranslationSense & { order: number[] }>();
        for (const row of rows) {
            const id = senseId(row);
            const ownOrder = wordOrderIn.get(id);
            if (ownOrder === undefined) continue;
            let sense = byId.get(id);
            if (!sense) {
                const words = emptyWords();
                words.English.push({ word: row.englishLemma });
                const rank = ranks.get(searchKey(row.englishLemma)) ?? Number.MAX_SAFE_INTEGER;
                sense = { english: row.englishLemma, sense: row.sense, words, order: [ownOrder, rank, row.entryOrder, row.senseOrder] };
                byId.set(id, sense);
                senses.push(sense);
            }
            sense.words[row.language as Language].push(row.gender ? { word: row.word, gender: row.gender } : { word: row.word });
        }
        senses.sort((a, b) => compareOrder(a.order, b.order));
    }

    const result: TranslateResult = { senses: senses.slice(0, MAX_SENSES).map(({ order, ...sense }) => sense) };
    if (fromLanguage !== 'Estonian' && !result.senses.some((sense) => sense.words.Estonian.length > 0)) {
        try {
            const estonian = await estonianEquivalents(query.trim(), fromLanguage, partOfSpeech);
            result.ekilex = { estonian: estonian.map((word) => ({ word })) };
        } catch {
            // eki.ts has logged it; the local senses still answer.
            result.ekilex = { unavailable: true };
        }
    }
    return result;
}

/**
 * Estonian "Search verb in English" (step F3, D22): the first English sense of `english` (Wiktionary
 * order: entry, sense, then the word's place in the sense) that has a one-word Estonian "-ma" verb,
 * and that verb ("run" → "jooksma"). undefined when the table has none; the caller then asks Ekilex.
 */
export async function firstEstonianVerb(english: string): Promise<string | undefined> {
    const t = lexemeTranslations;
    const [row] = await db
        .select({ word: t.word })
        .from(t)
        .where(and(
            eq(t.partOfSpeech, 'Verb'), eq(t.englishSearchKey, searchKey(english)), eq(t.language, 'Estonian'),
            like(t.word, '%ma'), notLike(t.word, '% %'),
        ))
        .orderBy(asc(t.entryOrder), asc(t.senseOrder), asc(t.wordOrder))
        .limit(1);
    return row?.word;
}
