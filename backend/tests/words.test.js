/**
 * Words API — Integration Tests
 *
 * These tests verify CRUD operations for words, including the creation of
 * nested translations/cases and many-to-many tag associations.
 *
 * Migration notes (Mongoose → Drizzle):
 *   - The old test used Mongoose models directly (Word.create, Tag.create,
 *     TagWord.find) to seed and assert on database state.  The new test uses
 *     the Drizzle ORM instance (imported from ../src/db) for seed data that
 *     bypasses the API, and the API itself for end-to-end flows.
 *   - tag IDs and word IDs are now UUIDs (returned by the API as `_id` for
 *     backward compatibility).
 *   - Foreign-key constraints require that tag authors exist in the `users`
 *     table, so test tags are created with the authenticated user's UUID.
 */

const crypto = require('crypto');
const request = require('supertest');
const { eq, inArray, sql } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { tags, tagWords, words } = require('../src/db/schema');

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

// Helper: register a user, log in, and return the full response body containing
// `token` (JWT) and `_id` (user UUID) used by authenticated requests.
const registerAndLogin = async (name = 'User', email = 'user@test.com', username = 'user', password = 'password123') => {
    await request(app).post('/api/users').send({ name, email, username, password });
    const loginRes = await request(app).post('/api/users/login').send({ email, password });
    return loginRes.body;
};

// Helper: construct a translation object in the legacy nested format that the
// API controller normalises into the translations + cases tables.
const t = (language, word, caseName = 'infinitiveMaEE') => ({
    language,
    cases: [{ word, caseName }],
});

// Helper: full word payload sent to POST /api/words.
const wordPayload = (overrides = {}) => ({
    partOfSpeech: 'Verb',
    translations: [t('English', 'run', 'simplePresent1sEN'), t('Estonian', 'jooksma', 'infinitiveMaEE')],
    clue: 'fast movement',
    tags: [],
    ...overrides,
});

// ===========================================================================
// POST /api/words - Create Word
// ===========================================================================
describe('POST /api/words - Create Word', () => {
    let token;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
    });

    it('creates a word and returns it', async () => {
        const res = await request(app)
            .post('/api/words').set('Authorization', `Bearer ${token}`)
            .send(wordPayload({ tags: [] }));

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('partOfSpeech', 'Verb');
        // The controller reconstructs the legacy nested translations array
        // from the normalised tables.
        expect(res.body.translations).toHaveLength(2);
        expect(res.body).not.toHaveProperty('password');
    });

    it('creates TagWord associations when tags provided', async () => {
        // Register a dedicated user so the tag has a valid author FK.
        const userData = await registerAndLogin('TagUser', 'taguser@test.com', 'taguser', 'pass123');
        token = userData.token;
        const userId = userData._id;

        const [tag] = await db.insert(tags).values({
            authorId: userId,
            label: 'T',
            public: 'Private',
        }).returning();

        const res = await request(app)
            .post('/api/words').set('Authorization', `Bearer ${token}`)
            .send(wordPayload({ tags: [{ _id: tag.id }] }));

        expect(res.statusCode).toBe(200);

        // Verify the junction table was populated.
        const tagWordRows = await db
            .select()
            .from(tagWords)
            .where(eq(tagWords.wordId, res.body._id));
        expect(tagWordRows).toHaveLength(1);
    });

    it('fails with 400 when partOfSpeech missing', async () => {
        const res = await request(app)
            .post('/api/words').set('Authorization', `Bearer ${token}`)
            .send(wordPayload({ partOfSpeech: undefined }));
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 when fewer than 2 translations', async () => {
        const res = await request(app)
            .post('/api/words').set('Authorization', `Bearer ${token}`)
            .send({ partOfSpeech: 'Noun', translations: [{ language: 'EN', cases: [] }], tags: [] });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 401 when not authenticated', async () => {
        const res = await request(app).post('/api/words').send(wordPayload());
        expect(res.statusCode).toBe(401);
    });
});

