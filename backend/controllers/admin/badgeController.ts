/**
 * Grant and revoke account badges (verified-badges.md, slice 2). Both routes
 * need `badge.manage` (owner only) and a reason. Each runs in one transaction:
 * lock the user row, check the state, change the badge, write the audit row.
 * A failed check rolls back, so there is never an audit row for a change that
 * did not happen. A revoke sets `revoked_at` and keeps the row.
 */
const asyncHandler = require('express-async-handler');
const { db }: typeof import('../../src/db') = require('../../src/db');
const { users, userBadges, auditLog }: typeof import('../../src/db/schema') = require('../../src/db/schema');
const { and, eq, isNull }: typeof import('drizzle-orm') = require('drizzle-orm');
const { HttpError }: typeof import('../../lib/httpError') = require('../../lib/httpError');
const { readReason, withStatus }: typeof import('../../lib/adminRequest') = require('../../lib/adminRequest');
const { isBadgeType }: typeof import('../../lib/badges') = require('../../lib/badges');
const { isUuid }: typeof import('../userController') = require('../userController');
const { loadUserDetail }: typeof import('./userController') = require('./userController');
import type { BadgeType } from '../../lib/badges';

type BadgeAction = 'grant' | 'revoke';

/** Builds the handler for one badge action. The route decides the permission; this does the rest. */
const badgeAction = (action: BadgeAction) =>
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;

    await withStatus(res, async () => {
      if (!isUuid(id)) throw new HttpError(404, 'User not found');

      // Grant reads the type from the body, revoke from the path.
      const type: unknown = action === 'grant' ? req.body?.type : req.params.type;
      if (!isBadgeType(type)) throw new HttpError(400, 'Unknown badge type');
      const badge: BadgeType = type;
      const reason = readReason(req.body, true);

      await db.transaction(async (tx) => {
        // Locks the row, so two staff members acting at once cannot both pass the state check.
        const [user] = await tx.select().from(users).where(eq(users.id, id)).for('update');
        if (!user) throw new HttpError(404, 'User not found');

        const active = and(eq(userBadges.userId, user.id), eq(userBadges.type, badge), isNull(userBadges.revokedAt));

        if (action === 'grant') {
          const [existing] = await tx.select({ id: userBadges.id }).from(userBadges).where(active).limit(1);
          if (existing) throw new HttpError(409, 'This account already has this badge');
          await tx.insert(userBadges).values({ userId: user.id, type: badge, grantedBy: req.staff.id });
        } else {
          const revoked = await tx
            .update(userBadges)
            .set({ revokedAt: new Date() })
            .where(active)
            .returning({ id: userBadges.id });
          if (revoked.length === 0) throw new HttpError(409, 'This account does not have this badge');
        }

        await tx.insert(auditLog).values({
          staffId: req.staff.id,
          action: `badge.${action}`,
          targetType: 'user',
          targetId: user.id,
          reason,
          // Enough to identify the account even if it is purged later.
          metadata: { email: user.email, username: user.username, badge },
        });
      });
    });

    res.json(await loadUserDetail(id, req.staff.role));
  });

/** `POST /api/admin/users/:id/badges` — body `{ type, reason }` */
const grantBadge = badgeAction('grant');
/** `POST /api/admin/users/:id/badges/:type/revoke` — body `{ reason }` */
const revokeBadge = badgeAction('revoke');

export = { grantBadge, revokeBadge };
