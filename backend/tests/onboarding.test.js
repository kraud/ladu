/**
 * First-login onboarding routes: POST /api/onboarding/capacity, POST /api/onboarding,
 * POST /api/onboarding/skip. Plan: .context/plans/onboarding.md, Slice 3d (D6, D18, D21, D23, D25).
 * Most tests use the committed pool; the capacity edge cases use a small synthetic pool.
 */
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const { eq, inArray } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, words, translations, translationCases, tags, tagWords } = require('../src/db/schema');
const { generateToken } = require('../controllers/userController');
const { setOnboardingData } = require('../services/onboardingService');

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    setOnboardingData(null);
});
afterAll(async () => {
    setOnboardingData(null);
    await testDb.closeDB();
    await pool.end();
});

/** A new account (status `pending`), native English, learning Spanish; returns { id, token }. */
const newUser = async (overrides = {}) => {
    await request(app).post('/api/users').send({
        name: 'Ona', email: 'ona@example.com', username: 'ona', password: 'pass123', languages: ['English', 'Spanish'],
    });
    await db.update(users).set({ nativeLanguage: 'English', ...overrides }).where(eq(users.email, 'ona@example.com'));
    const login = await request(app).post('/api/users/login').send({ email: 'ona@example.com', password: 'pass123' });
    return login.body;
};
const auth = (user) => ({ Authorization: `Bearer ${user.token}` });
const statusOf = async (id) => (await db.select({ s: users.onboardingStatus }).from(users).where(eq(users.id, id)))[0].s;

const choice = { levels: { Spanish: 'beginner' }, topics: ['food_drink', 'animals', 'feelings'] };

describe('access', () => {
    it('needs a session', async () => {
        expect((await request(app).post('/api/onboarding/capacity').send(choice)).statusCode).toBe(401);
    });

    it('answers 409 to an account that is not pending (older accounts: NULL)', async () => {
        const user = await newUser({ onboardingStatus: null });
        for (const path of ['/api/onboarding/capacity', '/api/onboarding', '/api/onboarding/skip']) {
            const res = await request(app).post(path).set(auth(user)).send({ ...choice, count: 50 });
            expect(res.statusCode).toBe(409);
            expect(res.body.code).toBe('onboarding_not_pending');
        }
    });

    it('refuses a demo account (403)', async () => {
        const [demo] = await db.insert(users).values({
            name: 'Demo', email: 'demo@example.com', username: 'demo-x', password: null, languages: ['English', 'Spanish'],
            isDemo: true, demoExpiresAt: new Date(Date.now() + 60_000), onboardingStatus: 'pending',
        }).returning();
        const res = await request(app).post('/api/onboarding/capacity').set({ Authorization: `Bearer ${generateToken(demo)}` }).send(choice);
        expect(res.statusCode).toBe(403);
    });
});

describe('POST /api/onboarding/capacity', () => {
    it('answers the slider maximum: a multiple of 10, at most 150', async () => {
        const user = await newUser();
        const res = await request(app).post('/api/onboarding/capacity').set(auth(user)).send(choice);
        expect(res.statusCode).toBe(200);
        expect(res.body.capacity % 10).toBe(0);
        expect(res.body.capacity).toBeGreaterThanOrEqual(50);
        expect(res.body.capacity).toBeLessThanOrEqual(150);
    });

    it('validates against the account: a level for each learning language, 3–6 topics', async () => {
        const user = await newUser();
        const noLevel = await request(app).post('/api/onboarding/capacity').set(auth(user)).send({ ...choice, levels: {} });
        expect(noLevel.statusCode).toBe(400);
        expect(noLevel.body.code).toBe('invalid_levels');
        const twoTopics = await request(app).post('/api/onboarding/capacity').set(auth(user)).send({ ...choice, topics: ['animals', 'weather'] });
        expect(twoTopics.body.code).toBe('invalid_topics');
    });
});

