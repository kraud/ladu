/**
 * Exercise Controller — Drizzle ORM (PostgreSQL)
 *
 * Thin layer: loads the candidate words + the user's performances, then hands
 * them to the pure domain module in ../services/exercises (spec:
 * .context/plans/phase-5-practice.md Part A).
 *
 * Migration notes (MongoDB → PostgreSQL):
 *   - The `Word.aggregate()` with `$lookup` for exercisePerformances is
 *     replaced by separate queries + application-level joining.
 *   - `getWordsIdFromFollowedTagsByUserId` is imported from tagController.ts.
 *
 * Route usage is declared in ../routes/exerciseRoutes.js (still CJS).
 */

const { and, eq, inArray } = require('drizzle-orm');
const { db }: typeof import('../src/db') = require('../src/db');
const {
    exercisePerformanceCases,
    exercisePerformances,
    words,
}: typeof import('../src/db/schema') = require('../src/db/schema');
// Pure domain logic (catalogue, knowledge math, generation, selection, distractors).
const { buildExerciseSet, shuffle }: typeof import('../services/exercises') = require('../services/exercises');
const asyncHandler = require('express-async-handler');

// Shared word-assembly helpers (translations, cases, tags).
const { fetchWordsWithRelations }: typeof import('../services/wordService') = require('../services/wordService');

// Re-exported from tagController's Drizzle version
const { getWordsIdFromFollowedTagsByUserId } = require('./tagController.ts');

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface WordWithData {
    _id: string;
    user: string;
    partOfSpeech: string;
    clue: string | null;
    isCloned: boolean;
    originalCreatorId: string | null;
    translations: Array<{
        _id: string;
        language: string;
        cases: Array<{ word: string; caseName: string }>;
    }>;
    createdAt: Date;
    updatedAt: Date;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Fetch words with their translations and cases, assembled into the old
 * Mongoose aggregate shape expected by the exercise-generation functions.
 *
 * Delegates to the shared fetchWordsWithRelations from wordService which
 * eliminates the duplicate join logic that was previously inlined here.
 * An empty exercisePerformances array is added to match the expected shape.
 */
const fetchWordsWithData = async (
    wordIds: string[],
    viewerId: string,
): Promise<WordWithData[]> => {
    const wordResponses = await fetchWordsWithRelations(wordIds, viewerId);
    // wordService now emits `id` only; this controller keeps its own legacy
    // `_id` shape internally, so remap here rather than rippling the change
    // through the exercise-generation helpers.
    return wordResponses.map((w) => ({
        _id: w.id,
        user: w.user,
        partOfSpeech: w.partOfSpeech,
        clue: w.clue,
        isCloned: w.isCloned,
        originalCreatorId: w.originalCreator,
        translations: w.translations.map((t) => ({
            _id: t.id,
            language: t.language,
            cases: t.cases,
        })),
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
    }));
};

/**
 * Fetch exercise performance records for a set of words, assembled into the
 * legacy Mongoose document shape (with nested statsByCase).
 */
const fetchPerformancesForWords = async (
    wordIds: string[],
    userId: string,
): Promise<any[]> => {
    if (wordIds.length === 0) return [];

    const perfRows = await db
        .select()
        .from(exercisePerformances)
        .where(
            and(
                inArray(exercisePerformances.wordId, wordIds),
                eq(exercisePerformances.userId, userId),
            ),
        );

    if (perfRows.length === 0) return [];

    const perfIds = perfRows.map((p) => p.id);
    const caseRows = await db
        .select()
        .from(exercisePerformanceCases)
        .where(inArray(exercisePerformanceCases.exercisePerformanceId, perfIds));

    const casesByPerfId = new Map<string, any[]>();
    for (const c of caseRows) {
        const bucket = casesByPerfId.get(c.exercisePerformanceId);
        if (bucket) bucket.push(c);
        else casesByPerfId.set(c.exercisePerformanceId, [c]);
    }

    return perfRows.map((p) => ({
        _id: p.id,
        user: p.userId,
        translationId: p.translationId,
        translationLanguage: p.translationLanguage,
        word: p.wordId,
        statsByCase: (casesByPerfId.get(p.id) || []).map((c) => ({
            caseName: c.caseName,
            record: c.record,
            lastDate: c.lastDate,
            knowledge: c.knowledge,
        })),
        averageTranslationKnowledge: p.averageTranslationKnowledge,
        lastDateModifiedTranslation: p.lastDateModifiedTranslation,
        performanceModifier: p.performanceModifier,
        reviseCounter: p.reviseCounter,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
    }));
};

// ===========================================================================
// ENDPOINTS
// ===========================================================================

// @desc    Creates exercises for a user based on parameters
// @route   GET /api/exercises/getUserExercises
// @access  Private
const getExercises = asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    const parameters = {
        ...req.query.parameters,
        amountOfExercises: parseInt(req.query.parameters.amountOfExercises, 10),
        difficultyMC: req.query.parameters.difficultyMC !== undefined
            ? parseInt(req.query.parameters.difficultyMC, 10)
            : undefined,
    };

    // Get word IDs (own words + followed-tag words, or preselected)
    const preSelectedWordsIncluded = parameters.preSelectedWords !== undefined && parameters.preSelectedWords.length > 0;

    let targetWordIds: string[];

    if (preSelectedWordsIncluded) {
        targetWordIds = parameters.preSelectedWords;
    } else {
        const followedWordIds = await getWordsIdFromFollowedTagsByUserId(userId);

        const myWordRows = await db
            .select({ id: words.id })
            .from(words)
            .where(eq(words.userId, userId));

        const myWordIds = myWordRows.map((w) => w.id);
        targetWordIds = [...new Set([...myWordIds, ...followedWordIds])];
    }

    // Fetch words
    const allWordRows = await fetchWordsWithData(targetWordIds, userId);

    // Filter by partOfSpeech
    const matchingWordData = allWordRows.filter((w) =>
        parameters.partsOfSpeech.includes(w.partOfSpeech),
    );

    // If not preselected, random sample of 50 (removed in Slice 3, decision D2b)
    let sampledWordData: WordWithData[];
    if (!preSelectedWordsIncluded && matchingWordData.length > 50) {
        shuffle(matchingWordData);
        sampledWordData = matchingWordData.slice(0, 50);
    } else {
        sampledWordData = matchingWordData;
    }

    const performances = await fetchPerformancesForWords(sampledWordData.map((w) => w._id), userId);
    const perfByWordId = new Map<string, any[]>();
    for (const p of performances) {
        const bucket = perfByWordId.get(p.word);
        if (bucket) bucket.push(p);
        else perfByWordId.set(p.word, [p]);
    }

    const exerciseWords = sampledWordData.map((w) => ({
        id: w._id,
        partOfSpeech: w.partOfSpeech,
        translations: w.translations.map((t) => ({ id: t._id, language: t.language, cases: t.cases })),
        performances: perfByWordId.get(w._id) || [],
    }));

    const exercises = buildExerciseSet(
        exerciseWords,
        {
            languages: parameters.languages,
            type: parameters.type,
            multiLang: parameters.multiLang,
            amount: parameters.amountOfExercises,
            wordSelection: parameters.wordSelection,
            difficultyMC: parameters.difficultyMC,
            nativeLanguage: parameters.nativeLanguage,
        },
        req.user.languages,
        Math.random,
    );

    res.status(200).json(exercises);
});

// ===========================================================================
// EXPORTS
// ===========================================================================

module.exports = {
    getExercises,
};
