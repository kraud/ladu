/**
 * The demo template and its copy (demo-access.md, Slice 2).
 *
 * The TEMPLATE is one user row (`is_demo = true`, `demo_expires_at` NULL, username
 * `__demo_template__`) that holds the sample data. It never signs in, never expires and is never
 * purged. `seedDemoTemplate` builds it from `scripts/demo-template/data.json`; richer content is a
 * change to that file, not to code (`tests/demoTemplate.test.js` checks the file).
 *
 * Each demo start copies the template into the new demo account (`cloneDemoTemplate`), inside the
 * start transaction: new ids made here (an old → new map per table, since `INSERT … RETURNING`
 * cannot return the source id), the practice config arrays remapped, and the practice history
 * dates moved forward, so the seed never looks "forgotten" (the forgetting curve ages by date).
 */
const { randomUUID } = require("crypto");
const path = require("path");
const fs = require("fs");
const { and, asc, eq, inArray, isNull } = require("drizzle-orm");
const { db }: typeof import("../src/db") = require("../src/db");
const {
  users,
  words,
  translations,
  translationCases,
  tags,
  tagWords,
  practiceConfigs,
  exercisePerformances,
  exercisePerformanceCases,
}: typeof import("../src/db/schema") = require("../src/db/schema");
const { applyAnswer, translationAverage }: typeof import("../services/exercises/knowledge") = require("../services/exercises/knowledge");
const { validateConfigRequest }: typeof import("../services/exercises/validateConfig") = require("../services/exercises/validateConfig");

export const TEMPLATE_USERNAME = "__demo_template__";
const TEMPLATE_EMAIL = "demo-template@ladu.invalid";
const DATA_FILE = path.resolve(__dirname, "../scripts/demo-template/data.json");
const DAY_MS = 24 * 60 * 60 * 1000;

// --- The data file -------------------------------------------------------------------------------

export interface TemplateData {
  tags: { key: string; label: string; description?: string }[];
  words: {
    key: string;
    partOfSpeech: string;
    tags: string[];
    /** language label → caseName → word */
    translations: Record<string, Record<string, string>>;
  }[];
  practiceConfigs: {
    name: string;
    description?: string | null;
    params: Record<string, unknown>;
    /** word keys, or null for "no pre-selected words" */
    words: string[] | null;
    /** tag keys, or null */
    tags: string[] | null;
  }[];
  /** Practice history of one translation: the last answers of each case (oldest first). */
  history: {
    word: string;
    language: string;
    daysAgo: number;
    modifier?: "Mastered" | "Revise";
    cases: Record<string, boolean[]>;
  }[];
}

export const loadTemplateData = (file: string = DATA_FILE): TemplateData => JSON.parse(fs.readFileSync(file, "utf8"));

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The template user, or undefined when it was not seeded. */
export const findTemplateUser = async (executor: Pick<typeof db, "select"> = db) => {
  const [row] = await executor
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, TEMPLATE_USERNAME), eq(users.isDemo, true), isNull(users.demoExpiresAt)))
    .limit(1);
  return row;
};

// --- Seed ----------------------------------------------------------------------------------------

/**
 * Builds the template from the data file, in one transaction. Safe to run again: an existing
 * template is kept (`created: false`) unless `reset` is set, which deletes it first (its rows
 * cascade). Running demos are copies, so a reset does not touch them.
 */
