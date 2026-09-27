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

const { db }: typeof import('../src/db') = require('../src/db');
const {
    tags,
    tagWords,
    translationCases,
    translations,
    words,
}: typeof import('../src/db/schema') = require('../src/db/schema');
const { and, eq, inArray, or } = require('drizzle-orm');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WordRow = typeof words.$inferSelect;
type TranslationRow = typeof translations.$inferSelect;
type CaseRow = typeof translationCases.$inferSelect;

/**
 * The slim shape a tag rides on a word response in — enough to render a
 * chip and tell ownership/visibility apart, not the full tag row (word
 * count, follower count, timestamps, …), which belongs to the tag API
 * itself (phase-4-tags.md Slice 2's `TagSummary`).
 */
export interface WordTagSummary {
    id: string;
    label: string;
    visibility: string;
    authorId: string;
}

/**
 * A single translation with its grammatical cases,
 * matching the legacy embedded shape.
 *
 * `id` only — the old `_id` alias (a MongoDB artifact with no column in the
 * Drizzle schema) was dropped in Phase 2 Slice 1; the new frontend reads `id`.
 */
export interface AssembledTranslation {
    id: string;
    language: string;
    cases: Array<{ word: string; caseName: string }>;
}

/**
 * Fully assembled word matching the old Mongoose response shape.
 * Every public endpoint that returns words uses this format.
 *
 * The old schema stored translations + cases as a nested subdocument.
 * Here they are spread into this flat-ish shape by fetchWordsWithRelations.
 *
 * `id` only — the `_id` alias was dropped in Phase 2 Slice 1.
 */
export interface WordResponse {
    id: string;
    user: string;
    partOfSpeech: string;
    translations: AssembledTranslation[];
    clue: string | null;
    isCloned: boolean;
    originalCreator: string | null;
    tags: WordTagSummary[];
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
            id: t.id,
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
 * Fetch all tags linked to a set of word UUIDs, filtered to what `viewerId`
 * may see: the viewer's own tags, or another author's Public tags — a
 * follower must never see the word owner's unrelated Private tag labels
 * just because that word also happens to carry one (phase-4-tags.md, "Why
 * the backend is being rebuilt"). Friends-Only is deferred (excluded here
 * unless the viewer is the author) until Phase 6 wires real friendships
 * into this filter too.
 *
 * Returns a Map<wordId, WordTagSummary[]>.
 */
const fetchTagsMap = async (
    wordIds: string[],
    viewerId: string,
): Promise<Map<string, WordTagSummary[]>> => {
    if (wordIds.length === 0) return new Map();

    const junctionRows = await db
        .select({ tagId: tagWords.tagId, wordId: tagWords.wordId })
        .from(tagWords)
        .where(inArray(tagWords.wordId, wordIds));

    if (junctionRows.length === 0) return new Map();

    const tagIdSet = [...new Set(junctionRows.map((j) => j.tagId))];
    const tagRows = await db
        .select({
            id: tags.id,
            label: tags.label,
            visibility: tags.visibility,
            authorId: tags.authorId,
        })
        .from(tags)
        .where(
            and(
                inArray(tags.id, tagIdSet),
                or(eq(tags.authorId, viewerId), eq(tags.visibility, 'Public')),
            ),
        );
    const tagById = new Map(tagRows.map((t) => [t.id, t]));

    const map = new Map<string, WordTagSummary[]>();
    for (const j of junctionRows) {
        const tag = tagById.get(j.tagId);
        if (!tag) continue; // filtered out by visibility above, or a race with a delete
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
    tagsMap: Map<string, WordTagSummary[]>,
): WordResponse => ({
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
 * `viewerId` decides which of each word's tags are visible (see
 * `fetchTagsMap`) — always pass the requesting user's id, never the word's
 * own author id, so a follower reading a followed word gets that word's
 * Public tags, not the owner's Private ones.
 *
 * @param wordIds - Array of word UUIDs
 * @param viewerId - The user viewing these words, for tag-visibility filtering
 * @returns Array of WordResponse objects (empty array if none found)
 */
const fetchWordsWithRelations = async (
    wordIds: string[],
    viewerId: string,
): Promise<WordResponse[]> => {
    if (wordIds.length === 0) return [];

    const wordRows = await db
        .select()
        .from(words)
        .where(inArray(words.id, wordIds));
    if (wordRows.length === 0) return [];

    const tMap = await fetchTranslationsMap(wordIds);
    const tagsMap = await fetchTagsMap(wordIds, viewerId);

    return wordRows.map((w) => assembleWord(w, tMap, tagsMap));
};

/**
 * Fetch a single word by id (shorthand).
 */
const fetchWordWithRelations = async (
    wordId: string,
    viewerId: string,
): Promise<WordResponse | null> => {
    const results = await fetchWordsWithRelations([wordId], viewerId);
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

export {
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
