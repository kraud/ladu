/**
 * The translate lookup (autocomplete-data-source-strategy.md Slice F, step F2; decision D22):
 * one word in any of the languages → the senses it belongs to → for each sense, the words in
 * every language. Reads `lexeme_translations` (English Wiktionary translation tables).
 *
 * English is the hub. From English: the senses of that English word. From another language
 * (reverse lookup): the English senses that list the word, then the other words of those senses.
 * Every sense lists every language (the English word too), an empty list where the data has
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

const { and, asc, eq, inArray, like, min, sql }: typeof import('drizzle-orm') = require('drizzle-orm');
const { db }: typeof import('../../src/db') = require('../../src/db');
const { lexemes, lexemeTranslations }: typeof import('../../src/db/schema') = require('../../src/db/schema');
const { searchKey }: typeof import('../../lib/lexicon/searchKey') = require('../../lib/lexicon/searchKey');
const { estonianEquivalents }: typeof import('./eki') = require('./eki');
const { escapeLike }: typeof import('./lexicon') = require('./lexicon');

const { LANGUAGE_NAMES }: typeof import('../../lib/languages') = require('../../lib/languages');

export const TRANSLATE_LANGUAGES = LANGUAGE_NAMES;
export const TRANSLATE_PARTS_OF_SPEECH = ['Noun', 'Verb', 'Adjective', 'Adverb', 'Conjunction', 'Preposition'] as const;
type Language = import('../../lib/languages').LanguageName;

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

const emptyWords = (): Record<Language, TranslationWord[]> =>
    Object.fromEntries(TRANSLATE_LANGUAGES.map((language) => [language, []])) as unknown as Record<Language, TranslationWord[]>;

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
        result.ekilex = await ekilexEstonian(query.trim(), fromLanguage, partOfSpeech);
    }
    return result;
}

/**
 * The Estonian words of the Ekilex meanings that list `word` (D22 item 2). An Ekilex failure does not
 * fail the route: eki.ts has logged it, the local senses still answer, and the result says so.
 */
async function ekilexEstonian(word: string, language: string, partOfSpeech: string): Promise<{ estonian: TranslationWord[] } | { unavailable: true }> {
    try {
        return { estonian: (await estonianEquivalents(word, language, partOfSpeech)).map((estonian) => ({ word: estonian })) };
    } catch {
        return { unavailable: true };
    }
}

/** Senses listed per word in the sense type-ahead ("bank" has many); the rest are reached by typing more. */
const MAX_SENSES_PER_WORD = 4;

/** Which sense of an English entry: `translate/sense` (Slice G, step G2) takes these three values. */
export interface SenseKey {
    englishLemma: string;
    entryOrder: number;
    senseOrder: number;
}

/** One line of the sense type-ahead: a word of the start language, in one of its senses. */
export interface SenseSuggestion {
    word: string;
    partOfSpeech: string;
    /** Nouns of the start language: der / die / das, el / la, as the table stores it. */
    gender?: string;
    /** The English word whose entry holds the sense (the word itself when the start is English). */
    english: string;
    /** Wiktionary's label for the sense; may be empty. */
    sense: string;
    key: SenseKey;
    /** The languages the sense has a word in, in TRANSLATE_LANGUAGES order. English is always there: it is the hub. */
    languages: Language[];
}

/**
 * The sense type-ahead (Slice G, step G1): words of `fromLanguage` that start with `prefix`, one
 * line per sense. `partOfSpeech` is one of TRANSLATE_PARTS_OF_SPEECH, or 'Any' for all of them.
 * The prefix is matched only against `fromLanguage` (for English: the English entry words).
 *
 * Order of the words: frequency rank (`lexemes`, unranked last), shorter, alphabetical — as the
 * word type-ahead (Slice E). Per word, at most MAX_SENSES_PER_WORD senses, in Wiktionary order
 * (the word's own place in the sense first: the common translation).
 */
