// Demo access, Slice 0: the demo gate and its caps in the owner's admin API, and `demo.enabled`
// in the public `GET /api/access`. See .context/plans/demo-access.md.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, accessSettings, auditLog } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const STAFF_PASSWORD = 'correct-horse-battery';
const staffToken = async (role) => {
    const email = `${role}@example.com`;
    await createStaff({ email, name: `${role} person`, password: STAFF_PASSWORD, role });
    return (await request(app).post('/api/admin/auth/login').send({ email, password: STAFF_PASSWORD })).body.token;
};
const as = (token) => (method, url) => request(app)[method](url).set('Authorization', `Bearer ${token}`);
const put = (token, body) => as(token)('put', '/api/admin/access/demo').send(body);

const settingsRow = async () => (await db.select().from(accessSettings))[0];
const audits = () => db.select().from(auditLog).where(eq(auditLog.action, 'access.demo_configure'));

const DEFAULTS = { enabled: false, durationMinutes: 15, maxWords: 30, maxTags: 5 };
const VALID = { enabled: true, durationMinutes: 20, maxWords: 40, maxTags: 8 };

describe('permission', () => {
    it('is for the owner only, and a refused role changes nothing', async () => {
        for (const role of ['admin', 'support', 'viewer']) {
            const token = await staffToken(role);
            expect((await put(token, VALID)).status).toBe(403);
        }
        expect((await settingsRow()).demoEnabled).toBe(false);
        expect(await audits()).toHaveLength(0);
    });

    it('refuses no token and a learner token', async () => {
        expect((await request(app).put('/api/admin/access/demo').send(VALID)).status).toBe(401);
        const [learner] = await db.insert(users).values({
            name: 'L', email: 'l@example.com', username: 'l', password: await bcrypt.hash('x-password-1', 4), languages: ['English', 'Spanish'], verified: true,
        }).returning();
        const learnerToken = require('../controllers/userController').generateToken(learner);
        expect((await request(app).put('/api/admin/access/demo').set('Authorization', `Bearer ${learnerToken}`).send(VALID)).status).toBe(401);
    });
});

describe('GET /api/admin/access', () => {
    it('returns the demo settings with their defaults: off, 15 minutes, 30 words, 5 tags', async () => {
        const res = await as(await staffToken('owner'))('get', '/api/admin/access');
        expect(res.status).toBe(200);
        expect(res.body.demo).toEqual(DEFAULTS);
    });
});

describe('PUT /api/admin/access/demo', () => {
    it('saves all four values and writes one audit row with the old and new values', async () => {
        const token = await staffToken('owner');
        const res = await put(token, { ...VALID, reason: 'launch' });
        expect(res.status).toBe(200);
        expect(res.body.demo).toEqual(VALID);
        expect(res.body.updatedBy).toBe('owner person');

        const row = await settingsRow();
        expect(row).toMatchObject({ demoEnabled: true, demoDurationMinutes: 20, demoMaxWords: 40, demoMaxTags: 8 });

        const rows = await audits();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ targetType: 'access', targetId: 'demo', reason: 'launch' });
        expect(rows[0].metadata).toEqual({ from: DEFAULTS, to: VALID });
    });

    it('writes one row for a change to a single value, and none when nothing changes', async () => {
        const token = await staffToken('owner');
        expect((await put(token, DEFAULTS)).status).toBe(200);
        expect(await audits()).toHaveLength(0);

        await put(token, { ...DEFAULTS, maxTags: 6 });
        const rows = await audits();
        expect(rows).toHaveLength(1);
        expect(rows[0].metadata).toEqual({ from: DEFAULTS, to: { ...DEFAULTS, maxTags: 6 } });
    });

    it('accepts the edges of each bound', async () => {
        const token = await staffToken('owner');
        expect((await put(token, { enabled: true, durationMinutes: 1, maxWords: 0, maxTags: 0 })).status).toBe(200);
        expect((await put(token, { enabled: true, durationMinutes: 1440, maxWords: 500, maxTags: 50 })).status).toBe(200);
        expect((await settingsRow())).toMatchObject({ demoDurationMinutes: 1440, demoMaxWords: 500, demoMaxTags: 50 });
    });

    it('refuses a missing, wrong-type, fractional or out-of-bounds value, and changes nothing', async () => {
        const token = await staffToken('owner');
        const bad = [
            {},
            { ...VALID, enabled: 'true' },
            { ...VALID, enabled: undefined },
            { ...VALID, durationMinutes: undefined },
            { ...VALID, durationMinutes: '15' },
            { ...VALID, durationMinutes: 0 },
            { ...VALID, durationMinutes: 1441 },
            { ...VALID, durationMinutes: 15.5 },
            { ...VALID, maxWords: -1 },
            { ...VALID, maxWords: 501 },
            { ...VALID, maxWords: null },
            { ...VALID, maxTags: -1 },
            { ...VALID, maxTags: 51 },
            { ...VALID, reason: 'x'.repeat(501) },
            { ...VALID, reason: 5 },
        ];
        for (const body of bad) {
            const res = await put(token, body);
            expect({ body, status: res.status }).toEqual({ body, status: 400 });
        }
        expect(await settingsRow()).toMatchObject({ demoEnabled: false, demoDurationMinutes: 15, demoMaxWords: 30, demoMaxTags: 5 });
        expect(await audits()).toHaveLength(0);
    });

    it('does not touch the registration and login gates', async () => {
        const token = await staffToken('owner');
        await as(token)('put', '/api/admin/access/registration').send({ mode: 'closed', note: 'Soon' });
        await put(token, VALID);
        const row = await settingsRow();
        expect(row).toMatchObject({ registrationMode: 'closed', registrationNote: 'Soon', loginMode: 'open' });
    });
});

describe('GET /api/access (public)', () => {
    it('says whether the demo is on, at once after a change, and never shows the caps', async () => {
        expect((await request(app).get('/api/access')).body.demo).toEqual({ enabled: false });

        await put(await staffToken('owner'), VALID);
        const res = await request(app).get('/api/access');
        expect(res.body.demo).toEqual({ enabled: true });
        expect(res.headers['cache-control']).toBe('no-store');
    });
});
