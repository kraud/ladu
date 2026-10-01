/**
 * Staff management for owners (admin-dashboard.md §2, slice 8): list, create,
 * change a role, disable, enable, reset a password. Every route needs
 * `staff.manage`, which only the owner role has, so "only an owner can create
 * or promote an owner" holds without a separate rule.
 *
 * Each change runs in one transaction with its audit row. No password is ever
 * written to the audit log or to a response.
 */
const asyncHandler = require('express-async-handler');
const { db }: typeof import('../../src/db') = require('../../src/db');
const { staffAccounts, auditLog }: typeof import('../../src/db/schema') = require('../../src/db/schema');
const { and, asc, eq, isNull, ne, sql }: typeof import('drizzle-orm') = require('drizzle-orm');
const { isRole }: typeof import('../../lib/adminPermissions') = require('../../lib/adminPermissions');
const { createStaff, validateStaffPassword, hashStaffPassword }: typeof import('../../lib/staffAccounts') =
  require('../../lib/staffAccounts');
const { isUuid }: typeof import('../userController') = require('../userController');
const { HttpError }: typeof import('../../lib/httpError') = require('../../lib/httpError');
import type { Tx } from '../../lib/userPurge';

const MAX_REASON_LENGTH = 500;

type StaffRow = typeof staffAccounts.$inferSelect;

/** What the UI may see. Never the password hash. */
const serialize = (row: StaffRow) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  status: row.disabledAt ? ('disabled' as const) : ('active' as const),
  mustChangePassword: row.mustChangePassword,
  lastLoginAt: row.lastLoginAt,
  passwordChangedAt: row.passwordChangedAt,
  createdAt: row.createdAt,
});

const readReason = (body: unknown, required: boolean): string => {
  const raw = (body as { reason?: unknown } | undefined)?.reason;
  if (raw !== undefined && typeof raw !== 'string') throw new HttpError(400, 'Reason must be text');
  const reason = (raw ?? '').trim();
  if (required && !reason) throw new HttpError(400, 'A reason is required');
  if (reason.length > MAX_REASON_LENGTH) throw new HttpError(400, `Reason must be at most ${MAX_REASON_LENGTH} characters`);
  return reason;
};

/** Runs `work`; an `HttpError` becomes the response status. */
const withStatus = async <T>(res: any, work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof HttpError) res.status(error.status);
    throw error;
  }
};

const audit = (tx: Tx, staffId: string, action: string, targetId: string, reason: string, metadata: Record<string, unknown>) =>
  tx.insert(auditLog).values({
    staffId,
    action,
    targetType: 'staff',
    targetId,
    reason: reason || null,
    metadata,
  });

/** `GET /api/admin/staff`: every staff account, oldest first. There are few, so no paging. */
const listStaff = asyncHandler(async (_req: any, res: any) => {
  const rows = await db.select().from(staffAccounts).orderBy(asc(staffAccounts.createdAt), asc(staffAccounts.id));
  res.json({ items: rows.map(serialize) });
});

/** `POST /api/admin/staff`: a new account with a temporary password the person must change. */
const createStaffMember = asyncHandler(async (req: any, res: any) => {
  const { email, name, role, password } = req.body ?? {};

  const created = await withStatus(res, async () => {
    const reason = readReason(req.body, false);
    if (typeof email !== 'string' || typeof name !== 'string') throw new HttpError(400, 'Email and name are required');
    if (!isRole(role)) throw new HttpError(400, 'Invalid role');
    try {
      validateStaffPassword(password);
    } catch (error: any) {
      throw new HttpError(400, error.message);
    }

    return db.transaction(async (tx) => {
      let staff;
      try {
        staff = await createStaff({ email, name, role, password, mustChangePassword: true }, tx);
      } catch (error: any) {
        // The messages of createStaff are safe to show (bad email, empty name).
        if ((error.cause?.code ?? error.code) === '23505') throw new HttpError(409, 'A staff account with this email already exists');
        throw new HttpError(400, error.message);
      }
      await audit(tx, req.staff.id, 'staff.create', staff.id, reason, { email: staff.email, name: staff.name, role: staff.role });
      const [row] = await tx.select().from(staffAccounts).where(eq(staffAccounts.id, staff.id));
      return row;
    });
  });

  res.status(201).json(serialize(created));
});

interface StaffActionSpec {
  action: string;
  reasonRequired: boolean;
  /** The action can leave no active owner. */
  canRemoveAnOwner?: boolean;
  /** A message if the action is not possible now, else null. */
  blockedBy: (target: StaffRow, req: any) => string | null;
  apply: (tx: Tx, target: StaffRow, req: any) => Promise<Record<string, unknown>>;
}

const SELF = 'You cannot do this to your own account';

