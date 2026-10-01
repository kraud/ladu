// Admin dashboard slice 5 — the nightly purge (lib/userPurge.ts, scripts/purge.js).
const path = require('path');
const { execFileSync } = require('child_process');
const { eq } = require('drizzle-orm');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, words, loginEvents, auditLog } = require('../src/db/schema');
const { runPurge } = require('../lib/userPurge');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);

let seq = 0;
const makeUser = async (overrides = {}) => {
    seq += 1;
    const [user] = await db
        .insert(users)
        .values({ name: `U${seq}`, email: `u${seq}@example.com`, username: `u${seq}`, languages: ['English', 'Spanish'], ...overrides })
        .returning();
    return user;
};
const exists = async (id) => (await db.select().from(users).where(eq(users.id, id))).length === 1;

describe('runPurge', () => {
    it('purges only accounts soft-deleted more than 30 days ago', async () => {
        const old = await makeUser({ deletedAt: daysAgo(31) });
        const recent = await makeUser({ deletedAt: daysAgo(29) });
        const active = await makeUser();
        const banned = await makeUser({ bannedAt: daysAgo(90) });
        const bannedOld = await makeUser({ bannedAt: daysAgo(90), deletedAt: daysAgo(40) });

        const result = await runPurge();

        expect(result.purgedUsers).toBe(2);
        expect(await exists(old.id)).toBe(false);
        expect(await exists(bannedOld.id)).toBe(false);
        expect(await exists(recent.id)).toBe(true);
        expect(await exists(active.id)).toBe(true);
        expect(await exists(banned.id)).toBe(true);
    });

    it('removes the account data, and writes one system audit row per account', async () => {
        const old = await makeUser({ deletedAt: daysAgo(45), username: 'gone' });
        await db.insert(words).values({ userId: old.id, partOfSpeech: 'Noun' });

        await runPurge();

        expect(await db.select().from(words)).toHaveLength(0);
        const audit = await db.select().from(auditLog);
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({
            staffId: null,
            action: 'user.purge',
            targetType: 'user',
            targetId: old.id,
            metadata: { actor: 'system', email: old.email, username: 'gone' },
        });
        expect(audit[0].reason).toMatch(/30 days/);
    });

    it('deletes login events older than 90 days and keeps newer ones', async () => {
        const user = await makeUser();
        await db.insert(loginEvents).values([
            { userId: user.id, method: 'password', createdAt: daysAgo(91) },
            { userId: user.id, method: 'password', createdAt: daysAgo(89) },
            { userId: user.id, method: 'google', createdAt: new Date() },
        ]);

        const result = await runPurge();

        expect(result).toMatchObject({ purgedUsers: 0, deletedLoginEvents: 1 });
        expect(await db.select().from(loginEvents)).toHaveLength(2);
    });

    it('does nothing on a second run, and on an empty database', async () => {
        expect(await runPurge()).toEqual({ purgedUsers: 0, deletedLoginEvents: 0 });
        await makeUser({ deletedAt: daysAgo(31) });

        expect((await runPurge()).purgedUsers).toBe(1);
        expect(await runPurge()).toEqual({ purgedUsers: 0, deletedLoginEvents: 0 });
        expect(await db.select().from(auditLog)).toHaveLength(1);
    });

    it('uses the cut-off for the time it is given', async () => {
        const user = await makeUser({ deletedAt: daysAgo(10) });

        expect((await runPurge(new Date(Date.now() + 19 * DAY))).purgedUsers).toBe(0);
        expect((await runPurge(new Date(Date.now() + 21 * DAY))).purgedUsers).toBe(1);
        expect(await exists(user.id)).toBe(false);
    });
});

describe('scripts/purge.js', () => {
    it('runs as the cron job runs it: removes only the expired account and prints a summary', async () => {
        const old = await makeUser({ deletedAt: daysAgo(31) });
        const recent = await makeUser({ deletedAt: daysAgo(5) });

        // NODE_ENV=test makes src/db pick TEST_DATABASE_URL, never the dev DB.
        const output = execFileSync('node', ['scripts/purge.js'], {
            cwd: path.resolve(__dirname, '..'),
            env: { ...process.env, NODE_ENV: 'test' },
            encoding: 'utf8',
        });

        expect(output).toMatch(/purge ok: 1 account\(s\), 0 login event\(s\)/);
        expect(await exists(old.id)).toBe(false);
        expect(await exists(recent.id)).toBe(true);
    });
});
