/**
 * GET /api/users/getUserMetrics — Integration Tests
 *
 * Phase 3.5 Slice 1: `calculateBasicUserMetrics` (metricController.ts) had zero
 * Jest coverage before this file — the handler itself is untouched here. Covers
 * the six `BasicUserMetrics` fields, fresh-account zeros, per-user isolation,
 * the practice coverage (`unpracticedWordsCount`, `translationsInPractice`, `practicedTranslations`:
 * own and followed words, a case counts as practiced with at least one answer),
 * and `wordsPerMonth`'s "YYYY-MM" bucketing against a backdated `words.created_at`.
 */

// Must run before `require('../app')` below — see auth.test.js's comment on
// this same pattern for why (this file isn't Babel/ts-jest transformed, so
// jest.mock hoisting never applies to it).
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('./request');
const app = require('../app');
const testDb = require('./db');
const { pool, db } = require('../src/db');
const { exercisePerformances, exercisePerformanceCases, translations, translationCases, words } = require('../src/db/schema');
const { and, eq } = require('drizzle-orm');

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

const auth = (token) => ({ Authorization: `Bearer ${token}` });

/**
 * Records answers on one case of a word, the way the practice engine stores them: one
 * `exercise_performances` row per translation, one `exercise_performance_cases` row per case.
 */
const practice = async (userId, wordId, language, caseName, record = [true]) => {
    const [translation] = await db.select().from(translations).where(and(eq(translations.wordId, wordId), eq(translations.language, language)));
    const [performance] = await db
        .insert(exercisePerformances)
        .values({ userId, wordId, translationId: translation.id, translationLanguage: language })
        .onConflictDoNothing()
        .returning();
    const exercisePerformanceId = performance?.id
        ?? (await db.select().from(exercisePerformances).where(and(eq(exercisePerformances.userId, userId), eq(exercisePerformances.translationId, translation.id))))[0].id;
    await db.insert(exercisePerformanceCases).values({ exercisePerformanceId, caseName, record });
};

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
            totalTags: 0,
            unpracticedWordsCount: 0,
            translationsInPractice: 0,
            practicedTranslations: 0,
            translationsPerLanguage: [],
            translationsPerLanguageAndPOS: [],
            wordsPerPOS: [],
            wordsPerMonth: [],
        });
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

    it('with no practice: every word is unpracticed, no translation is practiced, and every translation counts', async () => {
        const res = await getMetrics(token);
        expect(res.body.unpracticedWordsCount).toBe(4);
        expect(res.body.translationsInPractice).toBe(8); // 4 words x 2 translations
        expect(res.body.practicedTranslations).toBe(0);
        expect(res.body).not.toHaveProperty('incompleteWordsCount');
    });

    it('a word is practiced once one of its cases has an answer; only that translation counts as practiced', async () => {
        const [{ id: wordId, userId }] = await db.select().from(words).limit(1);
        await practice(userId, wordId, 'English', (await db.select().from(translationCases).innerJoin(translations, eq(translationCases.translationId, translations.id)).where(and(eq(translations.wordId, wordId), eq(translations.language, 'English'))))[0].translation_cases.caseName);

        const res = await getMetrics(token);
        expect(res.body.unpracticedWordsCount).toBe(3);
        expect(res.body.translationsInPractice).toBe(8);
        expect(res.body.practicedTranslations).toBe(1);
    });

    it('a translation counts once, however many of its cases are practiced; each practiced language counts', async () => {
        const [{ id: wordId, userId }] = await db.select().from(words).limit(1);
        const rows = await db.select().from(translationCases).innerJoin(translations, eq(translationCases.translationId, translations.id)).where(eq(translations.wordId, wordId));
        const english = rows.find((row) => row.translations.language === 'English');
        const spanish = rows.find((row) => row.translations.language === 'Spanish');
        // A second stored case on the English translation, practiced as well as the first.
        await db.insert(translationCases).values({ translationId: english.translations.id, caseName: 'extraCase', word: 'extra' });
        await practice(userId, wordId, 'English', english.translation_cases.caseName);
        await practice(userId, wordId, 'English', 'extraCase');

        let res = await getMetrics(token);
        expect(res.body.practicedTranslations).toBe(1);
        expect(res.body.translationsInPractice).toBe(8);
        expect(res.body.unpracticedWordsCount).toBe(3);

        await practice(userId, wordId, 'Spanish', spanish.translation_cases.caseName);
        res = await getMetrics(token);
        expect(res.body.practicedTranslations).toBe(2); // 2 of 8: one case from each of two languages
        expect(res.body.unpracticedWordsCount).toBe(3);
    });

    it('a case with an empty record, or one that is no longer in the word, is not practiced', async () => {
        const [{ id: wordId, userId }] = await db.select().from(words).limit(1);
        const [row] = await db.select().from(translationCases).innerJoin(translations, eq(translationCases.translationId, translations.id)).where(and(eq(translations.wordId, wordId), eq(translations.language, 'English')));
        await practice(userId, wordId, 'English', row.translation_cases.caseName, []);
        await practice(userId, wordId, 'Spanish', 'a-case-the-word-no-longer-has');

        const res = await getMetrics(token);
        expect(res.body.unpracticedWordsCount).toBe(4);
        expect(res.body.practicedTranslations).toBe(0);
    });
});

