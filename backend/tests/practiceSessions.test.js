/**
 * Saved practice sessions API — Integration Tests
 *
 * Phase 5.5 Slice 3 (phase-5-5-saved-practice.md §5):
 *   GET    /api/practice/sessions
 *   GET    /api/practice/sessions/:id
 *   POST   /api/practice/sessions
 *   PUT    /api/practice/sessions/:id
 *   DELETE /api/practice/sessions/:id
 * The pure validation and summary are pinned in tests/unit/exercisesSessionValidate.test.js;
 * this file tests the HTTP contract, ownership, the limit of 10, the 7-day expiry and the body size.
 */

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const app = require('../app');
const testDb = require('./db');
const { pool } = require('../src/db');
const { MAX_SAVED_SESSIONS, SESSION_TTL_DAYS } = require('../services/exercises');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const DAY_MS = 24 * 60 * 60 * 1000;

const register = async (name, email, username) => {
    await request(app)
        .post('/api/users')
        .send({ name, email, username, password: 'pass123', languages: ['English', 'Spanish'] });
    const r = await request(app).post('/api/users/login').send({ email, password: 'pass123' });
    return r.body;
};

const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

const exercise = (over = {}) => ({
    key: 'k',
    type: 'Text-Input',
    multiLang: true,
    partOfSpeech: 'Noun',
    wordId: 'w',
    translationId: 't',
    prompt: { language: 'English', caseName: 'singularEN', value: 'house' },
    answer: { language: 'Spanish', caseName: 'singularES', value: 'casa' },
    performance: null,
    ...over,
});

/** A session snapshot as the frontend stores it. `tag` makes each one recognisable. */
const snapshot = (tag = 'a', over = {}) => ({
    userId: 'u1',
    params: { languages: ['English', 'Spanish'], amount: 2, tag },
    wordIds: null,
    preselected: null,
    requested: 2,
    exercises: [exercise(), exercise()],
    answers: [{ result: 'correct', given: 'casa', saveStatus: 'saved' }, null],
    current: 1,
    view: 'exercises',
    returnToResults: false,
    ...over,
});

const save = (user, tag = 'a', over) =>
    request(app).post('/api/practice/sessions').set(auth(user)).send({ snapshot: snapshot(tag, over) });

const list = async (user) => (await request(app).get('/api/practice/sessions').set(auth(user))).body;

const tagsOf = async (user) => {
    const items = await list(user);
    const full = await Promise.all(
        items.map((i) => request(app).get(`/api/practice/sessions/${i.id}`).set(auth(user))),
    );
    return full.map((r) => r.body.snapshot.params.tag).sort();
};

const countRows = async () => (await pool.query('SELECT count(*)::int AS n FROM practice_sessions')).rows[0].n;

describe('practice sessions — auth', () => {
    const ID = '11111111-1111-4111-8111-111111111111';
    it.each([
        ['get', '/api/practice/sessions'],
        ['get', `/api/practice/sessions/${ID}`],
        ['post', '/api/practice/sessions'],
        ['put', `/api/practice/sessions/${ID}`],
        ['delete', `/api/practice/sessions/${ID}`],
    ])('%s %s needs a token', async (method, url) => {
        expect((await request(app)[method](url)).statusCode).toBe(401);
    });
});

describe('POST /api/practice/sessions', () => {
    it('saves a session with a summary built by the server and a 7-day expiry', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const res = await request(app)
            .post('/api/practice/sessions')
            .set(auth(user))
            .send({ snapshot: snapshot(), summary: { answered: 99 } });

        expect(res.statusCode).toBe(201);
        expect(res.body.id).toEqual(expect.any(String));
        expect(res.body.snapshot).toEqual(snapshot());
        expect(res.body.summary).toEqual({
            answered: 1,
            correct: 1,
            total: 2,
            languages: ['English', 'Spanish'],
            partsOfSpeech: ['Noun'],
            cardTypes: ['Text-Input'],
        });
        const days = (new Date(res.body.expiresAt).getTime() - Date.now()) / DAY_MS;
        expect(SESSION_TTL_DAYS).toBe(7);
        expect(days).toBeGreaterThan(6.9);
        expect(days).toBeLessThan(7.1);
    });

    it('returns 400 with a code for a snapshot that is not valid', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const res = await save(user, 'a', { view: 'nope' });
        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe('invalid_snapshot');
        expect((await request(app).post('/api/practice/sessions').set(auth(user)).send({})).body.code).toBe(
            'invalid_snapshot',
        );
        expect(await countRows()).toBe(0);
    });

    it('accepts a snapshot larger than the 100 KB default of the JSON parser', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const preselected = Array.from({ length: 500 }, (_, i) => ({
            id: `id-${i}`,
            partOfSpeech: 'Noun',
            label: 'x'.repeat(300),
            languages: ['EN'],
        }));
        const res = await save(user, 'big', { preselected });
        expect(JSON.stringify(preselected).length).toBeGreaterThan(100_000);
        expect(res.statusCode).toBe(201);
    });

    it('returns 400 snapshot_too_large over the size limit', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const res = await save(user, 'huge', { preselected: [{ label: 'x'.repeat(1_010_000) }] });
        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe('snapshot_too_large');
    });

    it('rejects a body over the parser limit', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const res = await save(user, 'huger', { preselected: [{ label: 'x'.repeat(1_100_000) }] });
        expect(res.statusCode).toBeGreaterThanOrEqual(400);
        expect(await countRows()).toBe(0);
    });
});

