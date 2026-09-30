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
