/**
 * The audit log viewer's API (admin-dashboard.md §3, slice 8). Read only; the
 * rows are written by the admin actions themselves. Needs `audit.read`.
 */
const asyncHandler = require('express-async-handler');
const { db }: typeof import('../../src/db') = require('../../src/db');
const { auditLog, staffAccounts }: typeof import('../../src/db/schema') = require('../../src/db/schema');
const { alias }: typeof import('drizzle-orm/pg-core') = require('drizzle-orm/pg-core');
const { and, asc, desc, eq, gte, isNull, lt, sql }: typeof import('drizzle-orm') = require('drizzle-orm');
const { isUuid }: typeof import('../userController') = require('../userController');

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_ACTION_LENGTH = 64;

/** The staff filter value for rows written by the system (the nightly job). */
const SYSTEM = 'system';

const single = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** An ISO date or time sent by the browser, or `undefined` if absent. Bad text is a 400. */
const readInstant = (res: any, name: string, value: unknown): Date | undefined => {
  if (value === undefined || value === '') return undefined;
  const text = single(value);
  const time = text === undefined ? NaN : Date.parse(text);
  if (Number.isNaN(time)) {
    res.status(400);
    throw new Error(`${name} must be a date`);
  }
  return new Date(time);
};

/** `GET /api/admin/audit` */
const listAudit = asyncHandler(async (req: any, res: any) => {
  const q = req.query;

  const page = q.page === undefined ? 1 : Number(single(q.page));
  const pageSize = q.pageSize === undefined ? DEFAULT_PAGE_SIZE : Number(single(q.pageSize));
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    res.status(400);
    throw new Error(`page must be 1 or more, and pageSize between 1 and ${MAX_PAGE_SIZE}`);
  }

  const staff = single(q.staff);
  if (q.staff !== undefined && staff === undefined) {
    res.status(400);
    throw new Error('Invalid staff filter');
  }
  if (staff && staff !== SYSTEM && !isUuid(staff)) {
    res.status(400);
    throw new Error('Invalid staff filter');
  }

  const action = single(q.action)?.trim();
  if (q.action !== undefined && action === undefined) {
    res.status(400);
    throw new Error('Invalid action filter');
  }
  if (action && action.length > MAX_ACTION_LENGTH) {
    res.status(400);
    throw new Error('Invalid action filter');
  }

  // `from` is included, `to` is not: the browser sends the start of the day after the
  // last day it wants, in the person's own time zone.
  const from = readInstant(res, 'from', q.from);
  const to = readInstant(res, 'to', q.to);
  if (from && to && from >= to) {
    res.status(400);
    throw new Error('from must be before to');
  }

  const where = and(
    staff === SYSTEM ? isNull(auditLog.staffId) : staff ? eq(auditLog.staffId, staff) : undefined,
    action ? eq(auditLog.action, action) : undefined,
    from ? gte(auditLog.createdAt, from) : undefined,
    to ? lt(auditLog.createdAt, to) : undefined,
  );

  const targetStaff = alias(staffAccounts, 'target_staff');

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(auditLog).where(where);

  const rows = await db
    .select({
      id: auditLog.id,
      createdAt: auditLog.createdAt,
      action: auditLog.action,
      staffId: auditLog.staffId,
      staffName: staffAccounts.name,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      targetStaffName: targetStaff.name,
      reason: auditLog.reason,
      metadata: auditLog.metadata,
    })
    .from(auditLog)
    // A row with no staff member was written by the system (the nightly purge).
    .leftJoin(staffAccounts, eq(auditLog.staffId, staffAccounts.id))
    // For a row about a staff member, its name. `target_id` is text, so the staff id is compared as text.
    .leftJoin(targetStaff, and(eq(auditLog.targetType, 'staff'), sql`${auditLog.targetId} = ${targetStaff.id}::text`))
    .where(where)
    // `id` makes the order total, so a page never repeats or skips a row with the same time.
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  res.json({
    items: rows.map(({ staffName, ...row }) => ({ ...row, staffName: row.staffId ? (staffName ?? 'Unknown') : 'System' })),
    total,
    page,
    pageSize,
  });
});

/** `GET /api/admin/audit/filters`: the values for the filter drop-downs. */
const getAuditFilters = asyncHandler(async (_req: any, res: any) => {
  const [actions, staff] = await Promise.all([
    db.selectDistinct({ action: auditLog.action }).from(auditLog).orderBy(asc(auditLog.action)),
    db.select({ id: staffAccounts.id, name: staffAccounts.name }).from(staffAccounts).orderBy(asc(staffAccounts.name), asc(staffAccounts.id)),
  ]);
  res.json({ actions: actions.map((row) => row.action), staff });
});

export = { listAudit, getAuditFilters };
