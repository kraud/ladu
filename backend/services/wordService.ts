/**
 * Word Service — shared helpers for assembling full word data with
 * translations, cases, and tags.
 *
 * The old MongoDB schema stored translations and cases as embedded subdocuments
 * inside each Word document. PostgreSQL normalises this into three levels:
 *   words → translations → translation_cases
 *
 * The functions in this file reconstruct the legacy nested shape
 * (see WordResponse) so every controller can return data the front-end expects
 * without duplicating the join logic.
 *
 * Extracted from wordController.ts to avoid controller→controller imports
 * (which can lead to circular dependencies) and to eliminate the duplicate
 * join logic that had appeared in exerciseController.ts and tagController.ts.
 *
 * Controllers should import these helpers rather than reimplementing the
 * translations+cases join themselves.
 */

const { db } = require('../src/db');
const {
    tags,
    tagWords,
    translationCases,
    translations,
    words,
} = require('../src/db/schema');
const { inArray } = require('drizzle-orm');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WordRow = typeof words.$inferSelect;
type TranslationRow = typeof translations.$inferSelect;
type CaseRow = typeof translationCases.$inferSelect;
type TagRow = typeof tags.$inferSelect;

/**
 * A single translation with its grammatical cases,
 * matching the legacy embedded shape.
 */
export interface AssembledTranslation {
    _id: string;
    language: string;
    cases: Array<{ word: string; caseName: string }>;
}

/**
 * Fully assembled word matching the old Mongoose response shape.
 * Every public endpoint that returns words uses this format.
 *
 * The old schema stored translations + cases as a nested subdocument.
 * Here they are spread into this flat-ish shape by fetchWordsWithRelations.
 */
