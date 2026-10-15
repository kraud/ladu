// Demo access, Slice 1: `POST /api/demo` (the gate, the per-IP limit, the live cap, the new demo
// account and its seed) and the demo session in `protect`. See .context/plans/demo-access.md.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { eq, ne } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, words, tags, practiceConfigs, userActivityDays } = require('../src/db/schema');
const { seedDemoTemplate } = require('../lib/demoTemplate');
const { resetDemoStartLimiter, takeDemoStart } = require('../lib/demo');
const { loadTemplateData, TEMPLATE_USERNAME } = require('../lib/demoTemplate');
const { TERMS_VERSION } = require('../lib/terms');

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    resetDemoStartLimiter();
    // Every demo start copies the template (Slice 2).
    await seedDemoTemplate();
    delete process.env.DEMO_STARTS_PER_IP;
});
afterAll(async () => {
    delete process.env.DEMO_STARTS_PER_IP;
    await testDb.closeDB();
    await pool.end();
});

const MINUTE = 60 * 1000;
// What the copy of the template adds (the caps count on top of it, D3).
const template = loadTemplateData();
const SEED_COUNTS = { words: template.words.length, tags: template.tags.length };

const setDemo = (values) =>
    pool.query(
        `UPDATE access_settings SET demo_enabled = $1, demo_duration_minutes = $2, demo_max_words = $3, demo_max_tags = $4, demo_max_live = $5 WHERE id = 1`,
        [values.enabled ?? true, values.durationMinutes ?? 15, values.maxWords ?? 30, values.maxTags ?? 5, values.maxLive ?? 200],
    );

// `trust proxy 1`: the first X-Forwarded-For entry is the client IP, as behind the edge proxy.
let ipSeq = 0;
const freshIp = () => `203.0.113.${++ipSeq}`;
const start = (body = {}, ip = freshIp()) => request(app).post('/api/demo').set('X-Forwarded-For', ip).send(body);

/** Every account except the template (which every test seeds). */
const accounts = () => db.select().from(users).where(ne(users.username, TEMPLATE_USERNAME));
const userRow = async (id) => (await db.select().from(users).where(eq(users.id, id)))[0];
const countFor = async (table, column, id) => (await db.select().from(table).where(eq(column, id))).length;

describe('POST /api/demo — the gate', () => {
    it('refuses with demo_disabled while the demo is off (the default), and makes no account', async () => {
        const res = await start();
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('demo_disabled');
        expect(await accounts()).toHaveLength(0);
    });
});