export const seedDemoTemplate = async (
  { reset = false, data = loadTemplateData(), now = new Date() }: { reset?: boolean; data?: TemplateData; now?: Date } = {},
): Promise<{ created: boolean; userId: string; words: number; tags: number }> =>
  db.transaction(async (tx: Tx) => {
    const existing = await findTemplateUser(tx);
    if (existing && !reset) {
      const [w, t] = await Promise.all([
        tx.select({ id: words.id }).from(words).where(eq(words.userId, existing.id)),
        tx.select({ id: tags.id }).from(tags).where(eq(tags.authorId, existing.id)),
      ]);
      return { created: false, userId: existing.id, words: w.length, tags: t.length };
    }
    if (existing) await tx.delete(users).where(eq(users.id, existing.id));

    const [template] = await tx
      .insert(users)
      .values({
        name: "Demo",
        username: TEMPLATE_USERNAME,
        email: TEMPLATE_EMAIL,
        password: null,
        languages: ["English", "Spanish", "German", "Estonian"],
        uiLanguage: "English",
        nativeLanguage: "English",
        verified: true,
        isDemo: true,
        demoExpiresAt: null,
      })
      .returning({ id: users.id });
    const userId = template.id;

    const tagIdByKey = new Map<string, string>();
    for (const tag of data.tags) {
      const [row] = await tx
        .insert(tags)
        .values({ authorId: userId, label: tag.label, description: tag.description ?? null, visibility: "Private" })
        .returning({ id: tags.id });
      tagIdByKey.set(tag.key, row.id);
    }

    // The first word in the file is the newest, as in the word list (newest first).
    const wordIdByKey = new Map<string, string>();
    const translationIdByWordLanguage = new Map<string, string>();
    for (const [index, word] of data.words.entries()) {
      const createdAt = new Date(now.getTime() - index * 1000);
      const [row] = await tx
        .insert(words)
        .values({ userId, partOfSpeech: word.partOfSpeech, createdAt, updatedAt: createdAt })
        .returning({ id: words.id });
      wordIdByKey.set(word.key, row.id);
      for (const [language, cases] of Object.entries(word.translations)) {
        const [translation] = await tx.insert(translations).values({ wordId: row.id, language }).returning({ id: translations.id });
        translationIdByWordLanguage.set(`${word.key}|${language}`, translation.id);
        await tx
          .insert(translationCases)
          .values(Object.entries(cases).map(([caseName, value]) => ({ translationId: translation.id, caseName, word: value })));
      }
      const wordTags = word.tags.map((key) => ({ tagId: tagIdByKey.get(key) as string, wordId: row.id }));
      if (wordTags.length > 0) await tx.insert(tagWords).values(wordTags);
    }

    for (const config of data.practiceConfigs) {
      await tx.insert(practiceConfigs).values({
        userId,
        name: config.name,
        description: config.description ?? null,
        params: config.params,
        wordIds: config.words ? config.words.map((key) => wordIdByKey.get(key) as string) : null,
        tagIds: config.tags ? config.tags.map((key) => tagIdByKey.get(key) as string) : null,
      });
    }

    // The knowledge of each case comes from its answers, through the engine's own rule, so the
    // seeded numbers cannot disagree with the ones practice computes.
    for (const entry of data.history) {
      const lastDate = new Date(now.getTime() - entry.daysAgo * DAY_MS);
      const stats = Object.entries(entry.cases).map(([caseName, answers]) =>
        answers.reduce<ReturnType<typeof applyAnswer> | undefined>((stat, correct) => applyAnswer(stat, caseName, correct, lastDate), undefined),
      ) as ReturnType<typeof applyAnswer>[];
      const [performance] = await tx
        .insert(exercisePerformances)
        .values({
          userId,
          wordId: wordIdByKey.get(entry.word) as string,
          translationId: translationIdByWordLanguage.get(`${entry.word}|${entry.language}`) as string,
          translationLanguage: entry.language,
          performanceModifier: entry.modifier ?? null,
          reviseCounter: 0,
          averageTranslationKnowledge: translationAverage(stats, lastDate),
          lastDateModifiedTranslation: lastDate,
        })
        .returning({ id: exercisePerformances.id });
      await tx.insert(exercisePerformanceCases).values(
        stats.map((stat) => ({
          exercisePerformanceId: performance.id,
          caseName: stat.caseName,
          record: stat.record,
          lastDate: stat.lastDate,
          knowledge: stat.knowledge,
        })),
      );
    }

    return { created: true, userId, words: data.words.length, tags: data.tags.length };
  });

// --- Copy ----------------------------------------------------------------------------------------

/** Maps each old id to a new one, made here. */
const idMap = (ids: string[]) => new Map(ids.map((id) => [id, randomUUID() as string]));
const mapped = (map: Map<string, string>, id: string) => map.get(id) as string;

/**
 * Copies the template into `userId`, inside the demo start transaction. Returns how many words,
 * tags and saved configs it added (the frozen caps are the words and tags plus the configured
 * maximums, D3/D7; the start log keeps all three, D19), or null when there is no template.
 *
 * The copies are the demo's OWN words and tags: `is_cloned = false` and no source ids, so the
 * "own copy" logic never treats them as followed words (Review log M4). Tags are Private.
 *
 * `languages` are the visitor's picks (D16): each saved config keeps only those languages, and a
 * config that is not valid after that is not copied (D17). The words keep all their translations,
 * like any word a user owns in a language they do not study.
 */
