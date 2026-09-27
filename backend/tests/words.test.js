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
 *   - tag IDs and word IDs are now UUIDs, returned by the API as `id` (the
 *     legacy `_id` alias on word responses was dropped in Phase 2 Slice 1).
 *   - Foreign-key constraints require that tag authors exist in the `users`
 *     table, so test tags are created with the authenticated user's UUID.
 */

// Must run before `require('../app')` below — see auth.test.js's comment on
// this same pattern for why (this file isn't Babel/ts-jest transformed, so
// jest.mock hoisting never applies to it).
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const crypto = require('crypto');
const request = require('supertest');
const { eq, inArray, sql } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { tags, tagWords, userFollowingTags, words } = require('../src/db/schema');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

// Helper: register a user, log in, and return the full response body containing
// `token` (JWT) and `_id` (user UUID) used by authenticated requests.
const registerAndLogin = async (name = 'User', email = 'user@test.com', username = 'user', password = 'password123') => {
    await request(app).post('/api/users').send({ name, email, username, password, languages: ['English', 'Spanish'] });
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
    tagIds: [],
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
            .send(wordPayload({ tagIds: [] }));

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('partOfSpeech', 'Verb');
        // The controller reconstructs the legacy nested translations array
        // from the normalised tables.
        expect(res.body.translations).toHaveLength(2);
        expect(res.body).not.toHaveProperty('password');
        // `id` only — no legacy `_id` alias on word or translation responses.
        expect(res.body).toHaveProperty('id');
        expect(res.body).not.toHaveProperty('_id');
        expect(res.body.translations[0]).toHaveProperty('id');
        expect(res.body.translations[0]).not.toHaveProperty('_id');
    });

    it('creates TagWord associations when tagIds provided', async () => {
        // Register a dedicated user so the tag has a valid author FK.
        const userData = await registerAndLogin('TagUser', 'taguser@test.com', 'taguser', 'pass123');
        token = userData.token;
        const userId = userData.id;

        const [tag] = await db.insert(tags).values({
            authorId: userId,
            label: 'T',
            visibility: 'Private',
        }).returning();

        const res = await request(app)
            .post('/api/words').set('Authorization', `Bearer ${token}`)
            .send(wordPayload({ tagIds: [tag.id] }));

        expect(res.statusCode).toBe(200);
        expect(res.body.tags.map((tg) => tg.id)).toEqual([tag.id]);

        // Verify the junction table was populated.
        const tagWordRows = await db
            .select()
            .from(tagWords)
            .where(eq(tagWords.wordId, res.body.id));
        expect(tagWordRows).toHaveLength(1);
    });

    // Ownership check (phase-4-tags.md — missing before this phase): a user
    // may only attach tags they own to a word they're creating.
    it('fails with 403 when tagIds includes a tag owned by another user, and creates nothing', async () => {
        const otherData = await registerAndLogin('TagOwner', 'tagowner@test.com', 'tagowner', 'pass123');
        const [otherTag] = await db.insert(tags).values({
            authorId: otherData.id,
            label: 'Not yours',
            visibility: 'Private',
        }).returning();

        const res = await request(app)
            .post('/api/words').set('Authorization', `Bearer ${token}`)
            .send(wordPayload({ tagIds: [otherTag.id] }));

        expect(res.statusCode).toBe(403);

        // The whole request is refused up front — no orphaned word row.
        const allWords = await db.select().from(words);
        expect(allWords).toHaveLength(0);
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
            .send({ partOfSpeech: 'Noun', translations: [{ language: 'EN', cases: [] }] });
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
    let token, userId, wordId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        userId = data.id;
        const r = await request(app).post('/api/words').set('Authorization', `Bearer ${token}`).send(wordPayload());
        wordId = r.body.id;
    });

    it('returns the word', async () => {
        const res = await request(app).get(`/api/words/${wordId}`).set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('partOfSpeech', 'Verb');
        expect(res.body).not.toHaveProperty('_id');
    });

    it('fails with 400 for non-existent id', async () => {
        // Random UUID that does not exist in the words table.
        const res = await request(app)
            .get(`/api/words/${crypto.randomUUID()}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(400);
    });

    it('fails with 403 when the word belongs to another user', async () => {
        const otherData = await registerAndLogin('Other', 'other@test.com', 'other', 'pass123');
        const res = await request(app)
            .get(`/api/words/${wordId}`)
            .set('Authorization', `Bearer ${otherData.token}`);
        expect(res.statusCode).toBe(403);
    });

    // Phase 4: a non-owner may read a word reached through a tag they
    // follow and can currently view — read-only (overview.md §3.2), which
    // the frontend derives from `user` not matching its own session id.
    it('returns the word when reached through a followed Public tag', async () => {
        const [tag] = await db.insert(tags).values({
            authorId: userId,
            label: 'Shared',
            visibility: 'Public',
        }).returning();
        await db.insert(tagWords).values({ tagId: tag.id, wordId });

        const followerData = await registerAndLogin('Follower', 'follower@test.com', 'follower', 'pass123');
        await request(app)
            .post('/api/tags/followTag')
            .set('Authorization', `Bearer ${followerData.token}`)
            .send({ tagId: tag.id });

        const res = await request(app)
            .get(`/api/words/${wordId}`)
            .set('Authorization', `Bearer ${followerData.token}`);

        expect(res.statusCode).toBe(200);
        // Still the true owner's id, not the viewer's — that's what lets the
        // frontend tell this apart as read-only.
        expect(res.body.user).toBe(userId);
    });

    it('still fails with 403 once the followed tag turns Private (D9)', async () => {
        const [tag] = await db.insert(tags).values({
            authorId: userId,
            label: 'Hidden',
            visibility: 'Private',
        }).returning();
        await db.insert(tagWords).values({ tagId: tag.id, wordId });

        // A Private tag can't be followed via the API (canViewTag refuses
        // it), so simulate a tag that turned Private *after* being followed
        // by inserting the follow row directly.
        const followerData = await registerAndLogin('Follower2', 'follower2@test.com', 'follower2', 'pass123');
        await db.insert(userFollowingTags).values({ tagId: tag.id, followerUserId: followerData.id });

        const res = await request(app)
            .get(`/api/words/${wordId}`)
            .set('Authorization', `Bearer ${followerData.token}`);

        expect(res.statusCode).toBe(403);
    });
});

// ===========================================================================
// PUT /api/words/:id - Update Word
// ===========================================================================
describe('PUT /api/words/:id - Update Word', () => {
    let token, userId, wordId, tagId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        userId = data.id;

        const [tag] = await db.insert(tags).values({
            authorId: userId,
            label: 'U',
            visibility: 'Private',
        }).returning();
        tagId = tag.id;

        const r = await request(app).post('/api/words').set('Authorization', `Bearer ${token}`)
            .send(wordPayload({ tagIds: [tagId] }));
        wordId = r.body.id;
    });

    // `PUT /api/words/:id` never touches tag associations (phase-4-tags.md,
    // agent call under D5) — that's the dedicated link/unlink endpoints' job
    // (Phase 4 Slice 2). These two guard against reintroducing the exact
    // class of bug Phase 3.9 fixed once already: a `tags`-less PUT (every
    // PUT `UpdateWordBody` sends — it has no `tags` field) silently wiping
    // every association via `req.body.tags || []`. The fix this time is
    // removing the code path outright, not tightening its guard again — so
    // an explicit `tags: []` must be just as inert as omitting it entirely.
    it('leaves tag associations untouched when `tags` is omitted from the body', async () => {
        const res = await request(app)
            .put(`/api/words/${wordId}`).set('Authorization', `Bearer ${token}`)
            .send({ partOfSpeech: 'Verb', translations: [t('English', 'walk', 'simplePresent1sEN'), t('Estonian', 'kõndima', 'infinitiveMaEE')] });

        expect(res.statusCode).toBe(200);

        const tagWordRows = await db.select().from(tagWords).where(eq(tagWords.wordId, wordId));
        expect(tagWordRows).toHaveLength(1);
        expect(tagWordRows[0].tagId).toBe(tagId);
    });

    it('leaves tag associations untouched even when `tags` is explicitly sent empty', async () => {
        const res = await request(app)
            .put(`/api/words/${wordId}`).set('Authorization', `Bearer ${token}`)
            .send({ tags: [] });

        expect(res.statusCode).toBe(200);

        const tagWordRows = await db.select().from(tagWords).where(eq(tagWords.wordId, wordId));
        expect(tagWordRows).toHaveLength(1);
        expect(tagWordRows[0].tagId).toBe(tagId);
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
        userId = data.id;

        // Create a tag with a valid author FK so the word can reference it.
        const [tag] = await db.insert(tags).values({
            authorId: userId,
            label: 'D',
            visibility: 'Private',
        }).returning();

        const r = await request(app).post('/api/words').set('Authorization', `Bearer ${token}`)
            .send(wordPayload({ tagIds: [tag.id] }));
        wordId = r.body.id;
    });

    it('deletes the word and its TagWord entries', async () => {
        const res = await request(app).delete(`/api/words/${wordId}`).set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ id: wordId });

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
        wordIds = [w1.body.id, w2.body.id];
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
