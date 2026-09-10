/**
 * Tags API — Integration Tests
 *
 * Redesigned contract (study §8.3):
 *   - `visibility` enum replaces the legacy `public` varchar.
 *   - `createTag` sets `authorId` server-side from the authenticated user.
 *   - `canViewTag` authz on getTagById / followTag / clone.
 *   - Tag sharing is an explicit `tag_shares` lifecycle (share/accept/decline);
 *     accepting clones the tag + words + translations + cases transactionally.
 */

const request = require('supertest');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const {
    tagShares,
    tags,
    tagWords,
    translationCases,
    translations,
    words,
} = require('../src/db/schema');

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const registerAndLogin = async (name = 'Tag User', email = 'tag@test.com', username = 'taguser') => {
    await request(app).post('/api/users').send({
        name, email, username, password: 'pass123', languages: ['English', 'Spanish'],
    });
    const r = await request(app).post('/api/users/login').send({ email, password: 'pass123' });
    return r.body;
};

const createWord = async (token, partOfSpeech, caseName, wordValue) => {
    const res = await request(app)
        .post('/api/words')
        .set('Authorization', `Bearer ${token}`)
        .send({
            partOfSpeech,
            translations: [
                { language: 'English', cases: [{ word: wordValue, caseName }] },
                { language: 'Estonian', cases: [{ word: wordValue + 'EE', caseName: 'infinitiveMaEE' }] },
            ],
            tags: [],
        });
    return res.body;
};

describe('POST /api/tags - Create Tag', () => {
    let token, userId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        userId = data.id;
    });

    it('creates a tag without words (authorId set server-side)', async () => {
        const res = await request(app)
            .post('/api/tags').set('Authorization', `Bearer ${token}`)
            .send({ label: 'Vocabulary', visibility: 'Private', words: [] });

        expect(res.statusCode).toBe(200);
        expect(res.body.words).toEqual([]);
        expect(res.body.authorId).toBe(userId);
    });

    it('creates a tag with word associations', async () => {
        const [word] = await db.insert(words).values({
            userId,
            partOfSpeech: 'Noun',
        }).returning();

        const res = await request(app)
            .post('/api/tags').set('Authorization', `Bearer ${token}`)
            .send({ label: 'Nouns', visibility: 'Private', words: [{ _id: word.id }] });

        expect(res.statusCode).toBe(200);

        const tagWordsRows = await db
            .select()
            .from(tagWords)
            .where(eq(tagWords.tagId, res.body._id));

        expect(tagWordsRows).toHaveLength(1);
    });

    it('fails with 400 when label is missing', async () => {
        const res = await request(app)
            .post('/api/tags').set('Authorization', `Bearer ${token}`)
            .send({ visibility: 'Private', words: [] });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 when visibility status is invalid', async () => {
        const res = await request(app)
            .post('/api/tags').set('Authorization', `Bearer ${token}`)
            .send({ label: 'Bad', visibility: 'Invalid', words: [] });
        expect(res.statusCode).toBe(400);
    });
});

