/**
 * Word Controller — Drizzle ORM (PostgreSQL)
 *
 * Migration notes (MongoDB → PostgreSQL schema changes):
 *   - MongoDB stored translations nested inside each Word document as
 *     `translations: [{ language, cases: [{ word, caseName }] }]`.
 *   - PostgreSQL normalises this into three levels: `words` → `translations` →
 *     `translation_cases`. Every endpoint that returns a word must reconstruct
 *     the legacy nested shape so the front-end contract is unchanged.
 *   - The many-to-many link between words and tags lives in the `tag_words`
 *     junction table (moved out of a virtual into its own physical table).
 *   - `isCloned` and `originalCreatorId` are stored directly on the word row;
 *     the old `originalCreator` ObjectId is now a UUID FK.
 *
 * Route usage is declared in ../routes/wordRoutes.js (still CJS).
 */

const { db } = require("../src/db");
const {
  tags,
  tagWords,
  translationCases,
  translations,
  words,
  exercisePerformances,
  exercisePerformanceCases,
} = require("../src/db/schema");

// Re-exported helper from the migrated tag controller.
const { getWordsIdFromFollowedTagsByUserId } = require("./tagController.ts");

const {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  lt,
  ne,
  not,
  or,
  sql,
}: typeof import("drizzle-orm") = require("drizzle-orm");
const asyncHandler = require("express-async-handler");

// Shared word-assembly helpers extracted to avoid controller→controller deps
const {
    fetchTranslationsMap,
    fetchTagsMap,
    assembleWord,
    fetchWordsWithRelations,
    fetchWordWithRelations,
} = require('../services/wordService');
import type { WordResponse, AssembledTranslation } from '../services/wordService';

// ---------------------------------------------------------------------------
// Types for translation diffing (used by updateWord)
// ---------------------------------------------------------------------------

interface IncomingCase {
  caseName: string;
  word: string;
}

interface IncomingTranslation {
  language: string;
  cases: IncomingCase[];
}

interface StoredCase {
  id: string;
  translationId: string;
  caseName: string;
  word: string;
}

interface StoredTranslation {
  id: string;
  wordId: string;
  language: string;
  cases: StoredCase[];
}

interface CaseDiff {
  casesToAdd: IncomingCase[];
  casesToRemove: StoredCase[];
  casesToUpdate: Array<{ stored: StoredCase; incoming: IncomingCase }>;
}

interface TranslationDiffResult {
  same: Array<{ stored: StoredTranslation; incoming: IncomingTranslation; caseDiff: CaseDiff }>;
  toAdd: IncomingTranslation[];
  toRemove: StoredTranslation[];
}
// (fetchTranslationsMap, fetchTagsMap, assembleWord, fetchWordsWithRelations,
//  and fetchWordWithRelations are now in backend/services/wordService.ts)

// ---------------------------------------------------------------------------
// HELPERS: Simplified-word field extraction (getWordsSimplified)
// ---------------------------------------------------------------------------

/**
 * Extract the minimal display fields for a translation, based on part of
 * speech and language.  Preserves the exact logic of the old
 * `getRequiredFieldsData()`.
 */
