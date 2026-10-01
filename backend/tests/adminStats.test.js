// Admin dashboard slice 9 — GET /api/admin/stats (aggregates only, users.read).
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, words, translations, tags, practiceSessions, exercisePerformances, userActivityDays } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const DAY = 24 * 60 * 60 * 1000;

// "Today" in UTC, the way the server counts it.
const now = new Date();
const TODAY_MS = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
const dayString = (offset) => new Date(TODAY_MS + offset * DAY).toISOString().slice(0, 10);
// Midday, so a few hours of time-zone difference in the test machine cannot move a row to another day.
const noon = (offset) => new Date(TODAY_MS + offset * DAY + 12 * 60 * 60 * 1000);
const mondayString = (weeksAgo) => {
    const weekday = (new Date(TODAY_MS).getUTCDay() + 6) % 7; // Monday = 0
    return dayString(-weekday - weeksAgo * 7);
};

const tokenFor = async (role = 'viewer') => {
    const staff = await createStaff({ email: `${role}@example.com`, name: role, password: 'correct-horse-battery', role });
    return (await request(app).post('/api/admin/auth/login').send({ email: staff.email, password: 'correct-horse-battery' })).body.token;
};
const stats = async (token) => request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`);

let seq = 0;
const makeUser = async (overrides = {}) => {
    seq += 1;
    const [user] = await db
        .insert(users)
        .values({
            name: `User ${seq}`,
            email: `user${seq}@example.test`,
            username: `user${seq}`,
            languages: ['English', 'Spanish'],
            verified: true,
            createdAt: noon(-100),
            ...overrides,
        })
        .returning();
    return user;
};

describe('access', () => {
    it('refuses no token and a learner token, and answers every staff role', async () => {
        const learner = await makeUser();

        expect((await request(app).get('/api/admin/stats')).status).toBe(401);
        expect((await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${global.signin(learner.id)}`)).status).toBe(401);
        for (const role of ['viewer', 'support', 'admin', 'owner']) {
            expect([role, (await stats(await tokenFor(role))).status]).toEqual([role, 200]);
        }
    });

    it('holds only numbers and labels: no email, name or username', async () => {
        await makeUser({ email: 'private.person@example.test', name: 'Private Person', username: 'privateperson' });

        const text = JSON.stringify((await stats(await tokenFor())).body);

        expect(text).not.toMatch(/private|example\.test|@/i);
    });
});

describe('an empty database', () => {
    it('answers with zeros, a full 30-day and 12-week range, and no activity history', async () => {
        const res = await stats(await tokenFor());

        expect(res.status).toBe(200);
        expect(res.body.today).toBe(dayString(0));
        expect(res.body.totals).toEqual({
            users: 0, verified: 0, unverified: 0, banned: 0, pendingDeletion: 0,
            words: 0, translations: 0, tags: 0, savedSessions: 0, practisedTranslations: 0,
        });
        const { daily, weekly } = res.body.signups;
        expect(daily).toHaveLength(30);
        expect(daily[0].day).toBe(dayString(-29));
        expect(daily[29].day).toBe(dayString(0));
        expect(daily.every((d) => d.count === 0)).toBe(true);
        expect(weekly).toHaveLength(12);
        expect(weekly[11].weekStart).toBe(mondayString(0));
        expect(weekly[0].weekStart).toBe(mondayString(11));
        expect(res.body.active.since).toBeNull();
        expect(res.body.active.points).toHaveLength(30);
        expect(res.body.active.points.every((p) => p.daily.count === null && p.weekly.count === null && p.monthly.count === null)).toBe(true);
        expect(res.body.languages).toEqual([]);
    });
});

