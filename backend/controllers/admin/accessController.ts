/**
 * The access gates, owner side (access-gates.md): the registration gate and its invite
 * list (PR 1), the login gate, the allowed accounts and the "sign everyone out" button
 * (PR 2). Every route needs `access.manage`. Each change runs in one transaction with
 * its audit row. The settings row is locked while it changes, so two owners acting at
 * once cannot both write a wrong "from" mode into the log.
 */
const asyncHandler = require('express-async-handler');
const { db }: typeof import('../../src/db') = require('../../src/db');
const { accessSettings, registrationInvites, loginAllowedUsers, staffAccounts, users, auditLog }: typeof import('../../src/db/schema') =
  require('../../src/db/schema');
const { and, desc, eq, inArray, sql }: typeof import('drizzle-orm') = require('drizzle-orm');
const { HttpError }: typeof import('../../lib/httpError') = require('../../lib/httpError');
const { readReason, withStatus }: typeof import('../../lib/adminRequest') = require('../../lib/adminRequest');
const { getAccessSettings, normalizeInviteEmail }: typeof import('../../lib/accessGate') = require('../../lib/accessGate');
const { isUuid }: typeof import('../userController') = require('../userController');
import type { AccessMode } from '../../lib/accessGate';

const MODES: readonly AccessMode[] = ['open', 'closed', 'limited'];
const MAX_NOTE_LENGTH = 300;
const MAX_EMAILS_PER_REQUEST = 500;
const MAX_ACCOUNTS_PER_REQUEST = 500;
/** The owner must type this to sign every learner out. The server checks it too. */
const SIGN_OUT_PHRASE = 'SIGN OUT EVERYONE';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isMode = (value: unknown): value is AccessMode => MODES.includes(value as AccessMode);

const loadAccess = async () => {
  const settings = await getAccessSettings();
  const [row] = await db
    .select({ updatedAt: accessSettings.updatedAt, staffName: staffAccounts.name })
    .from(accessSettings)
    .leftJoin(staffAccounts, eq(staffAccounts.id, accessSettings.updatedByStaffId))
    .where(eq(accessSettings.id, 1));

  const invites = await db
    .select({
      id: registrationInvites.id,
      email: registrationInvites.email,
      createdAt: registrationInvites.createdAt,
      addedBy: staffAccounts.name,
    })
    .from(registrationInvites)
    .leftJoin(staffAccounts, eq(staffAccounts.id, registrationInvites.createdByStaffId))
    .orderBy(desc(registrationInvites.createdAt), desc(registrationInvites.id));

  // Accounts that may sign in while login is limited. `status` follows the users list.
  const loginAllowed = (
    await db
      .select({
        userId: loginAllowedUsers.userId,
        name: users.name,
        email: users.email,
        bannedAt: users.bannedAt,
        deletedAt: users.deletedAt,
        addedAt: loginAllowedUsers.addedAt,
        addedBy: staffAccounts.name,
      })
      .from(loginAllowedUsers)
      .innerJoin(users, eq(users.id, loginAllowedUsers.userId))
      .leftJoin(staffAccounts, eq(staffAccounts.id, loginAllowedUsers.addedByStaffId))
      .orderBy(desc(loginAllowedUsers.addedAt), desc(loginAllowedUsers.userId))
  ).map(({ bannedAt, deletedAt, ...rest }) => ({
    ...rest,
    status: deletedAt ? ('deleted' as const) : bannedAt ? ('banned' as const) : ('active' as const),
  }));

  return {
    registration: { mode: settings.registrationMode, note: settings.registrationNote },
    login: { mode: settings.loginMode, note: settings.loginNote },
    // One row of settings holds both gates, so this is the last change to either one.
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.staffName ?? null,
    // `addedBy` is null when the staff account that added it was removed.
    invites,
    loginAllowed,
    counts: { invites: invites.length, loginAllowed: loginAllowed.length },
  };
};

/** `GET /api/admin/access` */
const getAccess = asyncHandler(async (_req: any, res: any) => {
  res.json(await loadAccess());
});

const GATES = {
  registration: { modeColumn: 'registrationMode', noteColumn: 'registrationNote', action: 'access.registration_mode', targetId: 'registration' },
  login: { modeColumn: 'loginMode', noteColumn: 'loginNote', action: 'access.login_mode', targetId: 'login' },
} as const;

