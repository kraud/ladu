/**
 * Practice configurations API — Integration Tests
 *
 * Phase 5.5 Slice 1 (phase-5-5-saved-practice.md §5):
 *   GET    /api/practice/configs
 *   POST   /api/practice/configs
 *   PUT    /api/practice/configs/:id
 *   DELETE /api/practice/configs/:id
 * The pure validation is pinned in tests/unit/exercisesConfigValidate.test.js;
 * this file tests the HTTP contract, ownership, unique names and `missingCount`.
 */

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const app = require('../app');
const testDb = require('./db');
const { pool } = require('../src/db');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const register = async (name, email, username) => {
    await request(app)
        .post('/api/users')
        .send({ name, email, username, password: 'pass123', languages: ['English', 'Spanish'] });
    const r = await request(app).post('/api/users/login').send({ email, password: 'pass123' });
    return r.body;
};

const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

const postNoun = async (user, en, es) => {
    const res = await request(app)
        .post('/api/words')
        .set(auth(user))
        .send({
            partOfSpeech: 'Noun',
            translations: [
                { language: 'English', cases: [{ word: en, caseName: 'singularEN' }] },
                { language: 'Spanish', cases: [{ word: es, caseName: 'singularES' }] },
            ],
            tags: [],
        });
    expect(res.statusCode).toBe(200);
    return res.body;
};

const params = (over = {}) => ({
    languages: ['English', 'Spanish'],
    partsOfSpeech: ['Noun', 'Verb'],
    amount: 12,
    type: 'Multiple-Choice',
    multiLang: 'Multi-Language',
    difficultyMC: 2,
    strictnessTI: 3,
    wordSelection: 'Random',
    excludeNative: true,
    ...over,
});

const configBody = (over = {}) => ({ name: 'Morning drill', description: 'Quick nouns', params: params(), ...over });

const create = (user, over) => request(app).post('/api/practice/configs').set(auth(user)).send(configBody(over));

describe('practice configs — auth', () => {
    it.each([
        ['get', '/api/practice/configs'],
        ['get', '/api/practice/configs/11111111-1111-4111-8111-111111111111/words'],
        ['post', '/api/practice/configs'],
        ['put', '/api/practice/configs/11111111-1111-4111-8111-111111111111'],
        ['delete', '/api/practice/configs/11111111-1111-4111-8111-111111111111'],
    ])('%s %s needs a token', async (method, url) => {
        const res = await request(app)[method](url);
        expect(res.statusCode).toBe(401);
    });
});

describe('POST /api/practice/configs', () => {
    it('creates a configuration without words', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const res = await create(user);
        expect(res.statusCode).toBe(201);
        expect(res.body).toMatchObject({
            name: 'Morning drill',
            description: 'Quick nouns',
            wordIds: null,
            missingCount: 0,
            params: params(),
        });
        expect(res.body.id).toEqual(expect.any(String));
    });

    it('accepts wordIds: null and description: null, as the frontend sends them', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const res = await create(user, { wordIds: null, description: null });
        expect(res.statusCode).toBe(201);
        expect(res.body).toMatchObject({ wordIds: null, description: null, missingCount: 0 });
    });

    it('keeps the tags the words were chosen by, next to the words', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const word = await postNoun(user, 'house', 'casa');
        const tagId = '3f0c1f7e-6a0b-4c43-9a4a-0e0a8d1d3b11';
        const res = await create(user, { wordIds: [word.id], tagIds: [tagId, tagId] });
        expect(res.statusCode).toBe(201);
        expect(res.body).toMatchObject({ wordIds: [word.id], tagIds: [tagId] });

        const list = await request(app).get('/api/practice/configs').set(auth(user));
        expect(list.body[0].tagIds).toEqual([tagId]);
    });

    it('tagIds is null when the words were not chosen by tag (also for a body without the field)', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const res = await create(user);
        expect(res.statusCode).toBe(201);
        expect(res.body.tagIds).toBeNull();
    });

    it('refuses tag ids that are not valid ids', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const res = await create(user, { tagIds: ['nope'] });
        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe('invalid_tag_ids');
    });

    it('creates a configuration with words', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const word = await postNoun(user, 'house', 'casa');
        const res = await create(user, { wordIds: [word.id] });
        expect(res.statusCode).toBe(201);
        expect(res.body.wordIds).toEqual([word.id]);
        expect(res.body.missingCount).toBe(0);
    });

    it('returns 400 with a code for invalid settings', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const res = await create(user, { params: params({ amount: 0 }) });
        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe('invalid_amount');
        const noName = await create(user, { name: '  ' });
        expect(noName.statusCode).toBe(400);
        expect(noName.body.code).toBe('invalid_name');
    });

    it('returns 409 name_taken for the same name, ignoring letter case', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        expect((await create(user)).statusCode).toBe(201);
        const res = await create(user, { name: 'MORNING DRILL' });
        expect(res.statusCode).toBe(409);
        expect(res.body.code).toBe('name_taken');
    });

    it('lets two users use the same name', async () => {
        const ann = await register('Ann', 'ann@test.com', 'ann');
        const bob = await register('Bob', 'bob@test.com', 'bob');
        expect((await create(ann)).statusCode).toBe(201);
        expect((await create(bob)).statusCode).toBe(201);
    });
});

