/**
 * `GET /api/admin/stats` (admin-dashboard.md §3, slice 9): the numbers on the
 * admin overview page. Read only, and needs `users.read`.
 *
 * Every day and week is in UTC, and a week starts on Monday. Days and weeks
 * with nothing in them are filled with 0 here (`generate_series`), so the
 * charts have no holes and need no date logic of their own.
 *
 * The queries take no user input: the ranges are constants.
 */
const asyncHandler = require('express-async-handler');
const { db }: typeof import('../../src/db') = require('../../src/db');
const { words, translations, tags, practiceSessions, exercisePerformances }: typeof import('../../src/db/schema') =
  require('../../src/db/schema');
const { sql }: typeof import('drizzle-orm') = require('drizzle-orm');

const DAYS = 30;
const WEEKS = 12;

// The current UTC day. `timestamp` columns in this schema hold UTC wall-clock time.
const TODAY = sql`(now() at time zone 'utc')::date`;

const rowsOf = async <T>(query: ReturnType<typeof sql>): Promise<T[]> => (await db.execute(query)).rows as T[];

const dayMs = 24 * 60 * 60 * 1000;
const parseDay = (day: string) => Date.parse(`${day}T00:00:00Z`);

type ActivityRow = { day: string; daily: number; weekly: number; monthly: number };

/**
 * One chart point for a window of `windowDays` days ending on `day`. The
 * first tracked day is incomplete (people seen earlier that day, before the
 * table existed, have no row), so a window that includes it is `partial`, and
 * a day before tracking began has no count at all.
 */
const activityPoint = (row: ActivityRow, since: string | null) => {
  const point = (value: number, windowDays: number) => {
    if (since === null || row.day < since) return { count: null, partial: false };
    const windowStart = parseDay(row.day) - (windowDays - 1) * dayMs;
    return { count: value, partial: windowStart <= parseDay(since) };
  };
  const daily = point(row.daily, 1);
  const weekly = point(row.weekly, 7);
  const monthly = point(row.monthly, 30);
  return { day: row.day, daily, weekly, monthly };
};

const getStats = asyncHandler(async (_req: any, res: any) => {
  const [
    [accounts],
    [{ n: wordCount }],
    [{ n: translationCount }],
    [{ n: tagCount }],
    [{ n: savedSessions }],
    [{ n: practisedTranslations }],
    dailySignups,
    weeklySignups,
    activity,
    [{ since }],
    languages,
    [{ today }],
  ] = await Promise.all([
    rowsOf<{ users: number; verified: number; unverified: number; banned: number; pending_deletion: number }>(sql`
      select
        count(*) filter (where deleted_at is null)::int as users,
        count(*) filter (where deleted_at is null and verified is true)::int as verified,
        count(*) filter (where deleted_at is null and verified is not true)::int as unverified,
        count(*) filter (where deleted_at is null and banned_at is not null)::int as banned,
        count(*) filter (where deleted_at is not null)::int as pending_deletion
      from users`),
    rowsOf<{ n: number }>(sql`select count(*)::int as n from ${words}`),
    rowsOf<{ n: number }>(sql`select count(*)::int as n from ${translations}`),
    rowsOf<{ n: number }>(sql`select count(*)::int as n from ${tags}`),
    // A saved session that has expired is already gone for its owner, so it is not counted.
    rowsOf<{ n: number }>(sql`select count(*)::int as n from ${practiceSessions} where expires_at > now()`),
    rowsOf<{ n: number }>(sql`select count(*)::int as n from ${exercisePerformances}`),
    rowsOf<{ day: string; count: number }>(sql`
      select to_char(d::date, 'YYYY-MM-DD') as day, count(u.id)::int as count
      from generate_series(${TODAY} - ${DAYS - 1}::int, ${TODAY}, interval '1 day') as d
      left join users u on u.created_at::date = d::date
      group by d order by d`),
    rowsOf<{ week_start: string; count: number }>(sql`
      select to_char(w::date, 'YYYY-MM-DD') as week_start, count(u.id)::int as count
      from generate_series(
        date_trunc('week', ${TODAY})::date - ${(WEEKS - 1) * 7}::int,
        date_trunc('week', ${TODAY})::date,
        interval '7 days') as w
      left join users u on date_trunc('week', u.created_at)::date = w::date
      group by w order by w`),
    rowsOf<ActivityRow>(sql`
      select to_char(d::date, 'YYYY-MM-DD') as day,
        (select count(*) from user_activity_days a where a.day = d::date)::int as daily,
        (select count(distinct a.user_id) from user_activity_days a where a.day between d::date - 6 and d::date)::int as weekly,
        (select count(distinct a.user_id) from user_activity_days a where a.day between d::date - 29 and d::date)::int as monthly
      from generate_series(${TODAY} - ${DAYS - 1}::int, ${TODAY}, interval '1 day') as d
      order by d`),
    rowsOf<{ since: string | null }>(sql`select to_char(min(day), 'YYYY-MM-DD') as since from user_activity_days`),
    rowsOf<{ language: string; users: number }>(sql`
      select lang as language, count(*)::int as users
      from users, unnest(languages) as lang
      where deleted_at is null
      group by lang
      order by users desc, lang asc`),
    rowsOf<{ today: string }>(sql`select to_char(${TODAY}, 'YYYY-MM-DD') as today`),
  ]);

  res.json({
    generatedAt: new Date(),
    today,
    totals: {
      users: accounts.users,
      verified: accounts.verified,
      unverified: accounts.unverified,
      banned: accounts.banned,
      pendingDeletion: accounts.pending_deletion,
      words: wordCount,
      translations: translationCount,
      tags: tagCount,
      savedSessions,
      practisedTranslations,
    },
    signups: {
      daily: dailySignups,
      weekly: weeklySignups.map((row) => ({ weekStart: row.week_start, count: row.count })),
    },
    active: {
      // The first day with a row; `null` while nothing has been recorded yet.
      since,
      points: activity.map((row) => activityPoint(row, since)),
    },
    languages,
  });
});

export = { getStats };
