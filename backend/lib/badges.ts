/**
 * Account badges (.context/plans/verified-badges.md). A badge belongs to an
 * account, and only staff grant it (admin API, permission `badge.manage`).
 *
 * Not to be confused with `users.verified`, which means "email verified".
 *
 * An active badge is a `user_badges` row with `revoked_at` NULL. A banned or
 * deleted account shows no badge (the row stays, so an unban brings it back).
 */
const { db }: typeof import('../src/db') = require('../src/db');
const { userBadges, users, tags }: typeof import('../src/db/schema') = require('../src/db/schema');
const { and, eq, inArray, isNull, sql }: typeof import('drizzle-orm') = require('drizzle-orm');

/** The allowed badge types. A new type is one more entry here — no migration. */
export const BADGE_TYPES = ['official'] as const;
export type BadgeType = (typeof BADGE_TYPES)[number];

export const isBadgeType = (value: unknown): value is BadgeType =>
    typeof value === 'string' && (BADGE_TYPES as readonly string[]).includes(value);

/**
 * The active badge types of each user, in one query. A user with no active
 * badge has no entry in the map. Types are sorted, so the output is stable.
 */
export const activeBadgesByUserIds = async (userIds: string[]): Promise<Map<string, BadgeType[]>> => {
    const result = new Map<string, BadgeType[]>();
    if (userIds.length === 0) return result;

    const rows = await db
        .select({ userId: userBadges.userId, type: userBadges.type })
        .from(userBadges)
        .innerJoin(users, eq(users.id, userBadges.userId))
        .where(
            and(
                inArray(userBadges.userId, userIds),
                isNull(userBadges.revokedAt),
                isNull(users.bannedAt),
                isNull(users.deletedAt),
            ),
        );

    for (const row of rows) {
        // A type that is no longer in BADGE_TYPES is not shown.
        if (!isBadgeType(row.type)) continue;
        const types = result.get(row.userId) ?? [];
        types.push(row.type);
        result.set(row.userId, types);
    }
    for (const types of result.values()) types.sort();
    return result;
};

/**
 * SQL condition for a query on `tags`: the tag author has this active badge.
 * Same rules as `activeBadgesByUserIds`, so the filter and the badge shown
 * on a tag always agree. The partial unique index on `user_badges` serves it.
 */
export const activeBadgeCondition = (type: BadgeType) => sql`EXISTS (
    SELECT 1 FROM ${userBadges}
    INNER JOIN ${users} ON ${users.id} = ${userBadges.userId}
    WHERE ${userBadges.userId} = ${tags.authorId}
        AND ${userBadges.type} = ${type}
        AND ${userBadges.revokedAt} IS NULL
        AND ${users.bannedAt} IS NULL
        AND ${users.deletedAt} IS NULL
)`;
