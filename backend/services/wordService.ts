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
    exercisePerformanceCases,
    exercisePerformances,
    tags,
    tagWords,
    translationCases,
    translations,
    words,
}: typeof import('../src/db/schema') = require('../src/db/schema');
const { and, desc, eq, inArray, or } = require('drizzle-orm');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WordRow = typeof words.$inferSelect;
type TranslationRow = typeof translations.$inferSelect;
type CaseRow = typeof translationCases.$inferSelect;
type PerformanceRow = typeof exercisePerformances.$inferSelect;
type PerformanceCaseRow = typeof exercisePerformanceCases.$inferSelect;

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
        .where(inArray(tagWords.wordId, wordIds))
        // Newest link first: the Review table's Tags cell shows the first tag of each word.
        .orderBy(desc(tagWords.createdAt));

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

/** Ids per `inArray` query in `fetchWordsWithRelations` (Postgres caps bind parameters at 65,535). */
const HYDRATE_CHUNK_SIZE = 5000;

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

    // Postgres allows at most 65,535 bind parameters in one query. A `limit=all`
    // list can pass more ids than that, so the ids go in groups.
    const result: WordResponse[] = [];
    for (let start = 0; start < wordIds.length; start += HYDRATE_CHUNK_SIZE) {
        const chunk = wordIds.slice(start, start + HYDRATE_CHUNK_SIZE);

        const wordRows = await db
            .select()
            .from(words)
            .where(inArray(words.id, chunk));
        if (wordRows.length === 0) continue;

        const tMap = await fetchTranslationsMap(chunk);
        const tagsMap = await fetchTagsMap(chunk, viewerId);

        for (const w of wordRows) result.push(assembleWord(w, tMap, tagsMap));
    }
    return result;
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

// ---------------------------------------------------------------------------
// Clone words for a user
// ---------------------------------------------------------------------------

/**
 * Copy words (with translations and cases) into `recipientId`'s account, inside
 * the caller's own transaction (`tx`). Shared by the tag clone
 * (`cloneTagForUser`, tagController.ts) and the single-word clone
 * (`cloneWord`, wordController.ts).
 *
 * The copies carry no tags. Each one stores where it came from: `isCloned`,
 * `originalCreatorId` (the user of the source word) and `sourceWordId` (the
 * source word row, one hop back).
 *
 * Batch-inserts words/translations/cases (three `INSERT ... RETURNING`
 * calls total, not one per word) — `RETURNING` preserves the input array's
 * order, so `result[i]` is the copy of `sourceWords[i]`.
 *
 * Also copies the *recipient's own* practice history from the source
 * translations to the new copies (D7 of phase-5-practice.md), so cloning does
 * not reset what they already know. Only their rows are read — never the
 * author's or anyone else's.
 *
 * @returns the inserted word rows, in the order of `sourceWords`
 */
const cloneWordsForUser = async (
    tx: any,
    sourceWords: WordResponse[],
    recipientId: string,
): Promise<WordRow[]> => {
    const clonedWordRows =
        sourceWords.length > 0
            ? await tx
                    .insert(words)
                    .values(
                        sourceWords.map((sourceWord) => ({
                            userId: recipientId,
                            partOfSpeech: sourceWord.partOfSpeech,
                            clue: sourceWord.clue,
                            isCloned: true,
                            originalCreatorId: sourceWord.user,
                            sourceWordId: sourceWord.id,
                        })),
                    )
                    .returning()
            : [];

    // Flattened one-row-per-translation inserts, tagged with the cloned word
    // (by index — `sourceWords[i]` <-> `clonedWordRows[i]`) they belong to.
    const translationInserts = sourceWords.flatMap((sourceWord, i) =>
        sourceWord.translations.map((translation) => ({
            wordId: clonedWordRows[i].id,
            language: translation.language,
        })),
    );
    const clonedTranslationRows =
        translationInserts.length > 0
            ? await tx.insert(translations).values(translationInserts).returning()
            : [];

    // Same flattening for cases, one level deeper: rebuild the parallel
    // flattened *source* translation list so `flattenedSourceTranslations[j]`
    // <-> `clonedTranslationRows[j]` for every source translation regardless
    // of which word it came from.
    const flattenedSourceTranslations = sourceWords.flatMap((sourceWord) => sourceWord.translations);
    const caseInserts = flattenedSourceTranslations.flatMap((translation, j) =>
        translation.cases.map((c) => ({
            translationId: clonedTranslationRows[j].id,
            caseName: c.caseName,
            word: c.word,
        })),
    );
    if (caseInserts.length > 0) {
        await tx.insert(translationCases).values(caseInserts);
    }

    // D7 (phase-5-practice.md): copy the *recipient's own* practice history from
    // the source translations to the new copies, so cloning a followed tag does
    // not reset what they already know. Only their rows are read — never the
    // author's or anyone else's.
    const sourceToClone = new Map<string, { id: string; wordId: string }>(
        flattenedSourceTranslations.map((sourceTranslation, j) => [sourceTranslation.id, clonedTranslationRows[j]]),
    );
    if (sourceToClone.size > 0) {
        const sourcePerformances: PerformanceRow[] = await tx
            .select()
            .from(exercisePerformances)
            .where(
                and(
                    eq(exercisePerformances.userId, recipientId),
                    inArray(exercisePerformances.translationId, [...sourceToClone.keys()]),
                ),
            );
        if (sourcePerformances.length > 0) {
            const clonedPerformances: PerformanceRow[] = await tx
                .insert(exercisePerformances)
                .values(
                    sourcePerformances.map((perf) => {
                        const target = sourceToClone.get(perf.translationId)!;
                        return {
                            userId: recipientId,
                            wordId: target.wordId,
                            translationId: target.id,
                            performanceModifier: perf.performanceModifier,
                            reviseCounter: perf.reviseCounter,
                            averageTranslationKnowledge: perf.averageTranslationKnowledge,
                            lastDateModifiedTranslation: perf.lastDateModifiedTranslation,
                            translationLanguage: perf.translationLanguage,
                        };
                    }),
                )
                .returning();
            // `RETURNING` keeps the input order, so `clonedPerformances[i]` is the copy of `sourcePerformances[i]`.
            const newPerformanceIdBySourceId = new Map<string, string>(
                sourcePerformances.map((perf, i) => [perf.id, clonedPerformances[i].id]),
            );
            const sourceCaseStats: PerformanceCaseRow[] = await tx
                .select()
                .from(exercisePerformanceCases)
                .where(inArray(exercisePerformanceCases.exercisePerformanceId, [...newPerformanceIdBySourceId.keys()]));
            if (sourceCaseStats.length > 0) {
                await tx.insert(exercisePerformanceCases).values(
                    sourceCaseStats.map((stat) => ({
                        exercisePerformanceId: newPerformanceIdBySourceId.get(stat.exercisePerformanceId)!,
                        caseName: stat.caseName,
                        record: stat.record,
                        lastDate: stat.lastDate,
                        knowledge: stat.knowledge,
                    })),
                );
            }
        }
    }

    return clonedWordRows;
};

