// Account badges, slice 1 — the user_badges table and lib/badges.ts.
// See .context/plans/verified-badges.md.
const { eq } = require('drizzle-orm');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, tags, userBadges, staffAccounts } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');
const { BADGE_TYPES, isBadgeType, activeBadgesByUserIds, activeBadgeCondition } = require('../lib/badges');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

let seq = 0;
const makeUser = async (overrides = {}) => {
    seq += 1;
    const [user] = await db
        .insert(users)
        .values({
            name: `User ${seq}`,
            email: `badge-user${seq}@example.com`,
            username: `badgeuser${seq}`,
            languages: ['English', 'Spanish'],
            ...overrides,
        })
        .returning();
    return user;
};

const makeStaff = (email = 'owner@example.com') =>
    createStaff({ email, name: 'Owner', password: 'correct-horse-battery', role: 'owner' });

const grant = async (userId, staffId, type = 'official') =>
    (await db.insert(userBadges).values({ userId, type, grantedBy: staffId }).returning())[0];

const revoke = (badgeId) => db.update(userBadges).set({ revokedAt: new Date() }).where(eq(userBadges.id, badgeId));

// Drizzle can wrap the driver error, so look in `cause` too.
const pgCode = (error) => error?.code ?? error?.cause?.code;
const expectPgError = async (promise, code) => {
    let caught;
    try {
        await promise;
    } catch (error) {
        caught = error;
    }
    expect(caught).toBeDefined();
    expect(pgCode(caught)).toBe(code);
};

describe('isBadgeType', () => {
    it('accepts only the listed types', () => {
        expect(BADGE_TYPES).toEqual(['official']);
        expect(isBadgeType('official')).toBe(true);
        expect(isBadgeType('Official')).toBe(false);
        expect(isBadgeType('teacher')).toBe(false);
        expect(isBadgeType('')).toBe(false);
        expect(isBadgeType(undefined)).toBe(false);
        expect(isBadgeType(5)).toBe(false);
    });
});

describe('user_badges table', () => {
    it('refuses a second active badge of the same type for one user', async () => {
        const staff = await makeStaff();
        const user = await makeUser();
        await grant(user.id, staff.id);
        await expectPgError(grant(user.id, staff.id), '23505');
    });

    it('allows the same type for two different users', async () => {
        const staff = await makeStaff();
        const [a, b] = [await makeUser(), await makeUser()];
        await grant(a.id, staff.id);
        await expect(grant(b.id, staff.id)).resolves.toBeDefined();
    });

    it('allows a grant again after a revoke, and keeps the revoked row', async () => {
        const staff = await makeStaff();
        const user = await makeUser();
        const first = await grant(user.id, staff.id);
        await revoke(first.id);
        const second = await grant(user.id, staff.id);
        expect(second.id).not.toBe(first.id);

        const rows = await db.select().from(userBadges).where(eq(userBadges.userId, user.id));
        expect(rows).toHaveLength(2);
        expect(rows.filter((row) => row.revokedAt === null)).toHaveLength(1);
    });

    it('allows many revoked rows of one type', async () => {
        const staff = await makeStaff();
        const user = await makeUser();
        for (let i = 0; i < 3; i += 1) await revoke((await grant(user.id, staff.id)).id);
        const rows = await db.select().from(userBadges).where(eq(userBadges.userId, user.id));
        expect(rows).toHaveLength(3);
    });

    it('allows two different types active at the same time', async () => {
        const staff = await makeStaff();
        const user = await makeUser();
        await grant(user.id, staff.id, 'official');
        // The column has no enum on purpose: a new type needs no migration.
        await expect(grant(user.id, staff.id, 'teacher')).resolves.toBeDefined();
    });

    it('sets granted_at and leaves revoked_at empty on a new row', async () => {
        const staff = await makeStaff();
        const user = await makeUser();
        const badge = await grant(user.id, staff.id);
        expect(badge.grantedAt).toBeInstanceOf(Date);
        expect(badge.revokedAt).toBeNull();
        expect(badge.grantedBy).toBe(staff.id);
    });

    it('deletes the badge rows when the user is deleted (cascade)', async () => {
        const staff = await makeStaff();
        const user = await makeUser();
        await revoke((await grant(user.id, staff.id)).id);
        await grant(user.id, staff.id);

        await db.delete(users).where(eq(users.id, user.id));

        expect(await db.select().from(userBadges)).toHaveLength(0);
    });

    it('blocks deleting the staff account that granted a badge (restrict)', async () => {
        const staff = await makeStaff();
        const user = await makeUser();
        await grant(user.id, staff.id);

        await expectPgError(db.delete(staffAccounts).where(eq(staffAccounts.id, staff.id)), '23503');
    });

    it('refuses a badge for a user that does not exist', async () => {
        const staff = await makeStaff();
        await expectPgError(grant('00000000-0000-4000-8000-000000000000', staff.id), '23503');
    });
});

