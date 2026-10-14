/**
 * Clone one word — Integration Tests
 *
 * `POST /api/words/:id/clone` (plans/words-clone-followed.md, Slice 2): a user
 * copies one word of someone else, reached through a tag they follow, into their
 * own account. The copy is private, has no tags, and stores where it came from
 * (`sourceWordId`, `isCloned`, `originalCreator`). Also covers `myCloneId` on
 * `GET /api/words/:id`.
 */

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const {
    exercisePerformanceCases,
    exercisePerformances,
    tags,
    translations,
    userFollowingTags,
    words,
} = require('../src/db/schema');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const registerAndLogin = async (name, email, username) => {
    await request(app)
        .post('/api/users')
        .send({ name, email, username, password: 'pass123', languages: ['English', 'Spanish'] });
    const res = await request(app).post('/api/users/login').send({ email, password: 'pass123' });
    return res.body;
};

const wordPayload = (overrides = {}) => ({
    partOfSpeech: 'Noun',
    translations: [
        { language: 'English', cases: [{ word: 'house', caseName: 'singularEN' }, { word: 'houses', caseName: 'pluralEN' }] },
        { language: 'Spanish', cases: [{ word: 'casa', caseName: 'singularES' }, { word: 'la', caseName: 'genderES' }] },
    ],
    clue: 'a small building',
    tagIds: [],
    ...overrides,
});

const createWord = (token, overrides) =>
    request(app).post('/api/words').set('Authorization', `Bearer ${token}`).send(wordPayload(overrides));

const get = (token, id) => request(app).get(`/api/words/${id}`).set('Authorization', `Bearer ${token}`);
const clone = (token, id) => request(app).post(`/api/words/${id}/clone`).set('Authorization', `Bearer ${token}`);

/** An author with a Public tag that holds one word, and a follower of that tag. */
const setUp = async () => {
    const author = await registerAndLogin('Author', 'author@test.com', 'author');
    const follower = await registerAndLogin('Follower', 'follower@test.com', 'follower');
    const [tag] = await db.insert(tags).values({ authorId: author.id, label: 'Home', visibility: 'Public' }).returning();
    const original = (await createWord(author.token, { tagIds: [tag.id] })).body;
    await db.insert(userFollowingTags).values({ tagId: tag.id, followerUserId: follower.id });
    return { author, follower, tag, original };
};

