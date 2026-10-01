/**
 * Hard-deleting accounts (admin-dashboard.md §3). Two callers share this:
 * "Purge now" in the admin API (a staff member), and the nightly job
 * `scripts/purge.js` (the system, `staffId` null).
 *
 * The user row's foreign keys cascade, so one DELETE removes the words, tags,
 * friendships, practice data, tokens, OAuth links and login history. Only
 * `words.original_creator_id` is set to NULL. The audit row is written first,
 * in the same transaction, and keeps the email and username: the user row is
 * gone afterwards, and `audit_log.target_id` has no foreign key on purpose.
 */
const { db }: typeof import('../src/db') = require('../src/db');
const { users, auditLog, loginEvents, userActivityDays }: typeof import('../src/db/schema') = require('../src/db/schema');
const { and, eq, isNotNull, lt }: typeof import('drizzle-orm') = require('drizzle-orm');

/** How long a soft-deleted account can still be restored. */
export const DELETE_GRACE_DAYS = 30;
/** How long `login_events` rows are kept. */
export const LOGIN_EVENT_RETENTION_DAYS = 90;
/** How long `user_activity_days` rows are kept (the admin statistics read 30 days; a year is room to grow). */
export const ACTIVITY_RETENTION_DAYS = 400;

const DAY_MS = 24 * 60 * 60 * 1000;

// The transaction object Drizzle passes to `db.transaction`.
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type PurgeTarget = { id: string; email: string; username: string; deletedAt: Date | null };

/** Writes the audit row, then deletes the user. Call inside a transaction. */
export const hardDeleteUser = async (
  tx: Tx,
  user: PurgeTarget,
  actor: { staffId: string | null; reason: string },
) => {
  await tx.insert(auditLog).values({
    staffId: actor.staffId,
    action: 'user.purge',
    targetType: 'user',
    targetId: user.id,
    reason: actor.reason,
    metadata: {
      email: user.email,
      username: user.username,
      deletedAt: user.deletedAt,
      ...(actor.staffId === null ? { actor: 'system' } : {}),
    },
  });
  await tx.delete(users).where(eq(users.id, user.id));
};

/**
 * The nightly job: purges accounts soft-deleted more than 30 days ago, and
 * deletes login history older than 90 days and activity days older than 400. One transaction per account, so
 * one failure does not undo the others. The cut-off is checked again inside the
 * transaction: an owner may restore an account between the read and the delete.
 */
export const runPurge = async (now: Date = new Date()) => {
  const accountCutoff = new Date(now.getTime() - DELETE_GRACE_DAYS * DAY_MS);
  const loginCutoff = new Date(now.getTime() - LOGIN_EVENT_RETENTION_DAYS * DAY_MS);
  // `day` is a 'YYYY-MM-DD' string, and ISO dates sort as text.
  const activityCutoff = new Date(now.getTime() - ACTIVITY_RETENTION_DAYS * DAY_MS).toISOString().slice(0, 10);

  const expired = await db
    .select({ id: users.id })
    .from(users)
    .where(and(isNotNull(users.deletedAt), lt(users.deletedAt, accountCutoff)));

  let purgedUsers = 0;
  for (const { id } of expired) {
    const purged = await db.transaction(async (tx) => {
      const [user] = await tx
        .select({ id: users.id, email: users.email, username: users.username, deletedAt: users.deletedAt })
        .from(users)
        .where(and(eq(users.id, id), isNotNull(users.deletedAt), lt(users.deletedAt, accountCutoff)))
        .for('update');
      if (!user) return false;
      await hardDeleteUser(tx, user, { staffId: null, reason: `Deleted more than ${DELETE_GRACE_DAYS} days ago` });
      return true;
    });
    if (purged) purgedUsers += 1;
  }

  const removed = await db
    .delete(loginEvents)
    .where(lt(loginEvents.createdAt, loginCutoff))
    .returning({ id: loginEvents.id });

  const removedDays = await db
    .delete(userActivityDays)
    .where(lt(userActivityDays.day, activityCutoff))
    .returning({ day: userActivityDays.day });

  return { purgedUsers, deletedLoginEvents: removed.length, deletedActivityDays: removedDays.length };
};