describe('totals', () => {
    it('counts accounts by state, and everything else once', async () => {
        const a = await makeUser();
        await makeUser({ verified: false });
        await makeUser({ verified: null });
        await makeUser({ bannedAt: new Date() });
        await makeUser({ deletedAt: new Date() });
        await makeUser({ deletedAt: new Date(), bannedAt: new Date(), verified: false });
        const [word] = await db.insert(words).values({ userId: a.id, partOfSpeech: 'Noun' }).returning();
        await db.insert(words).values({ userId: a.id, partOfSpeech: 'Verb' });
        const [t1] = await db.insert(translations).values({ wordId: word.id, language: 'English' }).returning();
        await db.insert(translations).values([{ wordId: word.id, language: 'Spanish' }, { wordId: word.id, language: 'German' }]);
        await db.insert(tags).values({ authorId: a.id, label: 'travel', visibility: 'Private' });
        const session = { snapshot: {}, summary: {} };
        await db.insert(practiceSessions).values([
            { userId: a.id, ...session, expiresAt: new Date(Date.now() + 5 * DAY) },
            { userId: a.id, ...session, expiresAt: new Date(Date.now() + DAY) },
            { userId: a.id, ...session, expiresAt: new Date(Date.now() - DAY) }, // expired: not counted
        ]);
        await db.insert(exercisePerformances).values({ userId: a.id, wordId: word.id, translationId: t1.id });

        const { totals } = (await stats(await tokenFor())).body;

        expect(totals).toEqual({
            users: 4, // the two deleted accounts are not users any more
            verified: 2, // the first, and the banned one
            unverified: 2, // false and NULL both count as not verified
            banned: 1, // a deleted account is not also "banned"
            pendingDeletion: 2,
            words: 2,
            translations: 3,
            tags: 1,
            savedSessions: 2,
            practisedTranslations: 1,
        });
    });
});

describe('signups', () => {
    it('counts accounts for each day of the last 30, fills empty days with 0, and ignores older ones', async () => {
        for (const offset of [0, -1, -1, -29, -30, -45]) await makeUser({ createdAt: noon(offset) });
        // A deleted account that has not been purged yet still exists, so it is still a signup.
        await makeUser({ createdAt: noon(-5), deletedAt: new Date() });

        const { daily } = (await stats(await tokenFor())).body.signups;

        const byDay = Object.fromEntries(daily.map((d) => [d.day, d.count]));
        expect(byDay[dayString(0)]).toBe(1);
        expect(byDay[dayString(-1)]).toBe(2);
        expect(byDay[dayString(-5)]).toBe(1);
        expect(byDay[dayString(-29)]).toBe(1); // the first day of the range is included
        expect(byDay[dayString(-30)]).toBeUndefined(); // one day before is not
        expect(daily.reduce((sum, d) => sum + d.count, 0)).toBe(5);
        expect(daily.map((d) => d.day)).toEqual([...daily.map((d) => d.day)].sort());
        expect(new Set(daily.map((d) => d.day)).size).toBe(30);
    });

    it('counts accounts for each of the last 12 weeks, weeks start on Monday, and the newest week is this one', async () => {
        const thisMonday = mondayString(0);
        // Sunday before this Monday belongs to LAST week; this Monday belongs to this week.
        await makeUser({ createdAt: noon(-((new Date(TODAY_MS).getUTCDay() + 6) % 7)) });
        await makeUser({ createdAt: noon(-((new Date(TODAY_MS).getUTCDay() + 6) % 7) - 1) });
        // The first and the day before the first week of the range.
        await makeUser({ createdAt: noon(-((new Date(TODAY_MS).getUTCDay() + 6) % 7) - 77) });
        await makeUser({ createdAt: noon(-((new Date(TODAY_MS).getUTCDay() + 6) % 7) - 78) });

        const { weekly } = (await stats(await tokenFor())).body.signups;

        expect(weekly).toHaveLength(12);
        expect(weekly.every((w) => new Date(`${w.weekStart}T00:00:00Z`).getUTCDay() === 1)).toBe(true);
        const byWeek = Object.fromEntries(weekly.map((w) => [w.weekStart, w.count]));
        expect(byWeek[thisMonday]).toBe(1);
        expect(byWeek[mondayString(1)]).toBe(1);
        expect(byWeek[mondayString(11)]).toBe(1);
        expect(byWeek[mondayString(12)]).toBeUndefined();
        expect(weekly.reduce((sum, w) => sum + w.count, 0)).toBe(3);
    });
});

