/**
 * The access gates, owner side (access-gates.md, PR 1: registration and the invite
 * list). Every route needs `access.manage`. Each change runs in one transaction with
 * its audit row. The settings row is locked while it changes, so two owners acting at
 * once cannot both write a wrong "from" mode into the log.
 */
const asyncHandler = require('express-async-handler');
const { db }: typeof import('../../src/db') = require('../../src/db');
const { accessSettings, registrationInvites, staffAccounts, users, auditLog }: typeof import('../../src/db/schema') =
  require('../../src/db/schema');
const { desc, eq, inArray, sql }: typeof import('drizzle-orm') = require('drizzle-orm');
const { HttpError }: typeof import('../../lib/httpError') = require('../../lib/httpError');
const { readReason, withStatus }: typeof import('../../lib/adminRequest') = require('../../lib/adminRequest');
const { getAccessSettings, normalizeInviteEmail }: typeof import('../../lib/accessGate') = require('../../lib/accessGate');
const { isUuid }: typeof import('../userController') = require('../userController');
import type { AccessMode } from '../../lib/accessGate';

const MODES: readonly AccessMode[] = ['open', 'closed', 'limited'];
const MAX_NOTE_LENGTH = 300;
const MAX_EMAILS_PER_REQUEST = 500;
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

  return {
    registration: { mode: settings.registrationMode, note: settings.registrationNote },
    // Shown read only until the login gate exists (PR 2).
    login: { mode: settings.loginMode, note: settings.loginNote },
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.staffName ?? null,
    // `addedBy` is null when the staff account that added it was removed.
    invites,
    counts: { invites: invites.length },
  };
};

/** `GET /api/admin/access` */
const getAccess = asyncHandler(async (_req: any, res: any) => {
  res.json(await loadAccess());
});

/** `PUT /api/admin/access/registration` — `{ mode, note?, reason? }` */
const setRegistration = asyncHandler(async (req: any, res: any) => {
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

      const finalNote = newNote ?? current.registrationNote;
      const modeChanged = current.registrationMode !== mode;
      const noteChanged = current.registrationNote !== finalNote;
      if (!modeChanged && !noteChanged) return; // nothing to write, nothing to log

      await tx
        .update(accessSettings)
        .set({ registrationMode: mode, registrationNote: finalNote, updatedAt: new Date(), updatedByStaffId: req.staff.id })
        .where(eq(accessSettings.id, 1));
      await tx.insert(auditLog).values({
        staffId: req.staff.id,
        action: 'access.registration_mode',
        targetType: 'access',
        targetId: 'registration',
        reason: reason || null,
        metadata: { from: current.registrationMode, to: mode, noteChanged },
      });
    });
  });

  res.json(await loadAccess());
});

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

export = { getAccess, setRegistration, addInvites, removeInvite };
