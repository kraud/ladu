/**
 * GET /api/words/simple — Integration Tests
 *
 * Phase 3 Slice 5: covers the rewritten list contract — flat query-param
 * filters (`pos`, `gender`, `q`, `tag`), keyset pagination (`cursor`/`limit`),
 * the `{ items, nextCursor }` response shape, followed-tag access, and the
 * getRequiredFieldsData fix (an unrecognised language/part of speech no
 * longer 500s the whole list).
 *
 * Phase 3 Slice 6 added `total` — the count matching the filters alone,
 * computed before the cursor predicate so it stays constant across pages of
 * one filter set (see the pagination block below for what "constant" means
 * across a sequence of requests where a row is inserted mid-page).
 */

const request = require('supertest');
const app = require('../app');
const testDb = require('./db');
const { pool, db } = require('../src/db');
const { tags, userFollowingTags } = require('../src/db/schema');

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const registerAndLogin = async (name = 'User', email = 'user@test.com', username = 'user', password = 'password123') => {
    await request(app).post('/api/users').send({ name, email, username, password, languages: ['English', 'Spanish'] });
    const loginRes = await request(app).post('/api/users/login').send({ email, password });
    return loginRes.body;
};

const t = (language, word, caseName) => ({ language, cases: [{ word, caseName }] });

const wordPayload = (overrides = {}) => ({
    partOfSpeech: 'Verb',
    translations: [t('English', 'run', 'simplePresent1sEN'), t('Estonian', 'jooksma', 'infinitiveMaEE')],
    clue: null,
    tags: [],
    ...overrides,
});

const create = (token, overrides) =>
    request(app).post('/api/words').set('Authorization', `Bearer ${token}`).send(wordPayload(overrides));

// ===========================================================================
// Row shape per part of speech
// ===========================================================================
describe('GET /api/words/simple - row shape', () => {
    let token;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
    });

    it('extracts the primary case per language for a Noun', async () => {
        const res = await create(token, {
            partOfSpeech: 'Noun',
            translations: [
                { language: 'English', cases: [{ word: 'cat', caseName: 'singularEN' }] },
                { language: 'Spanish', cases: [{ word: 'gato', caseName: 'singularES' }, { word: 'Masculino', caseName: 'genderES' }] },
            ],
        });

        const list = await request(app).get('/api/words/simple').set('Authorization', `Bearer ${token}`);
        const row = list.body.items.find((w) => w.id === res.body.id);

        expect(row.dataEN).toBe('cat');
        expect(row.dataES).toBe('gato');
        expect(row.genderES).toBe('Masculino');
        expect(row.registeredCasesEN).toBe(1);
        expect(row.registeredCasesES).toBe(2);
    });

    it('extracts the primary case per language for a Verb', async () => {
        const res = await create(token, {
            partOfSpeech: 'Verb',
            translations: [
                { language: 'English', cases: [{ word: 'eat', caseName: 'simplePresent1sEN' }] },
                { language: 'German', cases: [{ word: 'essen', caseName: 'infinitiveDE' }] },
            ],
        });

        const list = await request(app).get('/api/words/simple').set('Authorization', `Bearer ${token}`);
        const row = list.body.items.find((w) => w.id === res.body.id);

        expect(row.dataEN).toBe('eat');
        expect(row.dataDE).toBe('essen');
    });

    it('extracts the primary case per language for an Adjective', async () => {
        const res = await create(token, {
            partOfSpeech: 'Adjective',
            translations: [
                { language: 'English', cases: [{ word: 'fast', caseName: 'positiveEN' }] },
                { language: 'Estonian', cases: [{ word: 'kiire', caseName: 'algvorreEE' }] },
            ],
        });

        const list = await request(app).get('/api/words/simple').set('Authorization', `Bearer ${token}`);
        const row = list.body.items.find((w) => w.id === res.body.id);

        expect(row.dataEN).toBe('fast');
        expect(row.dataEE).toBe('kiire');
    });

    it('extracts the primary case per language for an Adverb', async () => {
        const res = await create(token, {
            partOfSpeech: 'Adverb',
            translations: [
                { language: 'English', cases: [{ word: 'quickly', caseName: 'adverbEN' }] },
                { language: 'Spanish', cases: [{ word: 'rápidamente', caseName: 'adverbES' }] },
            ],
        });

        const list = await request(app).get('/api/words/simple').set('Authorization', `Bearer ${token}`);
        const row = list.body.items.find((w) => w.id === res.body.id);

        expect(row.dataEN).toBe('quickly');
        expect(row.dataES).toBe('rápidamente');
    });

    it('does not 500 on an unrecognised language for a recognised part of speech', async () => {
        const res = await create(token, {
            partOfSpeech: 'Noun',
            translations: [
                { language: 'French', cases: [{ word: 'chat', caseName: 'singularFR' }] },
                { language: 'English', cases: [{ word: 'cat', caseName: 'singularEN' }] },
            ],
        });

        const list = await request(app).get('/api/words/simple').set('Authorization', `Bearer ${token}`);
        expect(list.statusCode).toBe(200);
        const row = list.body.items.find((w) => w.id === res.body.id);
        expect(row.dataEN).toBe('cat');
        expect(row.dataFR).toBeUndefined();
    });

    it('does not 500 on an unrecognised part of speech', async () => {
        const res = await create(token, {
            partOfSpeech: 'Preposition',
            translations: [t('English', 'under', 'someCaseEN'), t('Spanish', 'bajo', 'someCaseES')],
        });

        const list = await request(app).get('/api/words/simple').set('Authorization', `Bearer ${token}`);
        expect(list.statusCode).toBe(200);
        const row = list.body.items.find((w) => w.id === res.body.id);
        expect(row).toBeDefined();
        expect(row.dataEN).toBeUndefined();
    });
});

