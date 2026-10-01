/**
 * `GET /api/admin/health` (admin-dashboard.md §3, slice 6): what a support
 * person would otherwise SSH in to find out. Each environment's admin shows its
 * own backend: the `ENVIRONMENT` and `GIT_SHA` values come from its container.
 *
 * A dead database does not make this a 5xx. The page needs to show "database:
 * error", not an error screen, so the service block still answers, and the
 * database and backup blocks are null.
 */
const asyncHandler = require('express-async-handler');
const { db, pool }: typeof import('../../src/db') = require('../../src/db');
const {
  users,
  words,
  translations,
  tags,
  practiceSessions,
  loginEvents,
  auditLog,
  opsEvents,
}: typeof import('../../src/db/schema') = require('../../src/db/schema');
const { desc, eq, sql }: typeof import('drizzle-orm') = require('drizzle-orm');
// The folder Drizzle applies migrations from: its journal maps each applied
// migration's timestamp back to a readable name like `0013_ops_events`.
const journal: { entries: { tag: string; when: number }[] } = require('../../src/db/migrations/meta/_journal.json');

// The tables worth a row count on the page. Exact counts: these tables are small.
const COUNTED_TABLES = {
  users,
  words,
  translations,
  tags,
  practiceSessions,
  loginEvents,
  auditLog,
} as const;

const count = sql<number>`count(*)::int`;

const latestEvent = async (kind: 'backup' | 'restore_test') => {
  const [row] = await db
    .select({ ok: opsEvents.ok, detail: opsEvents.detail, at: opsEvents.createdAt })
    .from(opsEvents)
    .where(eq(opsEvents.kind, kind))
    .orderBy(desc(opsEvents.createdAt))
    .limit(1);
  return row ?? null;
};

const loadDatabaseSection = async () => {
  const counts = await Promise.all(
    Object.entries(COUNTED_TABLES).map(async ([name, table]) => {
      const [row] = await db.select({ n: count }).from(table);
      return [name, row.n] as const;
    }),
  );

  const [{ size }] = (await pool.query('SELECT pg_database_size(current_database())::bigint AS size')).rows;

  // Drizzle records each applied migration with the journal's `when` value.
  const applied = (await pool.query('SELECT created_at FROM drizzle.__drizzle_migrations')).rows as { created_at: string }[];
  const newest = applied.reduce((max, row) => Math.max(max, Number(row.created_at)), 0);

  return {
    sizeBytes: Number(size),
    migration: {
      // `null` when the newest applied migration is not in this build's journal (a rollback, or a newer release).
      latest: journal.entries.find((entry) => entry.when === newest)?.tag ?? null,
      appliedCount: applied.length,
    },
    tables: Object.fromEntries(counts),
  };
};

const getHealth = asyncHandler(async (_req: any, res: any) => {
  const checkedAt = new Date();
  let databaseOk = true;
  try {
    await pool.query('SELECT 1');
  } catch {
    databaseOk = false;
  }

  const service = {
    database: databaseOk ? 'ok' : 'error',
    environment: process.env.ENVIRONMENT ?? 'local',
    sha: process.env.GIT_SHA ?? 'unknown',
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    checkedAt,
  };

  if (!databaseOk) {
    res.json({ service, database: null, backups: null });
    return;
  }

  const [database, lastBackup, lastRestoreTest] = await Promise.all([
    loadDatabaseSection(),
    latestEvent('backup'),
    latestEvent('restore_test'),
  ]);

  res.json({ service, database, backups: { lastBackup, lastRestoreTest } });
});

export = { getHealth };
