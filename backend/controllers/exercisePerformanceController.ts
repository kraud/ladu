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

const { db } = require('../src/db');
const { exercisePerformanceCases, exercisePerformances } = require('../src/db/schema');

const { and, eq, inArray, sql }: typeof import('drizzle-orm') = require('drizzle-orm');
const asyncHandler = require('express-async-handler');

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

// ---------------------------------------------------------------------------
// PURE FUNCTIONS (no DB) — shared with exerciseController
// ---------------------------------------------------------------------------

/**
 * Calculate time-decayed knowledge.
 * percentageOfKnowledge is the current percentage, lastDate must be a Date.
 */
const calculateAging = (percentageOfKnowledge: number, lastDate: Date): number => {
    const currentDate = new Date();
    const difOfDays = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    return percentageOfKnowledge * Math.exp(-0.01 * difOfDays);
};

/**
 * Calculate new knowledge percentage after answering an exercise.
 */
const calculateNewPercentageOfKnowledge = (
    previousPercentageOfKnowledge: number,
    arrayResults: boolean[],
): number => {
    if (arrayResults.length > 0) {
        const averageOfArray = (arrayResults.filter(Boolean).length / 4) * 100;
        if (previousPercentageOfKnowledge > 0) {
            return (0.5 * previousPercentageOfKnowledge + 3.5 * averageOfArray) / 4;
        }
        return averageOfArray;
    }
    return previousPercentageOfKnowledge;
};

/**
 * Given a word object (with `.exercises`) and a list of exercise performance
 * records, map each exercise with its matching performance data and knowledge.
 *
 * `word` shape: `{ exercises: Exercise[], ... }`
 * `translationsPerformanceArray` is an array of legacy-shaped performance
 * records (as returned by toPerformanceResponse).
 */
const findMatches = (
    word: { exercises: any[] },
    translationsPerformanceArray: PerformanceResponse[],
): any[] => {
    return word.exercises
        .map((exercise: any) => {
            const itemB = exercise.matchingTranslations.itemB;
            if (
                itemB &&
                itemB.translationId &&
                translationsPerformanceArray !== undefined &&
                translationsPerformanceArray.length > 0
            ) {
                let isMastered = false;
                let isRevise = false;

                const stat = translationsPerformanceArray.find(
                    (translationPerformanceCandidate: PerformanceResponse) => {
                        if (
                            translationPerformanceCandidate.translationId?.toString() ===
                            itemB.translationId.toString()
                        ) {
                            if (translationPerformanceCandidate.performanceModifier !== undefined) {
                                isMastered =
                                    translationPerformanceCandidate.performanceModifier === 'Mastered';
                                isRevise =
                                    translationPerformanceCandidate.performanceModifier === 'Revise';
                            }
                            return true;
                        }
                        return false;
                    },
                );

                if (stat && !isMastered && !isRevise) {
                    const caseMatchingStats = stat.statsByCase.find(
                        (statCase) => statCase.caseName === itemB.case,
                    );
                    if (caseMatchingStats && caseMatchingStats.lastDate) {
                        const newKnowledge = calculateAging(
                            caseMatchingStats.knowledge || 0,
                            caseMatchingStats.lastDate,
                        );
                        return { ...exercise, knowledge: newKnowledge, performance: stat, wordId: word._id };
                    }
                    return { ...exercise, knowledge: 0, performance: stat, wordId: word._id };
                } else if (isMastered || isRevise) {
                    if (isMastered) {
                        return { ...exercise, knowledge: 100, performance: stat, wordId: word._id };
                    } else if (isRevise) {
                        return { ...exercise, knowledge: 0, performance: stat, wordId: word._id };
                    }
                }
            }
            return { ...exercise, knowledge: 0, performance: undefined, wordId: word._id };
        })
        .filter((result: any) => result !== null)
        .flat();
};

// ===========================================================================
// ENDPOINTS
// ===========================================================================

// @desc    Save (create/update) translation performance
// @route   POST /api/exercises/saveTranslationPerformance
// @access  Private
const saveTranslationPerformance = asyncHandler(async (req: any, res: any) => {
    let performanceId: string | undefined = req.body.performanceId;

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
    let cases = allCases.get(perfRow.id) || [];

    let statByCaseName = cases.find((s) => s.caseName === req.body.caseName);

    if (statByCaseName) {
        if (statByCaseName.record.length >= 4) {
            statByCaseName.record.shift(); // remove oldest
        }
        statByCaseName.record.push(req.body.record);
        statByCaseName.knowledge = calculateNewPercentageOfKnowledge(
            statByCaseName.knowledge || 0,
            statByCaseName.record,
        );
        statByCaseName.lastDate = new Date();
    } else {
        statByCaseName = {
            caseName: req.body.caseName,
            record: [req.body.record],
            lastDate: new Date(),
            knowledge: calculateNewPercentageOfKnowledge(0, [req.body.record]),
        };
        cases.push(statByCaseName);
    }

    // Recalculate average knowledge across all cases
    let newTranslationAverage = 0;
    for (const caseStat of cases) {
        if (caseStat.lastDate) {
            newTranslationAverage += calculateAging(caseStat.knowledge || 0, caseStat.lastDate);
        }
    }
    newTranslationAverage = newTranslationAverage / cases.length;

    const reviseCounterThreshold = 5;

    // When answering correctly, check if modifier is Revise
    let reviseCounter = perfRow.reviseCounter || 0;
    let performanceModifier = perfRow.performanceModifier;

    if (req.body.record && perfRow.performanceModifier === 'Revise') {
        reviseCounter += 1;
        if (reviseCounter >= reviseCounterThreshold) {
            performanceModifier = null;
            reviseCounter = 0;
        }
    }

    await db
        .update(exercisePerformances)
        .set({
            averageTranslationKnowledge: newTranslationAverage,
            lastDateModifiedTranslation: new Date(),
            performanceModifier,
            reviseCounter,
        })
        .where(eq(exercisePerformances.id, perfRow.id));

    // Upsert the modified case to DB
    await upsertCase(
        perfRow.id,
        statByCaseName.caseName,
        statByCaseName.record,
        statByCaseName.knowledge || 0,
        statByCaseName.lastDate || new Date(),
    );

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

    let modifier: string | null = null;
    if (req.body.action !== undefined) {
        modifier = req.body.action === 'master' ? 'Mastered' : 'Revise';
    }

    const [updated] = await db
        .update(exercisePerformances)
        .set({ performanceModifier: modifier, reviseCounter: 0 })
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
    findMatches,
};