describe('GET /api/practice/configs', () => {
    it('lists only the own configurations, newest first', async () => {
        const ann = await register('Ann', 'ann@test.com', 'ann');
        const bob = await register('Bob', 'bob@test.com', 'bob');
        await create(ann, { name: 'First' });
        await create(ann, { name: 'Second' });
        await create(bob, { name: 'Bob only' });

        const res = await request(app).get('/api/practice/configs').set(auth(ann));
        expect(res.statusCode).toBe(200);
        expect(res.body.map((c) => c.name)).toEqual(['Second', 'First']);
    });

    it('counts saved words the user can no longer see', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const kept = await postNoun(user, 'house', 'casa');
        const gone = await postNoun(user, 'dog', 'perro');
        await create(user, { name: 'With words', wordIds: [kept.id, gone.id] });
        await create(user, { name: 'No words' });

        await request(app).delete(`/api/words/${gone.id}`).set(auth(user)).expect(200);

        const res = await request(app).get('/api/practice/configs').set(auth(user));
        const byName = Object.fromEntries(res.body.map((c) => [c.name, c]));
        expect(byName['With words'].missingCount).toBe(1);
        expect(byName['With words'].wordIds).toEqual([kept.id, gone.id]);
        expect(byName['No words'].missingCount).toBe(0);
    });

    it('counts every word as missing when it belongs to someone else', async () => {
        const ann = await register('Ann', 'ann@test.com', 'ann');
        const bob = await register('Bob', 'bob@test.com', 'bob');
        const bobsWord = await postNoun(bob, 'cat', 'gato');
        await create(ann, { wordIds: [bobsWord.id] });

        const res = await request(app).get('/api/practice/configs').set(auth(ann));
        expect(res.body[0].missingCount).toBe(1);
    });
});

describe('GET /api/practice/configs/:id/words', () => {
    it('returns the visible saved words in the saved order, in the Review row shape', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const a = await postNoun(user, 'house', 'casa');
        const b = await postNoun(user, 'dog', 'perro');
        const gone = await postNoun(user, 'cat', 'gato');
        const { body: created } = await create(user, { wordIds: [b.id, gone.id, a.id] });
        await request(app).delete(`/api/words/${gone.id}`).set(auth(user)).expect(200);

        const res = await request(app).get(`/api/practice/configs/${created.id}/words`).set(auth(user));
        expect(res.statusCode).toBe(200);
        expect(res.body.map((w) => w.id)).toEqual([b.id, a.id]);
        expect(res.body[0]).toMatchObject({ partOfSpeech: 'Noun', storedLanguages: expect.arrayContaining(['English', 'Spanish']) });
    });

    it('returns an empty list for a configuration without words', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const { body: created } = await create(user);
        const res = await request(app).get(`/api/practice/configs/${created.id}/words`).set(auth(user));
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('does not return words the user cannot see', async () => {
        const ann = await register('Ann', 'ann@test.com', 'ann');
        const bob = await register('Bob', 'bob@test.com', 'bob');
        const bobsWord = await postNoun(bob, 'cat', 'gato');
        const { body: created } = await create(ann, { wordIds: [bobsWord.id] });
        const res = await request(app).get(`/api/practice/configs/${created.id}/words`).set(auth(ann));
        expect(res.body).toEqual([]);
    });

    it('returns 404 for another user’s row, a missing row and a bad id', async () => {
        const ann = await register('Ann', 'ann@test.com', 'ann');
        const bob = await register('Bob', 'bob@test.com', 'bob');
        const { body: created } = await create(ann);
        expect((await request(app).get(`/api/practice/configs/${created.id}/words`).set(auth(bob))).statusCode).toBe(404);
        expect(
            (await request(app).get('/api/practice/configs/11111111-1111-4111-8111-111111111111/words').set(auth(ann)))
                .statusCode,
        ).toBe(404);
        expect((await request(app).get('/api/practice/configs/x/words').set(auth(ann))).statusCode).toBe(404);
    });
});

