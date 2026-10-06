/**
 * Read-only user endpoints for the admin dashboard (admin-dashboard.md §3,
 * slice 4). Every field is listed on purpose: a raw `users` row carries the
 * bcrypt hash, so nothing here spreads a row into a response.
 */
const asyncHandler = require('express-async-handler');
const { db }: typeof import('../../src/db') = require('../../src/db');
const {
  users,
  words,
  translations,
  tags,
  friendships,
  practiceSessions,
  oauthIdentities,
  loginAllowedUsers,
  loginEvents,
  auditLog,
  staffAccounts,
  userBadges,
}: typeof import('../../src/db/schema') = require('../../src/db/schema');
const { and, asc, desc, eq, gt, ilike, isNotNull, isNull, or, sql }: typeof import('drizzle-orm') =
  require('drizzle-orm');
const { hasPermission }: typeof import('../../lib/adminPermissions') = require('../../lib/adminPermissions');
const { isUuid }: typeof import('../userController') = require('../userController');
const { hardDeleteUser }: typeof import('../../lib/userPurge') = require('../../lib/userPurge');
import type { Tx } from '../../lib/userPurge';
const { issueVerificationEmail, issuePasswordResetEmail }: typeof import('../../lib/accountEmails') = require('../../lib/accountEmails');
import type { SendEmail } from '../../lib/accountEmails';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const RECENT_LOGINS = 20;
const AUDIT_ENTRIES = 20;

type AccessFields = { bannedAt: Date | null; deletedAt: Date | null };

// A deleted account wins over a banned one, the same order as `accountBlock`.
const statusOf = (user: AccessFields): 'deleted' | 'banned' | 'active' =>
  user.deletedAt ? 'deleted' : user.bannedAt ? 'banned' : 'active';

const SORT_COLUMNS = {
  createdAt: users.createdAt,
  lastLoginAt: users.lastLoginAt,
  lastSeenAt: users.lastSeenAt,
  name: users.name,
  email: users.email,
} as const;
type SortKey = keyof typeof SORT_COLUMNS;

const isSortKey = (value: string): value is SortKey => Object.prototype.hasOwnProperty.call(SORT_COLUMNS, value);

/** A search term is literal text: `%`, `_` and `\` must not act as wildcards. */
const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// One test for two uses: the list's `hasGoogle` flag and the `method=google` filter.
// The outer column is written out (`"users"."id"`) on purpose: in a SELECT list
// Drizzle drops the table name from `${users.id}`, and inside this subquery the
// bare `"id"` would then match `oauth_identities.id`.
const hasGoogle = sql<boolean>`exists (select 1 from ${oauthIdentities} where ${oauthIdentities.userId} = "users"."id")`;

// Is this account on the login allowed list (access-gates.md)? Written out like `hasGoogle`, for the same reason.
const isLoginAllowed = sql<boolean>`exists (select 1 from ${loginAllowedUsers} where ${loginAllowedUsers.userId} = "users"."id")`;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

