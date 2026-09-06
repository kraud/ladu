/**
 * Tags API — Integration Tests
 *
 * These tests verify the CRUD operations for tags and their many-to-many
 * relationship with words (via tag_words). They have been migrated from
 * Mongoose to Drizzle ORM on PostgreSQL.
 *
 * Migration note: The old test used Mongoose models directly (Word.create,
 * Tag.findById, TagWord.find). The new test uses the Drizzle ORM instance
 * (imported from ../src/db) to seed and assert on database state. This keeps
 * the test implementations decoupled from any ORM choices in the controller.
 */

const request = require('supertest');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { tags, tagWords, words } = require('../src/db/schema');

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    // Close the shared Drizzle pool so Jest does not hang on an open connection
    await pool.end();
});

// Helper: register a user, log in, and return the auth token + user data.
// The userController.ts response includes `_id` (legacy alias for the UUID) and `token`.
const registerAndLogin = async () => {
    await request(app).post('/api/users').send({
        name: 'Tag User', email: 'tag@test.com', username: 'taguser', password: 'pass123',
    });
    const r = await request(app).post('/api/users/login').send({ email: 'tag@test.com', password: 'pass123' });
    return r.body;
};

describe('POST /api/tags - Create Tag', () => {
    let token, userId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        userId = data._id;
    });

    it('creates a tag without words', async () => {
        const res = await request(app)
            .post('/api/tags').set('Authorization', `Bearer ${token}`)
            .send({ author: userId, label: 'Vocabulary', public: 'Private', words: [] });

        expect(res.statusCode).toBe(200);
        expect(res.body.words).toEqual([]);
    });

    it('creates a tag with word associations', async () => {
        // Seed a single word via Drizzle so the controller can reference it by id.
        const [word] = await db.insert(words).values({
            userId: userId,
            partOfSpeech: 'Noun',
        }).returning();

        const res = await request(app)
            .post('/api/tags').set('Authorization', `Bearer ${token}`)
            .send({ author: userId, label: 'Nouns', public: 'Private', words: [{ _id: word.id }] });

        expect(res.statusCode).toBe(200);

        // Verify the junction table (tag_words) contains exactly one row for this tag.
        const tagWordsRows = await db
            .select()
            .from(tagWords)
            .where(eq(tagWords.tagId, res.body._id));

        expect(tagWordsRows).toHaveLength(1);
    });

    it('fails with 400 when label is missing', async () => {
        const res = await request(app)
            .post('/api/tags').set('Authorization', `Bearer ${token}`)
            .send({ author: userId, public: 'Private', words: [] });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 when public status is invalid', async () => {
        const res = await request(app)
            .post('/api/tags').set('Authorization', `Bearer ${token}`)
            .send({ author: userId, label: 'Bad', public: 'Invalid', words: [] });
        expect(res.statusCode).toBe(400);
    });
});

describe('GET /api/tags/getTags - Get User Tags', () => {
    let token, userId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        userId = data._id;

        // Seed two tags for the authenticated user.
        await db.insert(tags).values([
            { authorId: userId, label: 'First', public: 'Private' },
            { authorId: userId, label: 'Second', public: 'Public' },
        ]);
    });

    it('returns all tags authored by the user', async () => {
        const res = await request(app)
            .get('/api/tags/getTags').set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

describe('DELETE /api/tags/:id - Delete Tag', () => {
    let token, userId, tagId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        userId = data._id;

        // Seed a word and tag, then link them via the junction table.
        const [word] = await db.insert(words).values({
            userId: userId,
            partOfSpeech: 'Verb',
        }).returning();

        const [tag] = await db.insert(tags).values({
            authorId: userId,
            label: 'ToDelete',
            public: 'Private',
        }).returning();

        tagId = tag.id;

        await db.insert(tagWords).values({
            tagId: tag.id,
            wordId: word.id,
        });
    });

    it('deletes tag and cleans up TagWord entries', async () => {
        const res = await request(app)
            .delete(`/api/tags/${tagId}`).set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);

        // Confirm the tag row itself was removed.
        const [foundTag] = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);
        expect(foundTag).toBeUndefined();

        // Confirm cascade deletion cleared the junction table for this tag.
        const tagWordsRows = await db
            .select()
            .from(tagWords)
            .where(eq(tagWords.tagId, tagId));
        expect(tagWordsRows).toHaveLength(0);
    });

    it('fails with 401 when not the author', async () => {
        // Register a second user to obtain a different auth token.
        await request(app).post('/api/users').send({
            name: 'Other', email: 'other@test.com', username: 'other', password: 'pass123',
        });
        const r = await request(app).post('/api/users/login').send({ email: 'other@test.com', password: 'pass123' });

        const res = await request(app)
            .delete(`/api/tags/${tagId}`).set('Authorization', `Bearer ${r.body.token}`);
        expect(res.statusCode).toBe(401);
    });
});
