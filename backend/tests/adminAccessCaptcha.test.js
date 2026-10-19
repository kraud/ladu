// The captcha switch (captcha.md C2, C3): the owner's admin API, its audit row, and the
// `captcha` block of the admin answer (`configured` = both Turnstile keys are set).
const request = require('./request');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { accessSettings, auditLog } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    process.env.TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
    process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
});
afterAll(async () => {
    delete process.env.TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    await testDb.closeDB();
    await pool.end();
});

const STAFF_PASSWORD = 'correct-horse-battery';
const staffToken = async (role) => {
    const email = `${role}@example.com`;
    await createStaff({ email, name: `${role} person`, password: STAFF_PASSWORD, role });
    return (await request(app).post('/api/admin/auth/login').send({ email, password: STAFF_PASSWORD })).body.token;
};
const put = (token, body) => request(app).put('/api/admin/access/captcha').set('Authorization', `Bearer ${token}`).send(body);
const getAdmin = (token) => request(app).get('/api/admin/access').set('Authorization', `Bearer ${token}`);
const enabled = async () => (await db.select().from(accessSettings))[0].captchaEnabled;
const audits = () => db.select().from(auditLog).where(eq(auditLog.action, 'access.captcha_configure'));

it('is off by default, and the admin answer says if the keys are set', async () => {
    const token = await staffToken('owner');
    expect((await getAdmin(token)).body.captcha).toEqual({ enabled: false, configured: true });
    delete process.env.TURNSTILE_SECRET_KEY;
    expect((await getAdmin(token)).body.captcha).toEqual({ enabled: false, configured: false });
});

it('is for the owner only', async () => {
    for (const role of ['admin', 'support', 'viewer']) expect((await put(await staffToken(role), { enabled: true })).status).toBe(403);
    expect(await enabled()).toBe(false);
    expect(await audits()).toHaveLength(0);
});

it('turns on and off with one audit row each (old → new, reason)', async () => {
    const token = await staffToken('owner');
    const on = await put(token, { enabled: true, reason: 'bots on the demo' });
    expect(on.status).toBe(200);
    expect(on.body.captcha).toEqual({ enabled: true, configured: true });

    expect((await put(token, { enabled: true })).status).toBe(200); // no change: no audit row
    await put(token, { enabled: false });
    const rows = await audits();
    expect(rows).toHaveLength(2);
    const first = rows.find((row) => row.reason === 'bots on the demo');
    expect(first.metadata).toEqual({ from: { enabled: false }, to: { enabled: true } });
    expect(await enabled()).toBe(false);
});

it('cannot go on while a key is missing (400 captcha_not_configured), but can go off', async () => {
    const token = await staffToken('owner');
    await put(token, { enabled: true });
    delete process.env.TURNSTILE_SITE_KEY;

    await put(token, { enabled: false });
    expect(await enabled()).toBe(false);

    const refused = await put(token, { enabled: true });
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('captcha_not_configured');
    expect(await enabled()).toBe(false);
});

it('refuses a body without a boolean', async () => {
    expect((await put(await staffToken('owner'), { enabled: 'yes' })).status).toBe(400);
});