// ===========================================================================
// Practice coverage scope: own words plus words of followed tags
// ===========================================================================
describe('GET /api/users/getUserMetrics - practice coverage scope', () => {
    let user;
    let other;
    let theirs;

    beforeEach(async () => {
        user = await registerAndLogin();
        other = await registerAndLogin({ email: 'other@test.com', username: 'other' });
        theirs = (await create(other.token)).body;
        await create(user.token);
    });

    it('words of a followed Public tag count (words and translations), and stop counting when the tag turns Private', async () => {
        const tag = await request(app).post('/api/tags').set(auth(other.token)).send({ label: 'Shared', visibility: 'Public', description: '', wordIds: [theirs.id] });
        await request(app).post(`/api/tags/${tag.body.id}/follow`).set(auth(user.token));

        let res = await getMetrics(user.token);
        expect(res.body.totalWords).toBe(1); // unchanged: the word counts stay "own"
        expect(res.body.unpracticedWordsCount).toBe(2);
        expect(res.body.translationsInPractice).toBe(4);

        await request(app).patch(`/api/tags/${tag.body.id}`).set(auth(other.token)).send({ visibility: 'Private' });
        res = await getMetrics(user.token);
        expect(res.body.unpracticedWordsCount).toBe(1);
        expect(res.body.translationsInPractice).toBe(2);
    });

    it('a followed word counts as practiced after the user answers it; the other user\'s answers are not counted', async () => {
        const tag = await request(app).post('/api/tags').set(auth(other.token)).send({ label: 'Shared', visibility: 'Public', description: '', wordIds: [theirs.id] });
        await request(app).post(`/api/tags/${tag.body.id}/follow`).set(auth(user.token));
        const [row] = await db.select().from(translationCases).innerJoin(translations, eq(translationCases.translationId, translations.id)).where(and(eq(translations.wordId, theirs.id), eq(translations.language, 'English')));

        await practice(other.id, theirs.id, 'English', row.translation_cases.caseName);
        expect((await getMetrics(user.token)).body.practicedTranslations).toBe(0);

        await practice(user.id, theirs.id, 'English', row.translation_cases.caseName);
        const res = await getMetrics(user.token);
        expect(res.body.practicedTranslations).toBe(1);
        expect(res.body.unpracticedWordsCount).toBe(1);
    });

    it('a followed word is left out once the user has an own copy of it', async () => {
        const tag = await request(app).post('/api/tags').set(auth(other.token)).send({ label: 'Shared', visibility: 'Public', description: '', wordIds: [theirs.id] });
        await request(app).post(`/api/tags/${tag.body.id}/follow`).set(auth(user.token));
        const clone = await request(app).post(`/api/words/${theirs.id}/clone`).set(auth(user.token));
        expect(clone.status).toBeLessThan(300);

        const res = await getMetrics(user.token);
        expect(res.body.unpracticedWordsCount).toBe(2); // own word + the copy; the original is hidden
        expect(res.body.translationsInPractice).toBe(4);
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
