/**
 * Exercise Service — the database side of practice.
 *
 * The pure logic (catalogue, knowledge math, generation, selection, distractors,
 * validation, response shapes) lives in ./exercises. This file only loads data,
 * ranks the word pool in SQL, and saves answers.
 * Spec: .context/plans/phase-5-practice.md §B.3.
 *
 * Security rule: performance rows are ALWAYS found by (user id from the token,
 * translation id). A client never sends a performance id.
 */

const { db }: typeof import('../src/db') = require('../src/db');
const {
    exercisePerformanceCases,
    exercisePerformances,
    translationCases,
    translations,
    words,
}: typeof import('../src/db/schema') = require('../src/db/schema');
const { and, eq, inArray, or, sql } = require('drizzle-orm');

const {
    addDistractors,
    applyAnswer,
    generateExercisesForWord,
    nextReviseState,
    pickExercises,
    resultToRecord,
    shuffle,
    toExerciseDto,
    toPerformanceSummary,
    translationAverage,
}: typeof import('./exercises') = require('./exercises');
const { fetchWordsWithRelations }: typeof import('./wordService') = require('./wordService');
const { getWordsIdFromFollowedTagsByUserId } = require('../controllers/tagController.ts');

import type {
    AnswerRequest,
    ExerciseDto,
    ExerciseParams,
    ExerciseWord,
    GenerateRequest,
    Modifier,
    PerformanceSummary,
    Rng,
    TranslationPerformance,
    WordExercises,
} from './exercises';

/** Words loaded per round trip while walking the ranked list. */
export const BATCH_SIZE = 50;
/** Size of the random word pool that multiple-choice distractors come from. */
export const DISTRACTOR_POOL_SIZE = 50;