describe('the limit of 10 sessions', () => {
    it('keeps at most 10 and deletes the oldest when a new one is saved', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        expect(MAX_SAVED_SESSIONS).toBe(10);
        for (let i = 1; i <= 11; i++) expect((await save(user, `s${i}`)).statusCode).toBe(201);

        const tags = await tagsOf(user);
        expect(tags).toHaveLength(10);
        expect(tags).not.toContain('s1');
        expect(tags).toContain('s11');
    });

    it('counts an update as new: the updated session is no longer the oldest', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const ids = [];
        for (let i = 1; i <= 10; i++) ids.push((await save(user, `s${i}`)).body.id);

        const put = await request(app)
            .put(`/api/practice/sessions/${ids[0]}`)
            .set(auth(user))
            .send({ snapshot: snapshot('s1-updated') });
        expect(put.statusCode).toBe(200);
        await save(user, 's11');

        const tags = await tagsOf(user);
        expect(tags).toHaveLength(10);
        expect(tags).toContain('s1-updated');
        expect(tags).not.toContain('s2');
    });

    it('does not count an update toward the limit', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const ids = [];
        for (let i = 1; i <= 10; i++) ids.push((await save(user, `s${i}`)).body.id);
        for (const id of ids.slice(0, 3)) {
            await request(app).put(`/api/practice/sessions/${id}`).set(auth(user)).send({ snapshot: snapshot('again') }).expect(200);
        }
        expect(await list(user)).toHaveLength(10);
    });

    it('does not delete live sessions to make room when others are expired', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        for (let i = 1; i <= 10; i++) await save(user, `s${i}`);
        await pool.query(
            `UPDATE practice_sessions SET expires_at = now() - interval '1 hour'
             WHERE id IN (SELECT id FROM practice_sessions ORDER BY updated_at ASC LIMIT 4)`,
        );
        await save(user, 's11');

        // 4 expired ones were cleaned; the 6 live ones and the new one stay.
        expect(await tagsOf(user)).toHaveLength(7);
        expect(await countRows()).toBe(7);
    });

    it('is per user', async () => {
        const ann = await register('Ann', 'ann@test.com', 'ann');
        const bob = await register('Bob', 'bob@test.com', 'bob');
        await save(bob, 'bob1');
        for (let i = 1; i <= 12; i++) await save(ann, `a${i}`);
        expect(await list(ann)).toHaveLength(10);
        expect(await tagsOf(bob)).toEqual(['bob1']);
    });

    it('holds when many saves arrive at the same time', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const results = await Promise.all(Array.from({ length: 15 }, (_, i) => save(user, `p${i}`)));
        expect(results.every((r) => r.statusCode === 201)).toBe(true);
        expect(await countRows()).toBe(10);
    });
});

describe('GET /api/practice/sessions', () => {
    it('lists own sessions as summaries, newest first, without the snapshot', async () => {
        const ann = await register('Ann', 'ann@test.com', 'ann');
        const bob = await register('Bob', 'bob@test.com', 'bob');
        const first = (await save(ann, 'first')).body;
        const second = (await save(ann, 'second')).body;
        await save(bob, 'bobs');

        const items = await list(ann);
        expect(items.map((i) => i.id)).toEqual([second.id, first.id]);
        expect(items[0]).toEqual({
            id: second.id,
            summary: second.summary,
            createdAt: second.createdAt,
            updatedAt: second.updatedAt,
            expiresAt: second.expiresAt,
        });
        expect(items[0]).not.toHaveProperty('snapshot');
    });

    it('hides expired sessions', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const old = (await save(user, 'old')).body;
        await save(user, 'new');
        await pool.query(`UPDATE practice_sessions SET expires_at = now() - interval '1 second' WHERE id = $1`, [old.id]);

        expect((await list(user)).map((i) => i.id)).not.toContain(old.id);
        expect(await list(user)).toHaveLength(1);
    });
});