// ===========================================================================
// Filters
// ===========================================================================
describe('GET /api/words/simple - filters', () => {
    let token;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
    });

    it('filters by a single pos value', async () => {
        const noun = await create(token, {
            partOfSpeech: 'Noun',
            translations: [t('English', 'cat', 'singularEN'), t('Spanish', 'gato', 'singularES')],
        });
        const verb = await create(token, wordPayload());

        const res = await request(app).get('/api/words/simple?pos=Noun').set('Authorization', `Bearer ${token}`);
        const ids = res.body.items.map((w) => w.id);
        expect(ids).toContain(noun.body.id);
        expect(ids).not.toContain(verb.body.id);
        expect(res.body.total).toBe(1);
    });

    it('filters by multiple pos values (repeated key)', async () => {
        const noun = await create(token, {
            partOfSpeech: 'Noun',
            translations: [t('English', 'cat', 'singularEN'), t('Spanish', 'gato', 'singularES')],
        });
        const verb = await create(token, wordPayload());
        const adverb = await create(token, {
            partOfSpeech: 'Adverb',
            translations: [t('English', 'quickly', 'adverbEN'), t('Spanish', 'rápidamente', 'adverbES')],
        });

        const res = await request(app).get('/api/words/simple?pos=Noun&pos=Verb').set('Authorization', `Bearer ${token}`);
        const ids = res.body.items.map((w) => w.id);
        expect(ids).toContain(noun.body.id);
        expect(ids).toContain(verb.body.id);
        expect(ids).not.toContain(adverb.body.id);
    });

    it('filters by gender', async () => {
        const masc = await create(token, {
            partOfSpeech: 'Noun',
            translations: [
                { language: 'English', cases: [{ word: 'dog', caseName: 'singularEN' }] },
                { language: 'German', cases: [{ word: 'Hund', caseName: 'singularNominativDE' }, { word: 'Maskulin', caseName: 'genderDE' }] },
            ],
        });
        const fem = await create(token, {
            partOfSpeech: 'Noun',
            translations: [
                { language: 'English', cases: [{ word: 'cat', caseName: 'singularEN' }] },
                { language: 'German', cases: [{ word: 'Katze', caseName: 'singularNominativDE' }, { word: 'Feminin', caseName: 'genderDE' }] },
            ],
        });

        const res = await request(app).get('/api/words/simple?gender=Maskulin').set('Authorization', `Bearer ${token}`);
        const ids = res.body.items.map((w) => w.id);
        expect(ids).toContain(masc.body.id);
        expect(ids).not.toContain(fem.body.id);
    });

    it('finds a word by translation text via q', async () => {
        const target = await create(token, wordPayload());
        const other = await create(token, {
            partOfSpeech: 'Noun',
            translations: [t('English', 'cat', 'singularEN'), t('Spanish', 'gato', 'singularES')],
        });

        const res = await request(app).get('/api/words/simple?q=jooksma').set('Authorization', `Bearer ${token}`);
        const ids = res.body.items.map((w) => w.id);
        expect(ids).toContain(target.body.id);
        expect(ids).not.toContain(other.body.id);
    });

    it('tag filter includes a word the requester owns and tagged', async () => {
        const owner = await registerAndLogin('Owner', 'owner@test.com', 'owner', 'pass123');
        const [tag] = await db.insert(tags).values({ authorId: owner.id, label: 'Kitchen', visibility: 'Private' }).returning();
        const tagged = await create(owner.token, wordPayload({ tags: [{ _id: tag.id }] }));

        const res = await request(app).get(`/api/words/simple?tag=${tag.id}`).set('Authorization', `Bearer ${owner.token}`);
        const ids = res.body.items.map((w) => w.id);
        expect(ids).toContain(tagged.body.id);
    });

    it('tag filter still respects the access condition (does not leak another user\'s tagged words)', async () => {
        const owner = await registerAndLogin('Owner2', 'owner2@test.com', 'owner2', 'pass123');
        const stranger = await registerAndLogin('Stranger', 'stranger@test.com', 'stranger', 'pass123');
        const [tag] = await db.insert(tags).values({ authorId: owner.id, label: 'Private', visibility: 'Private' }).returning();
        await create(owner.token, wordPayload({ tags: [{ _id: tag.id }] }));

        const res = await request(app)
            .get(`/api/words/simple?tag=${tag.id}`)
            .set('Authorization', `Bearer ${stranger.token}`);
        expect(res.body.items).toEqual([]);
    });
});