/** `PUT /api/admin/access/registration` and `PUT /api/admin/access/login` — `{ mode, note?, reason? }` */
const setGate = (gate: keyof typeof GATES) => {
  const { modeColumn, noteColumn, action, targetId } = GATES[gate];

  return asyncHandler(async (req: any, res: any) => {
    await withStatus(res, async () => {
      const { mode, note } = req.body ?? {};
      const reason = readReason(req.body);
      if (!isMode(mode)) throw new HttpError(400, 'Mode must be open, closed or limited');
      if (note !== undefined && typeof note !== 'string') throw new HttpError(400, 'The extra line must be text');
      const newNote = note === undefined ? undefined : note.trim();
      if (newNote !== undefined && newNote.length > MAX_NOTE_LENGTH) {
        throw new HttpError(400, `The extra line must be at most ${MAX_NOTE_LENGTH} characters`);
      }

      await db.transaction(async (tx) => {
        const [current] = await tx.select().from(accessSettings).where(eq(accessSettings.id, 1)).for('update');
        if (!current) throw new HttpError(500, 'The access settings row is missing');

        const currentMode = current[modeColumn];
        const finalNote = newNote ?? current[noteColumn];
        const modeChanged = currentMode !== mode;
        const noteChanged = current[noteColumn] !== finalNote;
        if (!modeChanged && !noteChanged) return; // nothing to write, nothing to log

        await tx
          .update(accessSettings)
          .set({ [modeColumn]: mode, [noteColumn]: finalNote, updatedAt: new Date(), updatedByStaffId: req.staff.id })
          .where(eq(accessSettings.id, 1));
        await tx.insert(auditLog).values({
          staffId: req.staff.id,
          action,
          targetType: 'access',
          targetId,
          reason: reason || null,
          metadata: { from: currentMode, to: mode, noteChanged },
        });
      });
    });

    res.json(await loadAccess());
  });
};

const setRegistration = setGate('registration');
const setLogin = setGate('login');

type SkipReason = 'invalid' | 'duplicate_in_request' | 'already_listed' | 'has_account';

/** `POST /api/admin/access/invites` — `{ emails: string[], reason? }`. Bulk; reports what was added and skipped. */
const addInvites = asyncHandler(async (req: any, res: any) => {
  const result = await withStatus(res, async () => {
    const reason = readReason(req.body);
    const raw = req.body?.emails;
    if (!Array.isArray(raw) || raw.some((e) => typeof e !== 'string')) throw new HttpError(400, 'Emails must be a list of text');
    if (raw.length === 0) throw new HttpError(400, 'Add at least one email');
    if (raw.length > MAX_EMAILS_PER_REQUEST) {
      throw new HttpError(400, `At most ${MAX_EMAILS_PER_REQUEST} emails at once`);
    }

    const skipped: { email: string; reason: SkipReason }[] = [];
    const candidates: string[] = [];
    const seen = new Set<string>();
    for (const entry of raw as string[]) {
      const email = normalizeInviteEmail(entry);
      if (!email) continue; // a blank line is not an error
      if (email.length > 255 || !EMAIL_PATTERN.test(email)) skipped.push({ email: entry.trim().slice(0, 255), reason: 'invalid' });
      else if (seen.has(email)) skipped.push({ email, reason: 'duplicate_in_request' });
      else {
        seen.add(email);
        candidates.push(email);
      }
    }

    const added = await db.transaction(async (tx) => {
      if (candidates.length === 0) return [] as string[];

      // An email that already has an account cannot register, so an invite would never be used.
      const accounts = await tx
        .select({ email: sql<string>`lower(${users.email})` })
        .from(users)
        .where(inArray(sql`lower(${users.email})`, candidates));
      const hasAccount = new Set(accounts.map((a) => a.email));
      const fresh = candidates.filter((email) => {
        if (hasAccount.has(email)) skipped.push({ email, reason: 'has_account' });
        return !hasAccount.has(email);
      });
      if (fresh.length === 0) return [] as string[];

      // The unique index decides a race; what it refuses was already listed.
      const inserted = await tx
        .insert(registrationInvites)
        .values(fresh.map((email) => ({ email, createdByStaffId: req.staff.id })))
        .onConflictDoNothing()
        .returning({ email: registrationInvites.email });
      const insertedSet = new Set(inserted.map((r) => r.email));
      for (const email of fresh) if (!insertedSet.has(email)) skipped.push({ email, reason: 'already_listed' });

      if (inserted.length > 0) {
        await tx.insert(auditLog).values({
          staffId: req.staff.id,
          action: 'access.invite_add',
          targetType: 'access',
          targetId: 'registration',
          reason: reason || null,
          metadata: { count: inserted.length, emails: inserted.map((r) => r.email) },
        });
      }
      return inserted.map((r) => r.email);
    });

    return { added, skipped };
  });

  res.status(result.added.length > 0 ? 201 : 200).json({ ...result, ...(await loadAccess()) });
});