describe('POST /api/onboarding', () => {
    it('creates the words with their translations and cases, one tag per topic + core, and closes the onboarding', async () => {
        const user = await newUser();
        const res = await request(app).post('/api/onboarding').set(auth(user)).send({ ...choice, count: 50 });
        expect(res.statusCode).toBe(201);
        expect(res.body.words).toBe(50);
        expect(res.body.tags.map((t) => [t.topic, t.label])).toEqual([
            ['food_drink', 'Food & drink'], ['animals', 'Animals'], ['feelings', 'Feelings'], ['core', 'Core vocabulary'],
        ]);
        expect(res.body.tags.reduce((sum, t) => sum + t.words, 0)).toBe(50);

        const created = await db.select().from(words).where(eq(words.userId, user.id));
        expect(created).toHaveLength(50);
        const wordIds = created.map((w) => w.id);
        const rows = await db.select().from(translations).where(inArray(translations.wordId, wordIds));
        expect(rows).toHaveLength(100); // English + Spanish for each word
        const cases = await db.select().from(translationCases).where(inArray(translationCases.translationId, rows.map((r) => r.id)));
        expect(new Set(cases.map((c) => c.translationId)).size).toBe(100);
        const links = await db.select().from(tagWords).where(inArray(tagWords.wordId, wordIds));
        expect(links).toHaveLength(50);
        const tagRows = await db.select().from(tags).where(eq(tags.authorId, user.id));
        expect(tagRows.every((t) => t.visibility === 'Private')).toBe(true);
        expect(await statusOf(user.id)).toBe('done');

        // The words are normal words: the word list shows them.
        const list = await request(app).get('/api/words').set(auth(user));
        expect(list.statusCode).toBe(200);
    });

    it('names the tags in the UI language and avoids a label the user already has', async () => {
        const user = await newUser({ uiLanguage: 'Spanish' });
        await db.insert(tags).values({ authorId: user.id, label: 'animales', visibility: 'Private' });
        const res = await request(app).post('/api/onboarding').set(auth(user)).send({ ...choice, count: 50 });
        expect(res.statusCode).toBe(201);
        expect(res.body.tags.map((t) => t.label)).toEqual(['Comida y bebida', 'Animales (2)', 'Sentimientos', 'Vocabulario básico']);
    });

    it('capitalises German noun forms, as the word form does', async () => {
        const user = await newUser({ languages: ['English', 'German'] });
        const res = await request(app).post('/api/onboarding').set(auth(user)).send({ levels: { German: 'beginner' }, topics: choice.topics, count: 50 });
        expect(res.statusCode).toBe(201);
        const created = await db.select({ id: words.id }).from(words).where(eq(words.userId, user.id));
        const german = await db.select({ id: translations.id }).from(translations)
            .where(inArray(translations.wordId, created.map((w) => w.id)));
        const forms = await db.select().from(translationCases)
            .where(inArray(translationCases.translationId, german.map((g) => g.id)));
        const nominatives = forms.filter((c) => c.caseName === 'singularNominativDE');
        expect(nominatives.length).toBeGreaterThan(0);
        nominatives.forEach((c) => expect(c.word[0]).toBe(c.word[0].toUpperCase()));
    });

    it('handles the largest case: 150 words in 4 languages (the case rows go in chunks)', async () => {
        const user = await newUser({ languages: ['English', 'Spanish', 'German', 'Estonian'] });
        const levels = { Spanish: 'beginner', German: 'intermediate', Estonian: 'beginner' };
        const res = await request(app).post('/api/onboarding').set(auth(user)).send({ levels, topics: choice.topics, count: 150 });
        expect(res.statusCode).toBe(201);
        expect(res.body.words).toBe(150);
        const created = await db.select({ id: words.id }).from(words).where(eq(words.userId, user.id));
        const rows = await db.select({ id: translations.id }).from(translations).where(inArray(translations.wordId, created.map((w) => w.id)));
        const cases = await db.select({ id: translationCases.id }).from(translationCases).where(inArray(translationCases.translationId, rows.map((r) => r.id)));
        expect(cases.length).toBeGreaterThan(5000);
    });

    it('creates only once: a second request, or two at the same time, gets 409', async () => {
        const user = await newUser();
        const send = () => request(app).post('/api/onboarding').set(auth(user)).send({ ...choice, count: 50 });
        const statuses = (await Promise.all([send(), send()])).map((r) => r.statusCode).sort();
        expect(statuses).toEqual([201, 409]);
        expect((await send()).statusCode).toBe(409);
        expect(await db.select().from(words).where(eq(words.userId, user.id))).toHaveLength(50);
    });

    it('refuses a count outside 10–150 or not a step of 10', async () => {
        const user = await newUser();
        for (const count of [5, 55, 160]) {
            const res = await request(app).post('/api/onboarding').set(auth(user)).send({ ...choice, count });
            expect(res.body.code).toBe('invalid_count');
        }
        expect(await statusOf(user.id)).toBe('pending');
    });

    describe('with a small pool (capacity 40)', () => {
        const SMALL = 45;
        beforeEach(() => {
            const pool = Array.from({ length: SMALL }, (_, i) => ({
                status: 'keep', id: `noun:w${i}`, topic: ['food_drink', 'animals', 'feelings'][i % 3], band: 'beginner',
                partOfSpeech: 'Noun', rank: i + 1, sense: '', flags: [],
                words: { English: { word: `w${i}`, gender: null }, Spanish: { word: `p${i}`, gender: 'el' } },
            }));
            const forms = Object.fromEntries(pool.map((c) => [c.id, {
                English: { word: c.words.English.word, cases: { singularEN: c.words.English.word } },
                Spanish: { word: c.words.Spanish.word, cases: { genderES: 'el', singularES: c.words.Spanish.word } },
            }]));
            setOnboardingData({ pool, forms });
        });

        it('offers what is there (D25): capacity 40, a count up to it is accepted, more is not', async () => {
            const user = await newUser();
            const capacity = await request(app).post('/api/onboarding/capacity').set(auth(user)).send(choice);
            expect(capacity.body.capacity).toBe(40);

            const over = await request(app).post('/api/onboarding').set(auth(user)).send({ ...choice, count: 50 });
            expect(over.statusCode).toBe(400);
            expect(over.body.code).toBe('count_over_capacity');

            const ok = await request(app).post('/api/onboarding').set(auth(user)).send({ ...choice, count: 30 });
            expect(ok.statusCode).toBe(201);
            expect(ok.body.words).toBe(30);
        });
    });
});

describe('POST /api/onboarding/skip', () => {
    it('closes the onboarding with nothing created (D6); the login answer then says skipped', async () => {
        const user = await newUser();
        const res = await request(app).post('/api/onboarding/skip').set(auth(user));
        expect(res.statusCode).toBe(200);
        expect(res.body.onboardingStatus).toBe('skipped');
        expect(await statusOf(user.id)).toBe('skipped');
        expect(await db.select().from(words).where(eq(words.userId, user.id))).toHaveLength(0);

        const login = await request(app).post('/api/users/login').send({ email: 'ona@example.com', password: 'pass123' });
        expect(login.body.onboardingStatus).toBe('skipped');
        expect((await request(app).post('/api/onboarding').set(auth(user)).send({ ...choice, count: 50 })).statusCode).toBe(409);
    });
});