const getRequiredFieldsData = (
  translation: AssembledTranslation,
  partOfSpeech: string,
): Record<string, string> => {
  const findByCaseName = (name: string): string | undefined =>
    translation.cases.find((c) => c.caseName === name)?.word;

  switch (partOfSpeech) {
    case "Noun": {
      switch (translation.language) {
        case "Estonian":
          return { dataEE: findByCaseName("singularNimetavEE")! };
        case "English":
          return { dataEN: findByCaseName("singularEN")! };
        case "Spanish":
          return {
            genderES: findByCaseName("genderES")!,
            dataES: findByCaseName("singularES")!,
          };
        case "German":
          return {
            genderDE: findByCaseName("genderDE")!,
            dataDE: findByCaseName("singularNominativDE")!,
          };
        default:
          console.warn(
            `getRequiredFieldsData: unrecognized language "${translation.language}" for part of speech "Noun"`,
          );
          return {};
      }
    }
    case "Adverb": {
      switch (translation.language) {
        case "English":
          return { dataEN: findByCaseName("adverbEN")! };
        case "Spanish":
          return { dataES: findByCaseName("adverbES")! };
        case "German":
          return { dataDE: findByCaseName("adverbDE")! };
        default:
          console.warn(
            `getRequiredFieldsData: unrecognized language "${translation.language}" for part of speech "Adverb"`,
          );
          return {};
      }
    }
    case "Adjective": {
      switch (translation.language) {
        case "English":
          return { dataEN: findByCaseName("positiveEN")! };
        case "Spanish": {
          const male = findByCaseName("maleSingularES");
          if (male) return { dataES: male };
          return { dataES: findByCaseName("neutralSingularES")! };
        }
        case "German":
          return { dataDE: findByCaseName("positiveDE")! };
        case "Estonian":
          return { dataEE: findByCaseName("algvorreEE")! };
        default:
          console.warn(
            `getRequiredFieldsData: unrecognized language "${translation.language}" for part of speech "Adjective"`,
          );
          return {};
      }
    }
    case "Verb": {
      switch (translation.language) {
        case "English":
          return { dataEN: findByCaseName("simplePresent1sEN")! };
        case "Spanish":
          return { dataES: findByCaseName("infinitiveNonFiniteSimpleES")! };
        case "Estonian":
          return { dataEE: findByCaseName("infinitiveMaEE")! };
        case "German":
          return { dataDE: findByCaseName("infinitiveDE")! };
        default:
          console.warn(
            `getRequiredFieldsData: unrecognized language "${translation.language}" for part of speech "Verb"`,
          );
          return {};
      }
    }
    default:
      console.warn(
        `getRequiredFieldsData: unrecognized part of speech "${partOfSpeech}"`,
      );
      return {};
  }
};

/**
 * Map a language name to the field name used in the simplified response
 * (e.g. "Estonian" → "registeredCasesEE").  Mirrors old `getFieldName()`.
 */
const languageToFieldName = (language: string): string => {
  const map: Record<string, string> = {
    Estonian: "registeredCasesEE",
    English: "registeredCasesEN",
    Spanish: "registeredCasesES",
    German: "registeredCasesDE",
  };
  return map[language] || "";
};

/**
 * Build a simplified word object for the table view.
 * Mirrors the old loop inside `getWordsSimplified`.
 */
const simplifyWord = (word: WordResponse): Record<string, any> => {
  const storedLanguages = new Set<string>();
  let simplified: Record<string, any> = {
    tags: word.tags,
    partOfSpeech: word.partOfSpeech,
    createdAt: word.createdAt,
    updatedAt: word.updatedAt,
    id: word.id,
    user: word.user,
  };

  for (const translation of word.translations) {
    storedLanguages.add(translation.language);
    simplified = {
      ...simplified,
      ...getRequiredFieldsData(translation, word.partOfSpeech),
      [languageToFieldName(translation.language)]: translation.cases.length,
    };
  }

  return { ...simplified, storedLanguages: Array.from(storedLanguages) };
};

// ---------------------------------------------------------------------------
// HELPERS: Tag-word diffing (for updateWord)
// ---------------------------------------------------------------------------

/**
 * Compare the incoming tag list with the currently stored tags for a word
 * and return `{ toRemove, toAdd }` arrays of tag UUIDs.
 */