describe('POST /api/demo — the new demo account', () => {
    beforeEach(() => setDemo({ durationMinutes: 20, maxWords: 30, maxTags: 5 }));

    it('answers like a login, with the demo fields, and the token opens a session', async () => {
        const before = Date.now();
        const res = await start({ uiLanguage: 'German', theme: 'dark' });
        expect(res.status).toBe(201);

        const body = res.body;
        expect(body.token).toEqual(expect.any(String));
        expect(body).toMatchObject({
            name: 'Demo',
            verified: true,
            isDemo: true,
            uiLanguage: 'German',
            nativeLanguage: 'German',
            theme: 'dark',
            languages: ['German', 'English', 'Spanish', 'Estonian'],
            demoWordLimit: SEED_COUNTS.words + 30,
            demoTagLimit: SEED_COUNTS.tags + 5,
        });
        expect(body.username).toMatch(/^demo-[0-9a-f-]{36}$/);
        expect(body.email).toMatch(/^demo\+[0-9a-f-]{36}@ladu\.invalid$/);
        const expiresAt = new Date(body.demoExpiresAt).getTime();
        expect(expiresAt).toBeGreaterThanOrEqual(before + 20 * MINUTE - 1000);
        expect(expiresAt).toBeLessThanOrEqual(Date.now() + 20 * MINUTE + 1000);

        const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${body.token}`);
        expect(me.status).toBe(200);
        expect(me.body).toMatchObject({ id: body.id, isDemo: true, demoWordLimit: SEED_COUNTS.words + 30, demoTagLimit: SEED_COUNTS.tags + 5 });
        expect(me.body.password).toBeUndefined();
    });

    it('stores no password, records the Terms, and puts the English label first when no language is sent', async () => {
        const res = await start({ uiLanguage: 'en' }); // a code, not a label: ignored
        const row = await userRow(res.body.id);
        expect(row.password).toBeNull();
        expect(row.termsVersion).toBe(TERMS_VERSION);
        expect(row.termsAcceptedAt).toBeInstanceOf(Date);
        expect(row.uiLanguage).toBe('English');
        expect(row.languages).toEqual(['English', 'Spanish', 'German', 'Estonian']);
        expect(row.theme).toBeNull();
    });

    it('copies the template: its words, Private tags and saved configs', async () => {
        const { id } = (await start()).body;
        expect(await countFor(words, words.userId, id)).toBe(SEED_COUNTS.words);
        const seededTags = await db.select().from(tags).where(eq(tags.authorId, id));
        expect(seededTags).toHaveLength(SEED_COUNTS.tags);
        expect(seededTags.every((t) => t.visibility === 'Private')).toBe(true);
        expect(await countFor(practiceConfigs, practiceConfigs.userId, id)).toBe(template.practiceConfigs.length);

        // The app's own word list shows the seed with all four languages.
        const { token } = (await start()).body;
        const list = await request(app).get('/api/words/simple?page=1&limit=50').set('Authorization', `Bearer ${token}`);
        expect(list.status).toBe(200);
        expect(list.body.total).toBe(SEED_COUNTS.words);
    });


    it('freezes the duration and the caps on the row: a later change does not move a running demo', async () => {
        const { id } = (await start()).body;
        const before = await userRow(id);
        await setDemo({ durationMinutes: 60, maxWords: 1, maxTags: 1 });
        const after = await userRow(id);
        expect(after.demoExpiresAt).toEqual(before.demoExpiresAt);
        expect(after.demoWordLimit).toBe(SEED_COUNTS.words + 30);
        expect(after.demoTagLimit).toBe(SEED_COUNTS.tags + 5);
    });
});

describe('POST /api/demo — limits', () => {
    beforeEach(() => setDemo({}));

    it('limits starts per IP (DEMO_STARTS_PER_IP), and each IP has its own count', async () => {
        process.env.DEMO_STARTS_PER_IP = '2';
        const ip = freshIp();
        expect((await start({}, ip)).status).toBe(201);
        expect((await start({}, ip)).status).toBe(201);
        const third = await start({}, ip);
        expect(third.status).toBe(429);
        expect(third.body.code).toBe('demo_rate_limited');
        expect((await start({}, freshIp())).status).toBe(201);
        expect(await accounts()).toHaveLength(3);
    });

    it('defaults to 5 starts per IP in one hour, and opens again after the hour', () => {
        const now = Date.now();
        for (let i = 0; i < 5; i += 1) expect(takeDemoStart('198.51.100.1', now)).toBe(true);
        expect(takeDemoStart('198.51.100.1', now + 59 * MINUTE)).toBe(false);
        expect(takeDemoStart('198.51.100.1', now + 60 * MINUTE)).toBe(true);
    });

    it('refuses with demo_busy at the live cap; expired demos and the template do not count', async () => {
        await setDemo({ maxLive: 2 });
        await db.insert(users).values([
            { name: 'Old', email: 'old@ladu.invalid', username: 'old-demo', languages: ['English', 'Spanish'], isDemo: true, demoExpiresAt: new Date(Date.now() - MINUTE) },
        ]);
        expect((await start()).status).toBe(201);
        expect((await start()).status).toBe(201);
        const third = await start();
        expect(third.status).toBe(503);
        expect(third.body.code).toBe('demo_busy');
        // The old demo, the template (seeded in beforeEach) and the two new demos.
        expect((await db.select().from(users).where(eq(users.isDemo, true))).length).toBe(4);
    });

    it('never passes the live cap with parallel starts', async () => {
        await setDemo({ maxLive: 3 });
        const answers = await Promise.all(Array.from({ length: 8 }, () => start()));
        expect(answers.filter((r) => r.status === 201)).toHaveLength(3);
        expect(answers.filter((r) => r.status === 503)).toHaveLength(5);
    });
});

describe('the demo session in protect', () => {
    beforeEach(() => setDemo({}));

    it('refuses the token with 401 once the demo has expired', async () => {
        const { id, token } = (await start()).body;
        const me = () => request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
        expect((await me()).status).toBe(200);

        await db.update(users).set({ demoExpiresAt: new Date(Date.now() - 1000) }).where(eq(users.id, id));
        expect((await me()).status).toBe(401);
        expect((await request(app).get('/api/words/simple?page=1&limit=50').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    });

    it('records no activity for a demo user (no last_seen_at, no active day)', async () => {
        const { id, token } = (await start()).body;
        await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
        expect((await userRow(id)).lastSeenAt).toBeNull();
        expect(await db.select().from(userActivityDays).where(eq(userActivityDays.userId, id))).toHaveLength(0);
    });
});

describe('the demo fields on the user answers', () => {
    it('a normal login answers isDemo false and no demo values', async () => {
        await db.insert(users).values({
            name: 'L', email: 'l@example.com', username: 'l', password: await bcrypt.hash('x-password-1', 4), languages: ['English', 'Spanish'], verified: true,
        });
        const res = await request(app).post('/api/users/login').send({ email: 'l@example.com', password: 'x-password-1' });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ isDemo: false, demoExpiresAt: null, demoWordLimit: null, demoTagLimit: null });
    });

    it('a profile save by a demo keeps the demo fields in the answer (the app stores it as the session)', async () => {
        await setDemo({});
        const { email, token, demoExpiresAt } = (await start()).body;
        const res = await request(app).put('/api/users/updateUser').set('Authorization', `Bearer ${token}`).send({ email, theme: 'dark' });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ isDemo: true, demoExpiresAt, theme: 'dark' });
    });

    it('searchUser does not show the demo fields of other users', async () => {
        await db.insert(users).values({
            name: 'Finder', email: 'f@example.com', username: 'finder', password: await bcrypt.hash('x-password-1', 4), languages: ['English', 'Spanish'], verified: true,
        });
        await db.insert(users).values({ name: 'Other', email: 'o@example.com', username: 'other', languages: ['English', 'Spanish'], verified: true });
        const { token } = (await request(app).post('/api/users/login').send({ email: 'f@example.com', password: 'x-password-1' })).body;
        const res = await request(app).get('/api/users/searchUser?nameOrUsernameMatch=Other').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.map((u) => u.username)).toContain('other');
        for (const found of res.body) expect(found).not.toHaveProperty('isDemo');
    });
});