/** `DELETE /api/admin/access/invites/:id` */
const removeInvite = asyncHandler(async (req: any, res: any) => {
  await withStatus(res, async () => {
    const { id } = req.params;
    if (!isUuid(id)) throw new HttpError(404, 'Invite not found');
    const reason = readReason(req.body);

    await db.transaction(async (tx) => {
      const [removed] = await tx.delete(registrationInvites).where(eq(registrationInvites.id, id)).returning();
      if (!removed) throw new HttpError(404, 'Invite not found');
      await tx.insert(auditLog).values({
        staffId: req.staff.id,
        action: 'access.invite_remove',
        targetType: 'access',
        targetId: 'registration',
        reason: reason || null,
        metadata: { email: removed.email },
      });
    });
  });

  res.json(await loadAccess());
});

type AllowSkipReason = 'invalid' | 'duplicate_in_request' | 'unknown' | 'deleted' | 'already_allowed';

/** A list of text from the body, or `undefined` if the key is absent. Anything else is a 400. */
const readTextList = (body: unknown, key: string): string[] | undefined => {
  const raw = (body as Record<string, unknown> | undefined)?.[key];
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.some((e) => typeof e !== 'string')) throw new HttpError(400, `${key} must be a list of text`);
  return raw as string[];
};

/**
 * `POST /api/admin/access/login-allowed` — `{ userIds?: string[], emails?: string[], reason? }`.
 * Bulk. Looks each account up (an email is matched without regard to case), refuses an unknown or
 * deleted account, and reports what was added and skipped. One audit row for each account added,
 * about that user, so it also shows in the history on the user's page.
 */
const allowLogin = asyncHandler(async (req: any, res: any) => {
  const result = await withStatus(res, async () => {
    const reason = readReason(req.body);
    const ids = readTextList(req.body, 'userIds') ?? [];
    const emails = readTextList(req.body, 'emails') ?? [];
    if (ids.length + emails.length === 0) throw new HttpError(400, 'Add at least one account');
    if (ids.length + emails.length > MAX_ACCOUNTS_PER_REQUEST) {
      throw new HttpError(400, `At most ${MAX_ACCOUNTS_PER_REQUEST} accounts at once`);
    }

    const skipped: { value: string; reason: AllowSkipReason }[] = [];
    const validIds: string[] = [];
    const validEmails: string[] = [];
    for (const entry of ids) {
      const id = entry.trim().toLowerCase();
      if (!id) continue;
      if (isUuid(id)) validIds.push(id);
      else skipped.push({ value: entry.trim().slice(0, 255), reason: 'invalid' });
    }
    for (const entry of emails) {
      const email = normalizeInviteEmail(entry);
      if (!email) continue; // a blank line is not an error
      if (email.length > 255 || !EMAIL_PATTERN.test(email)) skipped.push({ value: entry.trim().slice(0, 255), reason: 'invalid' });
      else validEmails.push(email);
    }

    const added = await db.transaction(async (tx) => {
      const found = new Map<string, { id: string; email: string; deleted: boolean }>();
      const byId = validIds.length
        ? await tx.select({ id: users.id, email: users.email, deletedAt: users.deletedAt }).from(users).where(inArray(users.id, validIds))
        : [];
      const byEmail = validEmails.length
        ? await tx
            .select({ id: users.id, email: users.email, deletedAt: users.deletedAt })
            .from(users)
            .where(inArray(sql`lower(${users.email})`, validEmails))
        : [];
      for (const u of [...byId, ...byEmail]) found.set(u.id, { id: u.id, email: u.email, deleted: u.deletedAt !== null });
      const idByEmail = new Map(byEmail.map((u) => [u.email.toLowerCase(), u.id]));

      // Walk the input in order, so each account is counted once and each refusal names what the owner typed.
      const taken = new Set<string>();
      const toAdd: { id: string; email: string }[] = [];
      const consider = (value: string, userId: string | undefined) => {
        const account = userId ? found.get(userId) : undefined;
        if (!account) skipped.push({ value, reason: 'unknown' });
        else if (taken.has(account.id)) skipped.push({ value, reason: 'duplicate_in_request' });
        else if (account.deleted) {
          taken.add(account.id);
          skipped.push({ value, reason: 'deleted' });
        } else {
          taken.add(account.id);
          toAdd.push({ id: account.id, email: account.email });
        }
      };
      for (const id of validIds) consider(id, id);
      for (const email of validEmails) consider(email, idByEmail.get(email));

      if (toAdd.length === 0) return [] as { id: string; email: string }[];

      // The primary key decides a race; what it refuses was already on the list.
      const inserted = await tx
        .insert(loginAllowedUsers)
        .values(toAdd.map((u) => ({ userId: u.id, addedByStaffId: req.staff.id })))
        .onConflictDoNothing()
        .returning({ userId: loginAllowedUsers.userId });
      const insertedIds = new Set(inserted.map((r) => r.userId));
      for (const u of toAdd) if (!insertedIds.has(u.id)) skipped.push({ value: u.email, reason: 'already_allowed' });

      const newlyAdded = toAdd.filter((u) => insertedIds.has(u.id));
      if (newlyAdded.length > 0) {
        await tx.insert(auditLog).values(
          newlyAdded.map((u) => ({
            staffId: req.staff.id,
            action: 'access.login_allow',
            targetType: 'user',
            targetId: u.id,
            reason: reason || null,
            // Enough to identify the account even if it is purged later.
            metadata: { email: u.email },
          })),
        );
      }
      return newlyAdded;
    });

    return { added: added.map((u) => ({ userId: u.id, email: u.email })), skipped };
  });

  res.status(result.added.length > 0 ? 201 : 200).json({ ...result, ...(await loadAccess()) });
});

