/**
 * GET /api/users/getUserMetrics — Integration Tests
 *
 * Phase 3.5 Slice 1: `calculateBasicUserMetrics` (metricController.ts) had zero
 * Jest coverage before this file — the handler itself is untouched here. Covers
 * the six `BasicUserMetrics` fields, fresh-account zeros, per-user isolation,
 * `incompleteWordsCount`'s language-set semantics (including the always-0 case
 * when the account has no configured languages), and `wordsPerMonth`'s
 * "YYYY-MM" bucketing against a backdated `words.created_at`.
 */

const request = require('supertest');
const app = require('../app');
const testDb = require('./db');
const { pool, db } = require('../src/db');
const { users, words } = require('../src/db/schema');
const { eq } = require('drizzle-orm');

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const registerAndLogin = async (overrides = {}) => {
    const body = {
        name: 'User',
        email: 'user@test.com',
        username: 'user',
        password: 'password123',
        languages: ['English', 'Spanish'],
        ...overrides,
    };
    await request(app).post('/api/users').send(body);
    const loginRes = await request(app)
        .post('/api/users/login')
        .send({ email: body.email, password: body.password });
    return loginRes.body;
};

const t = (language, word, caseName) => ({ language, cases: [{ word, caseName }] });

const wordPayload = (overrides = {}) => ({
    partOfSpeech: 'Verb',
    translations: [t('English', 'run', 'simplePresent1sEN'), t('Spanish', 'correr', 'infinitiveNonFiniteSimpleES')],
    clue: null,
    tags: [],
    ...overrides,
});

const create = (token, overrides) =>
    request(app).post('/api/words').set('Authorization', `Bearer ${token}`).send(wordPayload(overrides));

const getMetrics = (token) =>
    request(app).get('/api/users/getUserMetrics').set('Authorization', `Bearer ${token}`);

// ===========================================================================
// Auth
// ===========================================================================
describe('GET /api/users/getUserMetrics - auth', () => {
    it('401s without a token', async () => {
        const res = await request(app).get('/api/users/getUserMetrics');
        expect(res.status).toBe(401);
    });
});

// ===========================================================================
// Fresh account
// ===========================================================================
describe('GET /api/users/getUserMetrics - fresh account', () => {
    it('returns all-zero / empty-array metrics for an account with no words', async () => {
        const { token } = await registerAndLogin();

        const res = await getMetrics(token);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            totalWords: 0,
            incompleteWordsCount: 0,
            translationsPerLanguage: [],
            translationsPerLanguageAndPOS: [],
            wordsPerPOS: [],
            wordsPerMonth: [],
        });
    });

    it('returns 0 incomplete words for an account with no configured languages, even with words', async () => {
        // Both register and updateUser enforce >= 2 languages, so there is no
        // API path to a zero-language account — seed the row directly to
        // exercise metricController.ts's own empty-languages branch (:139).
        const { token, id } = await registerAndLogin();
        await db.update(users).set({ languages: [] }).where(eq(users.id, id));
        await create(token);

        const res = await getMetrics(token);

        expect(res.status).toBe(200);
        expect(res.body.totalWords).toBe(1);
        expect(res.body.incompleteWordsCount).toBe(0);
    });
});

