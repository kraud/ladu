// Demo access, Slice 5: the demo start log, the refusal counter, the purge's final counts, and the
// admin endpoints for the demo users table and the usage banner (demo-access.md D19, D20).
const request = require('./request');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, words, tags, practiceConfigs, exercisePerformances, demoStarts, demoRefusals } = require('../src/db/schema');
const { resetDemoStartLimiter } = require('../lib/demo');
const { seedDemoTemplate, loadTemplateData } = require('../lib/demoTemplate');
const { recordDemoRefusal } = require('../lib/demoStats');
const { runPurge } = require('../lib/userPurge');
const { createStaff } = require('../lib/staffAccounts');

const template = loadTemplateData();
const SEED = { words: template.words.length, tags: template.tags.length, configs: template.practiceConfigs.length };
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    resetDemoStartLimiter();
    process.env.DEMO_STARTS_PER_IP = '100';
    await seedDemoTemplate();
    await setDemo({});
});
afterAll(async () => {
    delete process.env.DEMO_STARTS_PER_IP;
    await testDb.closeDB();
    await pool.end();
});

const setDemo = ({ enabled = true, maxWords = 30, maxTags = 5, maxLive = 200 }) =>
    pool.query(`UPDATE access_settings SET demo_enabled = $1, demo_max_words = $2, demo_max_tags = $3, demo_max_live = $4 WHERE id = 1`, [
        enabled,
        maxWords,
        maxTags,
        maxLive,
    ]);

const startDemo = async (body = { uiLanguage: 'German', languages: ['German', 'English'] }) => {
    const res = await request(app).post('/api/demo').send(body);
    expect(res.status).toBe(201);
    return res.body;
};
const expire = (id) => db.update(users).set({ demoExpiresAt: new Date(Date.now() - 1000) }).where(eq(users.id, id));
const startRow = async (userId) => (await db.select().from(demoStarts).where(eq(demoStarts.userId, userId)))[0];

/** What a visitor does in a demo, written straight to the DB: n words, n tags, n configs, n answers. */
const act = async (userId, { words: w = 0, tags: t = 0, configs: c = 0, answers = 0 }) => {
    for (let i = 0; i < w; i++) await db.insert(words).values({ userId, partOfSpeech: 'Noun' });
    for (let i = 0; i < t; i++) await db.insert(tags).values({ authorId: userId, label: `Mine ${i}`, visibility: 'Private' });
    for (let i = 0; i < c; i++) {
        const [first] = await db.select().from(practiceConfigs).where(eq(practiceConfigs.userId, userId));
        await db.insert(practiceConfigs).values({ userId, name: `Mine ${i}`, params: first.params });
    }
    // An answer sets `last_date_modified_translation` to now on the practised translation's row.
    const rows = await db.select().from(exercisePerformances).where(eq(exercisePerformances.userId, userId));
    for (const row of rows.slice(0, answers)) {
        await db.update(exercisePerformances).set({ lastDateModifiedTranslation: new Date() }).where(eq(exercisePerformances.id, row.id));
    }
};

const ownerToken = async () => {
    await createStaff({ email: 'owner@example.com', name: 'Owner', password: 'correct-horse-battery', role: 'owner' });
    return (await request(app).post('/api/admin/auth/login').send({ email: 'owner@example.com', password: 'correct-horse-battery' })).body.token;
};
const adminGet = (token, path) => request(app).get(`/api/admin/access/demo/${path}`).set('Authorization', `Bearer ${token}`);

describe('the start log (D19)', () => {
    it('writes one row per start: the time, the languages, the seed counts and the frozen limits', async () => {
        await setDemo({ maxWords: 12, maxTags: 3 });
        const demo = await startDemo({ uiLanguage: 'Spanish', languages: ['Estonian', 'Spanish'] });
        const row = await startRow(demo.id);
        expect(row).toMatchObject({
            uiLanguage: 'Spanish',
            languages: ['Estonian', 'Spanish'],
            seedWords: SEED.words,
            seedTags: SEED.tags,
            seedConfigs: SEED.configs,
            wordLimit: SEED.words + 12,
            tagLimit: SEED.tags + 3,
            wordsAdded: null,
            closedAt: null,
        });
        expect(row.expiresAt).toEqual(new Date(demo.demoExpiresAt));
    });

    it('writes no row for a refused start', async () => {
        await setDemo({ enabled: false });
        expect((await request(app).post('/api/demo').send({})).status).toBe(403);
        expect(await db.select().from(demoStarts)).toHaveLength(0);
    });
});

