// Admin dashboard slice 9 — `protect` records one active day for each user for each UTC day
// (user_activity_days), next to the hourly `last_seen_at`.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, userActivityDays } = require('../src/db/schema');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterEach(() => {
    global.Date = RealDate;
    jest.restoreAllMocks();
});
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const RealDate = Date;

/**
 * Fixes the clock. Jest 27 can only fake every timer at once, which would stall the
 * database driver, so this replaces only `Date`: `new Date()` and `Date.now()` answer
 * `iso`, everything else behaves as before.
 */
const setClock = (iso) => {
    const fixed = new RealDate(iso).getTime();
    global.Date = class extends RealDate {
        constructor(...args) {
            if (args.length === 0) super(fixed);
            else super(...args);
        }

        static now() {
            return fixed;
        }
    };
};

const makeUser = async (overrides = {}) => {
    const [user] = await db
        .insert(users)
        .values({
            name: 'Test User',
            email: 'test@example.com',
            username: 'testuser',
            password: await bcrypt.hash('password123', 4),
            languages: ['English', 'Spanish'],
            verified: true,
            ...overrides,
        })
        .returning();
    return user;
};

const hit = (user) => request(app).get('/api/users/me').set('Authorization', `Bearer ${global.signin(user.id)}`);
const days = async (user) => (await db.select().from(userActivityDays).where(eq(userActivityDays.userId, user.id))).map((r) => r.day).sort();
const lastSeen = async (user) => (await db.select().from(users).where(eq(users.id, user.id)))[0].lastSeenAt;

describe('the first request of a day', () => {
    it('records today (UTC) and sets last_seen_at', async () => {
        setClock('2026-10-05T10:00:00Z');
        const user = await makeUser();

        expect((await hit(user)).status).toBe(200);

        expect(await days(user)).toEqual(['2026-10-05']);
        expect((await lastSeen(user)).toISOString()).toBe('2026-10-05T10:00:00.000Z');
    });

    it('does nothing more on later requests the same day, and does not rewrite last_seen_at within the hour', async () => {
        setClock('2026-10-05T10:00:00Z');
        const user = await makeUser();
        await hit(user);

        setClock('2026-10-05T10:30:00Z');
        await hit(user);
        await hit(user);

        expect(await days(user)).toEqual(['2026-10-05']);
        expect((await lastSeen(user)).toISOString()).toBe('2026-10-05T10:00:00.000Z');
    });

    it('still refreshes last_seen_at after an hour, without a second row', async () => {
        setClock('2026-10-05T10:00:00Z');
        const user = await makeUser();
        await hit(user);

        setClock('2026-10-05T11:30:00Z');
        await hit(user);

        expect(await days(user)).toEqual(['2026-10-05']);
        expect((await lastSeen(user)).toISOString()).toBe('2026-10-05T11:30:00.000Z');
    });

    it('records two parallel first requests once', async () => {
        setClock('2026-10-05T10:00:00Z');
        const user = await makeUser();

        const results = await Promise.all([hit(user), hit(user), hit(user), hit(user)]);

        expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
        expect(await days(user)).toEqual(['2026-10-05']);
    });
});

describe('a new UTC day', () => {
    it('is recorded even when the last request was only 20 minutes ago (23:50, then 00:10)', async () => {
        setClock('2026-10-04T23:50:00Z');
        const user = await makeUser();
        await hit(user);
        expect(await days(user)).toEqual(['2026-10-04']);

        setClock('2026-10-05T00:10:00Z');
        await hit(user);

        expect(await days(user)).toEqual(['2026-10-04', '2026-10-05']);
        // The day change forces a refresh, so the next request of the new day does not insert again.
        expect((await lastSeen(user)).toISOString()).toBe('2026-10-05T00:10:00.000Z');
        setClock('2026-10-05T00:20:00Z');
        await hit(user);
        expect(await days(user)).toEqual(['2026-10-04', '2026-10-05']);
    });

    it('records each day once over several days', async () => {
        const user = await makeUser();

        for (const iso of ['2026-10-05T08:00:00Z', '2026-10-05T20:00:00Z', '2026-10-06T08:00:00Z', '2026-10-08T08:00:00Z', '2026-10-08T09:00:00Z']) {
            setClock(iso);
            await hit(user);
        }

        expect(await days(user)).toEqual(['2026-10-05', '2026-10-06', '2026-10-08']);
    });

    it('uses the UTC day, not the day of the server\'s time zone', async () => {
        // 23:30 UTC on the 5th is already the 6th in Estonia and Germany; the row says the 5th.
        setClock('2026-10-05T23:30:00Z');
        const user = await makeUser();

        await hit(user);

        expect(await days(user)).toEqual(['2026-10-05']);
    });
});

describe('what is deliberately not recorded', () => {
    it('adds no row for a user who was already seen earlier the same day (the first day after deploy)', async () => {
        setClock('2026-10-05T10:00:00Z');
        const user = await makeUser({ lastSeenAt: new RealDate('2026-10-05T00:05:00Z') });

        await hit(user);

        expect(await days(user)).toEqual([]);
        // The hourly refresh still runs.
        expect((await lastSeen(user)).toISOString()).toBe('2026-10-05T10:00:00.000Z');
    });

    it('records nothing for a banned, a deleted or a logged-out user', async () => {
        setClock('2026-10-05T10:00:00Z');
        const banned = await makeUser({ bannedAt: new RealDate(), email: 'b@example.com', username: 'b' });
        const deleted = await makeUser({ deletedAt: new RealDate(), email: 'd@example.com', username: 'd' });
        const loggedOut = await makeUser({ tokenVersion: 2, email: 'l@example.com', username: 'l' });

        for (const user of [banned, deleted, loggedOut]) expect((await hit(user)).status).toBe(401);

        expect(await db.select().from(userActivityDays)).toHaveLength(0);
    });

    it('records nothing for a request without a valid token', async () => {
        setClock('2026-10-05T10:00:00Z');
        await makeUser();

        await request(app).get('/api/users/me');
        await request(app).get('/api/users/me').set('Authorization', 'Bearer not-a-token');

        expect(await db.select().from(userActivityDays)).toHaveLength(0);
    });
});

describe('when recording fails', () => {
    it('does not fail the request, leaves last_seen_at alone, and tries again on the next request', async () => {
        setClock('2026-10-05T10:00:00Z');
        const user = await makeUser();
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const real = db.insert.bind(db);
        let failedOnce = false;
        jest.spyOn(db, 'insert').mockImplementation((table) => {
            if (table === userActivityDays && !failedOnce) {
                failedOnce = true;
                throw new Error('connection reset');
            }
            return real(table);
        });

        const first = await hit(user);

        expect(first.status).toBe(200);
        expect(await days(user)).toEqual([]);
        expect(await lastSeen(user)).toBeNull(); // not set, so the next request retries
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Could not record the active day'));

        const second = await hit(user);

        expect(second.status).toBe(200);
        expect(await days(user)).toEqual(['2026-10-05']);
        expect((await lastSeen(user)).toISOString()).toBe('2026-10-05T10:00:00.000Z');
    });
});
