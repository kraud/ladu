/**
 * Demo usage records and statistics (demo-access.md D19, D20, Slice 5).
 *
 * - `recordDemoStart`: one `demo_starts` row per start, inside the start transaction.
 * - `recordDemoRefusal`: +1 on the (UTC day, code) counter in `demo_refusals`.
 * - `closeDemoStarts`: the purge writes the final counts to the rows of the demos it deletes.
 * - `listDemoUsers`: the demo accounts on the DB now (the admin table).
 * - `demoUsageStats`: the admin banner.
 *
 * "Added" is what the demo has now minus what the template copy gave it (never below 0).
 * "Translations practised" counts the demo's practice rows with an answer after the start
 * (`last_date_modified_translation`; the copy moves the seed dates to a day ago or earlier, and an
 * answer does not change `updated_at`). Every date comparison goes through the query builder (the
 * columns have no time zone; a raw `Date` parameter would be sent in local time).
 */
const { and, count, desc, eq, gt, gte, inArray, isNotNull, sql } = require("drizzle-orm");
const { db }: typeof import("../src/db") = require("../src/db");
const {
  users,
  words,
  tags,
  practiceConfigs,
  exercisePerformances,
  demoStarts,
  demoRefusals,
}: typeof import("../src/db/schema") = require("../src/db/schema");
const { countLiveDemos }: typeof import("./demo") = require("./demo");

type Executor = Pick<typeof db, "select" | "insert" | "update">;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** The window of the engagement, cap and language statistics. */
export const DEMO_STATS_WINDOW_DAYS = 30;
/** The window of the refusal counts. */
export const DEMO_REFUSAL_WINDOW_DAYS = 7;
/** The admin table shows the newest demos on the DB, at most this many (the live cap is 1000 at most). */
export const DEMO_USERS_LIMIT = 200;

/** The refusals that are counted: the ones a visitor can meet when the request itself is valid. */
export const COUNTED_REFUSALS = [
  "demo_disabled",
  "demo_rate_limited",
  "demo_busy",
  "demo_unavailable",
  "captcha_failed",
] as const;
export type CountedRefusal = (typeof COUNTED_REFUSALS)[number];

export const isCountedRefusal = (code: unknown): code is CountedRefusal =>
  COUNTED_REFUSALS.includes(code as CountedRefusal);

// --- Writes --------------------------------------------------------------------------------------

export interface DemoStartRecord {
  userId: string;
  startedAt: Date;
  expiresAt: Date;
  uiLanguage: string;
  languages: string[];
  seedWords: number;
  seedTags: number;
  seedConfigs: number;
  wordLimit: number;
  tagLimit: number;
}

export const recordDemoStart = async (tx: Executor, record: DemoStartRecord): Promise<void> => {
  await tx.insert(demoStarts).values(record);
};

/** Adds one to today's counter (UTC day) for this refusal code. */
export const recordDemoRefusal = async (code: CountedRefusal, now: Date = new Date()): Promise<void> => {
  await db
    .insert(demoRefusals)
    .values({ day: now.toISOString().slice(0, 10), code, count: 1 })
    .onConflictDoUpdate({
      target: [demoRefusals.day, demoRefusals.code],
      set: { count: sql`${demoRefusals.count} + 1` },
    });
};

// --- What a demo has done ------------------------------------------------------------------------

export interface DemoActivity {
  words: number;
  tags: number;
  configs: number;
  translationsPractised: number;
}

/** The current counts of these demo users (users with no rows are 0). Four grouped counts. */
export const demoActivity = async (executor: Pick<typeof db, "select">, userIds: string[]): Promise<Map<string, DemoActivity>> => {
  const result = new Map<string, DemoActivity>(
    userIds.map((id) => [id, { words: 0, tags: 0, configs: 0, translationsPractised: 0 }]),
  );
  if (userIds.length === 0) return result;

  const [wordRows, tagRows, configRows, practisedRows] = await Promise.all([
    executor.select({ userId: words.userId, value: count() }).from(words).where(inArray(words.userId, userIds)).groupBy(words.userId),
    executor.select({ userId: tags.authorId, value: count() }).from(tags).where(inArray(tags.authorId, userIds)).groupBy(tags.authorId),
    executor
      .select({ userId: practiceConfigs.userId, value: count() })
      .from(practiceConfigs)
      .where(inArray(practiceConfigs.userId, userIds))
      .groupBy(practiceConfigs.userId),
    executor
      .select({ userId: exercisePerformances.userId, value: count() })
      .from(exercisePerformances)
      .innerJoin(demoStarts, eq(demoStarts.userId, exercisePerformances.userId))
      .where(
        and(
          inArray(exercisePerformances.userId, userIds),
          gt(exercisePerformances.lastDateModifiedTranslation, demoStarts.startedAt),
        ),
      )
      .groupBy(exercisePerformances.userId),
  ]);

  const put = (rows: { userId: string; value: number }[], key: keyof DemoActivity) => {
    for (const row of rows) {
      const entry = result.get(row.userId);
      if (entry) entry[key] = Number(row.value);
    }
  };
  put(wordRows, "words");
  put(tagRows, "tags");
  put(configRows, "configs");
  put(practisedRows, "translationsPractised");
  return result;
};

