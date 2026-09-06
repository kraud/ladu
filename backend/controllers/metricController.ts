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

const { count, eq, inArray, sql } = require("drizzle-orm");
const { db } = require("../src/db");
const { translations, words } = require("../src/db/schema");

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
  incompleteWordsCount: number;
}

/**
 * Calculate basic dashboard metrics for a given user.
 */
const calculateBasicUserMetrics = async (user: {
  _id: string;
  languages?: string[];
}): Promise<BasicUserMetrics | undefined> => {
  const userId = user._id;
  const userLanguages: string[] =
    user.languages !== undefined ? user.languages : [];

  // 1) Total word count
  const [{ count: totalWords }] = await db
    .select({ count: count() })
    .from(words)
    .where(eq(words.userId, userId));

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

  // 6) Incomplete words count: words whose translations don't cover all user languages
  const wordRows = await db
    .select({ id: words.id })
    .from(words)
    .where(eq(words.userId, userId));

  const wordIds = wordRows.map((w) => w.id);
  let incompleteWordsCount = 0;

  if (wordIds.length > 0 && userLanguages.length > 0) {
    const langRows = await db
      .select({ wordId: translations.wordId, language: translations.language })
      .from(translations)
      .where(inArray(translations.wordId, wordIds));

    // Group languages by word
    const langsByWord = new Map<string, Set<string>>();
    for (const r of langRows) {
      const s = langsByWord.get(r.wordId) || new Set();
      s.add(r.language);
      langsByWord.set(r.wordId, s);
    }

    for (const [, langs] of langsByWord) {
      const missing = userLanguages.some((l) => !langs.has(l));
      if (missing) incompleteWordsCount++;
    }
  }

  return {
    translationsPerLanguage,
    translationsPerLanguageAndPOS,
    wordsPerPOS,
    wordsPerMonth,
    totalWords,
    incompleteWordsCount,
  };
};

module.exports = { calculateBasicUserMetrics };