const single = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** `GET /api/admin/users` */
const listUsers = asyncHandler(async (req: any, res: any) => {
  const q = req.query;

  const page = q.page === undefined ? 1 : Number(single(q.page));
  const pageSize = q.pageSize === undefined ? DEFAULT_PAGE_SIZE : Number(single(q.pageSize));
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    res.status(400);
    throw new Error(`page must be 1 or more, and pageSize between 1 and ${MAX_PAGE_SIZE}`);
  }

  const sortRaw = single(q.sort) ?? 'createdAt';
  const orderRaw = single(q.order) ?? 'desc';
  if (!isSortKey(sortRaw) || (orderRaw !== 'asc' && orderRaw !== 'desc')) {
    res.status(400);
    throw new Error('Invalid sort or order');
  }

  const verified = oneOf(q.verified, ['true', 'false'] as const);
  const status = oneOf(q.status, ['active', 'banned', 'deleted'] as const);
  const method = oneOf(q.method, ['password', 'google'] as const);
  const loginAllowed = oneOf(q.loginAllowed, ['true', 'false'] as const);
  for (const [name, raw, ok] of [
    ['verified', q.verified, verified],
    ['status', q.status, status],
    ['method', q.method, method],
    ['loginAllowed', q.loginAllowed, loginAllowed],
  ] as const) {
    if (raw !== undefined && raw !== '' && ok === undefined) {
      res.status(400);
      throw new Error(`Invalid ${name}`);
    }
  }

  // Who may sign in is access configuration, so only a person with `access.manage` sees it or filters by it.
  // A filter would reveal it too, so it is refused, not ignored.
  const canManageAccess = hasPermission(req.staff.role, 'access.manage');
  if (loginAllowed !== undefined && !canManageAccess) {
    res.status(403);
    throw new Error('Forbidden');
  }

  const term = single(q.search)?.trim();
  const conditions = [
    term ? or(ilike(users.email, likePattern(term)), ilike(users.username, likePattern(term)), ilike(users.name, likePattern(term))) : undefined,
    // `users.verified` is nullable; NULL counts as not verified.
    verified === 'true' ? eq(users.verified, true) : undefined,
    verified === 'false' ? or(isNull(users.verified), eq(users.verified, false)) : undefined,
    status === 'active' ? and(isNull(users.bannedAt), isNull(users.deletedAt)) : undefined,
    status === 'banned' ? and(isNotNull(users.bannedAt), isNull(users.deletedAt)) : undefined,
    status === 'deleted' ? isNotNull(users.deletedAt) : undefined,
    method === 'password' ? isNotNull(users.password) : undefined,
    method === 'google' ? hasGoogle : undefined,
    loginAllowed === 'true' ? isLoginAllowed : undefined,
    loginAllowed === 'false' ? sql`not ${isLoginAllowed}` : undefined,
  ];
  const where = and(...conditions);

  const direction = orderRaw === 'asc' ? asc : desc;
  // Never-logged-in users (NULL dates) sort last in both directions; `id`
  // makes the order total, so pages do not repeat or skip rows.
  const orderBy = [sql`${SORT_COLUMNS[sortRaw]} ${sql.raw(orderRaw)} nulls last`, direction(users.id)];

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(users).where(where);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      username: users.username,
      verified: users.verified,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      lastLoginCountry: users.lastLoginCountry,
      lastSeenAt: users.lastSeenAt,
      bannedAt: users.bannedAt,
      deletedAt: users.deletedAt,
      hasPassword: sql<boolean>`${users.password} is not null`,
      hasGoogle,
      loginAllowed: isLoginAllowed,
    })
    .from(users)
    .where(where)
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  res.json({
    items: rows.map((row) => ({
      ...row,
      verified: row.verified === true,
      status: statusOf(row),
      // `null` tells the UI this role may not see it.
      loginAllowed: canManageAccess ? row.loginAllowed : null,
    })),
    total,
    page,
    pageSize,
  });
});

const countOf = async (query: Promise<{ n: number }[]>) => (await query)[0].n;