describe('PUT /api/practice/configs/:id', () => {
    it('replaces name, description, settings and words', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const word = await postNoun(user, 'house', 'casa');
        const { body: created } = await create(user);

        const res = await request(app)
            .put(`/api/practice/configs/${created.id}`)
            .set(auth(user))
            .send(configBody({ name: 'Renamed', description: null, params: params({ amount: 5 }), wordIds: [word.id] }));
        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({
            id: created.id,
            name: 'Renamed',
            description: null,
            wordIds: [word.id],
            params: params({ amount: 5 }),
        });

        const list = await request(app).get('/api/practice/configs').set(auth(user));
        expect(list.body).toHaveLength(1);
        expect(list.body[0].name).toBe('Renamed');
    });

    it('replaces the tags too, and clears them when the body has none', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const tagId = '3f0c1f7e-6a0b-4c43-9a4a-0e0a8d1d3b11';
        const { body: created } = await create(user, { tagIds: [tagId] });
        expect(created.tagIds).toEqual([tagId]);

        const res = await request(app)
            .put(`/api/practice/configs/${created.id}`)
            .set(auth(user))
            .send(configBody({ tagIds: null }));
        expect(res.statusCode).toBe(200);
        expect(res.body.tagIds).toBeNull();
    });

    it('allows the own current name (also in another letter case)', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const { body: created } = await create(user);
        const res = await request(app)
            .put(`/api/practice/configs/${created.id}`)
            .set(auth(user))
            .send(configBody({ name: 'morning DRILL' }));
        expect(res.statusCode).toBe(200);
        expect(res.body.name).toBe('morning DRILL');
    });

    it('returns 409 name_taken for the name of another configuration', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        await create(user, { name: 'One' });
        const { body: two } = await create(user, { name: 'Two' });
        const res = await request(app)
            .put(`/api/practice/configs/${two.id}`)
            .set(auth(user))
            .send(configBody({ name: 'one' }));
        expect(res.statusCode).toBe(409);
        expect(res.body.code).toBe('name_taken');
    });

    it('returns 400 for invalid settings', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const { body: created } = await create(user);
        const res = await request(app)
            .put(`/api/practice/configs/${created.id}`)
            .set(auth(user))
            .send(configBody({ params: params({ type: 'Nope' }) }));
        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe('invalid_type');
    });

    it('returns 404 for another user’s row, a missing row and a bad id — and changes nothing', async () => {
        const ann = await register('Ann', 'ann@test.com', 'ann');
        const bob = await register('Bob', 'bob@test.com', 'bob');
        const { body: created } = await create(ann);

        const other = await request(app)
            .put(`/api/practice/configs/${created.id}`)
            .set(auth(bob))
            .send(configBody({ name: 'Hacked' }));
        expect(other.statusCode).toBe(404);
        const missing = await request(app)
            .put('/api/practice/configs/11111111-1111-4111-8111-111111111111')
            .set(auth(ann))
            .send(configBody());
        expect(missing.statusCode).toBe(404);
        const bad = await request(app).put('/api/practice/configs/not-an-id').set(auth(ann)).send(configBody());
        expect(bad.statusCode).toBe(404);

        const list = await request(app).get('/api/practice/configs').set(auth(ann));
        expect(list.body[0].name).toBe('Morning drill');
    });
});

describe('DELETE /api/practice/configs/:id', () => {
    it('deletes the own configuration', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const { body: created } = await create(user);
        const res = await request(app).delete(`/api/practice/configs/${created.id}`).set(auth(user));
        expect(res.statusCode).toBe(204);
        const list = await request(app).get('/api/practice/configs').set(auth(user));
        expect(list.body).toEqual([]);
    });

    it('returns 404 for another user’s row and keeps it', async () => {
        const ann = await register('Ann', 'ann@test.com', 'ann');
        const bob = await register('Bob', 'bob@test.com', 'bob');
        const { body: created } = await create(ann);
        const res = await request(app).delete(`/api/practice/configs/${created.id}`).set(auth(bob));
        expect(res.statusCode).toBe(404);
        const list = await request(app).get('/api/practice/configs').set(auth(ann));
        expect(list.body).toHaveLength(1);
    });

    it('returns 404 for a missing row and a bad id', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const missing = await request(app)
            .delete('/api/practice/configs/11111111-1111-4111-8111-111111111111')
            .set(auth(user));
        expect(missing.statusCode).toBe(404);
        expect((await request(app).delete('/api/practice/configs/x').set(auth(user))).statusCode).toBe(404);
    });
});

describe('cascade', () => {
    it('removes the configurations when the user is deleted', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        await create(user);
        await pool.query('DELETE FROM users');
        const { rows } = await pool.query('SELECT count(*)::int AS n FROM practice_configs');
        expect(rows[0].n).toBe(0);
    });
});