describe('GET /api/practice/sessions/:id', () => {
    it('returns the full snapshot', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const created = (await save(user, 'x')).body;
        const res = await request(app).get(`/api/practice/sessions/${created.id}`).set(auth(user));
        expect(res.statusCode).toBe(200);
        expect(res.body.snapshot).toEqual(snapshot('x'));
        expect(res.body.summary).toEqual(created.summary);
    });

    it('returns 404 for another user’s row, an expired row, a missing row and a bad id', async () => {
        const ann = await register('Ann', 'ann@test.com', 'ann');
        const bob = await register('Bob', 'bob@test.com', 'bob');
        const created = (await save(ann, 'x')).body;

        expect((await request(app).get(`/api/practice/sessions/${created.id}`).set(auth(bob))).statusCode).toBe(404);
        expect(
            (await request(app).get('/api/practice/sessions/11111111-1111-4111-8111-111111111111').set(auth(ann))).statusCode,
        ).toBe(404);
        expect((await request(app).get('/api/practice/sessions/x').set(auth(ann))).statusCode).toBe(404);

        await pool.query(`UPDATE practice_sessions SET expires_at = now() - interval '1 second'`);
        expect((await request(app).get(`/api/practice/sessions/${created.id}`).set(auth(ann))).statusCode).toBe(404);
    });
});

describe('PUT /api/practice/sessions/:id', () => {
    it('replaces the snapshot and the summary and starts a new 7-day period', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const created = (await save(user, 'v1')).body;
        await pool.query(`UPDATE practice_sessions SET expires_at = now() + interval '1 day'`);

        const res = await request(app)
            .put(`/api/practice/sessions/${created.id}`)
            .set(auth(user))
            .send({
                snapshot: snapshot('v2', {
                    answers: [
                        { result: 'correct', given: 'a', saveStatus: 'saved' },
                        { result: 'wrong', given: 'b', saveStatus: 'saved' },
                    ],
                    current: 1,
                }),
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.id).toBe(created.id);
        expect(res.body.snapshot.params.tag).toBe('v2');
        expect(res.body.summary).toMatchObject({ answered: 2, correct: 1 });
        const days = (new Date(res.body.expiresAt).getTime() - Date.now()) / DAY_MS;
        expect(days).toBeGreaterThan(6.9);
        expect(await list(user)).toHaveLength(1);
    });

    it('returns 400 for a snapshot that is not valid, and changes nothing', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const created = (await save(user, 'v1')).body;
        const res = await request(app)
            .put(`/api/practice/sessions/${created.id}`)
            .set(auth(user))
            .send({ snapshot: snapshot('bad', { current: 9 }) });
        expect(res.statusCode).toBe(400);
        expect(await tagsOf(user)).toEqual(['v1']);
    });

    it('returns 404 for another user’s row, an expired row, a missing row and a bad id', async () => {
        const ann = await register('Ann', 'ann@test.com', 'ann');
        const bob = await register('Bob', 'bob@test.com', 'bob');
        const created = (await save(ann, 'mine')).body;
        const put = (user, id) =>
            request(app).put(`/api/practice/sessions/${id}`).set(auth(user)).send({ snapshot: snapshot('hacked') });

        expect((await put(bob, created.id)).statusCode).toBe(404);
        expect((await put(ann, '11111111-1111-4111-8111-111111111111')).statusCode).toBe(404);
        expect((await put(ann, 'x')).statusCode).toBe(404);
        expect(await tagsOf(ann)).toEqual(['mine']);

        await pool.query(`UPDATE practice_sessions SET expires_at = now() - interval '1 second'`);
        expect((await put(ann, created.id)).statusCode).toBe(404);
    });
});

describe('DELETE /api/practice/sessions/:id', () => {
    it('deletes the own session', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        const created = (await save(user)).body;
        expect((await request(app).delete(`/api/practice/sessions/${created.id}`).set(auth(user))).statusCode).toBe(204);
        expect(await list(user)).toEqual([]);
    });

    it('returns 404 for another user’s row and keeps it, and for a missing row and a bad id', async () => {
        const ann = await register('Ann', 'ann@test.com', 'ann');
        const bob = await register('Bob', 'bob@test.com', 'bob');
        const created = (await save(ann)).body;

        expect((await request(app).delete(`/api/practice/sessions/${created.id}`).set(auth(bob))).statusCode).toBe(404);
        expect(
            (await request(app).delete('/api/practice/sessions/11111111-1111-4111-8111-111111111111').set(auth(ann)))
                .statusCode,
        ).toBe(404);
        expect((await request(app).delete('/api/practice/sessions/x').set(auth(ann))).statusCode).toBe(404);
        expect(await list(ann)).toHaveLength(1);
    });
});

describe('cascade', () => {
    it('removes the sessions when the user is deleted', async () => {
        const user = await register('Ann', 'ann@test.com', 'ann');
        await save(user);
        await pool.query('DELETE FROM users');
        expect(await countRows()).toBe(0);
    });
});