// ===========================================================================
// The six fields, against a known fixture set
// ===========================================================================
describe('GET /api/users/getUserMetrics - populated account', () => {
    let token;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;

        // 2 verbs (EN+ES), 1 noun (EN+ES) — all complete for languages ['English','Spanish'].
        await create(token, { partOfSpeech: 'Verb' });
        await create(token, { partOfSpeech: 'Verb' });
        await create(
            token,
            wordPayload({
                partOfSpeech: 'Noun',
                translations: [t('English', 'cat', 'singularEN'), t('Spanish', 'gato', 'singularES')],
            }),
        );
        // One incomplete word: English + German — 2 translations (satisfies the
        // create-time minimum) but still missing the account's Spanish.
        await create(
            token,
            wordPayload({
                partOfSpeech: 'Noun',
                translations: [t('English', 'dog', 'singularEN'), t('German', 'Hund', 'singularNominativDE')],
            }),
        );
    });

    it('totalWords counts every word owned by the user', async () => {
        const res = await getMetrics(token);
        expect(res.body.totalWords).toBe(4);
    });

    it('wordsPerPOS groups by part of speech with the literal "partOfSpeech" type', async () => {
        const res = await getMetrics(token);
        const byPos = Object.fromEntries(res.body.wordsPerPOS.map((r) => [r.partOfSpeech, r.count]));
        expect(byPos).toEqual({ Verb: 2, Noun: 2 });
        for (const row of res.body.wordsPerPOS) {
            expect(row.type).toBe('partOfSpeech');
        }
    });

    it('translationsPerLanguage counts translation rows, keyed by "language"', async () => {
        const res = await getMetrics(token);
        const byLang = Object.fromEntries(res.body.translationsPerLanguage.map((r) => [r.language, r.count]));
        // English on all 4 words; Spanish on 3 (not the German+English "dog" word); German on 1.
        expect(byLang).toEqual({ English: 4, Spanish: 3, German: 1 });
        for (const row of res.body.translationsPerLanguage) {
            expect(row.type).toBe('language');
        }
    });

    it('translationsPerLanguageAndPOS keys the language value under "label", not "language"', async () => {
        const res = await getMetrics(token);
        expect(res.body.translationsPerLanguageAndPOS.length).toBeGreaterThan(0);
        for (const row of res.body.translationsPerLanguageAndPOS) {
            expect(row).toHaveProperty('label');
            expect(row).not.toHaveProperty('language');
            expect(row.type).toBe('language');
            expect(typeof row.partOfSpeech).toBe('string');
            expect(typeof row.count).toBe('number');
        }
        const englishVerbRow = res.body.translationsPerLanguageAndPOS.find(
            (r) => r.label === 'English' && r.partOfSpeech === 'Verb',
        );
        expect(englishVerbRow?.count).toBe(2);
    });

    it('incompleteWordsCount flags the word missing a configured language', async () => {
        const res = await getMetrics(token);
        expect(res.body.incompleteWordsCount).toBe(1);
    });
});

// ===========================================================================
// wordsPerMonth bucketing
// ===========================================================================
describe('GET /api/users/getUserMetrics - wordsPerMonth', () => {
    it('buckets by "YYYY-MM" using words.created_at, split further by partOfSpeech', async () => {
        const { token } = await registerAndLogin();

        const augustWord = await create(token, { partOfSpeech: 'Verb' });
        const septemberVerb = await create(token, { partOfSpeech: 'Verb' });
        const septemberNoun = await create(
            token,
            wordPayload({
                partOfSpeech: 'Noun',
                translations: [t('English', 'cat', 'singularEN'), t('Spanish', 'gato', 'singularES')],
            }),
        );

        // Backdate the first word into August; leave the other two as "now" (September in this fixture's telling).
        await db
            .update(words)
            .set({ createdAt: new Date('2026-08-15T12:00:00Z') })
            .where(eq(words.id, augustWord.body.id));
        const septemberDate = new Date('2026-09-15T12:00:00Z');
        await db
            .update(words)
            .set({ createdAt: septemberDate })
            .where(eq(words.id, septemberVerb.body.id));
        await db
            .update(words)
            .set({ createdAt: septemberDate })
            .where(eq(words.id, septemberNoun.body.id));

        const res = await getMetrics(token);

        expect(res.body.wordsPerMonth).toEqual(
            expect.arrayContaining([
                { label: '2026-08', partOfSpeech: 'Verb', count: 1 },
                { label: '2026-09', partOfSpeech: 'Verb', count: 1 },
                { label: '2026-09', partOfSpeech: 'Noun', count: 1 },
            ]),
        );
        expect(res.body.wordsPerMonth).toHaveLength(3);
    });
});

// ===========================================================================
// Per-user isolation
// ===========================================================================
describe('GET /api/users/getUserMetrics - per-user isolation', () => {
    it("does not mix one user's words into another's metrics", async () => {
        const userA = await registerAndLogin({ email: 'a@test.com', username: 'usera' });
        const userB = await registerAndLogin({ email: 'b@test.com', username: 'userb' });

        await create(userA.token);
        await create(userA.token);
        await create(userB.token);

        const [resA, resB] = await Promise.all([getMetrics(userA.token), getMetrics(userB.token)]);

        expect(resA.body.totalWords).toBe(2);
        expect(resB.body.totalWords).toBe(1);
    });
});
