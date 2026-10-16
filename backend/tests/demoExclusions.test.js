// Demo access, Slice 2 step 3: the purge of expired demos, demo accounts left out of the admin
// list, the statistics and user search, and `totalTags` in the user metrics (D9).
// See .context/plans/demo-access.md.
const request = require('./request');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, words, auditLog } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');
const { resetDemoStartLimiter } = require('../lib/demo');
const { loadTemplateData, seedDemoTemplate, TEMPLATE_USERNAME } = require('../lib/demoTemplate');
const { runPurge } = require('../lib/userPurge');
const { generateToken } = require('../controllers/userController');

const template = loadTemplateData();

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    resetDemoStartLimiter();
    process.env.DEMO_STARTS_PER_IP = '100';
    await seedDemoTemplate();
    await pool.query(`UPDATE access_settings SET demo_enabled = true WHERE id = 1`);
});
afterAll(async () => {
    delete process.env.DEMO_STARTS_PER_IP;
    await testDb.closeDB();
    await pool.end();
});

const startDemo = async () => {
    const res = await request(app).post('/api/demo').send({ uiLanguage: 'German' });
    expect(res.status).toBe(201);
    return res.body;
};
const expire = (id) => db.update(users).set({ demoExpiresAt: new Date(Date.now() - 1000) }).where(eq(users.id, id));
const exists = async (id) => (await db.select().from(users).where(eq(users.id, id))).length === 1;

let seq = 0;
const realUser = async (overrides = {}) => {
    seq += 1;
    const [user] = await db
        .insert(users)
        .values({ name: `Real ${seq}`, email: `real${seq}@example.com`, username: `real${seq}`, languages: ['English', 'Spanish'], verified: true, ...overrides })
        .returning();
    return { ...user, token: generateToken(user) };
};
const staffToken = async () => {
    await createStaff({ email: 'viewer@example.com', name: 'viewer', password: 'correct-horse-battery', role: 'owner' });
    return (await request(app).post('/api/admin/auth/login').send({ email: 'viewer@example.com', password: 'correct-horse-battery' })).body.token;
};
const templateId = async () => (await db.select().from(users).where(eq(users.username, TEMPLATE_USERNAME)))[0].id;

describe('the nightly purge', () => {
    it('deletes expired demos with their data, and keeps live demos, the template and real accounts', async () => {
        const expired = await startDemo();
        const live = await startDemo();
        const real = await realUser();
        await expire(expired.id);

        const result = await runPurge();
        expect(result.purgedDemos).toBe(1);
        expect(result.purgedUsers).toBe(0);
        expect(await exists(expired.id)).toBe(false);
        expect(await db.select().from(words).where(eq(words.userId, expired.id))).toHaveLength(0);
        expect(await exists(live.id)).toBe(true);
        expect(await exists(real.id)).toBe(true);
        expect(await exists(await templateId())).toBe(true);
        expect(await db.select().from(words).where(eq(words.userId, await templateId()))).toHaveLength(template.words.length);
    });

    it('writes no audit row for a demo (only a count)', async () => {
        const demo = await startDemo();
        await expire(demo.id);
        await runPurge();
        expect(await db.select().from(auditLog)).toHaveLength(0);
    });
});

describe('the admin users list', () => {
    it('lists only real accounts: never a demo or the template', async () => {
        await startDemo();
        const real = await realUser();
        const token = await staffToken();
        const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(1);
        expect(res.body.items.map((u) => u.email)).toEqual([real.email]);

        const searched = await request(app).get('/api/admin/users?search=demo').set('Authorization', `Bearer ${token}`);
        expect(searched.status).toBe(200);
        expect(searched.body.total).toBe(0);
    });
});

describe('the admin statistics', () => {
    it('count no demo account, no demo content, no demo signup and no demo language', async () => {
        const token = await staffToken();
        await realUser({ languages: ['English', 'Spanish'] });
        const before = (await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`)).body;

        await startDemo(); // German first, all four languages, 14 words copied
        await startDemo();
        const after = (await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`)).body;

        expect(after.totals).toEqual(before.totals);
        expect(after.signups).toEqual(before.signups);
        expect(after.languages).toEqual(before.languages);
        expect(after.totals.users).toBe(1);
        expect(after.totals.words).toBe(0);
    });
});

describe('user search', () => {
    it('never finds a demo account or the template', async () => {
        const real = await realUser();
        await startDemo();
        for (const term of ['Demo', 'demo-', '__demo']) {
            const res = await request(app).get(`/api/users/searchUser?nameOrUsernameMatch=${encodeURIComponent(term)}`).set('Authorization', `Bearer ${real.token}`);
            expect(res.status).toBe(200);
            expect({ term, found: res.body.length }).toEqual({ term, found: 0 });
        }
    });
});

describe('user metrics: totalTags (D9)', () => {
    it('counts the account\'s own tags, so the app can show "tags left" for a demo', async () => {
        const demo = await startDemo();
        const res = await request(app).get('/api/users/getUserMetrics').set('Authorization', `Bearer ${demo.token}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ totalWords: template.words.length, totalTags: template.tags.length });
    });
});