/** Takes accounts off the allowed list, one audit row for each, in one transaction. Returns the ids removed. */
const takeOffList = async (staffId: string, userIds: string[], reason: string): Promise<string[]> =>
  db.transaction(async (tx) => {
    const removed = await tx
      .delete(loginAllowedUsers)
      .where(inArray(loginAllowedUsers.userId, userIds))
      .returning({ userId: loginAllowedUsers.userId });
    if (removed.length === 0) return [];

    const emails = await tx.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, removed.map((r) => r.userId)));
    const emailOf = new Map(emails.map((u) => [u.id, u.email]));
    await tx.insert(auditLog).values(
      removed.map((r) => ({
        staffId,
        action: 'access.login_disallow',
        targetType: 'user',
        targetId: r.userId,
        reason: reason || null,
        metadata: { email: emailOf.get(r.userId) ?? null },
      })),
    );
    return removed.map((r) => r.userId);
  });

/** `POST /api/admin/access/login-allowed/remove` — `{ userIds: string[], reason? }`. Bulk; an id that is not on the list is skipped. */
const disallowLoginMany = asyncHandler(async (req: any, res: any) => {
  const result = await withStatus(res, async () => {
    const reason = readReason(req.body);
    const ids = readTextList(req.body, 'userIds') ?? [];
    if (ids.length === 0) throw new HttpError(400, 'Choose at least one account');
    if (ids.length > MAX_ACCOUNTS_PER_REQUEST) throw new HttpError(400, `At most ${MAX_ACCOUNTS_PER_REQUEST} accounts at once`);

    const valid = [...new Set(ids.map((id) => id.trim().toLowerCase()).filter(isUuid))];
    const removed = valid.length ? await takeOffList(req.staff.id, valid, reason) : [];
    return { removed: removed.length, skipped: ids.length - removed.length };
  });

  res.json({ ...result, ...(await loadAccess()) });
});

/** `DELETE /api/admin/access/login-allowed/:userId` */
const disallowLogin = asyncHandler(async (req: any, res: any) => {
  await withStatus(res, async () => {
    const { userId } = req.params;
    if (!isUuid(userId)) throw new HttpError(404, 'This account is not on the allowed list');
    const reason = readReason(req.body);
    const removed = await takeOffList(req.staff.id, [userId], reason);
    if (removed.length === 0) throw new HttpError(404, 'This account is not on the allowed list');
  });

  res.json(await loadAccess());
});

/**
 * `POST /api/admin/access/sign-out-everyone` — `{ confirm: "SIGN OUT EVERYONE", reason }`.
 *
 * One statement raises `users.token_version` for every account. `protect` compares the `tv` in
 * a learner's token with that column on every request, so every learner token stops working at
 * the next request and the app goes back to the login page. Nothing new runs on each request.
 * Staff tokens are separate (`staff_accounts.token_version`) and are not touched, so the owner
 * stays signed in. With login limited, only allowed accounts can then sign back in.
 */
const signOutEveryone = asyncHandler(async (req: any, res: any) => {
  const signedOut = await withStatus(res, async () => {
    const reason = readReason(req.body, true);
    if (req.body?.confirm !== SIGN_OUT_PHRASE) throw new HttpError(400, `Type ${SIGN_OUT_PHRASE} to confirm`);

    return db.transaction(async (tx) => {
      const result = await tx.execute(sql`UPDATE users SET token_version = token_version + 1`);
      const count = result.rowCount ?? 0;
      await tx.insert(auditLog).values({
        staffId: req.staff.id,
        action: 'access.sign_out_everyone',
        targetType: 'access',
        targetId: 'sessions',
        reason,
        metadata: { count },
      });
      return count;
    });
  });

  res.json({ signedOut });
});

export = {
  getAccess,
  setRegistration,
  setLogin,
  addInvites,
  removeInvite,
  allowLogin,
  disallowLoginMany,
  disallowLogin,
  signOutEveryone,
};