// ===========================================================================
// GET /api/words - Get Words
// ===========================================================================
describe('GET /api/words - Get Words', () => {
    let token;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
    });

    it('returns empty array when no words exist', async () => {
        const res = await request(app).get('/api/words').set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('returns all words for the user', async () => {
        // Create two words via the API so full end-to-end coverage is maintained.
        await request(app).post('/api/words').set('Authorization', `Bearer ${token}`).send(wordPayload());
        await request(app).post('/api/words').set('Authorization', `Bearer ${token}`)
            .send(wordPayload({ translations: [t('German', 'laufen', 'infinitiveDE'), t('Estonian', 'jooksma', 'infinitiveMaEE')] }));

        const res = await request(app).get('/api/words').set('Authorization', `Bearer ${token}`);
        expect(res.body).toHaveLength(2);
    });
});

// ===========================================================================
// GET /api/words/:id - Get Word By ID
// ===========================================================================
describe('GET /api/words/:id - Get Word By ID', () => {
    let token, wordId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        const r = await request(app).post('/api/words').set('Authorization', `Bearer ${token}`).send(wordPayload());
        wordId = r.body._id;
    });

    it('returns the word', async () => {
        const res = await request(app).get(`/api/words/${wordId}`).set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('partOfSpeech', 'Verb');
    });

    it('fails with 400 for non-existent id', async () => {
        // Random UUID that does not exist in the words table.
        const res = await request(app)
            .get(`/api/words/${crypto.randomUUID()}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(400);
    });
});

// ===========================================================================
// DELETE /api/words/:id - Delete Word
// ===========================================================================
describe('DELETE /api/words/:id - Delete Word', () => {
    let token, wordId, userId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        userId = data._id;

        // Create a tag with a valid author FK so the word can reference it.
        const [tag] = await db.insert(tags).values({
            authorId: userId,
            label: 'D',
            public: 'Private',
        }).returning();

        const r = await request(app).post('/api/words').set('Authorization', `Bearer ${token}`)
            .send(wordPayload({ tags: [{ _id: tag.id }] }));
        wordId = r.body._id;
    });

    it('deletes the word and its TagWord entries', async () => {
        const res = await request(app).delete(`/api/words/${wordId}`).set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);

        // Verify the word row itself was removed.
        const [foundWord] = await db.select().from(words).where(eq(words.id, wordId)).limit(1);
        expect(foundWord).toBeUndefined();

        // Verify cascade deletion cleared the junction table.
        const tagWordRows = await db.select().from(tagWords).where(eq(tagWords.wordId, wordId));
        expect(tagWordRows).toHaveLength(0);
    });

    it('fails with 401 when not owner', async () => {
        const otherData = await registerAndLogin('Other', 'other@test.com', 'other', 'pass123');
        const otherToken = otherData.token;

        const res = await request(app).delete(`/api/words/${wordId}`).set('Authorization', `Bearer ${otherToken}`);
        expect(res.statusCode).toBe(401);
    });
});

// ===========================================================================
// DELETE /api/words/deleteMany - Bulk Delete
// ===========================================================================
describe('DELETE /api/words/deleteMany - Bulk Delete', () => {
    let token, wordIds;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;

        const w1 = await request(app).post('/api/words').set('Authorization', `Bearer ${token}`)
            .send(wordPayload({ translations: [t('English', 'eat', 'infinitiveNonFiniteSimpleEN'), t('Estonian', 's88ma', 'infinitiveMaEE')] }));
        const w2 = await request(app).post('/api/words').set('Authorization', `Bearer ${token}`)
            .send(wordPayload({ translations: [t('English', 'sleep', 'infinitiveNonFiniteSimpleEN'), t('Estonian', 'magama', 'infinitiveMaEE')] }));
        wordIds = [w1.body._id, w2.body._id];
    });

    it('deletes multiple words', async () => {
        const res = await request(app)
            .delete('/api/words/deleteMany').set('Authorization', `Bearer ${token}`)
            .send({ wordsId: wordIds });
        expect(res.statusCode).toBe(200);

        const remaining = await db
            .select({ count: sql`count(*)::int` })
            .from(words)
            .where(inArray(words.id, wordIds));
        expect(remaining[0].count).toBe(0);
    });
});

// ===========================================================================
// GET /api/words/searchWord - Search
// ===========================================================================
describe('GET /api/words/searchWord - Search', () => {
    let token;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        await request(app).post('/api/words').set('Authorization', `Bearer ${token}`)
            .send(wordPayload());
    });

    it('finds a word by translation text', async () => {
        const res = await request(app)
            .get('/api/words/searchWord?query=jooksma')
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty for non-matching query', async () => {
        const res = await request(app)
            .get('/api/words/searchWord?query=xyznonexistent')
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual([]);
    });
});