// ===========================================================================
// A followed original is swapped for the user's own copy (words-clone-followed.md, Slice 7)
// ===========================================================================
describe('saved lists: a followed original is swapped for the user\'s copy', () => {
    /** Bob owns a Public tag with one word; Ann follows it and has an own word. */
    const setUp = async () => {
        const ann = await register('Ann', 'ann@test.com', 'ann');
        const bob = await register('Bob', 'bob@test.com', 'bob');
        const original = await postNoun(bob, 'tree', 'arbol');
        const tag = await request(app)
            .post('/api/tags')
            .set(auth(bob))
            .send({ label: 'Nature', visibility: 'Public', description: '', wordIds: [original.id] });
        await request(app).post(`/api/tags/${tag.body.id}/follow`).set(auth(ann)).expect(200);
        const own = await postNoun(ann, 'house', 'casa');
        return { ann, bob, original, own, tag: tag.body };
    };
    const wordsOf = async (user, configId) =>
        (await request(app).get(`/api/practice/configs/${configId}/words`).set(auth(user))).body.map((w) => w.id);
    const configOf = async (user, configId) =>
        (await request(app).get('/api/practice/configs').set(auth(user))).body.find((c) => c.id === configId);

    it('lists the original while there is no copy, and the copy once there is one (same place, no missing word)', async () => {
        const { ann, original, own } = await setUp();
        const { body: config } = await create(ann, { wordIds: [original.id, own.id] });
        expect(await wordsOf(ann, config.id)).toEqual([original.id, own.id]);

        const copy = (await request(app).post(`/api/words/${original.id}/clone`).set(auth(ann))).body;

        expect(await wordsOf(ann, config.id)).toEqual([copy.id, own.id]);
        const listed = await configOf(ann, config.id);
        expect(listed.missingCount).toBe(0);
        // Nothing is stored: the saved ids are still the original's.
        expect(listed.wordIds).toEqual([original.id, own.id]);
    });

    it('the list goes back to the original when the copy is deleted', async () => {
        const { ann, original, own } = await setUp();
        const { body: config } = await create(ann, { wordIds: [original.id, own.id] });
        const copy = (await request(app).post(`/api/words/${original.id}/clone`).set(auth(ann))).body;
        expect(await wordsOf(ann, config.id)).toEqual([copy.id, own.id]);

        await request(app).delete(`/api/words/${copy.id}`).set(auth(ann)).expect(200);

        expect(await wordsOf(ann, config.id)).toEqual([original.id, own.id]);
    });

    it('keeps a word once when the list holds both the original and the copy', async () => {
        const { ann, original, own } = await setUp();
        const copy = (await request(app).post(`/api/words/${original.id}/clone`).set(auth(ann))).body;
        const { body: config } = await create(ann, { wordIds: [original.id, own.id, copy.id] });

        expect(await wordsOf(ann, config.id)).toEqual([copy.id, own.id]);
    });

    it('the copy is practised even when the tag is no longer visible (the copy is the user\'s own)', async () => {
        const { ann, bob, original, own, tag } = await setUp();
        const { body: config } = await create(ann, { wordIds: [original.id, own.id] });
        const copy = (await request(app).post(`/api/words/${original.id}/clone`).set(auth(ann))).body;

        await request(app).patch(`/api/tags/${tag.id}`).set(auth(bob)).send({ visibility: 'Private' });

        expect(await wordsOf(ann, config.id)).toEqual([copy.id, own.id]);
        expect((await configOf(ann, config.id)).missingCount).toBe(0);
    });

    it('does not touch the list of a user who has no copy, and never swaps an own word', async () => {
        const { ann, bob, original, tag } = await setUp();
        const cara = await register('Cara', 'cara@test.com', 'cara');
        await request(app).post(`/api/tags/${tag.id}/follow`).set(auth(cara)).expect(200);
        const { body: config } = await create(cara, { wordIds: [original.id] });
        await request(app).post(`/api/words/${original.id}/clone`).set(auth(ann)).expect(201);

        expect(await wordsOf(cara, config.id)).toEqual([original.id]);

        // Bob's own word is not swapped, even though Ann copied it.
        const { body: bobsConfig } = await create(bob, { wordIds: [original.id] });
        expect(await wordsOf(bob, bobsConfig.id)).toEqual([original.id]);
    });

    it('a saved ORIGINAL with no copy still counts as missing once the tag turns Private', async () => {
        const { ann, bob, original, tag } = await setUp();
        const { body: config } = await create(ann, { wordIds: [original.id] });
        await request(app).patch(`/api/tags/${tag.id}`).set(auth(bob)).send({ visibility: 'Private' });

        expect((await configOf(ann, config.id)).missingCount).toBe(1);
        expect(await wordsOf(ann, config.id)).toEqual([]);
    });
});