const STAFF_ACTIONS = {
  role: {
    action: 'staff.role_change',
    reasonRequired: false,
    canRemoveAnOwner: true,
    blockedBy: (t, req) => {
      if (t.id === req.staff.id) return SELF;
      if (!isRole(req.body?.role)) return null; // answered as 400 below, before this runs
      return t.role === req.body.role ? 'This account already has this role' : null;
    },
    apply: async (tx, t, req) => {
      await tx.update(staffAccounts).set({ role: req.body.role, updatedAt: new Date() }).where(eq(staffAccounts.id, t.id));
      return { email: t.email, from: t.role, to: req.body.role };
    },
  },
  disable: {
    action: 'staff.disable',
    reasonRequired: true,
    canRemoveAnOwner: true,
    blockedBy: (t, req) => (t.id === req.staff.id ? SELF : t.disabledAt ? 'This account is already disabled' : null),
    apply: async (tx, t) => {
      // Raising the token version ends the person's open sessions at once.
      await tx
        .update(staffAccounts)
        .set({ disabledAt: new Date(), tokenVersion: sql`${staffAccounts.tokenVersion} + 1`, updatedAt: new Date() })
        .where(eq(staffAccounts.id, t.id));
      return { email: t.email };
    },
  },
  enable: {
    action: 'staff.enable',
    reasonRequired: false,
    blockedBy: (t) => (!t.disabledAt ? 'This account is not disabled' : null),
    apply: async (tx, t) => {
      await tx.update(staffAccounts).set({ disabledAt: null, updatedAt: new Date() }).where(eq(staffAccounts.id, t.id));
      return { email: t.email };
    },
  },
  'reset-password': {
    action: 'staff.password_reset',
    reasonRequired: false,
    blockedBy: (t, req) => (t.id === req.staff.id ? 'Use "Change password" for your own account' : null),
    apply: async (tx, t, req) => {
      const passwordHash = await hashStaffPassword(req.body.password);
      await tx
        .update(staffAccounts)
        .set({
          passwordHash,
          mustChangePassword: true,
          tokenVersion: sql`${staffAccounts.tokenVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(staffAccounts.id, t.id));
      return { email: t.email };
    },
  },
} satisfies Record<string, StaffActionSpec>;

type StaffActionName = keyof typeof STAFF_ACTIONS;

const staffAction = (name: StaffActionName) => {
  const spec: StaffActionSpec = STAFF_ACTIONS[name];

  return asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;

    const row = await withStatus(res, async () => {
      if (!isUuid(id)) throw new HttpError(404, 'Staff account not found');
      const reason = readReason(req.body, spec.reasonRequired);

      // Input checks that need no database come first, so a bad request never takes a lock.
      if (name === 'role' && !isRole(req.body?.role)) throw new HttpError(400, 'Invalid role');
      if (name === 'reset-password') {
        try {
          validateStaffPassword(req.body?.password);
        } catch (error: any) {
          throw new HttpError(400, error.message);
        }
      }

      return db.transaction(async (tx) => {
        // Every action that can remove an owner locks all active owners first, always in
        // the same order. Two owners who act on each other at the same moment then wait
        // in line, and the second one sees the first one's result.
        if (spec.canRemoveAnOwner) {
          await tx
            .select({ id: staffAccounts.id })
            .from(staffAccounts)
            .where(and(eq(staffAccounts.role, 'owner'), isNull(staffAccounts.disabledAt)))
            .orderBy(asc(staffAccounts.id))
            .for('update');
        }

        const [target] = await tx.select().from(staffAccounts).where(eq(staffAccounts.id, id)).for('update');
        if (!target) throw new HttpError(404, 'Staff account not found');

        const blocked = spec.blockedBy(target, req);
        if (blocked) throw new HttpError(409, blocked);

        const losesOwner =
          spec.canRemoveAnOwner && target.role === 'owner' && !target.disabledAt && !(name === 'role' && req.body.role === 'owner');
        if (losesOwner) {
          const others = await tx
            .select({ id: staffAccounts.id })
            .from(staffAccounts)
            .where(and(eq(staffAccounts.role, 'owner'), isNull(staffAccounts.disabledAt), ne(staffAccounts.id, target.id)));
          if (others.length === 0) throw new HttpError(409, 'This is the last active owner. Make another owner first');
        }

        const metadata = await spec.apply(tx, target, req);
        await audit(tx, req.staff.id, spec.action, target.id, reason, metadata);

        const [updated] = await tx.select().from(staffAccounts).where(eq(staffAccounts.id, target.id));
        return updated;
      });
    });

    res.json(serialize(row));
  });
};

const changeStaffRole = staffAction('role');
const disableStaff = staffAction('disable');
const enableStaff = staffAction('enable');
const resetStaffPassword = staffAction('reset-password');

export = { listStaff, createStaffMember, changeStaffRole, disableStaff, enableStaff, resetStaffPassword };