export async function senseSuggestions(
    fromLanguage: Language,
    partOfSpeech: string,
    prefix: string,
    limit: number,
): Promise<SenseSuggestion[]> {
    const t = lexemeTranslations;
    const english = fromLanguage === 'English';
    const keyColumn = english ? t.englishSearchKey : t.searchKey;
    const wordColumn = english ? t.englishLemma : t.word;
    const where = and(
        english ? undefined : eq(t.language, fromLanguage),
        partOfSpeech === 'Any' ? undefined : eq(t.partOfSpeech, partOfSpeech),
        like(keyColumn, `${escapeLike(searchKey(prefix))}%`),
    );

    // 1. The words: one per (part of speech, search key), ranked.
    const rank = min(lexemes.frequencyRank);
    const words = await db
        .select({ partOfSpeech: t.partOfSpeech, key: keyColumn })
        .from(t)
        .leftJoin(lexemes, and(eq(lexemes.language, fromLanguage), eq(lexemes.partOfSpeech, t.partOfSpeech), eq(lexemes.searchKey, keyColumn)))
        .where(where)
        .groupBy(t.partOfSpeech, keyColumn)
        .orderBy(sql`${rank} asc nulls last`, sql`length(${keyColumn})`, asc(keyColumn), asc(t.partOfSpeech))
        .limit(limit);
    if (words.length === 0) return [];

    // 2. Their senses.
    const rows = await db
        .select({
            partOfSpeech: t.partOfSpeech, key: keyColumn, word: wordColumn, gender: t.gender,
            englishLemma: t.englishLemma, entryOrder: t.entryOrder, sense: t.sense, senseOrder: t.senseOrder, wordOrder: t.wordOrder,
        })
        .from(t)
        .where(and(
            english ? undefined : eq(t.language, fromLanguage),
            inArray(keyColumn, [...new Set(words.map((word) => word.key))]),
        ))
        .orderBy(asc(t.entryOrder), asc(t.senseOrder), asc(t.wordOrder));

    const wordId = (row: { partOfSpeech: string; key: string }) => `${row.partOfSpeech}\u0000${row.key}`;
    const bySense = new Map<string, SenseSuggestion>();
    const perWord = new Map<string, number>();
    const rowsByWord = new Map<string, typeof rows>();
    for (const row of rows) rowsByWord.set(wordId(row), [...(rowsByWord.get(wordId(row)) ?? []), row]);

    for (const word of words) {
        for (const row of rowsByWord.get(wordId(word)) ?? []) {
            const id = `${wordId(row)}\u0000${senseId(row)}`;
            if (bySense.has(id) || (perWord.get(wordId(row)) ?? 0) >= MAX_SENSES_PER_WORD) continue;
            perWord.set(wordId(row), (perWord.get(wordId(row)) ?? 0) + 1);
            bySense.set(id, {
                word: row.word,
                partOfSpeech: row.partOfSpeech,
                ...(row.gender && !english ? { gender: row.gender } : {}),
                english: row.englishLemma,
                sense: row.sense,
                key: { englishLemma: row.englishLemma, entryOrder: row.entryOrder, senseOrder: row.senseOrder },
                languages: ['English'],
            });
        }
    }
    const listed = [...bySense.values()].slice(0, limit);
    await addCoveredLanguages(listed);
    return listed;
}

/** Fills `languages` of the listed senses: one query for the languages that have a word in any of them. */
async function addCoveredLanguages(suggestions: SenseSuggestion[]): Promise<void> {
    if (suggestions.length === 0) return;
    const t = lexemeTranslations;
    const rows = await db
        .selectDistinct({ partOfSpeech: t.partOfSpeech, englishLemma: t.englishLemma, entryOrder: t.entryOrder, senseOrder: t.senseOrder, language: t.language })
        .from(t)
        .where(inArray(t.englishSearchKey, [...new Set(suggestions.map((s) => searchKey(s.english)))]));
    const covered = new Map<string, Set<string>>();
    for (const row of rows) {
        const id = `${row.partOfSpeech}\u0000${senseId(row)}`;
        covered.set(id, (covered.get(id) ?? new Set()).add(row.language));
    }
    for (const s of suggestions) {
        const has = covered.get(`${s.partOfSpeech}\u0000${senseId(s.key)}`);
        s.languages = TRANSLATE_LANGUAGES.filter((language) => language === 'English' || has?.has(language));
    }
}

/** One sense with the words of the asked languages only (a key is absent when the language was not asked). */
export interface SenseResult {
    sense: Omit<TranslationSense, 'words'> & { words: Partial<Record<Language, TranslationWord[]>> };
    /** Only when Estonian was asked and the sense has no Estonian word. */
    ekilex?: { estonian: TranslationWord[] } | { unavailable: true };
}

/**
 * One sense by its key (Slice G, step G2): the preview of a type-ahead pick. `languages` are the
 * languages of the user's account: only their words are returned, and Ekilex (D22) is asked only
 * when Estonian is among them and the sense has no Estonian word. undefined when the key matches
 * no row (a stale pick after a data reload).
 */
export async function senseWords(partOfSpeech: string, key: SenseKey, languages: readonly Language[]): Promise<SenseResult | undefined> {
    const t = lexemeTranslations;
    const rows = await db
        .select({ sense: t.sense, language: t.language, word: t.word, gender: t.gender })
        .from(t)
        .where(and(
            eq(t.partOfSpeech, partOfSpeech),
            eq(t.englishSearchKey, searchKey(key.englishLemma)),
            eq(t.englishLemma, key.englishLemma),
            eq(t.entryOrder, key.entryOrder),
            eq(t.senseOrder, key.senseOrder),
        ))
        .orderBy(asc(t.wordOrder));
    if (rows.length === 0) return undefined;

    const words: Partial<Record<Language, TranslationWord[]>> = {};
    for (const language of TRANSLATE_LANGUAGES) if (languages.includes(language)) words[language] = [];
    words.English?.push({ word: key.englishLemma });
    for (const row of rows) words[row.language as Language]?.push(row.gender ? { word: row.word, gender: row.gender } : { word: row.word });

    const result: SenseResult = { sense: { english: key.englishLemma, sense: rows[0].sense, words } };
    if (words.Estonian && words.Estonian.length === 0) {
        result.ekilex = await ekilexEstonian(key.englishLemma, 'English', partOfSpeech);
    }
    return result;
}
