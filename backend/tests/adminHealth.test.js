// Admin dashboard slice 6 — GET /api/admin/health.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, words, loginEvents, opsEvents } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');
const journal = require('../src/db/migrations/meta/_journal.json');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const staffToken = async (role = 'viewer') => {
    const email = `${role}@example.com`;
    await createStaff({ email, name: role, password: 'correct-horse-battery', role });
    return (await request(app).post('/api/admin/auth/login').send({ email, password: 'correct-horse-battery' })).body.token;
};
const health = (token) => request(app).get('/api/admin/health').set('Authorization', `Bearer ${token}`);

const setEnv = (values) => {
    const before = {};
    for (const key of Object.keys(values)) {
        before[key] = process.env[key];
        if (values[key] === undefined) delete process.env[key];
        else process.env[key] = values[key];
    }
    return () => {
        for (const key of Object.keys(before)) {
            if (before[key] === undefined) delete process.env[key];
            else process.env[key] = before[key];
        }
    };
};

describe('access', () => {
    it('rejects no token and a learner token, and lets every role read', async () => {
        const [user] = await db
            .insert(users)
            .values({ name: 'L', email: 'l@example.com', username: 'l', languages: ['English', 'Spanish'] })
            .returning();

        expect((await request(app).get('/api/admin/health')).status).toBe(401);
        expect((await health(global.signin(user.id))).status).toBe(401);
        for (const role of ['viewer', 'support', 'admin', 'owner']) {
            expect([role, (await health(await staffToken(role))).status]).toEqual([role, 200]);
        }
    });
});

describe('service block', () => {
    it('reports the environment, the commit and the runtime from the container', async () => {
        const restore = setEnv({ ENVIRONMENT: 'staging', GIT_SHA: 'abc1234' });
        try {
            const res = await health(await staffToken());

            expect(res.body.service).toMatchObject({
                database: 'ok',
                environment: 'staging',
                sha: 'abc1234',
                nodeVersion: process.version,
            });
            expect(res.body.service.uptimeSeconds).toBeGreaterThanOrEqual(0);
            expect(Date.now() - new Date(res.body.service.checkedAt).getTime()).toBeLessThan(10_000);
        } finally {
            restore();
        }
    });

    it('falls back to "local" and "unknown" when the container sets neither', async () => {
        const restore = setEnv({ ENVIRONMENT: undefined, GIT_SHA: undefined });
        try {
            const res = await health(await staffToken());

            expect(res.body.service).toMatchObject({ environment: 'local', sha: 'unknown' });
        } finally {
            restore();
        }
    });
});

describe('database block', () => {
    it('counts the main tables, exactly', async () => {
        const [a, b] = await db
            .insert(users)
            .values([
                { name: 'A', email: 'a@example.com', username: 'a', languages: ['English', 'Spanish'] },
                { name: 'B', email: 'b@example.com', username: 'b', languages: ['English', 'Spanish'] },
            ])
            .returning();
        await db.insert(words).values([{ userId: a.id, partOfSpeech: 'Noun' }, { userId: b.id, partOfSpeech: 'Verb' }, { userId: b.id, partOfSpeech: 'Noun' }]);
        await db.insert(loginEvents).values({ userId: a.id, method: 'password' });

        const res = await health(await staffToken());

        expect(res.body.database.tables).toEqual({
            users: 2,
            words: 3,
            translations: 0,
            tags: 0,
            practiceSessions: 0,
            loginEvents: 1,
            // The one staff member's login wrote one audit row.
            auditLog: 1,
        });
    });

    it('reports a real size and the newest applied migration by name', async () => {
        const res = await health(await staffToken());

        expect(res.body.database.sizeBytes).toBeGreaterThan(1_000_000);
        const newest = journal.entries.reduce((a, b) => (b.when > a.when ? b : a));
        expect(res.body.database.migration.latest).toBe(newest.tag);
        expect(res.body.database.migration.appliedCount).toBeGreaterThanOrEqual(journal.entries.length);
    });
});

describe('backups block', () => {
    it('is empty when nothing was recorded (staging, or before the first run)', async () => {
        const res = await health(await staffToken());

        expect(res.body.backups).toEqual({ lastBackup: null, lastRestoreTest: null });
    });

    it('returns the newest event of each kind, including a failed one', async () => {
        const at = (hoursAgo) => new Date(Date.now() - hoursAgo * 3_600_000);
        await db.insert(opsEvents).values([
            { kind: 'backup', ok: true, detail: 'ladu_prod_old.dump', createdAt: at(50) },
            { kind: 'backup', ok: true, detail: 'ladu_prod_new.dump', createdAt: at(2) },
            { kind: 'restore_test', ok: true, detail: 'restored OK', createdAt: at(200) },
            { kind: 'restore_test', ok: false, detail: 'pg_restore failed', createdAt: at(30) },
        ]);

        const { backups } = (await health(await staffToken())).body;

        expect(backups.lastBackup).toMatchObject({ ok: true, detail: 'ladu_prod_new.dump' });
        expect(backups.lastRestoreTest).toMatchObject({ ok: false, detail: 'pg_restore failed' });
        expect(Date.now() - new Date(backups.lastBackup.at).getTime()).toBeLessThan(3 * 3_600_000);
    });
});

describe('when the database does not answer', () => {
    it('still answers 200, with database "error" and no database or backup data', async () => {
        const token = await staffToken();
        const original = pool.query.bind(pool);
        jest.spyOn(pool, 'query').mockImplementation((text, ...rest) =>
            text === 'SELECT 1' ? Promise.reject(new Error('connection refused')) : original(text, ...rest),
        );

        const res = await health(token);

        expect(res.status).toBe(200);
        expect(res.body.service.database).toBe('error');
        expect(res.body).toMatchObject({ database: null, backups: null });
    });
});
