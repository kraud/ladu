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
 *
 * Words pagination Slice 1 (.context/plans/words-pagination.md) added offset
 * mode: `?page=N&limit=1..200|all` returns `{ items, total, page, pageSize }`
 * (`pageSize` null for `all`; no `nextCursor`; `page` + `cursor` is a 400), and
 * the `owner=me` filter (own words only, in both modes).
 */

// Must run before `require('../app')` below — see auth.test.js's comment on
// this same pattern for why (this file isn't Babel/ts-jest transformed, so
// jest.mock hoisting never applies to it).
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('./request');
const app = require('../app');
const testDb = require('./db');
const { pool, db } = require('../src/db');
const { tags, userFollowingTags } = require('../src/db/schema');
const { eq } = require('drizzle-orm');

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
    tagIds: [],
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

    it('extracts the primary case per language for a Conjunction, and search skips its property rows', async () => {
        const res = await create(token, {
            partOfSpeech: 'Conjunction',
            translations: [
                {
                    language: 'German',
                    cases: [
                        { word: 'weder', caseName: 'conjunctionDE' },
                        { word: 'Coordinating', caseName: 'conjunctionTypeDE' },
                        { word: 'true', caseName: 'correlativeDE' },
                        { word: 'noch', caseName: 'secondPartDE' },
                    ],
                },
                {
                    language: 'Spanish',
                    cases: [
                        { word: 'ni', caseName: 'conjunctionES' },
                        { word: 'Subordinating', caseName: 'conjunctionTypeES' },
                        { word: 'Subjunctive', caseName: 'moodES' },
                    ],
                },
            ],
        });
        expect(res.status).toBe(200);

        const list = await request(app).get('/api/words/simple').set('Authorization', `Bearer ${token}`);
        const row = list.body.items.find((w) => w.id === res.body.id);
        expect(row.dataDE).toBe('weder');
        expect(row.dataES).toBe('ni');

        const search = async (q) => (await request(app).get(`/api/words/simple?q=${q}`).set('Authorization', `Bearer ${token}`)).body.items;
        expect(await search('noch')).toHaveLength(1); // the second part is a written form
        expect(await search('Coordinating')).toHaveLength(0); // the type is a property
        expect(await search('Subjunctive')).toHaveLength(0); // the mood is a property
    });

    it('extracts the primary case per language for a Preposition, and search skips its property rows', async () => {
        const res = await create(token, {
            partOfSpeech: 'Preposition',
            translations: [
                {
                    language: 'German',
                    cases: [
                        { word: 'wegen', caseName: 'prepositionDE' },
                        { word: 'Before the noun', caseName: 'positionDE' },
                        { word: 'G', caseName: 'governedCaseDE' },
                        { word: 'true', caseName: 'contractsDE' },
                        { word: 'zum', caseName: 'withDemDE' },
                    ],
                },
                {
                    language: 'Estonian',
                    cases: [
                        { word: 'sees', caseName: 'prepositionEE' },
                        { word: 'After the noun', caseName: 'positionEE' },
                        { word: 'Genitive', caseName: 'governedCasePostEE' },
                        { word: 'true', caseName: 'spatialSeriesEE' },
                        { word: 'sisse', caseName: 'directionToEE' },
                        { word: 'seest', caseName: 'directionFromEE' },
                    ],
                },
            ],
        });
        expect(res.status).toBe(200);

        const list = await request(app).get('/api/words/simple').set('Authorization', `Bearer ${token}`);
        const row = list.body.items.find((w) => w.id === res.body.id);
        expect(row.dataDE).toBe('wegen');
        expect(row.dataEE).toBe('sees');

        const search = async (q) => (await request(app).get(`/api/words/simple?q=${q}`).set('Authorization', `Bearer ${token}`)).body.items;
        expect(await search('zum')).toHaveLength(1); // a contraction is a written form
        expect(await search('seest')).toHaveLength(1); // so is a direction form
        expect(await search('Genitive')).toHaveLength(0); // the governed case is a property
        expect(await search('Before')).toHaveLength(0); // the position is a property
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
                { language: 'Klingon', cases: [{ word: 'chat', caseName: 'singularKL' }] },
                { language: 'English', cases: [{ word: 'cat', caseName: 'singularEN' }] },
            ],
        });

        const list = await request(app).get('/api/words/simple').set('Authorization', `Bearer ${token}`);
        expect(list.statusCode).toBe(200);
        const row = list.body.items.find((w) => w.id === res.body.id);
        expect(row.dataEN).toBe('cat');
        expect(row.dataKL).toBeUndefined();
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
        const tagged = await create(owner.token, wordPayload({ tagIds: [tag.id] }));

        const res = await request(app).get(`/api/words/simple?tag=${tag.id}`).set('Authorization', `Bearer ${owner.token}`);
        const ids = res.body.items.map((w) => w.id);
        expect(ids).toContain(tagged.body.id);
    });

    it('tag filter still respects the access condition (does not leak another user\'s tagged words)', async () => {
        const owner = await registerAndLogin('Owner2', 'owner2@test.com', 'owner2', 'pass123');
        const stranger = await registerAndLogin('Stranger', 'stranger@test.com', 'stranger', 'pass123');
        const [tag] = await db.insert(tags).values({ authorId: owner.id, label: 'Private', visibility: 'Private' }).returning();
        await create(owner.token, wordPayload({ tagIds: [tag.id] }));

        const res = await request(app)
            .get(`/api/words/simple?tag=${tag.id}`)
            .set('Authorization', `Bearer ${stranger.token}`);
        expect(res.body.items).toEqual([]);
    });

    // Phase 4 Slice 6: `/tag/:id` previews a Public tag's words before the
    // viewer follows it (matching the word count `/tags` already shows a
    // non-follower) — a stranger sees a Public tag's words via `?tag=`, but
    // a Private one still resolves to nothing.
    it('a stranger can preview a Public tag\'s words via ?tag= without following it', async () => {
        const owner = await registerAndLogin('Owner7', 'owner7@test.com', 'owner7', 'pass123');
        const stranger = await registerAndLogin('Stranger2', 'stranger2@test.com', 'stranger2', 'pass123');
        const [tag] = await db.insert(tags).values({ authorId: owner.id, label: 'Kitchen', visibility: 'Public' }).returning();
        const tagged = await create(owner.token, wordPayload({ tagIds: [tag.id] }));

        const res = await request(app)
            .get(`/api/words/simple?tag=${tag.id}`)
            .set('Authorization', `Bearer ${stranger.token}`);
        const ids = res.body.items.map((w) => w.id);
        expect(ids).toContain(tagged.body.id);
    });

    it('a stranger cannot preview a Private tag\'s words via ?tag=', async () => {
        const owner = await registerAndLogin('Owner8', 'owner8@test.com', 'owner8', 'pass123');
        const stranger = await registerAndLogin('Stranger3', 'stranger3@test.com', 'stranger3', 'pass123');
        const [tag] = await db.insert(tags).values({ authorId: owner.id, label: 'Secret', visibility: 'Private' }).returning();
        await create(owner.token, wordPayload({ tagIds: [tag.id] }));

        const res = await request(app)
            .get(`/api/words/simple?tag=${tag.id}`)
            .set('Authorization', `Bearer ${stranger.token}`);
        expect(res.body.items).toEqual([]);
    });

    // D15 (phase-4-tags.md, corrected 2026-09-28): selecting several tags is
    // additive (OR/union) — a word matching ANY of them qualifies. Regression
    // guard against "fixing" this `inArray` into an AND/`count(distinct
    // tag_id)` form, which the UI deliberately does not want (see D15).
    it('tag filter is additive across multiple tags (OR, not AND)', async () => {
        const owner = await registerAndLogin('Owner6', 'owner6@test.com', 'owner6', 'pass123');
        const [tagA] = await db.insert(tags).values({ authorId: owner.id, label: 'A', visibility: 'Private' }).returning();
        const [tagB] = await db.insert(tags).values({ authorId: owner.id, label: 'B', visibility: 'Private' }).returning();
        const onlyA = await create(owner.token, wordPayload({
            tagIds: [tagA.id],
            translations: [t('English', 'onlyA', 'simplePresent1sEN'), t('Estonian', 'ainultA', 'infinitiveMaEE')],
        }));
        const onlyB = await create(owner.token, wordPayload({
            tagIds: [tagB.id],
            translations: [t('English', 'onlyB', 'simplePresent1sEN'), t('Estonian', 'ainultB', 'infinitiveMaEE')],
        }));
        const neither = await create(owner.token, wordPayload({
            translations: [t('English', 'neither', 'simplePresent1sEN'), t('Estonian', 'kumbki', 'infinitiveMaEE')],
        }));

        const res = await request(app)
            .get(`/api/words/simple?tag=${tagA.id}&tag=${tagB.id}`)
            .set('Authorization', `Bearer ${owner.token}`);
        const ids = res.body.items.map((w) => w.id);

        expect(ids).toContain(onlyA.body.id);
        expect(ids).toContain(onlyB.body.id);
        expect(ids).not.toContain(neither.body.id);
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
// Offset pagination (?page=) and ?owner=me
// ===========================================================================
describe('GET /api/words/simple - offset pagination', () => {
    let token;
    let userId;
    let createdIds;

    // 5 words, created a, b, c, d, e (the default order is newest first: e, d, c, b, a).
    beforeEach(async () => {
        const me = await registerAndLogin();
        token = me.token;
        userId = me.id;
        createdIds = [];
        for (const label of ['a', 'b', 'c', 'd', 'e']) {
            const r = await create(token, {
                translations: [t('English', label, 'simplePresent1sEN'), t('Estonian', label, 'infinitiveMaEE')],
            });
            createdIds.push(r.body.id);
        }
    });

    const get = (query, auth = token) =>
        request(app).get(`/api/words/simple?${query}`).set('Authorization', `Bearer ${auth}`);

    it('returns pages that do not overlap and together hold every word', async () => {
        const page1 = await get('page=1&limit=2');
        const page2 = await get('page=2&limit=2');
        const page3 = await get('page=3&limit=2');

        expect(page1.statusCode).toBe(200);
        expect(page1.body.items).toHaveLength(2);
        expect(page2.body.items).toHaveLength(2);
        expect(page3.body.items).toHaveLength(1);

        const allIds = [...page1.body.items, ...page2.body.items, ...page3.body.items].map((w) => w.id);
        expect(allIds).toEqual([...createdIds].reverse());
    });

    it('returns total, page and pageSize, and no nextCursor', async () => {
        const res = await get('page=2&limit=2');
        expect(res.body.total).toBe(5);
        expect(res.body.page).toBe(2);
        expect(res.body.pageSize).toBe(2);
        expect(res.body).not.toHaveProperty('nextCursor');
    });

    it('uses a page size of 50 when limit is not given', async () => {
        const res = await get('page=1');
        expect(res.body.pageSize).toBe(50);
        expect(res.body.items).toHaveLength(5);
    });

    it('returns every word for limit=all, with pageSize null', async () => {
        const res = await get('page=1&limit=all');
        expect(res.statusCode).toBe(200);
        expect(res.body.items).toHaveLength(5);
        expect(res.body.total).toBe(5);
        expect(res.body.pageSize).toBeNull();
    });

    it('accepts a page size of 200', async () => {
        const res = await get('page=1&limit=200');
        expect(res.statusCode).toBe(200);
        expect(res.body.pageSize).toBe(200);
    });

    it('returns no items for a page after the last one, with the correct total', async () => {
        const res = await get('page=9&limit=2');
        expect(res.statusCode).toBe(200);
        expect(res.body.items).toEqual([]);
        expect(res.body.total).toBe(5);
    });

    it('works with a language sort and keeps the words without text last across the page boundary', async () => {
        await create(token, {
            partOfSpeech: 'Noun',
            translations: [t('Spanish', 'pez', 'singularES'), t('Estonian', 'kala', 'singularNimetavEE')],
        });
        const page1 = await get('page=1&limit=3&sort=EN&dir=asc');
        const page2 = await get('page=2&limit=3&sort=EN&dir=asc');
        const english = (res) => res.body.items.map((w) => w.dataEN?.word ?? w.dataEN ?? null);
        expect([...english(page1), ...english(page2)]).toEqual(['a', 'b', 'c', 'd', 'e', null]);
    });

    it('applies the filters before paging', async () => {
        await create(token, {
            partOfSpeech: 'Noun',
            translations: [t('Spanish', 'pez', 'singularES'), t('Estonian', 'kala', 'singularNimetavEE')],
        });
        const res = await get('page=1&limit=2&pos=Noun');
        expect(res.body.total).toBe(1);
        expect(res.body.items).toHaveLength(1);
    });

    it.each([
        ['page=0'],
        ['page=-1'],
        ['page=abc'],
        ['page=1.5'],
        ['page=1&limit=201'],
        ['page=1&limit=0'],
        ['page=1&limit=abc'],
    ])('rejects %s with 400', async (query) => {
        const res = await get(query);
        expect(res.statusCode).toBe(400);
    });

    it('rejects page together with cursor with 400', async () => {
        const first = await get('limit=2');
        const res = await get(`page=1&cursor=${encodeURIComponent(first.body.nextCursor)}`);
        expect(res.statusCode).toBe(400);
    });

    it('keeps the cursor mode unchanged when page is absent', async () => {
        const res = await get('limit=2');
        expect(res.body.items).toHaveLength(2);
        expect(res.body.nextCursor).not.toBeNull();
        expect(res.body).not.toHaveProperty('page');
    });

    it('with owner=me, leaves out words that come from followed tags', async () => {
        const owner = await registerAndLogin('Owner5', 'owner5@test.com', 'owner5', 'pass123');
        const [tag] = await db.insert(tags).values({ authorId: owner.id, label: 'Shared', visibility: 'Public' }).returning();
        const sharedWord = await create(owner.token, wordPayload({ tagIds: [tag.id] }));
        await db.insert(userFollowingTags).values({ tagId: tag.id, followerUserId: userId });

        const all = await get('page=1&limit=all');
        expect(all.body.items.map((w) => w.id)).toContain(sharedWord.body.id);
        expect(all.body.total).toBe(6);

        const mine = await get('page=1&limit=all&owner=me');
        expect(mine.body.items.map((w) => w.id)).not.toContain(sharedWord.body.id);
        expect(mine.body.total).toBe(5);
    });

    it('with owner=others, keeps only words that come from followed tags', async () => {
        const owner = await registerAndLogin('Owner9', 'owner9@test.com', 'owner9', 'pass123');
        const [tag] = await db.insert(tags).values({ authorId: owner.id, label: 'Shared', visibility: 'Public' }).returning();
        const sharedWord = await create(owner.token, wordPayload({ tagIds: [tag.id] }));
        await db.insert(userFollowingTags).values({ tagId: tag.id, followerUserId: userId });

        const others = await get('page=1&limit=all&owner=others');
        expect(others.body.items.map((w) => w.id)).toEqual([sharedWord.body.id]);
        expect(others.body.total).toBe(1);
    });

    it('ignores an unknown owner value', async () => {
        const res = await get('page=1&limit=all&owner=nobody');
        expect(res.statusCode).toBe(200);
        expect(res.body.total).toBe(5);
    });

    it('also accepts owner=me in cursor mode', async () => {
        const res = await get('owner=me');
        expect(res.body.total).toBe(5);
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

        const taggedWord = await create(owner.token, wordPayload({ tagIds: [tag.id] }));
        const untaggedWord = await create(owner.token, {
            translations: [t('English', 'other', 'simplePresent1sEN'), t('Estonian', 'teine', 'infinitiveMaEE')],
        });

        await db.insert(userFollowingTags).values({ tagId: tag.id, followerUserId: follower.id });

        const res = await request(app).get('/api/words/simple').set('Authorization', `Bearer ${follower.token}`);
        const ids = res.body.items.map((w) => w.id);
        expect(ids).toContain(taggedWord.body.id);
        expect(ids).not.toContain(untaggedWord.body.id);
    });

    // D9 (phase-4-tags.md): a follower loses access the moment the owner
    // turns the tag Private, without needing to unfollow — and regains it
    // automatically if the owner flips it back, since the follow row itself
    // was never touched.
    it('excludes a followed tag\'s words once the owner makes it Private, and re-includes them if made Public again', async () => {
        const owner = await registerAndLogin('Owner4', 'owner4@test.com', 'owner4', 'pass123');
        const follower = await registerAndLogin('Follower2', 'follower2@test.com', 'follower2', 'pass123');
        const [tag] = await db.insert(tags).values({ authorId: owner.id, label: 'Shared', visibility: 'Public' }).returning();
        const taggedWord = await create(owner.token, wordPayload({ tagIds: [tag.id] }));
        await db.insert(userFollowingTags).values({ tagId: tag.id, followerUserId: follower.id });

        const before = await request(app).get('/api/words/simple').set('Authorization', `Bearer ${follower.token}`);
        expect(before.body.items.map((w) => w.id)).toContain(taggedWord.body.id);

        await db.update(tags).set({ visibility: 'Private' }).where(eq(tags.id, tag.id));

        const during = await request(app).get('/api/words/simple').set('Authorization', `Bearer ${follower.token}`);
        expect(during.body.items.map((w) => w.id)).not.toContain(taggedWord.body.id);

        // The follow relationship itself is untouched by the visibility flip.
        const stillFollowing = await db.select().from(userFollowingTags).where(eq(userFollowingTags.tagId, tag.id));
        expect(stillFollowing).toHaveLength(1);

        await db.update(tags).set({ visibility: 'Public' }).where(eq(tags.id, tag.id));

        const after = await request(app).get('/api/words/simple').set('Authorization', `Bearer ${follower.token}`);
        expect(after.body.items.map((w) => w.id)).toContain(taggedWord.body.id);
    });

    // A follower must never see the owner's OTHER, unrelated Private tags
    // just because a shared word happens to carry one too (phase-4-tags.md,
    // "Why the backend is being rebuilt").
    it("shows a follower only the owner's Public tags on a shared word, not their unrelated Private ones", async () => {
        const owner = await registerAndLogin('Owner5', 'owner5@test.com', 'owner5', 'pass123');
        const follower = await registerAndLogin('Follower3', 'follower3@test.com', 'follower3', 'pass123');
        const [publicTag] = await db.insert(tags).values({ authorId: owner.id, label: 'Shared', visibility: 'Public' }).returning();
        const [privateTag] = await db.insert(tags).values({ authorId: owner.id, label: 'Secret', visibility: 'Private' }).returning();
        const sharedWord = await create(owner.token, wordPayload({ tagIds: [publicTag.id, privateTag.id] }));
        await db.insert(userFollowingTags).values({ tagId: publicTag.id, followerUserId: follower.id });

        const res = await request(app).get('/api/words/simple').set('Authorization', `Bearer ${follower.token}`);
        const row = res.body.items.find((w) => w.id === sharedWord.body.id);
        expect(row.tags.map((tg) => tg.id)).toEqual([publicTag.id]);
    });
});

// ===========================================================================
// Sorted by a language column: ?sort=EN&dir=asc|desc
// ===========================================================================
describe('GET /api/words/simple - sort by language', () => {
    let token;

    // English verbs with an Estonian partner; "kala" is a noun with no English text at all.
    const seed = async () => {
        for (const [en, ee] of [['banana', 'banaan'], ['Cherry', 'kirss'], ['apple', 'õun'], ['date', 'dattel']]) {
            await create(token, {
                translations: [t('English', en, 'simplePresent1sEN'), t('Estonian', ee, 'infinitiveMaEE')],
            });
        }
        await create(token, {
            partOfSpeech: 'Noun',
            translations: [t('Spanish', 'pez', 'singularES'), t('Estonian', 'kala', 'singularNimetavEE')],
        });
    };
    const get = (query) => request(app).get(`/api/words/simple?${query}`).set('Authorization', `Bearer ${token}`);
    const english = (res) => res.body.items.map((w) => w.dataEN ?? null).map((d) => d?.word ?? d);

    beforeEach(async () => {
        token = (await registerAndLogin()).token;
        await seed();
    });

    it('sorts ascending, ignoring case, with the words that have no text in the language last', async () => {
        const res = await get('sort=EN&dir=asc');
        expect(res.statusCode).toBe(200);
        expect(english(res)).toEqual(['apple', 'banana', 'Cherry', 'date', null]);
    });

    it('sorts descending and still puts the empty cell last', async () => {
        const res = await get('sort=EN&dir=desc');
        expect(english(res)).toEqual(['date', 'Cherry', 'banana', 'apple', null]);
    });

    it('pages through the sorted list with the cursor, with no word twice or missing', async () => {
        for (const dir of ['asc', 'desc']) {
            const seen = [];
            let cursor;
            for (let page = 0; page < 10; page++) {
                const res = await get(`sort=EN&dir=${dir}&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
                expect(res.statusCode).toBe(200);
                seen.push(...english(res));
                cursor = res.body.nextCursor;
                if (!cursor) break;
            }
            const whole = english(await get(`sort=EN&dir=${dir}`));
            expect(seen).toEqual(whole);
            expect(seen).toHaveLength(5);
        }
    });

    it('sorts by another language of the same words', async () => {
        const res = await get('sort=EE&dir=asc');
        const estonian = res.body.items.map((w) => (w.dataEE?.word ?? w.dataEE));
        expect(estonian).toEqual(['banaan', 'dattel', 'kala', 'kirss', 'õun']);
    });

    it('rejects an unknown language, an unknown direction and a cursor of the other kind', async () => {
        expect((await get('sort=XX')).statusCode).toBe(400);
        expect((await get('sort=EN&dir=sideways')).statusCode).toBe(400);
        const firstPage = await get('limit=2');
        expect((await get(`sort=EN&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`)).statusCode).toBe(400);
    });
});