/** The user detail, or `undefined` if there is no such user. `role` decides whether the audit history is included. */
const loadUserDetail = async (id: string, role: string) => {
  if (!isUuid(id)) return undefined;

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) return undefined;

  const n = sql<number>`count(*)::int`;
  const canReadAudit = hasPermission(role, 'audit.read');

  const canManageAccess = hasPermission(role, 'access.manage');

  const [wordCount, translationCount, tagCount, friendCount, sessionCount, identities, recentLogins, deletedBy, audit, allowedRows, badgeRows] =
    await Promise.all([
      countOf(db.select({ n }).from(words).where(eq(words.userId, id))),
      countOf(
        db.select({ n }).from(translations).innerJoin(words, eq(translations.wordId, words.id)).where(eq(words.userId, id)),
      ),
      countOf(db.select({ n }).from(tags).where(eq(tags.authorId, id))),
      countOf(
        db
          .select({ n })
          .from(friendships)
          .where(and(eq(friendships.status, 'accepted'), or(eq(friendships.requesterId, id), eq(friendships.addresseeId, id)))),
      ),
      countOf(db.select({ n }).from(practiceSessions).where(eq(practiceSessions.userId, id))),
      db
        .select({ provider: oauthIdentities.provider, emailAtLink: oauthIdentities.emailAtLink, linkedAt: oauthIdentities.createdAt })
        .from(oauthIdentities)
        .where(eq(oauthIdentities.userId, id))
        .orderBy(asc(oauthIdentities.createdAt)),
      db
        .select({ id: loginEvents.id, method: loginEvents.method, country: loginEvents.country, createdAt: loginEvents.createdAt })
        .from(loginEvents)
        .where(eq(loginEvents.userId, id))
        .orderBy(desc(loginEvents.createdAt))
        .limit(RECENT_LOGINS),
      user.deletedByStaffId
        ? db.select({ name: staffAccounts.name }).from(staffAccounts).where(eq(staffAccounts.id, user.deletedByStaffId)).limit(1)
        : Promise.resolve([]),
      // `null` (not an empty list) tells the UI this role may not see the section.
      canReadAudit
        ? db
            .select({
              id: auditLog.id,
              action: auditLog.action,
              reason: auditLog.reason,
              metadata: auditLog.metadata,
              createdAt: auditLog.createdAt,
              staffName: staffAccounts.name,
            })
            .from(auditLog)
            // A row with no staff member was written by the system (the nightly purge).
            .leftJoin(staffAccounts, eq(auditLog.staffId, staffAccounts.id))
            .where(and(eq(auditLog.targetType, 'user'), eq(auditLog.targetId, id)))
            .orderBy(desc(auditLog.createdAt))
            .limit(AUDIT_ENTRIES)
        : Promise.resolve(null),
      canManageAccess
        ? db.select({ userId: loginAllowedUsers.userId }).from(loginAllowedUsers).where(eq(loginAllowedUsers.userId, id)).limit(1)
        : Promise.resolve(null),
      // Active badges only; the history is in the audit log. Read straight from the
      // table (not `activeBadgesByUserIds`): staff must still see the badge of a
      // banned account, to revoke it.
      db
        .select({ type: userBadges.type, grantedAt: userBadges.grantedAt, staffId: staffAccounts.id, staffName: staffAccounts.name })
        .from(userBadges)
        .innerJoin(staffAccounts, eq(staffAccounts.id, userBadges.grantedBy))
        .where(and(eq(userBadges.userId, id), isNull(userBadges.revokedAt)))
        .orderBy(asc(userBadges.grantedAt)),
    ]);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    languages: user.languages,
    uiLanguage: user.uiLanguage,
    nativeLanguage: user.nativeLanguage,
    theme: user.theme,
    verified: user.verified === true,
    status: statusOf(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
    lastLoginCountry: user.lastLoginCountry,
    lastSeenAt: user.lastSeenAt,
    bannedAt: user.bannedAt,
    banReason: user.banReason,
    deletedAt: user.deletedAt,
    deletedByStaffName: deletedBy[0]?.name ?? null,
    hasPassword: user.password !== null,
    // `null` tells the UI this role may not see it.
    loginAllowed: allowedRows ? allowedRows.length > 0 : null,
    badges: badgeRows.map((row) => ({
      type: row.type,
      grantedAt: row.grantedAt,
      grantedBy: { id: row.staffId, name: row.staffName },
    })),
    identities,
    counts: {
      words: wordCount,
      translations: translationCount,
      tags: tagCount,
      friends: friendCount,
      practiceSessions: sessionCount,
    },
    recentLogins,
    audit: audit && audit.map((entry) => ({ ...entry, staffName: entry.staffName ?? 'System' })),
  };
};

/** `GET /api/admin/users/:id` */
const getUser = asyncHandler(async (req: any, res: any) => {
  const detail = await loadUserDetail(req.params.id, req.staff.role);
  if (!detail) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json(detail);
});

// ---------------------------------------------------------------------------
// Actions (slice 5). Each one runs in a single transaction: lock the user row,
// check the state, change it, write the audit row. A failed check rolls back,
// so there is never an audit row for a change that did not happen.
// ---------------------------------------------------------------------------

const MAX_REASON_LENGTH = 500;
const EMAIL_COOLDOWN_MINUTES = 5;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type UserRow = typeof users.$inferSelect;