const added = (now: number, seed: number) => Math.max(0, now - seed);

/**
 * Writes the final counts to the start rows of these demo users, before the purge deletes them.
 * Call it in the purge's transaction, with the same user ids it deletes.
 */
export const closeDemoStarts = async (tx: Executor, userIds: string[], now: Date): Promise<void> => {
  if (userIds.length === 0) return;
  const rows = await tx
    .select({ id: demoStarts.id, userId: demoStarts.userId, seedWords: demoStarts.seedWords, seedTags: demoStarts.seedTags, seedConfigs: demoStarts.seedConfigs })
    .from(demoStarts)
    .where(and(inArray(demoStarts.userId, userIds), sql`${demoStarts.closedAt} IS NULL`));
  if (rows.length === 0) return;

  const activity = await demoActivity(tx, userIds);
  for (const row of rows) {
    const a = activity.get(row.userId as string);
    if (!a) continue;
    await tx
      .update(demoStarts)
      .set({
        wordsAdded: added(a.words, row.seedWords),
        tagsAdded: added(a.tags, row.seedTags),
        configsAdded: added(a.configs, row.seedConfigs),
        translationsPractised: a.translationsPractised,
        closedAt: now,
      })
      .where(eq(demoStarts.id, row.id));
  }
};

// --- The admin table -----------------------------------------------------------------------------

export interface DemoUserRow {
  id: string;
  status: "live" | "expired";
  startedAt: string;
  expiresAt: string;
  languages: string[];
  uiLanguage: string | null;
  /** NULL for a demo started before the start log existed (no seed counts to subtract). */
  wordsAdded: number | null;
  tagsAdded: number | null;
  configsAdded: number | null;
  translationsPractised: number | null;
  /** The configured maximums for this demo (frozen limit − seed); NULL like the counts. */
  maxWords: number | null;
  maxTags: number | null;
}

/** The demo accounts on the DB now (live, and expired ones the purge has not deleted yet), newest first. */
export const listDemoUsers = async (now: Date = new Date()): Promise<{ total: number; rows: DemoUserRow[] }> => {
  const onDb = and(eq(users.isDemo, true), isNotNull(users.demoExpiresAt));
  const [{ value: total }] = await db.select({ value: count() }).from(users).where(onDb);

  const found = await db
    .select({
      id: users.id,
      createdAt: users.createdAt,
      expiresAt: users.demoExpiresAt,
      languages: users.languages,
      uiLanguage: users.uiLanguage,
      startedAt: demoStarts.startedAt,
      seedWords: demoStarts.seedWords,
      seedTags: demoStarts.seedTags,
      seedConfigs: demoStarts.seedConfigs,
      wordLimit: demoStarts.wordLimit,
      tagLimit: demoStarts.tagLimit,
    })
    .from(users)
    .leftJoin(demoStarts, eq(demoStarts.userId, users.id))
    .where(onDb)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(DEMO_USERS_LIMIT);

  const activity = await demoActivity(db, found.map((r) => r.id));
  const rows = found.map((r): DemoUserRow => {
    const a = activity.get(r.id)!;
    const logged = r.seedWords !== null;
    return {
      id: r.id,
      status: (r.expiresAt as Date) > now ? "live" : "expired",
      startedAt: (r.startedAt ?? r.createdAt).toISOString(),
      expiresAt: (r.expiresAt as Date).toISOString(),
      languages: r.languages,
      uiLanguage: r.uiLanguage,
      wordsAdded: logged ? added(a.words, r.seedWords!) : null,
      tagsAdded: logged ? added(a.tags, r.seedTags!) : null,
      configsAdded: logged ? added(a.configs, r.seedConfigs!) : null,
      translationsPractised: logged ? a.translationsPractised : null,
      maxWords: logged ? r.wordLimit! - r.seedWords! : null,
      maxTags: logged ? r.tagLimit! - r.seedTags! : null,
    };
  });
  return { total: Number(total), rows };
};

// --- The admin banner ----------------------------------------------------------------------------

export interface DemoUsageStats {
  starts: { last24h: number; last7d: number; last30d: number; total: number };
  runningNow: number;
  windowDays: number;
  /** Over the demos of the window whose counts are known (closed, or still on the DB). */
  engagement: {
    demos: number;
    avgWordsAdded: number;
    avgTagsAdded: number;
    avgTranslationsPractised: number;
    addedAWord: number;
  };
  /** Demos of the window with a word (tag) cap above 0, and how many of them reached it. */
  caps: { wordCapDemos: number; reachedWordCap: number; tagCapDemos: number; reachedTagCap: number };
  refusalWindowDays: number;
  refusals: Record<CountedRefusal, number>;
  /** How many demos of the window picked each language, and their UI languages. Most first. */
  languages: { language: string; count: number }[];
  uiLanguages: { language: string; count: number }[];
}