export const cloneDemoTemplate = async (
  tx: Tx,
  userId: string,
  now: Date = new Date(),
  languages?: string[],
): Promise<{ words: number; tags: number; configs: number } | null> => {
  const template = await findTemplateUser(tx);
  if (!template) return null;

  const tWords = await tx.select().from(words).where(eq(words.userId, template.id)).orderBy(asc(words.createdAt), asc(words.id));
  const tTags = await tx.select().from(tags).where(eq(tags.authorId, template.id));
  const wordIds = tWords.map((w) => w.id);
  const tagIds = tTags.map((t) => t.id);
  const tTranslations = wordIds.length ? await tx.select().from(translations).where(inArray(translations.wordId, wordIds)) : [];
  const translationIds = tTranslations.map((t) => t.id);
  const tCases = translationIds.length
    ? await tx.select().from(translationCases).where(inArray(translationCases.translationId, translationIds))
    : [];
  const tTagWords = tagIds.length ? await tx.select().from(tagWords).where(inArray(tagWords.tagId, tagIds)) : [];
  const tConfigs = (await tx.select().from(practiceConfigs).where(eq(practiceConfigs.userId, template.id))).flatMap((c) => {
    if (!languages) return [c];
    const params = c.params as Record<string, unknown>;
    const configLanguages = Array.isArray(params.languages) ? (params.languages as unknown[]) : [];
    const kept = { ...params, languages: configLanguages.filter((l) => typeof l === "string" && languages.includes(l)) };
    const valid = validateConfigRequest({ name: c.name, description: c.description, params: kept }).ok;
    return valid ? [{ ...c, params: kept }] : [];
  });
  const tPerformances = await tx.select().from(exercisePerformances).where(eq(exercisePerformances.userId, template.id));
  const tPerformanceCases = tPerformances.length
    ? await tx
        .select()
        .from(exercisePerformanceCases)
        .where(inArray(exercisePerformanceCases.exercisePerformanceId, tPerformances.map((p) => p.id)))
    : [];

  const wordMap = idMap(wordIds);
  const translationMap = idMap(translationIds);
  const tagMap = idMap(tagIds);
  const performanceMap = idMap(tPerformances.map((p) => p.id));

  // Move every history date forward by one amount, so the newest one is a day ago and the gaps stay.
  const dates = [
    ...tPerformances.map((p) => p.lastDateModifiedTranslation),
    ...tPerformanceCases.map((c) => c.lastDate),
  ].filter((d): d is Date => d instanceof Date);
  const newest = dates.length ? Math.max(...dates.map((d) => d.getTime())) : null;
  const shiftMs = newest === null ? 0 : now.getTime() - DAY_MS - newest;
  const shift = (date: Date | null) => (date ? new Date(date.getTime() + shiftMs) : null);

  if (tWords.length) {
    // The template's order is kept: the newest template word is the newest demo word.
    await tx.insert(words).values(
      tWords.map((w, index) => {
        const createdAt = new Date(now.getTime() - (tWords.length - 1 - index));
        return {
          id: mapped(wordMap, w.id),
          userId,
          partOfSpeech: w.partOfSpeech,
          clue: w.clue,
          isCloned: false,
          originalCreatorId: null,
          sourceWordId: null,
          createdAt,
          updatedAt: createdAt,
        };
      }),
    );
  }
  if (tTranslations.length) {
    await tx.insert(translations).values(
      tTranslations.map((t) => ({ id: mapped(translationMap, t.id), wordId: mapped(wordMap, t.wordId), language: t.language, createdAt: now, updatedAt: now })),
    );
  }
  if (tCases.length) {
    await tx.insert(translationCases).values(
      tCases.map((c) => ({ translationId: mapped(translationMap, c.translationId), caseName: c.caseName, word: c.word })),
    );
  }
  if (tTags.length) {
    await tx.insert(tags).values(
      tTags.map((t) => ({
        id: mapped(tagMap, t.id),
        authorId: userId,
        label: t.label,
        description: t.description,
        visibility: "Private" as const,
        sourceTagId: null,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }
  if (tTagWords.length) {
    await tx.insert(tagWords).values(tTagWords.map((tw) => ({ tagId: mapped(tagMap, tw.tagId), wordId: mapped(wordMap, tw.wordId) })));
  }
  if (tConfigs.length) {
    // The arrays hold template ids: each one is mapped, and an id with no copy is dropped.
    const remap = (map: Map<string, string>, ids: string[] | null) =>
      ids === null ? null : ids.map((id) => map.get(id)).filter((id): id is string => id !== undefined);
    await tx.insert(practiceConfigs).values(
      tConfigs.map((c) => ({
        userId,
        name: c.name,
        description: c.description,
        params: c.params,
        wordIds: remap(wordMap, c.wordIds),
        tagIds: remap(tagMap, c.tagIds),
        createdAt: now,
        updatedAt: now,
      })),
    );
  }
  if (tPerformances.length) {
    await tx.insert(exercisePerformances).values(
      tPerformances.map((p) => ({
        id: mapped(performanceMap, p.id),
        userId,
        wordId: mapped(wordMap, p.wordId),
        translationId: mapped(translationMap, p.translationId),
        performanceModifier: p.performanceModifier,
        reviseCounter: p.reviseCounter,
        averageTranslationKnowledge: p.averageTranslationKnowledge,
        lastDateModifiedTranslation: shift(p.lastDateModifiedTranslation),
        translationLanguage: p.translationLanguage,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }
  if (tPerformanceCases.length) {
    await tx.insert(exercisePerformanceCases).values(
      tPerformanceCases.map((c) => ({
        exercisePerformanceId: mapped(performanceMap, c.exercisePerformanceId),
        caseName: c.caseName,
        record: c.record,
        lastDate: shift(c.lastDate),
        knowledge: c.knowledge,
      })),
    );
  }

  return { words: tWords.length, tags: tTags.length, configs: tConfigs.length };
};