describe('the refusal counter (D20)', () => {
    const counters = () => db.select().from(demoRefusals);

    it('counts each refused start per UTC day and code, in one row', async () => {
        await setDemo({ enabled: false });
        await request(app).post('/api/demo').send({});
        await request(app).post('/api/demo').send({});
        await setDemo({ maxLive: 1 });
        await startDemo();
        expect((await request(app).post('/api/demo').send({})).body.code).toBe('demo_busy');

        const today = new Date().toISOString().slice(0, 10);
        const rows = await counters();
        expect(rows).toHaveLength(2);
        expect(rows).toEqual(
            expect.arrayContaining([
                { day: today, code: 'demo_disabled', count: 2 },
                { day: today, code: 'demo_busy', count: 1 },
            ]),
        );
    });

    it('counts the per-IP refusal, but not a bad language choice', async () => {
        process.env.DEMO_STARTS_PER_IP = '1';
        await startDemo();
        expect((await request(app).post('/api/demo').send({})).body.code).toBe('demo_rate_limited');
        expect((await request(app).post('/api/demo').send({ languages: ['English'] })).body.code).toBe('demo_invalid_languages');
        expect(await counters()).toEqual([{ day: new Date().toISOString().slice(0, 10), code: 'demo_rate_limited', count: 1 }]);
    });

    it('counts a start refused for a missing template as demo_unavailable', async () => {
        await pool.query(`DELETE FROM users WHERE username = '__demo_template__'`);
        expect((await request(app).post('/api/demo').send({})).body.code).toBe('demo_unavailable');
        expect((await counters()).map((r) => r.code)).toEqual(['demo_unavailable']);
    });
});

describe('the purge closes the start rows', () => {
    it('writes the final counts of an expired demo, keeps the row without the user, and leaves a live demo open', async () => {
        const ended = await startDemo();
        const live = await startDemo();
        await act(ended.id, { words: 2, tags: 1, configs: 1, answers: 3 });
        await expire(ended.id);

        expect((await runPurge()).purgedDemos).toBe(1);

        const rows = await db.select().from(demoStarts);
        expect(rows).toHaveLength(2);
        const closed = rows.find((r) => r.userId === null);
        expect(closed).toMatchObject({ wordsAdded: 2, tagsAdded: 1, configsAdded: 1, translationsPractised: 3 });
        expect(closed.closedAt).toBeInstanceOf(Date);
        expect(await startRow(live.id)).toMatchObject({ wordsAdded: null, closedAt: null });
    });

    it('counts a deleted seed word as no word added (never below 0), and no seed practice as practised', async () => {
        const demo = await startDemo();
        const [seedWord] = await db.select().from(words).where(eq(words.userId, demo.id));
        await db.delete(words).where(eq(words.id, seedWord.id));
        await expire(demo.id);
        await runPurge();
        expect((await db.select().from(demoStarts))[0]).toMatchObject({ wordsAdded: 0, translationsPractised: 0 });
    });
});

describe('GET /api/admin/access/demo/users (D19)', () => {
    it('lists the demos on the DB, live and expired, newest first, with what each one added', async () => {
        await setDemo({ maxWords: 10, maxTags: 2 });
        const older = await startDemo({ uiLanguage: 'English', languages: ['English', 'Spanish'] });
        const newer = await startDemo({ uiLanguage: 'German', languages: ['German', 'Estonian'] });
        await act(newer.id, { words: 3, tags: 2, answers: 1 });
        await expire(older.id);
        // A normal user is not listed (the template is not either).
        await db.insert(users).values({ name: 'Real', email: 'r@example.com', username: 'real', languages: ['English', 'Spanish'] });

        const res = await adminGet(await ownerToken(), 'users');
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(2);
        expect(res.body.rows.map((r) => r.id)).toEqual([newer.id, older.id]);
        expect(res.body.rows[0]).toMatchObject({
            status: 'live',
            languages: ['German', 'Estonian'],
            uiLanguage: 'German',
            wordsAdded: 3,
            tagsAdded: 2,
            configsAdded: 0,
            translationsPractised: 1,
            maxWords: 10,
            maxTags: 2,
            expiresAt: newer.demoExpiresAt,
        });
        expect(res.body.rows[1]).toMatchObject({ status: 'expired', wordsAdded: 0, translationsPractised: 0 });
    });

    it('shows a demo that has no start row (started before the log) with empty counts', async () => {
        const demo = await startDemo();
        await db.delete(demoStarts).where(eq(demoStarts.userId, demo.id));
        const res = await adminGet(await ownerToken(), 'users');
        expect(res.body.rows[0]).toMatchObject({ id: demo.id, status: 'live', wordsAdded: null, maxWords: null });
    });

    it('is for the owner only', async () => {
        await createStaff({ email: 'admin@example.com', name: 'Admin', password: 'correct-horse-battery', role: 'admin' });
        const token = (await request(app).post('/api/admin/auth/login').send({ email: 'admin@example.com', password: 'correct-horse-battery' })).body.token;
        expect((await adminGet(token, 'users')).status).toBe(403);
        expect((await adminGet(token, 'stats')).status).toBe(403);
        expect((await request(app).get('/api/admin/access/demo/stats')).status).toBe(401);
    });
});

