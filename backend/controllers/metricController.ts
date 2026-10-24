/**
 * Metric Controller — Drizzle ORM (PostgreSQL)
 *
 * Migration notes (MongoDB → PostgreSQL):
 *   - The Word.aggregate() pipeline with $facet is replaced by application-level
 *     queries on the words, translations, and translation_cases tables.
 *
 * NB! No route uses this controller directly.  It is consumed internally by the
 * dashboard endpoint in userController.ts.  The old userController.js (CJS)
 * called it but is no longer active.
 */

const { and, count, eq, inArray, or, sql } = require("drizzle-orm");
const { db }: typeof import("../src/db") = require("../src/db");
const { exercisePerformanceCases, exercisePerformances, tags, translationCases, translations, words }: typeof import("../src/db/schema") = require("../src/db/schema");
const { notHiddenByOwnCopy }: typeof import("../services/wordService") = require("../services/wordService");
const { getWordsIdFromFollowedTagsByUserId } = require("./tagController");

interface BasicUserMetrics {
  translationsPerLanguage: Array<{
    language: string;
    count: number;
    type: string;
  }>;
  translationsPerLanguageAndPOS: Array<{
    label: string;
    type: string;
    partOfSpeech: string;
    count: number;
  }>;
  wordsPerPOS: Array<{ partOfSpeech: string; type: string; count: number }>;
  wordsPerMonth: Array<{ label: string; partOfSpeech: string; count: number }>;
  totalWords: number;
  /** The user's own tags (demo-access.md D9: the demo's "tags left" counter). */
  totalTags: number;
  /** Words in the practice scope where no case has an answer yet. */
  unpracticedWordsCount: number;
  /** Translations of the words in the practice scope that store at least one case (they can be practiced). */
  translationsInPractice: number;
  /** Of those, the translations with at least one answered case. */
  practicedTranslations: number;
}

/**
 * How much of the user's practice scope has been practiced. The scope is the one practice uses:
 * the user's own words plus the words of followed tags the user can still see, without a followed
 * word the user has an own copy of. A case is practiced when the user's `exercise_performance_cases`
 * row for it has at least one answer. A translation (one language of a word) is practiced when one
 * of its stored cases (`translation_cases`) is practiced; a translation with no stored case cannot
 * be practiced and is not counted. A word is unpracticed when none of its translations is practiced.
 */
const calculatePracticeCoverage = async (
  userId: string,
): Promise<Pick<BasicUserMetrics, "unpracticedWordsCount" | "translationsInPractice" | "practicedTranslations">> => {
  const followedIds: string[] = await getWordsIdFromFollowedTagsByUserId(userId);
  const inScope = and(
    followedIds.length > 0 ? or(eq(words.userId, userId), inArray(words.id, followedIds)) : eq(words.userId, userId),
    notHiddenByOwnCopy(userId),
  );

  const perWord = await db
    .select({
      total: sql<number>`count(distinct ${translations.id}) filter (where ${translationCases.id} is not null)::int`,
      practiced: sql<number>`(count(distinct ${translations.id}) filter (where exists (
        select 1 from ${exercisePerformances} as ep
        inner join ${exercisePerformanceCases} as epc on epc.exercise_performance_id = ep.id
        where ep.user_id = ${userId}
          and ep.translation_id = ${translationCases.translationId}
          and epc.case_name = ${translationCases.caseName}
          and cardinality(epc.record) > 0
      )))::int`,
    })
    .from(words)
    .leftJoin(translations, eq(translations.wordId, words.id))
    .leftJoin(translationCases, eq(translationCases.translationId, translations.id))
    .where(inScope)
    .groupBy(words.id);

  return {
    unpracticedWordsCount: perWord.filter((row) => row.practiced === 0).length,
    translationsInPractice: perWord.reduce((sum, row) => sum + row.total, 0),
    practicedTranslations: perWord.reduce((sum, row) => sum + row.practiced, 0),
  };
};

/**
 * Calculate basic dashboard metrics for a given user.
 */
const calculateBasicUserMetrics = async (user: {
  id: string;
}): Promise<BasicUserMetrics | undefined> => {
  const userId = user.id;

  // 1) Total word count
  const [{ count: totalWords }] = await db
    .select({ count: count() })
    .from(words)
    .where(eq(words.userId, userId));

  // 1b) Own tag count
  const [{ count: totalTags }] = await db
    .select({ count: count() })
    .from(tags)
    .where(eq(tags.authorId, userId));

  // 2) Words per part-of-speech
  const wordsPerPOSRows = await db
    .select({
      partOfSpeech: words.partOfSpeech,
      count: count(),
    })
    .from(words)
    .where(eq(words.userId, userId))
    .groupBy(words.partOfSpeech);

  const wordsPerPOS = wordsPerPOSRows.map((r) => ({
    partOfSpeech: r.partOfSpeech,
    type: "partOfSpeech",
    count: r.count,
  }));

  // 3) Translations by language
  const transByLangRows = await db
    .select({
      language: translations.language,
      count: count(),
    })
    .from(translations)
    .innerJoin(words, eq(translations.wordId, words.id))
    .where(eq(words.userId, userId))
    .groupBy(translations.language);

  const translationsPerLanguage = transByLangRows.map((r) => ({
    language: r.language,
    count: r.count,
    type: "language",
  }));

  // 4) Translations by language + part of speech
  const transByLangPosRows = await db
    .select({
      language: translations.language,
      partOfSpeech: words.partOfSpeech,
      count: count(),
    })
    .from(translations)
    .innerJoin(words, eq(translations.wordId, words.id))
    .where(eq(words.userId, userId))
    .groupBy(translations.language, words.partOfSpeech);

  const translationsPerLanguageAndPOS = transByLangPosRows.map((r) => ({
    label: r.language,
    type: "language",
    partOfSpeech: r.partOfSpeech,
    count: r.count,
  }));

  // 5) Words per month
  const wordsPerMonthRows = await db
    .select({
      year: sql<string>`EXTRACT(YEAR FROM ${words.createdAt})`,
      month: sql<string>`LPAD(EXTRACT(MONTH FROM ${words.createdAt})::text, 2, '0')`,
      partOfSpeech: words.partOfSpeech,
      count: count(),
    })
    .from(words)
    .where(eq(words.userId, userId))
    .groupBy(
      sql`EXTRACT(YEAR FROM ${words.createdAt})`,
      sql`EXTRACT(MONTH FROM ${words.createdAt})`,
      words.partOfSpeech,
    )
    .orderBy(
      sql`EXTRACT(YEAR FROM ${words.createdAt})`,
      sql`EXTRACT(MONTH FROM ${words.createdAt})`,
    );

  const wordsPerMonth = wordsPerMonthRows.map((r) => ({
    label: `${Math.round(Number(r.year))}-${r.month}`,
    partOfSpeech: r.partOfSpeech,
    count: r.count,
  }));

  // 6) Practice coverage (own and followed words)
  const coverage = await calculatePracticeCoverage(userId);

  return {
    translationsPerLanguage,
    translationsPerLanguageAndPOS,
    wordsPerPOS,
    wordsPerMonth,
    totalWords,
    totalTags,
    ...coverage,
  };
};

module.exports = { calculateBasicUserMetrics };