describe('languages', () => {
    it('counts users for each language, most first, then A to Z, and ignores deleted accounts', async () => {
        await makeUser({ languages: ['English', 'Spanish'] });
        await makeUser({ languages: ['English', 'German', 'Estonian'] });
        await makeUser({ languages: ['English'] });
        await makeUser({ languages: ['German'] });
        await makeUser({ languages: [] });
        await makeUser({ languages: ['Spanish', 'Estonian'], deletedAt: new Date() });
        await makeUser({ languages: ['Spanish', 'Estonian', 'German'], deletedAt: new Date() });

        const { languages } = (await stats(await tokenFor())).body;

        expect(languages).toEqual([
            { language: 'English', users: 3 },
            { language: 'German', users: 2 },
            { language: 'Estonian', users: 1 },
            { language: 'Spanish', users: 1 },
        ]);
    });
});

describe('active users', () => {
    const activity = (user, offsets) => db.insert(userActivityDays).values(offsets.map((o) => ({ userId: user.id, day: dayString(o) })));

    it('counts users for each day, and rolling 7-day and 30-day windows count each user once', async () => {
        const a = await makeUser();
        const b = await makeUser();
        const c = await makeUser();
        await activity(a, [0, -1, -2]);
        await activity(b, [-1]);
        await activity(c, [-10]);

        const { active } = (await stats(await tokenFor())).body;
        const at = (offset) => active.points.find((p) => p.day === dayString(offset));

        expect(active.since).toBe(dayString(-10));
        expect(at(0).daily.count).toBe(1);
        expect(at(-1).daily.count).toBe(2);
        expect(at(-3).daily.count).toBe(0);
        // A was active on 3 days of the week, and still counts once.
        expect(at(0).weekly.count).toBe(2);
        expect(at(0).monthly.count).toBe(3);
        expect(at(-7).weekly.count).toBe(1); // the window [-13, -7] holds only C (day -10)
        expect(at(-10).daily.count).toBe(1);
    });

    it('has no count for a day before the history began, and marks every window that includes the first day as partial', async () => {
        const a = await makeUser();
        await activity(a, [-10, -9]);

        const { active } = (await stats(await tokenFor())).body;
        const at = (offset) => active.points.find((p) => p.day === dayString(offset));

        expect(at(-11).daily).toEqual({ count: null, partial: false });
        expect(at(-11).monthly).toEqual({ count: null, partial: false });
        // The first day is incomplete: people seen earlier that day, before the table existed, have no row.
        expect(at(-10).daily).toEqual({ count: 1, partial: true });
        expect(at(-9).daily).toEqual({ count: 1, partial: false });
        // A 7-day window ending on day -9 still reaches back to -15: it includes the first day.
        expect(at(-9).weekly.partial).toBe(true);
        expect(at(-4).weekly.partial).toBe(true); // window [-10, -4]
        expect(at(-3).weekly.partial).toBe(false); // window [-9, -3]: the first day is out of it
        // A 30-day window is partial until 30 days have passed since the first day.
        expect(at(0).monthly.partial).toBe(true);
    });

    it('marks a monthly window complete once 30 full days exist after the first day', async () => {
        const a = await makeUser();
        // The history began 40 days ago: the 30-day window ending today starts at -29, after day -40.
        await activity(a, [-40, 0]);

        const { active } = (await stats(await tokenFor())).body;

        const today = active.points.at(-1);
        expect(today.monthly).toEqual({ count: 1, partial: false });
        expect(today.weekly).toEqual({ count: 1, partial: false });
    });

    it('treats a history that begins today as one partial day', async () => {
        const a = await makeUser();
        await activity(a, [0]);

        const { active } = (await stats(await tokenFor())).body;

        expect(active.since).toBe(dayString(0));
        expect(active.points.at(-1).daily).toEqual({ count: 1, partial: true });
        expect(active.points.slice(0, -1).every((p) => p.daily.count === null)).toBe(true);
    });
});

describe('the answer does not depend on who asks', () => {
    it('is the same for a viewer and an owner', async () => {
        await makeUser({ createdAt: noon(-3) });
        const viewer = (await stats(await tokenFor('viewer'))).body;
        const owner = (await stats(await tokenFor('owner'))).body;

        // The staff login itself is not a user, so only the clock differs.
        expect({ ...viewer, generatedAt: 0 }).toEqual({ ...owner, generatedAt: 0 });
    });
});