describe('GET /api/admin/access/demo/stats (D20)', () => {
    /** A closed start row from the past, as the purge leaves it. */
    const pastStart = (daysAgo, values = {}) =>
        db.insert(demoStarts).values({
            userId: null,
            startedAt: new Date(Date.now() - daysAgo * DAY),
            expiresAt: new Date(Date.now() - daysAgo * DAY + 15 * MINUTE),
            uiLanguage: 'English',
            languages: ['English', 'Spanish'],
            seedWords: SEED.words,
            seedTags: SEED.tags,
            seedConfigs: SEED.configs,
            wordLimit: SEED.words + 2,
            tagLimit: SEED.tags + 1,
            wordsAdded: 0,
            tagsAdded: 0,
            configsAdded: 0,
            translationsPractised: 0,
            closedAt: new Date(Date.now() - daysAgo * DAY + DAY),
            ...values,
        });

    it('counts the starts per window, and the demos running now', async () => {
        await pastStart(3);
        await pastStart(20);
        await pastStart(45);
        await startDemo();
        const res = await adminGet(await ownerToken(), 'stats');
        expect(res.status).toBe(200);
        expect(res.body.starts).toEqual({ last24h: 1, last7d: 2, last30d: 3, total: 4 });
        expect(res.body.runningNow).toBe(1);
    });

    it('averages what demos of the last 30 days added, closed ones with the ones still on the DB', async () => {
        await pastStart(2, { wordsAdded: 2, tagsAdded: 1, translationsPractised: 4, uiLanguage: 'Spanish', languages: ['Spanish', 'German'] });
        await pastStart(5, { wordsAdded: 0, tagsAdded: 0, translationsPractised: 0 });
        await pastStart(40, { wordsAdded: 50 }); // outside the window
        // A start row whose user was deleted another way before the purge: no counts, left out.
        await pastStart(1, { wordsAdded: null, closedAt: null });
        await setDemo({ maxWords: 1, maxTags: 0 });
        const live = await startDemo({ uiLanguage: 'German', languages: ['German', 'Estonian'] });
        await act(live.id, { words: 1, answers: 2 });

        const { body } = await adminGet(await ownerToken(), 'stats');
        expect(body.windowDays).toBe(30);
        // Three demos with counts: words 2 + 0 + 1, tags 1 + 0 + 0, practised 4 + 0 + 2.
        expect(body.engagement).toEqual({ demos: 3, avgWordsAdded: 1, avgTagsAdded: 0.3, avgTranslationsPractised: 2, addedAWord: 2 });
        // Word caps: 2, 2 and 1 (all above 0), reached by the first (2 of 2) and the live one (1 of 1).
        // Tag caps: 1, 1 and 0: the live demo has none, so 2 demos, reached by the first (1 of 1).
        expect(body.caps).toEqual({ wordCapDemos: 3, reachedWordCap: 2, tagCapDemos: 2, reachedTagCap: 1 });
        // Every start of the window counts here, also the one with no counts. Most first, then A to Z.
        expect(body.languages).toEqual([
            { language: 'Spanish', count: 3 },
            { language: 'English', count: 2 },
            { language: 'German', count: 2 },
            { language: 'Estonian', count: 1 },
        ]);
        expect(body.uiLanguages).toEqual([
            { language: 'English', count: 2 },
            { language: 'German', count: 1 },
            { language: 'Spanish', count: 1 },
        ]);
    });

    it('sums the refusals of the last 7 days by code', async () => {
        const daysAgo = (n) => new Date(Date.now() - n * DAY);
        await recordDemoRefusal('demo_busy', daysAgo(0));
        await recordDemoRefusal('demo_busy', daysAgo(6));
        await recordDemoRefusal('demo_rate_limited', daysAgo(2));
        await recordDemoRefusal('demo_busy', daysAgo(7)); // outside the window
        const { body } = await adminGet(await ownerToken(), 'stats');
        expect(body.refusalWindowDays).toBe(7);
        expect(body.refusals).toEqual({ demo_disabled: 0, demo_rate_limited: 1, demo_busy: 2, demo_unavailable: 0, captcha_failed: 0 });
    });

    it('answers with zeros when there is no demo yet', async () => {
        const { body } = await adminGet(await ownerToken(), 'stats');
        expect(body.starts).toEqual({ last24h: 0, last7d: 0, last30d: 0, total: 0 });
        expect(body.engagement).toEqual({ demos: 0, avgWordsAdded: 0, avgTagsAdded: 0, avgTranslationsPractised: 0, addedAWord: 0 });
        expect(body.languages).toEqual([]);
    });
});