// ---------------------------------------------------------------------------
// Generic list-pagination helpers
// ---------------------------------------------------------------------------
// Shared by `getWordsSimplified` (wordController.ts) and the tag list
// (tagController.ts's `listTags`, phase-4-tags.md Slice 2) — homed here,
// rather than on either controller, for the same reason this whole file
// exists: a controller->controller import (tagController needing something
// from wordController, which itself already imports from tagController)
// would be circular. Both controllers already depend on this service, never
// on each other for this.

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;
// Offset (numbered-page) mode allows bigger pages than cursor mode.
const MAX_OFFSET_PAGE_LIMIT = 200;

/** A repeatable query param (`?pos=Noun&pos=Verb`) arrives as an array only
 * when given more than once; normalise the single-value case too. */
const parseArrayParam = (value: any): string[] => {
    if (value === undefined) return [];
    return Array.isArray(value) ? value : [value];
};

const parseLimitParam = (value: any): number => {
    const parsed = value !== undefined ? parseInt(value, 10) : DEFAULT_PAGE_LIMIT;
    if (!Number.isFinite(parsed)) return DEFAULT_PAGE_LIMIT;
    return Math.min(Math.max(parsed, 1), MAX_PAGE_LIMIT);
};

/**
 * `?page=` for offset mode. Returns null when the param is absent (cursor mode).
 * Throws on anything that is not an integer >= 1; the controller maps it to 400.
 */
const parsePageParam = (value: any): number | null => {
    if (value === undefined) return null;
    if (typeof value !== 'string' || !/^\d+$/.test(value) || parseInt(value, 10) < 1) {
        throw new Error('Invalid page');
    }
    return parseInt(value, 10);
};

/**
 * `?limit=` for offset mode: an integer from 1 to 200, or the literal `all`
 * (returned as null). Absent means the default. Throws on anything else.
 */
const parsePageLimitParam = (value: any): number | null => {
    if (value === undefined) return DEFAULT_PAGE_LIMIT;
    if (value === 'all') return null;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('Invalid limit');
    const parsed = parseInt(value, 10);
    if (parsed < 1 || parsed > MAX_OFFSET_PAGE_LIMIT) throw new Error('Invalid limit');
    return parsed;
};

// Generic keyset-cursor pair: an opaque sort value (the word list encodes
// `createdAt.toISOString()`; the tag list encodes either that or a plain
// label string) plus the tiebreaker id — one cursor implementation shared
// by both lists rather than each growing its own base64(`value|id`) helper.
const encodeCursor = (sortValue: string, id: string): string =>
    Buffer.from(`${sortValue}|${id}`, 'utf-8').toString('base64');

const decodeCursor = (cursor: string): { sortValue: string; id: string } | null => {
    try {
        const [sortValue, id] = Buffer.from(cursor, 'base64')
            .toString('utf-8')
            .split('|');
        if (!id || sortValue === undefined) return null;
        return { sortValue, id };
    } catch {
        return null;
    }
};

export {
    fetchTranslationsMap,
    fetchTagsMap,
    assembleWord,
    fetchWordsWithRelations,
    fetchWordWithRelations,
    getWordsByIds,
    cloneWordsForUser,
    parseArrayParam,
    parseLimitParam,
    parsePageParam,
    parsePageLimitParam,
    encodeCursor,
    decodeCursor,
};

// TypeScript module marker — required so that `import type { WordResponse }`
// from consuming controllers works correctly with CJS + TS.
export {};