describe('activeBadgesByUserIds', () => {
    it('returns an empty map for no ids', async () => {
        expect((await activeBadgesByUserIds([])).size).toBe(0);
    });

    it('returns the active types per user and nothing for a user with none', async () => {
        const staff = await makeStaff();
        const [a, b, c] = [await makeUser(), await makeUser(), await makeUser()];
        await grant(a.id, staff.id, 'official');
        await grant(b.id, staff.id, 'official');

        const map = await activeBadgesByUserIds([a.id, b.id, c.id]);
        expect(map.get(a.id)).toEqual(['official']);
        expect(map.get(b.id)).toEqual(['official']);
        expect(map.has(c.id)).toBe(false);
    });

    it('ignores a revoked badge', async () => {
        const staff = await makeStaff();
        const user = await makeUser();
        await revoke((await grant(user.id, staff.id)).id);
        expect((await activeBadgesByUserIds([user.id])).has(user.id)).toBe(false);
    });

    it('ignores a type that is not in BADGE_TYPES', async () => {
        const staff = await makeStaff();
        const user = await makeUser();
        await grant(user.id, staff.id, 'teacher');
        expect((await activeBadgesByUserIds([user.id])).has(user.id)).toBe(false);
    });

    it('shows no badge for a banned or a deleted user, and shows it again after an unban', async () => {
        const staff = await makeStaff();
        const banned = await makeUser({ bannedAt: new Date() });
        const deleted = await makeUser({ deletedAt: new Date() });
        await grant(banned.id, staff.id);
        await grant(deleted.id, staff.id);

        const map = await activeBadgesByUserIds([banned.id, deleted.id]);
        expect(map.size).toBe(0);

        await db.update(users).set({ bannedAt: null }).where(eq(users.id, banned.id));
        expect((await activeBadgesByUserIds([banned.id])).get(banned.id)).toEqual(['official']);
    });
});

describe('activeBadgeCondition', () => {
    const makeTag = async (authorId, label) =>
        (await db.insert(tags).values({ authorId, label, visibility: 'Public' }).returning())[0];

    const labelsWithBadge = async (type) =>
        (await db.select({ label: tags.label }).from(tags).where(activeBadgeCondition(type)).orderBy(tags.label)).map(
            (row) => row.label,
        );

    it('keeps only tags whose author has the active badge', async () => {
        const staff = await makeStaff();
        const [badged, plain, revoked] = [await makeUser(), await makeUser(), await makeUser()];
        await grant(badged.id, staff.id);
        await revoke((await grant(revoked.id, staff.id)).id);
        await makeTag(badged.id, 'From badged');
        await makeTag(plain.id, 'From plain');
        await makeTag(revoked.id, 'From revoked');

        expect(await labelsWithBadge('official')).toEqual(['From badged']);
    });

    it('agrees with activeBadgesByUserIds for a banned author', async () => {
        const staff = await makeStaff();
        const banned = await makeUser({ bannedAt: new Date() });
        await grant(banned.id, staff.id);
        await makeTag(banned.id, 'From banned');

        expect(await labelsWithBadge('official')).toEqual([]);
    });

    it('does not match another type', async () => {
        const staff = await makeStaff();
        const user = await makeUser();
        await grant(user.id, staff.id, 'teacher');
        await makeTag(user.id, 'From teacher');

        expect(await labelsWithBadge('official')).toEqual([]);
    });

    it('does not count a user twice when the user has many rows', async () => {
        const staff = await makeStaff();
        const user = await makeUser();
        await revoke((await grant(user.id, staff.id)).id);
        await grant(user.id, staff.id);
        await makeTag(user.id, 'Only once');

        expect(await labelsWithBadge('official')).toEqual(['Only once']);
    });
});