interface Viewer {
    id: string;
    languages: string[];
    nativeLanguage?: string | null;
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

/** Condition: the word is the user's own, or is reachable through a followed tag the user can still see. */
const visibleWordCondition = async (userId: string) => {
    const followedIds: string[] = await getWordsIdFromFollowedTagsByUserId(userId);
    return followedIds.length > 0
        ? or(eq(words.userId, userId), inArray(words.id, followedIds))
        : eq(words.userId, userId);
};

// ---------------------------------------------------------------------------
// Ranking (decision D2b)
// ---------------------------------------------------------------------------

export interface RankedWord {
    id: string;
    score: number;
}

/**
 * Every candidate word with its A.9 word score, weakest first (random tie-break).
 * In Random mode the order is fully random. The SQL mirrors `wordScore` in
 * ./exercises/knowledge.ts — a test pins the two against each other.
 *
 * Time is passed in as epoch seconds, not read from the database clock, so the
 * SQL and the JS use the same "now". `timestamp` columns hold UTC values, so
 * `extract(epoch …)` gives the true epoch.
 */
export async function rankCandidateWords(
    viewer: Viewer,
    request: Pick<GenerateRequest, 'languages' | 'partsOfSpeech' | 'multiLang' | 'wordSelection' | 'wordIds'>,
    now: Date = new Date(),
): Promise<RankedWord[]> {
    const nowSeconds = now.getTime() / 1000;
    const minLanguages = request.multiLang === 'Multi-Language' ? 2 : 1;

    const conditions = [
        await visibleWordCondition(viewer.id),
        inArray(words.partOfSpeech, request.partsOfSpeech),
        // The word must have enough translations in the selected languages.
        sql`${words.id} IN (
            SELECT ${translations.wordId} FROM ${translations}
            WHERE ${inArray(translations.language, request.languages)}
            GROUP BY ${translations.wordId}
            HAVING count(DISTINCT ${translations.language}) >= ${minLanguages}
        )`,
    ];
    if (request.wordIds) conditions.push(inArray(words.id, request.wordIds));

    const random = request.wordSelection === 'Random';
    const scoreLanguages = viewer.languages.length > 0 ? viewer.languages : ['__none__'];
    const score = sql<number>`COALESCE(AVG(
        CASE
            WHEN ${exercisePerformances.performanceModifier} = 'Mastered' THEN 100
            WHEN ${exercisePerformances.performanceModifier} = 'Revise' THEN 0
            WHEN ${exercisePerformances.lastDateModifiedTranslation} IS NULL THEN 0
            ELSE COALESCE(${exercisePerformances.averageTranslationKnowledge}, 0)::double precision
                * exp(-0.01 * floor((
                    ${nowSeconds}::double precision
                    - extract(epoch FROM ${exercisePerformances.lastDateModifiedTranslation})::double precision
                ) / 86400))
        END
    ) FILTER (WHERE ${inArray(exercisePerformances.translationLanguage, scoreLanguages)}), 0)`;

    const rows: { id: string; score: number | string }[] = await db
        .select({ id: words.id, score })
        .from(words)
        .leftJoin(
            exercisePerformances,
            and(eq(exercisePerformances.wordId, words.id), eq(exercisePerformances.userId, viewer.id)),
        )
        .where(and(...conditions))
        .groupBy(words.id)
        .orderBy(...(random ? [sql`random()`] : [score, sql`random()`]));

    return rows.map((r) => ({ id: r.id, score: Number(r.score) }));
}

// ---------------------------------------------------------------------------
// Loading words + performances
// ---------------------------------------------------------------------------

type PerformanceWithWord = TranslationPerformance & { wordId: string };

const loadPerformances = async (
    userId: string,
    filter: { wordIds: string[] } | { translationIds: string[] },
): Promise<PerformanceWithWord[]> => {
    const where =
        'wordIds' in filter
            ? inArray(exercisePerformances.wordId, filter.wordIds)
            : inArray(exercisePerformances.translationId, filter.translationIds);
    const perfRows = await db
        .select()
        .from(exercisePerformances)
        .where(and(eq(exercisePerformances.userId, userId), where));
    if (perfRows.length === 0) return [];

    const caseRows = await db
        .select()
        .from(exercisePerformanceCases)
        .where(inArray(exercisePerformanceCases.exercisePerformanceId, perfRows.map((p) => p.id)));

    const casesByPerformance = new Map<string, typeof caseRows>();
    for (const c of caseRows) {
        const bucket = casesByPerformance.get(c.exercisePerformanceId);
        if (bucket) bucket.push(c);
        else casesByPerformance.set(c.exercisePerformanceId, [c]);
    }

    return perfRows.map((p) => ({
        wordId: p.wordId,
        translationId: p.translationId,
        translationLanguage: p.translationLanguage,
        performanceModifier: p.performanceModifier,
        reviseCounter: p.reviseCounter,
        averageTranslationKnowledge: p.averageTranslationKnowledge,
        lastDateModifiedTranslation: p.lastDateModifiedTranslation,
        statsByCase: (casesByPerformance.get(p.id) ?? []).map((c) => ({
            caseName: c.caseName,
            record: c.record,
            knowledge: c.knowledge,
            lastDate: c.lastDate,
        })),
    }));
};

/** Words (in the order of `wordIds`) with translations, cases and — optionally — the user's performances. */
const loadExerciseWords = async (
    wordIds: string[],
    userId: string,
    withPerformances: boolean,
): Promise<ExerciseWord[]> => {
    if (wordIds.length === 0) return [];
    const rows = await fetchWordsWithRelations(wordIds, userId);
    const performances = withPerformances ? await loadPerformances(userId, { wordIds }) : [];
    const byWord = new Map<string, TranslationPerformance[]>();
    for (const p of performances) {
        const bucket = byWord.get(p.wordId);
        if (bucket) bucket.push(p);
        else byWord.set(p.wordId, [p]);
    }
    const byId = new Map(
        rows.map((w) => [
            w.id,
            {
                id: w.id,
                partOfSpeech: w.partOfSpeech,
                translations: w.translations.map((t) => ({ id: t.id, language: t.language, cases: t.cases })),
                performances: byWord.get(w.id) ?? [],
            } as ExerciseWord,
        ]),
    );
    return wordIds.flatMap((id) => (byId.has(id) ? [byId.get(id) as ExerciseWord] : []));
};

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

/**
 * Build a session. Walks the ranked word list in batches until enough words give
 * exercises, so the weakest words of the WHOLE pool are used (no random sample).
 * If the pool runs out first, `pickExercises` repeats rounds over the words found.
 */
export async function generateExercises(
    viewer: Viewer,
    request: GenerateRequest,
    rng: Rng = Math.random,
    now: Date = new Date(),
): Promise<ExerciseDto[]> {
    const random = request.wordSelection === 'Random';
    const params: ExerciseParams = {
        languages: request.languages,
        type: request.type,
        multiLang: request.multiLang,
        amount: request.amount,
        wordSelection: request.wordSelection,
        difficultyMC: request.difficultyMC,
        nativeLanguage: request.excludeNative ? viewer.nativeLanguage ?? undefined : undefined,
    };

    const ranked = await rankCandidateWords(viewer, request, now);

    const entries: WordExercises[] = [];
    const loaded = new Map<string, ExerciseWord>();
    for (let i = 0; i < ranked.length && entries.length < request.amount; i += BATCH_SIZE) {
        const batch = ranked.slice(i, i + BATCH_SIZE);
        const batchWords = await loadExerciseWords(batch.map((r) => r.id), viewer.id, true);
        const scoreById = new Map(batch.map((r) => [r.id, r.score]));
        for (const word of batchWords) {
            loaded.set(word.id, word);
            const exercises = generateExercisesForWord(word, params, rng);
            if (exercises.length > 0) entries.push({ word, exercises, score: scoreById.get(word.id) ?? 0 });
        }
    }

    let picked = pickExercises(entries, request.amount, random, rng, now);

    const needsDistractors =
        (request.type === 'Multiple-Choice' || request.type === 'Random') && request.multiLang !== 'Single-Language';
    if (needsDistractors && picked.some((e) => e.type === 'Multiple-Choice' && e.multiLang)) {
        // Random pool of the candidate set, plus the picked words (level 3 needs the answer's own word).
        const poolIds = new Set(shuffle(ranked.map((r) => r.id), rng).slice(0, DISTRACTOR_POOL_SIZE));
        for (const e of picked) poolIds.add(e.wordId);
        const missing = [...poolIds].filter((id) => !loaded.has(id));
        for (const word of await loadExerciseWords(missing, viewer.id, false)) loaded.set(word.id, word);
        const pool = [...poolIds].flatMap((id) => (loaded.has(id) ? [loaded.get(id) as ExerciseWord] : []));
        picked = addDistractors(picked, pool, request.difficultyMC, rng);
    }

    return picked.map((exercise, index) => toExerciseDto(exercise, index, rng));
}

// ---------------------------------------------------------------------------
// Answers + modifiers
// ---------------------------------------------------------------------------

/**
 * Save one answer. Returns null when the translation does not exist, is not visible
 * to the user, or has no such case (the controller answers 404 for all three, so
 * a private word's existence never leaks).
 */
export async function saveAnswer(
    userId: string,
    answer: AnswerRequest,
    now: Date = new Date(),
): Promise<PerformanceSummary | null> {
    const [translation] = await db
        .select({ id: translations.id, wordId: translations.wordId, language: translations.language })
        .from(translations)
        .innerJoin(words, eq(words.id, translations.wordId))
        .where(and(eq(translations.id, answer.translationId), await visibleWordCondition(userId)))
        .limit(1);
    if (!translation) return null;

    const [existingCase] = await db
        .select({ id: translationCases.id })
        .from(translationCases)
        .where(and(eq(translationCases.translationId, translation.id), eq(translationCases.caseName, answer.caseName)))
        .limit(1);
    if (!existingCase) return null;

    const correct = resultToRecord(answer.result);

    await db.transaction(async (tx: any) => {
        // Insert-if-missing first, then lock the row: two fast answers cannot create two rows.
        await tx
            .insert(exercisePerformances)
            .values({
                userId,
                wordId: translation.wordId,
                translationId: translation.id,
                translationLanguage: translation.language,
                reviseCounter: 0,
                averageTranslationKnowledge: 0,
                lastDateModifiedTranslation: now,
            })
            .onConflictDoNothing();

        const [perf] = await tx
            .select()
            .from(exercisePerformances)
            .where(and(eq(exercisePerformances.userId, userId), eq(exercisePerformances.translationId, translation.id)))
            .for('update');

        const caseRows = await tx
            .select()
            .from(exercisePerformanceCases)
            .where(eq(exercisePerformanceCases.exercisePerformanceId, perf.id));

        const updatedStat = applyAnswer(caseRows.find((c: any) => c.caseName === answer.caseName), answer.caseName, correct, now);
        const allStats = [...caseRows.filter((c: any) => c.caseName !== answer.caseName), updatedStat];
        const revise = nextReviseState(perf.performanceModifier, perf.reviseCounter, correct);

        await tx
            .insert(exercisePerformanceCases)
            .values({
                exercisePerformanceId: perf.id,
                caseName: answer.caseName,
                record: updatedStat.record,
                knowledge: updatedStat.knowledge,
                lastDate: now,
            })
            .onConflictDoUpdate({
                target: [exercisePerformanceCases.exercisePerformanceId, exercisePerformanceCases.caseName],
                set: { record: updatedStat.record, knowledge: updatedStat.knowledge, lastDate: now },
            });

        await tx
            .update(exercisePerformances)
            .set({
                averageTranslationKnowledge: translationAverage(allStats, now),
                lastDateModifiedTranslation: now,
                performanceModifier: revise.performanceModifier,
                reviseCounter: revise.reviseCounter,
            })
            .where(eq(exercisePerformances.id, perf.id));
    });

    return getPerformanceSummary(userId, translation.id);
}

/** Set (or clear, with null) the modifier of the user's own performance row. Null result → 404. */
export async function setModifier(
    userId: string,
    translationId: string,
    modifier: Modifier | null,
): Promise<PerformanceSummary | null> {
    const updated = await db
        .update(exercisePerformances)
        .set({ performanceModifier: modifier, reviseCounter: 0 })
        .where(and(eq(exercisePerformances.userId, userId), eq(exercisePerformances.translationId, translationId)))
        .returning({ id: exercisePerformances.id });
    if (updated.length === 0) return null;
    return getPerformanceSummary(userId, translationId);
}

export async function getPerformanceSummary(
    userId: string,
    translationId: string,
): Promise<PerformanceSummary | null> {
    const [perf] = await loadPerformances(userId, { translationIds: [translationId] });
    return perf ? toPerformanceSummary(perf) : null;
}