const countSince = async (since: Date | null): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(demoStarts)
    .where(since ? gt(demoStarts.startedAt, since) : undefined);
  return Number(row?.value ?? 0);
};

const ranked = (counts: Map<string, number>) =>
  [...counts.entries()]
    .map(([language, value]) => ({ language, count: value }))
    .sort((a, b) => b.count - a.count || a.language.localeCompare(b.language));

const average = (total: number, n: number) => (n > 0 ? Math.round((total / n) * 10) / 10 : 0);

export const demoUsageStats = async (now: Date = new Date()): Promise<DemoUsageStats> => {
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const [last24h, last7d, last30d, total, runningNow] = await Promise.all([
    countSince(ago(DAY_MS)),
    countSince(ago(7 * DAY_MS)),
    countSince(ago(30 * DAY_MS)),
    countSince(null),
    countLiveDemos(),
  ]);

  // The window's starts. Few in practice (the live cap and the per-IP limit bound them), so the
  // sums are made here, where closed rows and demos still on the DB are easy to combine.
  const windowRows = await db
    .select({
      userId: demoStarts.userId,
      languages: demoStarts.languages,
      uiLanguage: demoStarts.uiLanguage,
      seedWords: demoStarts.seedWords,
      seedTags: demoStarts.seedTags,
      wordLimit: demoStarts.wordLimit,
      tagLimit: demoStarts.tagLimit,
      wordsAdded: demoStarts.wordsAdded,
      tagsAdded: demoStarts.tagsAdded,
      translationsPractised: demoStarts.translationsPractised,
      closedAt: demoStarts.closedAt,
    })
    .from(demoStarts)
    .where(gt(demoStarts.startedAt, ago(DEMO_STATS_WINDOW_DAYS * DAY_MS)));

  const openIds = windowRows.filter((r) => r.closedAt === null && r.userId !== null).map((r) => r.userId as string);
  const activity = await demoActivity(db, openIds);

  const engagement = { demos: 0, words: 0, tags: 0, practised: 0, addedAWord: 0 };
  const caps = { wordCapDemos: 0, reachedWordCap: 0, tagCapDemos: 0, reachedTagCap: 0 };
  const languageCounts = new Map<string, number>();
  const uiCounts = new Map<string, number>();

  for (const row of windowRows) {
    for (const language of row.languages) languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
    uiCounts.set(row.uiLanguage, (uiCounts.get(row.uiLanguage) ?? 0) + 1);

    let counts: { words: number; tags: number; practised: number } | null = null;
    if (row.closedAt !== null) {
      counts = { words: row.wordsAdded ?? 0, tags: row.tagsAdded ?? 0, practised: row.translationsPractised ?? 0 };
    } else if (row.userId !== null && activity.has(row.userId)) {
      const a = activity.get(row.userId)!;
      counts = { words: added(a.words, row.seedWords), tags: added(a.tags, row.seedTags), practised: a.translationsPractised };
    }
    // A row with no counts: its user was deleted another way before the purge. It is left out.
    if (!counts) continue;

    engagement.demos += 1;
    engagement.words += counts.words;
    engagement.tags += counts.tags;
    engagement.practised += counts.practised;
    if (counts.words > 0) engagement.addedAWord += 1;

    const maxWords = row.wordLimit - row.seedWords;
    const maxTags = row.tagLimit - row.seedTags;
    if (maxWords > 0) {
      caps.wordCapDemos += 1;
      if (counts.words >= maxWords) caps.reachedWordCap += 1;
    }
    if (maxTags > 0) {
      caps.tagCapDemos += 1;
      if (counts.tags >= maxTags) caps.reachedTagCap += 1;
    }
  }

  const refusalSince = new Date(now.getTime() - (DEMO_REFUSAL_WINDOW_DAYS - 1) * DAY_MS).toISOString().slice(0, 10);
  const refusalRows = await db
    .select({ code: demoRefusals.code, value: sql<number>`sum(${demoRefusals.count})` })
    .from(demoRefusals)
    .where(gte(demoRefusals.day, refusalSince))
    .groupBy(demoRefusals.code);
  const refusals = Object.fromEntries(COUNTED_REFUSALS.map((code) => [code, 0])) as Record<CountedRefusal, number>;
  for (const row of refusalRows) if (isCountedRefusal(row.code)) refusals[row.code] = Number(row.value);

  return {
    starts: { last24h, last7d, last30d, total },
    runningNow,
    windowDays: DEMO_STATS_WINDOW_DAYS,
    engagement: {
      demos: engagement.demos,
      avgWordsAdded: average(engagement.words, engagement.demos),
      avgTagsAdded: average(engagement.tags, engagement.demos),
      avgTranslationsPractised: average(engagement.practised, engagement.demos),
      addedAWord: engagement.addedAWord,
    },
    caps,
    refusalWindowDays: DEMO_REFUSAL_WINDOW_DAYS,
    refusals,
    languages: ranked(languageCounts),
    uiLanguages: ranked(uiCounts),
  };
};