describe('POST /api/words/:id/clone', () => {
    it('copies a followed word into the follower\'s account: private, no tags, with its origin stored', async () => {
        const { author, follower, original } = await setUp();

        const res = await clone(follower.token, original.id);

        expect(res.statusCode).toBe(201);
        expect(res.body.id).not.toBe(original.id);
        expect(res.body).toMatchObject({
            user: follower.id,
            isCloned: true,
            originalCreator: author.id,
            partOfSpeech: 'Noun',
            clue: 'a small building',
            tags: [],
        });
        expect(res.body.translations.map((tr) => tr.language).sort()).toEqual(['English', 'Spanish']);
        const english = res.body.translations.find((tr) => tr.language === 'English');
        expect(english.cases.map((c) => c.word).sort()).toEqual(['house', 'houses']);

        const [row] = await db.select().from(words).where(eq(words.id, res.body.id));
        expect(row.sourceWordId).toBe(original.id);
        // The original is untouched.
        const stillThere = await get(author.token, original.id);
        expect(stillThere.body.tags).toHaveLength(1);
        expect(stillThere.body.translations).toHaveLength(2);
    });

    it('the copy is the follower\'s own: they can read it, the author cannot', async () => {
        const { author, follower, original } = await setUp();
        const copy = (await clone(follower.token, original.id)).body;

        expect((await get(follower.token, copy.id)).statusCode).toBe(200);
        expect((await get(author.token, copy.id)).statusCode).toBe(403);
    });

    it('copies the follower\'s own practice history, and only that', async () => {
        const { author, follower, original } = await setUp();
        const english = original.translations.find((tr) => tr.language === 'English');
        const [mine] = await db
            .insert(exercisePerformances)
            .values({
                userId: follower.id,
                wordId: original.id,
                translationId: english.id,
                translationLanguage: 'English',
                averageTranslationKnowledge: 70,
                lastDateModifiedTranslation: new Date('2026-01-01T00:00:00Z'),
            })
            .returning();
        await db.insert(exercisePerformanceCases).values({
            exercisePerformanceId: mine.id,
            caseName: 'singularEN',
            record: [true],
            lastDate: new Date('2026-01-01T00:00:00Z'),
            knowledge: 40,
        });
        await db.insert(exercisePerformances).values({
            userId: author.id,
            wordId: original.id,
            translationId: english.id,
            translationLanguage: 'English',
            averageTranslationKnowledge: 10,
            lastDateModifiedTranslation: new Date('2026-01-01T00:00:00Z'),
        });

        const copy = (await clone(follower.token, original.id)).body;

        const copiedTranslations = await db.select().from(translations).where(eq(translations.wordId, copy.id));
        const copiedEnglish = copiedTranslations.find((tr) => tr.language === 'English');
        const copied = await db.select().from(exercisePerformances).where(eq(exercisePerformances.translationId, copiedEnglish.id));
        expect(copied).toHaveLength(1);
        expect(copied[0]).toMatchObject({ userId: follower.id, wordId: copy.id, averageTranslationKnowledge: 70 });
        const stats = await db.select().from(exercisePerformanceCases).where(eq(exercisePerformanceCases.exercisePerformanceId, copied[0].id));
        expect(stats).toHaveLength(1);
    });

    it('answers 400 for a word the caller already owns', async () => {
        const { author, original } = await setUp();
        const res = await clone(author.token, original.id);
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('You already own this word');
    });

    it('answers 403 for a word of someone else that the caller cannot read (no followed tag)', async () => {
        const { original } = await setUp();
        const stranger = await registerAndLogin('Stranger', 'stranger@test.com', 'stranger');
        const res = await clone(stranger.token, original.id);
        expect(res.statusCode).toBe(403);
        expect(await db.select().from(words).where(eq(words.userId, stranger.id))).toHaveLength(0);
    });

    it('answers 403 once the tag is made Private (the follower can no longer read the word)', async () => {
        const { follower, tag, original } = await setUp();
        await db.update(tags).set({ visibility: 'Private' }).where(eq(tags.id, tag.id));
        expect((await clone(follower.token, original.id)).statusCode).toBe(403);
    });

    it('answers 400 for an unknown word', async () => {
        const { follower } = await setUp();
        const res = await clone(follower.token, '00000000-0000-4000-8000-000000000000');
        expect(res.statusCode).toBe(400);
    });

    it('answers 409 for a second copy of the same word', async () => {
        const { follower, original } = await setUp();
        expect((await clone(follower.token, original.id)).statusCode).toBe(201);
        const second = await clone(follower.token, original.id);
        expect(second.statusCode).toBe(409);
        expect(await db.select().from(words).where(eq(words.userId, follower.id))).toHaveLength(1);
    });

    it('needs a signed-in user', async () => {
        const { original } = await setUp();
        const res = await request(app).post(`/api/words/${original.id}/clone`);
        expect(res.statusCode).toBe(401);
    });
});

describe('GET /api/words/:id — myCloneId', () => {
    it('is null for a followed word with no copy, and the copy id after a clone', async () => {
        const { follower, original } = await setUp();

        expect((await get(follower.token, original.id)).body.myCloneId).toBeNull();

        const copy = (await clone(follower.token, original.id)).body;
        expect((await get(follower.token, original.id)).body.myCloneId).toBe(copy.id);
    });

    it('goes back to null when the copy is deleted', async () => {
        const { follower, original } = await setUp();
        const copy = (await clone(follower.token, original.id)).body;

        const del = await request(app).delete(`/api/words/${copy.id}`).set('Authorization', `Bearer ${follower.token}`);
        expect(del.statusCode).toBe(200);

        expect((await get(follower.token, original.id)).body.myCloneId).toBeNull();
        expect((await get(follower.token, original.id)).statusCode).toBe(200);
    });

    it('is only about the caller\'s own copy: another follower still sees null', async () => {
        const { tag, original, follower } = await setUp();
        const second = await registerAndLogin('Second', 'second@test.com', 'second');
        await db.insert(userFollowingTags).values({ tagId: tag.id, followerUserId: second.id });
        await clone(follower.token, original.id);

        expect((await get(second.token, original.id)).body.myCloneId).toBeNull();
    });

    it('is not on your own word', async () => {
        const { author, original } = await setUp();
        expect(await get(author.token, original.id)).toMatchObject({ statusCode: 200 });
        expect((await get(author.token, original.id)).body).not.toHaveProperty('myCloneId');
    });

    it('the copy survives when the original is deleted, with no source any more', async () => {
        const { author, follower, original } = await setUp();
        const copy = (await clone(follower.token, original.id)).body;

        await request(app).delete(`/api/words/${original.id}`).set('Authorization', `Bearer ${author.token}`);

        const [row] = await db.select().from(words).where(eq(words.id, copy.id));
        expect(row).toBeDefined();
        expect(row.sourceWordId).toBeNull();
        expect(row.isCloned).toBe(true);
    });
});