const diffTagWords = async (
  wordId: string,
  incomingTags: Array<{ _id?: string; id?: string }>,
): Promise<{ toRemove: string[]; toAdd: string[] }> => {
  const incomingIds = incomingTags
    .map((t) => t._id ?? t.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const stored = await db
    .select({ tagId: tagWords.tagId })
    .from(tagWords)
    .where(eq(tagWords.wordId, wordId));

  const storedIds = stored.map((s) => s.tagId);

  return {
    toRemove: storedIds.filter((id) => !incomingIds.includes(id)),
    toAdd: incomingIds.filter((id) => !storedIds.includes(id)),
  };
};

/**
 * Compare incoming translations (from request body) with currently stored
 * translations for a word, matching by language.  Returns a diff describing
 * which translations to keep (with case-level changes), add, or remove.
 */
const diffTranslations = (
  incoming: IncomingTranslation[],
  stored: StoredTranslation[],
): TranslationDiffResult => {
  const result: TranslationDiffResult = {
    same: [],
    toAdd: [],
    toRemove: [],
  };

  for (const s of stored) {
    const match = incoming.find((inc) => inc.language === s.language);
    if (match) {
      const casesToAdd: IncomingCase[] = [];
      const casesToRemove: StoredCase[] = [];
      const casesToUpdate: Array<{ stored: StoredCase; incoming: IncomingCase }> = [];

      for (const sc of s.cases) {
        const cm = match.cases.find((mc) => mc.caseName === sc.caseName);
        if (!cm) {
          casesToRemove.push(sc);
        } else if (cm.word !== sc.word) {
          casesToUpdate.push({ stored: sc, incoming: cm });
        }
      }

      for (const mc of match.cases) {
        if (!s.cases.find((sc) => sc.caseName === mc.caseName)) {
          casesToAdd.push(mc);
        }
      }

      result.same.push({
        stored: s,
        incoming: match,
        caseDiff: { casesToAdd, casesToRemove, casesToUpdate },
      });
    } else {
      result.toRemove.push(s);
    }
  }

  for (const inc of incoming) {
    if (!stored.find((s) => s.language === inc.language)) {
      result.toAdd.push(inc);
    }
  }

  return result;
};

// ===========================================================================
// ENDPOINTS
// ===========================================================================

// @desc    Get all words for the authenticated user
// @route   GET /api/words
// @access  Private
const getWords = asyncHandler(async (req: any, res: any) => {
  const wordRows = await db
    .select()
    .from(words)
    .where(eq(words.userId, req.user.id));

  const wordIds = wordRows.map((w) => w.id);
  // fetchWordsWithRelations handles the empty-array case internally.
  const result = await fetchWordsWithRelations(wordIds);
  res.status(200).json(result);
});

// @desc    Get list of word ids belonging to tags the current user follows
// @route   GET /api/words/getWordsRelatedToFollowedTag
// @access  Private
const getWordsByFollowedTag = asyncHandler(async (req: any, res: any) => {
  // Delegates to the tag controller which handles the user-following-tags → tagWords resolution
  const matchingWordsId = await getWordsIdFromFollowedTagsByUserId(req.user.id);
  res.status(200).json(matchingWordsId);
});

// ---------------------------------------------------------------------------
// HELPERS: query-param parsing & keyset cursor (for getWordsSimplified)
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;

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

const encodeCursor = (createdAt: Date, id: string): string =>
  Buffer.from(`${createdAt.toISOString()}|${id}`, "utf-8").toString("base64");

const decodeCursor = (cursor: string): { createdAt: Date; id: string } | null => {
  try {
    const [createdAtStr, id] = Buffer.from(cursor, "base64")
      .toString("utf-8")
      .split("|");
    const createdAt = new Date(createdAtStr);
    if (!id || Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
};

// @desc    Get words with simplified data (table view with filters + keyset pagination)
// @route   GET /api/words/simple
// @access  Private
const getWordsSimplified = asyncHandler(async (req: any, res: any) => {
  // ids of words belonging to tags the user follows (included alongside own words)
  const followedTagWordIds = await getWordsIdFromFollowedTagsByUserId(
    req.user.id,
  );

  // Base access condition: own words OR words from followed tags
  const accessCondition = or(
    eq(words.userId, req.user.id),
    followedTagWordIds.length > 0
      ? inArray(words.id, followedTagWordIds)
      : sql`false`,
  );

  const conditions = [accessCondition];

  const posValues = parseArrayParam(req.query.pos);
  if (posValues.length > 0) {
    conditions.push(inArray(words.partOfSpeech, posValues));
  }

  const genderValues = parseArrayParam(req.query.gender);
  if (genderValues.length > 0) {
    const genderWordIds = db
      .select({ id: translations.wordId })
      .from(translationCases)
      .innerJoin(translations, eq(translationCases.translationId, translations.id))
      .where(
        and(
          inArray(translationCases.word, genderValues),
          ilike(translationCases.caseName, "gender%"),
        ),
      );
    conditions.push(inArray(words.id, genderWordIds));
  }

  const q: string | undefined = req.query.q;
  if (q) {
    // Same matching rule as GET /api/words/searchWord: substring match on any
    // stored case word, excluding gender/gradable metadata rows.
    const matchingWordIds = db
      .select({ id: translations.wordId })
      .from(translationCases)
      .innerJoin(translations, eq(translationCases.translationId, translations.id))
      .where(
        and(
          ilike(translationCases.word, `%${q}%`),
          not(ilike(translationCases.caseName, "gender%")),
          not(ilike(translationCases.caseName, "gradable%")),
        ),
      );
    conditions.push(inArray(words.id, matchingWordIds));
  }

  const tagIds = parseArrayParam(req.query.tag);
  if (tagIds.length > 0) {
    const tagWordIds = db
      .select({ id: tagWords.wordId })
      .from(tagWords)
      .where(inArray(tagWords.tagId, tagIds));
    conditions.push(inArray(words.id, tagWordIds));
  }

  // Total matching the filters alone (not the cursor page) — computed before
  // the keyset predicate is added below, so it stays constant across pages.
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(words)
    .where(and(...conditions));

  if (req.query.cursor !== undefined) {
    const cursor = decodeCursor(req.query.cursor);
    if (!cursor) {
      res.status(400);
      throw new Error("Invalid cursor");
    }
    // Keyset condition for ORDER BY created_at DESC, id DESC: strictly older
    // than the cursor row, or tied on created_at and strictly smaller id.
    // (A raw `(created_at, id) < ($1, $2)` row-value comparison was tried
    // first but Postgres does not reliably type-infer the composite literal's
    // parameters here, so it silently failed to filter.)
    conditions.push(
      or(
        lt(words.createdAt, cursor.createdAt),
        and(eq(words.createdAt, cursor.createdAt), lt(words.id, cursor.id)),
      ),
    );
  }

  const limit = parseLimitParam(req.query.limit);

  const pageRows = await db
    .select()
    .from(words)
    .where(and(...conditions))
    .orderBy(desc(words.createdAt), desc(words.id))
    .limit(limit + 1);

  const hasMore = pageRows.length > limit;
  const rows = hasMore ? pageRows.slice(0, limit) : pageRows;
  const nextCursor = hasMore
    ? encodeCursor(rows[rows.length - 1].createdAt, rows[rows.length - 1].id)
    : null;

  // Fetch full relations, then re-order to match the cursor-ordered rows —
  // fetchWordsWithRelations' own SELECT ... WHERE id IN (...) does not
  // preserve input order.
  const orderedIds = rows.map((r) => r.id);
  const fullWordsById = new Map(
    (await fetchWordsWithRelations(orderedIds)).map((w) => [w.id, w]),
  );
  const items = orderedIds
    .map((id) => fullWordsById.get(id))
    .filter((w): w is WordResponse => w !== undefined)
    .map(simplifyWord);

  res.status(200).json({ items, nextCursor, total });
});

// @desc    Get a single word by ID (with tags resolved)
// @route   GET /api/words/:id
// @access  Private
const getWordById = asyncHandler(async (req: any, res: any) => {
  const wordData = await fetchWordWithRelations(req.params.id);

  if (!wordData) {
    res.status(400);
    throw new Error("Word not found");
  }

  // Ownership check (§8.4). Until Phase 4 adds followed-tag read access, only
  // the author may fetch a word by id.
  if (wordData.user !== req.user.id) {
    res.status(403);
    throw new Error("User not authorized");
  }

  res.status(200).json(wordData);
});

// @desc    Create a word with translations, cases, and optional tag associations
// @route   POST /api/words
// @access  Private
const setWord = asyncHandler(async (req: any, res: any) => {
  if (!req.body.partOfSpeech) {
    res.status(400);
    throw new Error("Please add part of speech");
  }
  if (!req.body.translations || req.body.translations.length < 2) {
    res.status(400);
    throw new Error("Please add 2 or more translations");
  }

  // 1. Insert the word row
  const [newWord] = await db
    .insert(words)
    .values({
      userId: req.user.id,
      partOfSpeech: req.body.partOfSpeech,
      clue: req.body.clue ?? null,
    })
    .returning();

  // 2. Insert translation rows and collect their generated IDs
  const translationInserts = req.body.translations.map((t: any) => ({
    wordId: newWord.id,
    language: t.language,
  }));
  const newTranslations = await db
    .insert(translations)
    .values(translationInserts)
    .returning();

  // 3. Insert case rows for each translation
  const caseInserts: Array<{
    translationId: string;
    caseName: string;
    word: string;
  }> = [];
  for (let i = 0; i < newTranslations.length; i++) {
    const tCases = req.body.translations[i].cases || [];
    for (const c of tCases) {
      caseInserts.push({
        translationId: newTranslations[i].id,
        caseName: c.caseName,
        word: c.word,
      });
    }
  }
  if (caseInserts.length > 0) {
    await db.insert(translationCases).values(caseInserts);
  }

  // 4. Create tag-word associations if provided
  const incomingTags: Array<{ _id?: string; id?: string }> = req.body.tags || [];
  if (incomingTags.length > 0) {
    await db
      .insert(tagWords)
      .values(
        incomingTags
          .map((tag) => ({ tagId: tag._id ?? tag.id, wordId: newWord.id }))
          .filter((item) => typeof item.tagId === 'string' && item.tagId.length > 0),
      );
  }

  // 5. Return the fully assembled word
  const assembled = await fetchWordWithRelations(newWord.id);
  res.status(200).json(assembled);
});

// @desc    Update a word and synchronise its tag associations
// @route   PUT /api/words/:id
// @access  Private
const updateWord = asyncHandler(async (req: any, res: any) => {
  const [word] = await db
    .select()
    .from(words)
    .where(eq(words.id, req.params.id))
    .limit(1);

  if (!word) {
    res.status(400);
    throw new Error("Word not found");
  }
  if (!req.user) {
    res.status(401);
    throw new Error("User not found");
  }
  if (word.userId !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }

  if (req.body.translations !== undefined) {
    // Fetch stored translations with their cases
    const storedTranslationRows = await db
      .select({
        translationId: translations.id,
        translationLanguage: translations.language,
        caseId: translationCases.id,
        caseName: translationCases.caseName,
        caseWord: translationCases.word,
      })
      .from(translations)
      .leftJoin(translationCases, eq(translationCases.translationId, translations.id))
      .where(eq(translations.wordId, req.params.id));

    const groupedMap = new Map<string, StoredTranslation>();
    for (const r of storedTranslationRows) {
      if (!groupedMap.has(r.translationId)) {
        groupedMap.set(r.translationId, {
          id: r.translationId,
          wordId: req.params.id,
          language: r.translationLanguage,
          cases: [],
        });
      }
      if (r.caseId) {
        groupedMap.get(r.translationId)!.cases.push({
          id: r.caseId,
          translationId: r.translationId,
          caseName: r.caseName!,
          word: r.caseWord!,
        });
      }
    }
    const storedTranslations = Array.from(groupedMap.values());

    // Diff incoming vs stored
    const diff = diffTranslations(req.body.translations, storedTranslations);

    // --- Handle removed translations + their performance data ---
    if (diff.toRemove.length > 0) {
      const removedIds = diff.toRemove.map((t) => t.id);

      // Delete performance records owned by this user for these translations
      await db
        .delete(exercisePerformances)
        .where(
          and(
            inArray(exercisePerformances.translationId, removedIds),
            eq(exercisePerformances.userId, req.user.id),
          ),
        );

      // Delete the translations themselves (FK set-null handles other users' perf)
      await db
        .delete(translations)
        .where(inArray(translations.id, removedIds));
    }

    // --- Handle kept translations (case-level diff) ---
    for (const { stored: s, caseDiff } of diff.same) {
      if (caseDiff.casesToRemove.length > 0) {
        // Remove orphaned exercise performance cases
        const [perf] = await db
          .select()
          .from(exercisePerformances)
          .where(
            and(
              eq(exercisePerformances.translationId, s.id),
              eq(exercisePerformances.userId, req.user.id),
            ),
          )
          .limit(1);
        if (perf) {
          await db
            .delete(exercisePerformanceCases)
            .where(
              and(
                eq(exercisePerformanceCases.exercisePerformanceId, perf.id),
                inArray(
                  exercisePerformanceCases.caseName,
                  caseDiff.casesToRemove.map((c) => c.caseName),
                ),
              ),
            );
        }

        await db
          .delete(translationCases)
          .where(
            inArray(
              translationCases.id,
              caseDiff.casesToRemove.map((c) => c.id),
            ),
          );
      }

      if (caseDiff.casesToUpdate.length > 0) {
        for (const { stored: sc, incoming: ic } of caseDiff.casesToUpdate) {
          await db
            .update(translationCases)
            .set({ word: ic.word })
            .where(eq(translationCases.id, sc.id));
        }
      }

      if (caseDiff.casesToAdd.length > 0) {
        await db.insert(translationCases).values(
          caseDiff.casesToAdd.map((c) => ({
            translationId: s.id,
            caseName: c.caseName,
            word: c.word,
          })),
        );
      }
    }

    // --- Handle new translations ---
    if (diff.toAdd.length > 0) {
      const newTranslations = await db
        .insert(translations)
        .values(
          diff.toAdd.map((t) => ({
            wordId: req.params.id,
            language: t.language,
          })),
        )
        .returning();

      const caseInserts: Array<{
        translationId: string;
        caseName: string;
        word: string;
      }> = [];
      for (let i = 0; i < newTranslations.length; i++) {
        for (const c of diff.toAdd[i].cases) {
          caseInserts.push({
            translationId: newTranslations[i].id,
            caseName: c.caseName,
            word: c.word,
          });
        }
      }
      if (caseInserts.length > 0) {
        await db.insert(translationCases).values(caseInserts);
      }
    }
  }

  // Diff tag associations and apply changes
  const incomingTags: Array<{ _id?: string; id?: string }> = req.body.tags || [];
  const { toRemove, toAdd } = await diffTagWords(req.params.id, incomingTags);

  if (toRemove.length > 0) {
    await db
      .delete(tagWords)
      .where(
        and(
          eq(tagWords.wordId, req.params.id),
          inArray(tagWords.tagId, toRemove),
        ),
      );
  }
  if (toAdd.length > 0) {
    await db
      .insert(tagWords)
      .values(toAdd.map((tagId) => ({ tagId, wordId: req.params.id })));
  }

  // Update word fields — only set fields that are explicitly provided
  const wordUpdateFields: Record<string, any> = {};
  if (req.body.user !== undefined) wordUpdateFields.userId = req.body.user;
  if (req.body.partOfSpeech !== undefined) wordUpdateFields.partOfSpeech = req.body.partOfSpeech;
  if (req.body.clue !== undefined) wordUpdateFields.clue = req.body.clue;

  const hasUpdates = Object.keys(wordUpdateFields).length > 0;
  const updatedWordId = hasUpdates
    ? (await db
        .update(words)
        .set(wordUpdateFields)
        .where(eq(words.id, req.params.id))
        .returning({ id: words.id }))[0].id
    : req.params.id;

  const assembled = await fetchWordWithRelations(updatedWordId);
  res.status(200).json(assembled);
});

// @desc    Delete a word (cascade removes translations, cases, and tag_words)
// @route   DELETE /api/words/:id
// @access  Private
const deleteWord = asyncHandler(async (req: any, res: any) => {
  const [word] = await db
    .select()
    .from(words)
    .where(eq(words.id, req.params.id))
    .limit(1);

  if (!word) {
    res.status(400);
    throw new Error("Word not found");
  }
  if (!req.user) {
    res.status(401);
    throw new Error("User not found");
  }
  if (word.userId !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }

  // Cascade deletes handle translations, translation_cases, and tag_words.
  // We explicitly delete tag_words first so the test assertion
  // "expect(await TagWord.find({ wordId })).toHaveLength(0)" passes.
  await db.delete(tagWords).where(eq(tagWords.wordId, req.params.id));
  await db.delete(words).where(eq(words.id, req.params.id));

  res.status(200).json({ id: word.id });
});

// @desc    Delete multiple words by their IDs
// @route   DELETE /api/words/deleteMany
// @access  Private
const deleteManyWords = asyncHandler(async (req: any, res: any) => {
  if (!req.user) {
    res.status(401);
    throw new Error("User not found");
  }

  const wordIds: string[] = req.body.wordsId || [];
  if (wordIds.length === 0) {
    res.status(400);
    throw new Error("No word IDs provided");
  }

  // Verify all words exist and belong to the current user
  const wordRows = await db
    .select()
    .from(words)
    .where(inArray(words.id, wordIds));

  if (wordRows.length !== wordIds.length) {
    res.status(400);
    throw new Error("Some words are missing");
  }

  const notOwned = wordRows.filter((w) => w.userId !== req.user.id);
  if (notOwned.length > 0) {
    res.status(401);
    throw new Error("User not authorized to delete at least one of the words");
  }

  // Delete tagWords first, then words (cascade handles the rest)
  await db.delete(tagWords).where(inArray(tagWords.wordId, wordIds));
  await db.delete(words).where(inArray(words.id, wordIds));

  res.status(200).json({ deletedCount: wordIds.length });
});

// @desc    Search words by translation text
// @route   GET /api/words/searchWord
// @access  Private
const filterWordByAnyTranslation = asyncHandler(async (req: any, res: any) => {
  if (!req.query || !req.query.query) {
    res.status(400);
    throw new Error("Missing search query text");
  }
  if (!req.user) {
    res.status(401);
    throw new Error("User not found");
  }

  const query = req.query.query;
  const wordsFromFollowedTags = await getWordsIdFromFollowedTagsByUserId(
    req.user.id,
  );

  // Find all translation_cases rows that match the search query (case-insensitive),
  // excluding gender/gradable metadata fields.  Each distinct match produces one
  // search result entry (even if multiple cases in the same word match).
  const matchingCaseRows = await db
    .select({
      wordId: words.id,
      translationId: translations.id,
      translationLanguage: translations.language,
      caseWord: translationCases.word,
      caseName: translationCases.caseName,
    })
    .from(translationCases)
    .innerJoin(
      translations,
      eq(translationCases.translationId, translations.id),
    )
    .innerJoin(words, eq(translations.wordId, words.id))
    .where(
      and(
        ilike(translationCases.word, `%${query}%`),
        not(ilike(translationCases.caseName, "gender%")),
        not(ilike(translationCases.caseName, "gradable%")),
        or(
          eq(words.userId, req.user.id),
          wordsFromFollowedTags.length > 0
            ? inArray(words.id, wordsFromFollowedTags)
            : sql`false`,
        ),
      ),
    );

  if (matchingCaseRows.length === 0) {
    res.status(200).json([]);
    return;
  }

  // Group results by word+language to produce one entry per language
  const wordIds = [...new Set(matchingCaseRows.map((r) => r.wordId))];
  const wordMap = new Map(
    (await fetchWordsWithRelations(wordIds)).map((w) => [w.id, w]),
  );

  const simpleResults: Array<{
    id: string;
    type: string;
    completeWordInfo: WordResponse;
    language: string;
    label: string;
  }> = [];

  // For each word, produce one result per matching language (first matching case wins per language)
  const seen = new Set<string>(); // key = `${wordId}:${language}`
  for (const row of matchingCaseRows) {
    const key = `${row.wordId}:${row.translationLanguage}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const completeWordInfo = wordMap.get(row.wordId);
    if (!completeWordInfo) continue;

    simpleResults.push({
      id: row.wordId,
      type: "word",
      completeWordInfo,
      language: row.translationLanguage,
      label: row.caseWord,
    });
  }

  simpleResults.sort((a, b) => a.label.localeCompare(b.label));
  res.status(200).json(simpleResults);
});

// ===========================================================================
// EXPORTS
// ===========================================================================

module.exports = {
  getWords,
  getWordsSimplified,
  getWordById,
  setWord,
  updateWord,
  deleteWord,
  filterWordByAnyTranslation,
  deleteManyWords,
  getWordsByFollowedTag,
};