interface ActionContext {
  staffId: string;
  reason: string;
}

interface ActionSpec {
  /** Audit `action` value. */
  action: string;
  reasonRequired: boolean;
  /** The username must be typed again (delete and purge). */
  confirmUsername?: boolean;
  /** A message if the action is not possible in the user's current state, else null. */
  blockedBy: (user: UserRow) => string | null;
  /** Returns a function to run after the transaction commits (an email), if there is one. */
  apply: (tx: Tx, user: UserRow, ctx: ActionContext) => Promise<void | SendEmail>;
  /** The same action on the same user is refused for this many minutes after it was done (read from the audit log). */
  cooldownMinutes?: number;
  /** Extra audit metadata, next to the email and username every row has. */
  auditMetadata?: (user: UserRow) => Record<string, unknown>;
  /**
   * The action deletes the user. `apply` then writes the audit row itself (via
   * `hardDeleteUser`), and the response has no user detail.
   */
  removesUser?: boolean;
}

const ACTIONS = {
  ban: {
    action: 'user.ban',
    reasonRequired: true,
    blockedBy: (u) => (u.deletedAt ? 'This account is deleted' : u.bannedAt ? 'This account is already banned' : null),
    apply: async (tx, u, { reason }) => {
      await tx.update(users).set({ bannedAt: new Date(), banReason: reason, updatedAt: new Date() }).where(eq(users.id, u.id));
    },
  },
  unban: {
    action: 'user.unban',
    reasonRequired: false,
    blockedBy: (u) => (u.deletedAt ? 'Restore this account first' : !u.bannedAt ? 'This account is not banned' : null),
    apply: async (tx, u) => {
      await tx.update(users).set({ bannedAt: null, banReason: null, updatedAt: new Date() }).where(eq(users.id, u.id));
    },
  },
  'force-logout': {
    action: 'user.force_logout',
    reasonRequired: false,
    blockedBy: (u) => (u.deletedAt ? 'This account is deleted' : null),
    apply: async (tx, u) => {
      await tx.update(users).set({ tokenVersion: sql`${users.tokenVersion} + 1` }).where(eq(users.id, u.id));
    },
  },
  delete: {
    action: 'user.delete',
    reasonRequired: true,
    confirmUsername: true,
    blockedBy: (u) => (u.deletedAt ? 'This account is already deleted' : null),
    apply: async (tx, u, { staffId }) => {
      await tx.update(users).set({ deletedAt: new Date(), deletedByStaffId: staffId, updatedAt: new Date() }).where(eq(users.id, u.id));
    },
  },
  restore: {
    action: 'user.restore',
    reasonRequired: false,
    blockedBy: (u) => (!u.deletedAt ? 'This account is not deleted' : null),
    apply: async (tx, u) => {
      await tx.update(users).set({ deletedAt: null, deletedByStaffId: null, updatedAt: new Date() }).where(eq(users.id, u.id));
    },
  },
  // "Purge now" is offered only for an account that is already soft-deleted, so
  // a purge always follows a delete (two steps, two audit rows).
  purge: {
    action: 'user.purge',
    reasonRequired: true,
    confirmUsername: true,
    removesUser: true,
    blockedBy: (u) => (!u.deletedAt ? 'Delete this account first' : null),
    apply: async (tx, u, { staffId, reason }) => {
      await hardDeleteUser(tx, u, { staffId, reason });
    },
  },
  // The two email actions. The token row is written in the transaction; the
  // email itself leaves only after the commit (`afterCommit`). Delivery is not
  // known, so the response never says "sent", and the audit row holds the
  // address and language but never the token or the link.
  'resend-verification': {
    action: 'user.resend_verification',
    reasonRequired: false,
    cooldownMinutes: EMAIL_COOLDOWN_MINUTES,
    auditMetadata: (u) => ({ language: u.uiLanguage }),
    blockedBy: (u) => (u.deletedAt ? 'This account is deleted' : u.verified === true ? 'This account is already verified' : null),
    apply: (tx, u) => issueVerificationEmail(u, tx),
  },
  'send-password-reset': {
    action: 'user.send_password_reset',
    reasonRequired: false,
    cooldownMinutes: EMAIL_COOLDOWN_MINUTES,
    auditMetadata: (u) => ({ language: u.uiLanguage }),
    blockedBy: (u) => (u.deletedAt ? 'This account is deleted' : u.password === null ? 'This account has no password' : null),
    apply: (tx, u) => issuePasswordResetEmail(u, tx),
  },
} satisfies Record<string, ActionSpec>;