// ===========================================================================
// Pagination
// ===========================================================================
describe('GET /api/words/simple - pagination', () => {
    it('pages consistently and excludes words inserted after the cursor was issued', async () => {
        const { token } = await registerAndLogin();
        const createdIds = [];
        for (const label of ['a', 'b', 'c']) {
            const r = await create(token, {
                translations: [t('English', label, 'simplePresent1sEN'), t('Estonian', label, 'infinitiveMaEE')],
            });
            createdIds.push(r.body.id);
        }

        const page1 = await request(app).get('/api/words/simple?limit=2').set('Authorization', `Bearer ${token}`);
        expect(page1.body.items).toHaveLength(2);
        expect(page1.body.nextCursor).not.toBeNull();
        expect(page1.body.total).toBe(3);

        // Insert a fourth word AFTER page 1's cursor was issued.
        const dRes = await create(token, {
            translations: [t('English', 'd', 'simplePresent1sEN'), t('Estonian', 'd', 'infinitiveMaEE')],
        });

        const page2 = await request(app)
            .get(`/api/words/simple?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
            .set('Authorization', `Bearer ${token}`);
        expect(page2.body.items).toHaveLength(1);
        expect(page2.body.nextCursor).toBeNull();
        // The filtered total is computed before the cursor is applied, so it
        // reflects the count as of THIS request (now 4, the word inserted
        // between pages included) rather than page 1's total of 3 — it is
        // stable across pages of the SAME request sequence, not a frozen
        // snapshot from when the cursor was issued.
        expect(page2.body.total).toBe(4);

        const allIds = [...page1.body.items, ...page2.body.items].map((w) => w.id);
        expect(new Set(allIds)).toEqual(new Set(createdIds));
        expect(allIds).not.toContain(dRes.body.id);
    });

    it('rejects a malformed cursor with 400', async () => {
        const { token } = await registerAndLogin();
        const res = await request(app)
            .get('/api/words/simple?cursor=not-valid-base64!!')
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(400);
    });
});

// ===========================================================================
// Followed-tag access
// ===========================================================================
describe('GET /api/words/simple - followed-tag access', () => {
    it("includes a followed tag's words and excludes the same owner's untagged words", async () => {
        const owner = await registerAndLogin('Owner3', 'owner3@test.com', 'owner3', 'pass123');
        const follower = await registerAndLogin('Follower', 'follower@test.com', 'follower', 'pass123');
        const [tag] = await db.insert(tags).values({ authorId: owner.id, label: 'Shared', visibility: 'Public' }).returning();

        const taggedWord = await create(owner.token, wordPayload({ tags: [{ _id: tag.id }] }));
        const untaggedWord = await create(owner.token, {
            translations: [t('English', 'other', 'simplePresent1sEN'), t('Estonian', 'teine', 'infinitiveMaEE')],
        });

        await db.insert(userFollowingTags).values({ tagId: tag.id, followerUserId: follower.id });

        const res = await request(app).get('/api/words/simple').set('Authorization', `Bearer ${follower.token}`);
        const ids = res.body.items.map((w) => w.id);
        expect(ids).toContain(taggedWord.body.id);
        expect(ids).not.toContain(untaggedWord.body.id);
    });
});
