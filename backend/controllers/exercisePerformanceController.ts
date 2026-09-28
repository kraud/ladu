/**
 * Exercise Performance Controller — Drizzle ORM (PostgreSQL)
 *
 * Migration notes (MongoDB → PostgreSQL):
 *   - `statsByCase[]` has been normalised into a separate
 *     `exercise_performance_cases` table.  The API response still assembles
 *     the nested shape for backward compatibility.
 *   - `getPerformanceByWorId` is an internal helper (no route).
 *
 * Route usage is declared in ../routes/exerciseRoutes.js (still CJS).
 */

const { db }: typeof import('../src/db') = require('../src/db');
const { exercisePerformanceCases, exercisePerformances }: typeof import('../src/db/schema') = require('../src/db/schema');

const { and, eq, inArray }: typeof import('drizzle-orm') = require('drizzle-orm');
const asyncHandler = require('express-async-handler');
const {
    applyAnswer,
    calculateAging,
    calculateNewPercentageOfKnowledge,
    modifierForAction,
    nextReviseState,
    translationAverage,
}: typeof import('../services/exercises') = require('../services/exercises');

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface StatByCase {
    caseName: string;
    record: boolean[];
    lastDate: Date | null;
    knowledge: number | null;
}

interface PerformanceResponse {
    _id: string;
    id: string;
    user: string;
    translationId: string | null;
    translationLanguage: string | null;
    word: string;
    statsByCase: StatByCase[];
    averageTranslationKnowledge: number | null;
    lastDateModifiedTranslation: Date | null;
    performanceModifier: string | null;
    reviseCounter: number | null;
    createdAt: Date;
    updatedAt: Date;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Fetch all case rows for a set of performance IDs and group by parent id.
 */
const fetchCasesGrouped = async (
    performanceIds: string[],
): Promise<Map<string, StatByCase[]>> => {
    if (performanceIds.length === 0) return new Map();

    const rows = await db
        .select()
        .from(exercisePerformanceCases)
        .where(inArray(exercisePerformanceCases.exercisePerformanceId, performanceIds));

    const map = new Map<string, StatByCase[]>();
    for (const c of rows) {
        const entry: StatByCase = {
            caseName: c.caseName,
            record: c.record,
            lastDate: c.lastDate,
            knowledge: c.knowledge,
        };
        const bucket = map.get(c.exercisePerformanceId);
        if (bucket) bucket.push(entry);
        else map.set(c.exercisePerformanceId, [entry]);
    }
    return map;
};

/**
 * Assemble a response object in the legacy Mongoose shape.
 */
const toPerformanceResponse = (
    row: typeof exercisePerformances.$inferSelect,
    cases: StatByCase[],
): PerformanceResponse => ({
    _id: row.id,
    id: row.id,
    user: row.userId,
    translationId: row.translationId,
    translationLanguage: row.translationLanguage,
    word: row.wordId,
    statsByCase: cases,
    averageTranslationKnowledge: row.averageTranslationKnowledge,
    lastDateModifiedTranslation: row.lastDateModifiedTranslation,
    performanceModifier: row.performanceModifier,
    reviseCounter: row.reviseCounter,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
});

/**
 * Upsert a single case row for a given performance entry.
 * If a case with the same caseName exists, update it; otherwise insert.
 */
const upsertCase = async (
    performanceId: string,
    caseName: string,
    record: boolean[],
    knowledge: number,
    lastDate: Date,
) => {
    const [existing] = await db
        .select()
        .from(exercisePerformanceCases)
        .where(
            and(
                eq(exercisePerformanceCases.exercisePerformanceId, performanceId),
                eq(exercisePerformanceCases.caseName, caseName),
            ),
        )
        .limit(1);

    if (existing) {
        await db
            .update(exercisePerformanceCases)
            .set({ record, knowledge, lastDate })
            .where(eq(exercisePerformanceCases.id, existing.id));
    } else {
        await db.insert(exercisePerformanceCases).values({
            exercisePerformanceId: performanceId,
            caseName,
            record,
            knowledge,
            lastDate,
        });
    }
};

// Pure math lives in ../services/exercises/knowledge.ts (Phase 5, Slice 1).

// ===========================================================================
// ENDPOINTS
// ===========================================================================

// @desc    Save (create/update) translation performance
// @route   POST /api/exercises/saveTranslationPerformance
// @access  Private
const saveTranslationPerformance = asyncHandler(async (req: any, res: any) => {
    const performanceId: string | undefined = req.body.performanceId;

    let perfRow: typeof exercisePerformances.$inferSelect | undefined;

    if (performanceId !== undefined) {
        [perfRow] = await db
            .select()
            .from(exercisePerformances)
            .where(eq(exercisePerformances.id, performanceId))
            .limit(1);
    } else {
        [perfRow] = await db
            .select()
            .from(exercisePerformances)
            .where(
                and(
                    eq(exercisePerformances.translationId, req.body.translationId),
                    eq(exercisePerformances.userId, req.user.id),
                ),
            )
            .limit(1);
    }

    if (perfRow === undefined) {
        // No performance stored for this translation → create it
        const knowledge = calculateNewPercentageOfKnowledge(0, [req.body.record]);

        const [created] = await db
            .insert(exercisePerformances)
            .values({
                userId: req.user.id,
                translationId: req.body.translationId,
                translationLanguage: req.body.translationLanguage,
                wordId: req.body.word,
                averageTranslationKnowledge: knowledge,
                lastDateModifiedTranslation: new Date(),
            })
            .returning();

        await db.insert(exercisePerformanceCases).values({
            exercisePerformanceId: created.id,
            caseName: req.body.caseName,
            record: [req.body.record],
            lastDate: new Date(),
            knowledge,
        });

        const cases = await fetchCasesGrouped([created.id]);
        const response = toPerformanceResponse(created, cases.get(created.id) || []);
        return res.status(200).json(response);
    }

    // Update existing performance
    const allCases = await fetchCasesGrouped([perfRow.id]);
    const cases = allCases.get(perfRow.id) || [];

    const now = new Date();
    const updatedStat = applyAnswer(
        cases.find((s) => s.caseName === req.body.caseName),
        req.body.caseName,
        req.body.record,
        now,
    );
    const allStats = [...cases.filter((s) => s.caseName !== req.body.caseName), updatedStat];

    const { performanceModifier, reviseCounter } = nextReviseState(
        perfRow.performanceModifier,
        perfRow.reviseCounter,
        req.body.record,
    );

    await db
        .update(exercisePerformances)
        .set({
            averageTranslationKnowledge: translationAverage(allStats, now),
            lastDateModifiedTranslation: now,
            performanceModifier,
            reviseCounter,
        })
        .where(eq(exercisePerformances.id, perfRow.id));

    await upsertCase(perfRow.id, updatedStat.caseName, updatedStat.record, updatedStat.knowledge || 0, now);

    // Re-read performance data to return fresh state
    const [updatedPerf] = await db
        .select()
        .from(exercisePerformances)
        .where(eq(exercisePerformances.id, perfRow.id))
        .limit(1);

    const updatedCasesMap = await fetchCasesGrouped([updatedPerf.id]);
    const response = toPerformanceResponse(updatedPerf, updatedCasesMap.get(updatedPerf.id) || []);

    res.status(200).json(response);
});

// @desc    Set performance modifier (Mastered / Revise)
// @route   POST /api/exercises/savePerformanceAction
// @access  Private
const savePerformanceAction = asyncHandler(async (req: any, res: any) => {
    if (req.body.performanceId === undefined) {
        return res.status(500).json('Performance not found');
    }

    const [perf] = await db
        .select()
        .from(exercisePerformances)
        .where(eq(exercisePerformances.id, req.body.performanceId))
        .limit(1);

    if (perf === undefined) {
        return res.status(500).json('Performance not found');
    }

    const [updated] = await db
        .update(exercisePerformances)
        .set(modifierForAction(req.body.action))
        .where(eq(exercisePerformances.id, req.body.performanceId))
        .returning();

    const casesMap = await fetchCasesGrouped([updated.id]);
    const response = toPerformanceResponse(updated, casesMap.get(updated.id) || []);

    res.status(200).json(response);
});

// ===========================================================================
// EXPORTS
// ===========================================================================

module.exports = {
    saveTranslationPerformance,
    savePerformanceAction,
    calculateAging,
    calculateNewPercentageOfKnowledge,
};
