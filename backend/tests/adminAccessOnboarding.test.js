// The onboarding switch (onboarding.md D26): the owner's admin API, its audit row, the counts by
// status, and `onboarding.enabled` in the public `GET /api/access`.
const request = require('supertest');
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
const put = (token, body) => request(app).put('/api/admin/access/onboarding').set('Authorization', `Bearer ${token}`).send(body);
const enabled = async () => (await db.select().from(accessSettings))[0].onboardingEnabled;
const audits = () => db.select().from(auditLog).where(eq(auditLog.action, 'access.onboarding_configure'));

it('is off by default, in the admin answer and the public one', async () => {
    const admin = await request(app).get('/api/admin/access').set('Authorization', `Bearer ${await staffToken('owner')}`);
    expect(admin.body.onboarding).toEqual({ enabled: false });
    expect((await request(app).get('/api/access')).body.onboarding).toEqual({ enabled: false });
});

it('is for the owner only', async () => {
    for (const role of ['admin', 'support', 'viewer']) expect((await put(await staffToken(role), { enabled: true })).status).toBe(403);
    expect(await enabled()).toBe(false);
    expect(await audits()).toHaveLength(0);
});

it('turns on and off with one audit row each (old → new, reason), and the public answer follows', async () => {
    const token = await staffToken('owner');
    const on = await put(token, { enabled: true, reason: 'pool reviewed' });
    expect(on.status).toBe(200);
    expect(on.body.onboarding).toEqual({ enabled: true });
    expect((await request(app).get('/api/access')).body.onboarding).toEqual({ enabled: true });

    expect((await put(token, { enabled: true })).status).toBe(200); // no change: no audit row
    await put(token, { enabled: false });
    const rows = await audits();
    expect(rows).toHaveLength(2);
    const first = rows.find((row) => row.reason === 'pool reviewed');
    expect(first.metadata).toEqual({ from: { enabled: false }, to: { enabled: true } });
    expect(await enabled()).toBe(false);
});

it('refuses a body without a boolean', async () => {
    expect((await put(await staffToken('owner'), { enabled: 'yes' })).status).toBe(400);
});

it('counts the accounts by onboarding status (not the ones without one)', async () => {
    const account = (n, onboardingStatus) => ({
        name: `U${n}`, email: `u${n}@example.com`, username: `u${n}`, languages: ['English', 'Spanish'], verified: true, onboardingStatus,
    });
    await db.insert(users).values([account(1, 'pending'), account(2, 'pending'), account(3, 'done'), account(4, 'skipped'), account(5, null)]);
    const res = await request(app).get('/api/admin/access').set('Authorization', `Bearer ${await staffToken('owner')}`);
    expect(res.body.onboardingCounts).toEqual({ pending: 2, done: 1, skipped: 1 });
});