type ActionName = keyof typeof ACTIONS;

const readReason = (body: unknown, required: boolean): string => {
  const raw = (body as { reason?: unknown } | undefined)?.reason;
  if (raw !== undefined && typeof raw !== 'string') throw new HttpError(400, 'Reason must be text');
  const reason = (raw ?? '').trim();
  if (required && !reason) throw new HttpError(400, 'A reason is required');
  if (reason.length > MAX_REASON_LENGTH) throw new HttpError(400, `Reason must be at most ${MAX_REASON_LENGTH} characters`);
  return reason;
};

/** Builds the handler for one action. The route decides the permission; this does the rest. */
const userAction = (name: ActionName) => {
  const spec: ActionSpec = ACTIONS[name];

  return asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    let afterCommit: SendEmail | undefined;
    try {
      if (!isUuid(id)) throw new HttpError(404, 'User not found');
      const reason = readReason(req.body, spec.reasonRequired);

      await db.transaction(async (tx) => {
        // Locks the row, so two staff members acting at once cannot both pass the state check.
        const [user] = await tx.select().from(users).where(eq(users.id, id)).for('update');
        if (!user) throw new HttpError(404, 'User not found');

        const blocked = spec.blockedBy(user);
        if (blocked) throw new HttpError(409, blocked);

        // The UI asks for the same; the server does not trust that.
        if (spec.confirmUsername && (req.body as { confirmUsername?: unknown })?.confirmUsername !== user.username) {
          throw new HttpError(400, 'The typed username does not match');
        }

        if (spec.cooldownMinutes) {
          // Runs after the row lock, so two parallel clicks cannot both pass.
          const since = new Date(Date.now() - spec.cooldownMinutes * 60_000);
          const [last] = await tx
            .select({ createdAt: auditLog.createdAt })
            .from(auditLog)
            .where(and(eq(auditLog.action, spec.action), eq(auditLog.targetId, user.id), gt(auditLog.createdAt, since)))
            .orderBy(desc(auditLog.createdAt))
            .limit(1);
          if (last) {
            const retryAt = new Date(last.createdAt.getTime() + spec.cooldownMinutes * 60_000);
            const minutes = Math.max(1, Math.ceil((retryAt.getTime() - Date.now()) / 60_000));
            throw new HttpError(429, `This email was sent a moment ago. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`);
          }
        }

        afterCommit = (await spec.apply(tx, user, { staffId: req.staff.id, reason })) as SendEmail | undefined;

        if (!spec.removesUser) {
          await tx.insert(auditLog).values({
            staffId: req.staff.id,
            action: spec.action,
            targetType: 'user',
            targetId: user.id,
            reason: reason || null,
            // Enough to identify the account even if it is purged later.
            metadata: { email: user.email, username: user.username, ...spec.auditMetadata?.(user) },
          });
        }
      });
    } catch (error) {
      if (error instanceof HttpError) res.status(error.status);
      throw error;
    }

    // Only now: the transaction is committed, so no email leaves for a rolled-back change.
    if (afterCommit) afterCommit();

    if (spec.removesUser) {
      res.json({ purged: true });
      return;
    }
    res.json(await loadUserDetail(id, req.staff.role));
  });
};

const banUser = userAction('ban');
const unbanUser = userAction('unban');
const forceLogoutUser = userAction('force-logout');
const deleteUser = userAction('delete');
const restoreUser = userAction('restore');
const purgeUser = userAction('purge');
const resendVerification = userAction('resend-verification');
const sendPasswordReset = userAction('send-password-reset');

export = { listUsers, getUser, loadUserDetail, banUser, unbanUser, forceLogoutUser, deleteUser, restoreUser, purgeUser, resendVerification, sendPasswordReset };