export interface WordResponse {
    _id: string;
    id: string;
    user: string;
    partOfSpeech: string;
    translations: AssembledTranslation[];
    clue: string | null;
    isCloned: boolean;
    originalCreator: string | null;
    tags: TagRow[];
    createdAt: Date;
    updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Fetch translations + cases and group by wordId
// ---------------------------------------------------------------------------

/**
 * Fetch all translations and their cases for a set of word UUIDs.
 * Returns a Map<wordId, AssembledTranslation[]> for O(1) look-up.
 *
 * Two separate queries (translations → translation_cases) joined in
 * application memory, replacing the old MongoDB $lookup pipeline.
 */
const fetchTranslationsMap = async (
    wordIds: string[],
): Promise<Map<string, AssembledTranslation[]>> => {
    if (wordIds.length === 0) return new Map();

    const translationRows = await db
        .select()
        .from(translations)
        .where(inArray(translations.wordId, wordIds));

    if (translationRows.length === 0) return new Map();

    const translationIds = translationRows.map((t) => t.id);

    const caseRows = await db
        .select()
        .from(translationCases)
        .where(inArray(translationCases.translationId, translationIds));

    // Group cases by translation id
    const casesByTranslationId = new Map<string, CaseRow[]>();
    for (const c of caseRows) {
        const bucket = casesByTranslationId.get(c.translationId);
        if (bucket) bucket.push(c);
        else casesByTranslationId.set(c.translationId, [c]);
    }

    // Group translations by word id
    const map = new Map<string, AssembledTranslation[]>();
    for (const t of translationRows) {
        const entry: AssembledTranslation = {
            _id: t.id,
            language: t.language,
            cases: (casesByTranslationId.get(t.id) || []).map((c) => ({
                word: c.word,
                caseName: c.caseName,
            })),
        };
        const bucket = map.get(t.wordId);
        if (bucket) bucket.push(entry);
        else map.set(t.wordId, [entry]);
    }

    return map;
};

// ---------------------------------------------------------------------------
// Fetch tags linked to words (via tag_words junction)
// ---------------------------------------------------------------------------

/**
 * Fetch all tags linked to a set of word UUIDs.
 * Returns a Map<wordId, TagRow[]>.
 */
const fetchTagsMap = async (
    wordIds: string[],
): Promise<Map<string, TagRow[]>> => {
    if (wordIds.length === 0) return new Map();

    const junctionRows = await db
        .select({ tagId: tagWords.tagId, wordId: tagWords.wordId })
        .from(tagWords)
        .where(inArray(tagWords.wordId, wordIds));

    if (junctionRows.length === 0) return new Map();

    const tagIdSet = [...new Set(junctionRows.map((j) => j.tagId))];
    const tagRows = await db
        .select()
        .from(tags)
        .where(inArray(tags.id, tagIdSet));
    const tagById = new Map(tagRows.map((t) => [t.id, t]));

    const map = new Map<string, TagRow[]>();
    for (const j of junctionRows) {
        const tag = tagById.get(j.tagId);
        if (!tag) continue;
        const bucket = map.get(j.wordId);
        if (bucket) bucket.push(tag);
        else map.set(j.wordId, [tag]);
    }

    return map;
};

// ---------------------------------------------------------------------------
// Assemble a single word response
// ---------------------------------------------------------------------------

/**
 * Assemble a single WordResponse from a WordRow plus pre-fetched maps.
 * All controllers should call fetchWordsWithRelations rather than this
 * directly, unless they already have the maps in hand.
 */
const assembleWord = (
    word: WordRow,
    translationsMap: Map<string, AssembledTranslation[]>,
    tagsMap: Map<string, TagRow[]>,
): WordResponse => ({
    _id: word.id,
    id: word.id,
    user: word.userId,
    partOfSpeech: word.partOfSpeech,
    translations: translationsMap.get(word.id) || [],
    clue: word.clue,
    isCloned: word.isCloned,
    originalCreator: word.originalCreatorId,
    tags: tagsMap.get(word.id) || [],
    createdAt: word.createdAt,
    updatedAt: word.updatedAt,
});

// ---------------------------------------------------------------------------
// Public API: fetch words with full relations
// ---------------------------------------------------------------------------

/**
 * Fetch one or more words by their UUIDs and return them as fully assembled
 * WordResponse objects (with nested translations, cases, and tags).
 *
 * This is the primary function controllers should call when they need to
 * return word data to the front-end. It replaces:
 *   - The old MongoDB aggregation $lookup pipeline
 *   - The incomplete getWordsByIds that only returned bare word rows
 *
 * @param wordIds - Array of word UUIDs
 * @returns Array of WordResponse objects (empty array if none found)
 */
const fetchWordsWithRelations = async (
    wordIds: string[],
): Promise<WordResponse[]> => {
    if (wordIds.length === 0) return [];

    const wordRows = await db
        .select()
        .from(words)
        .where(inArray(words.id, wordIds));
    if (wordRows.length === 0) return [];

    const tMap = await fetchTranslationsMap(wordIds);
    const tagsMap = await fetchTagsMap(wordIds);

    return wordRows.map((w) => assembleWord(w, tMap, tagsMap));
};

/**
 * Fetch a single word by id (shorthand).
 */
const fetchWordWithRelations = async (
    wordId: string,
): Promise<WordResponse | null> => {
    const results = await fetchWordsWithRelations([wordId]);
    return results[0] || null;
};

/**
 * Fetch raw word rows only (no translations, cases, or tags).
 * This is intentionally limited — it does NOT include translations or cases.
 *
 * Use this when you only need word-level fields (e.g. cloning a word).
 * Use fetchWordsWithRelations when you need the full nested shape.
 */
const getWordsByIds = async (wordIds: string[]): Promise<WordRow[]> => {
    if (wordIds.length === 0) return [];
    return db.select().from(words).where(inArray(words.id, wordIds));
};

module.exports = {
    fetchTranslationsMap,
    fetchTagsMap,
    assembleWord,
    fetchWordsWithRelations,
    fetchWordWithRelations,
    getWordsByIds,
};

// TypeScript module marker — required so that `import type { WordResponse }`
// from consuming controllers works correctly with CJS + TS.
export {};