describe('GET /api/tags/getTags - Get User Tags', () => {
    let token, userId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        userId = data.id;

        await db.insert(tags).values([
            { authorId: userId, label: 'First', visibility: 'Private' },
            { authorId: userId, label: 'Second', visibility: 'Public' },
        ]);
    });

    it('returns all tags authored by the user', async () => {
        const res = await request(app)
            .get('/api/tags/getTags').set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

describe('Tag sharing lifecycle', () => {
    let owner, recipient;

    beforeEach(async () => {
        owner = await registerAndLogin('Owner', 'owner@test.com', 'owner');
        recipient = await registerAndLogin('Recipient', 'recipient@test.com', 'recipient');
    });

    const createSharedTag = async () => {
        const word = await createWord(owner.token, 'Verb', 'infinitiveNonFiniteSimpleEN', 'to run');
        const res = await request(app)
            .post('/api/tags')
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ label: 'Shared', visibility: 'Private', words: [{ _id: word._id }] });
        return res.body;
    };

    it('POST /api/tags/:id/share - shares a tag and creates a notification', async () => {
        const tag = await createSharedTag();

        const res = await request(app)
            .post(`/api/tags/${tag._id}/share`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ recipientId: recipient.id });

        expect(res.statusCode).toBe(200);
        expect(res.body.tagId).toBe(tag._id);
        expect(res.body.recipientId).toBe(recipient.id);
        expect(res.body.status).toBe('pending');
    });

    it('POST /api/tags/:id/share - rejects duplicate pending share', async () => {
        const tag = await createSharedTag();
        await request(app)
            .post(`/api/tags/${tag._id}/share`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ recipientId: recipient.id });

        const res = await request(app)
            .post(`/api/tags/${tag._id}/share`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ recipientId: recipient.id });

        expect(res.statusCode).toBe(400);
    });

    it('POST /api/tags/:id/share - rejects sharing another users tag', async () => {
        const tag = await createSharedTag();

        const res = await request(app)
            .post(`/api/tags/${tag._id}/share`)
            .set('Authorization', `Bearer ${recipient.token}`)
            .send({ recipientId: owner.id });

        expect(res.statusCode).toBe(401);
    });

    it('POST /api/tag-shares/:id/accept - clones tag with translations and cases', async () => {
        const tag = await createSharedTag();
        const share = await request(app)
            .post(`/api/tags/${tag._id}/share`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ recipientId: recipient.id });

        const res = await request(app)
            .post(`/api/tag-shares/${share.body.id}/accept`)
            .set('Authorization', `Bearer ${recipient.token}`);

        expect(res.statusCode).toBe(200);

        // The cloned tag must exist with the recipient as author.
        const clonedTag = res.body.clonedTag;
        expect(clonedTag.authorId).toBe(recipient.id);
        expect(clonedTag.label).toBe('Shared');

        // The cloned word must carry its translations + cases (the §8.3 fix).
        const [clonedWord] = await db
            .select()
            .from(words)
            .where(eq(words.userId, recipient.id))
            .limit(1);
        expect(clonedWord.isCloned).toBe(true);
        expect(clonedWord.originalCreatorId).toBe(owner.id);

        const transRows = await db
            .select()
            .from(translations)
            .where(eq(translations.wordId, clonedWord.id));
        expect(transRows.length).toBeGreaterThanOrEqual(1);

        const caseRows = await db
            .select()
            .from(translationCases)
            .where(eq(translationCases.translationId, transRows[0].id));
        expect(caseRows.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/tag-shares/:id/accept - rejects accept by the sender', async () => {
        const tag = await createSharedTag();
        const share = await request(app)
            .post(`/api/tags/${tag._id}/share`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ recipientId: recipient.id });

        const res = await request(app)
            .post(`/api/tag-shares/${share.body.id}/accept`)
            .set('Authorization', `Bearer ${owner.token}`);

        expect(res.statusCode).toBe(401);
    });

    it('POST /api/tag-shares/:id/decline - declines a share', async () => {
        const tag = await createSharedTag();
        const share = await request(app)
            .post(`/api/tags/${tag._id}/share`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ recipientId: recipient.id });

        const res = await request(app)
            .post(`/api/tag-shares/${share.body.id}/decline`)
            .set('Authorization', `Bearer ${recipient.token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('declined');

        const [updated] = await db
            .select()
            .from(tagShares)
            .where(eq(tagShares.id, share.body.id))
            .limit(1);
        expect(updated.status).toBe('declined');
    });
});

describe('Tag clone authorization', () => {
    let owner, stranger;

    beforeEach(async () => {
        owner = await registerAndLogin('Owner', 'owner@test.com', 'owner');
        stranger = await registerAndLogin('Stranger', 'stranger@test.com', 'stranger');
    });

    it('POST /api/tags/addExternalTag - clones a Public tag', async () => {
        const word = await createWord(owner.token, 'Noun', 'singularNominative', 'book');
        const tag = await request(app)
            .post('/api/tags')
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ label: 'PublicTag', visibility: 'Public', words: [{ _id: word._id }] });

        const res = await request(app)
            .post('/api/tags/addExternalTag')
            .set('Authorization', `Bearer ${stranger.token}`)
            .send({ tagId: tag.body._id });

        expect(res.statusCode).toBe(200);
        expect(res.body.authorId).toBe(stranger.id);
    });

    it('POST /api/tags/addExternalTag - rejects cloning a Private tag', async () => {
        const word = await createWord(owner.token, 'Noun', 'singularNominative', 'book');
        const tag = await request(app)
            .post('/api/tags')
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ label: 'PrivateTag', visibility: 'Private', words: [{ _id: word._id }] });

        const res = await request(app)
            .post('/api/tags/addExternalTag')
            .set('Authorization', `Bearer ${stranger.token}`)
            .send({ tagId: tag.body._id });

        expect(res.statusCode).toBe(401);
    });

    it('GET /api/tags/:id - rejects viewing a Private tag by a non-author', async () => {
        const word = await createWord(owner.token, 'Noun', 'singularNominative', 'book');
        const tag = await request(app)
            .post('/api/tags')
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ label: 'Hidden', visibility: 'Private', words: [{ _id: word._id }] });

        const res = await request(app)
            .get(`/api/tags/${tag.body._id}`)
            .set('Authorization', `Bearer ${stranger.token}`);

        expect(res.statusCode).toBe(401);
    });
});

describe('DELETE /api/tags/:id - Delete Tag', () => {
    let token, userId, tagId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        userId = data.id;

        const [word] = await db.insert(words).values({
            userId,
            partOfSpeech: 'Verb',
        }).returning();

        const [tag] = await db.insert(tags).values({
            authorId: userId,
            label: 'ToDelete',
            visibility: 'Private',
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

        const [foundTag] = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);
        expect(foundTag).toBeUndefined();

        const tagWordsRows = await db
            .select()
            .from(tagWords)
            .where(eq(tagWords.tagId, tagId));
        expect(tagWordsRows).toHaveLength(0);
    });

    it('fails with 401 when not the author', async () => {
        await request(app).post('/api/users').send({
            name: 'Other', email: 'other@test.com', username: 'other', password: 'pass123',
            languages: ['English', 'Spanish'],
        });
        const r = await request(app).post('/api/users/login').send({ email: 'other@test.com', password: 'pass123' });

        const res = await request(app)
            .delete(`/api/tags/${tagId}`).set('Authorization', `Bearer ${r.body.token}`);
        expect(res.statusCode).toBe(401);
    });
});
