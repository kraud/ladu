// Demo access, Slice 1: what a demo account may not do (D10 a, c) and the silent password reset.
// See .context/plans/demo-access.md. `jest.mock` must come before `require('../app')`.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());
const sendMail = require('../utils/sendEmail');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, oauthIdentities, passwordResetTokens } = require('../src/db/schema');
const { seedDemoTemplate } = require('../lib/demoTemplate');
const { resetDemoStartLimiter } = require('../lib/demo');
const { issueTicket } = require('../lib/oauth/ticket');

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    resetDemoStartLimiter();
    // Every demo start copies the template (Slice 2).
    await seedDemoTemplate();
    sendMail.mockClear();
    await pool.query(`UPDATE access_settings SET demo_enabled = true WHERE id = 1`);
});
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const startDemo = async () => {
    const res = await request(app).post('/api/demo').send({ uiLanguage: 'English' });
    expect(res.status).toBe(201);
    return res.body;
};
const as = (token) => (method, url) => request(app)[method](url).set('Authorization', `Bearer ${token}`);
const expectRestricted = (res) => {
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('demo_restricted');
};

describe('sign-in methods (D10 a)', () => {
    it('refuses to start a Google link for a demo', async () => {
        const demo = await startDemo();
        expectRestricted(await as(demo.token)('post', '/api/auth/google/link'));
    });

    it('refuses to remove a sign-in method for a demo, and keeps it', async () => {
        const demo = await startDemo();
        // A demo never gets an identity; this one is planted to prove the guard does not depend on that.
        const [identity] = await db
            .insert(oauthIdentities)
            .values({ userId: demo.id, provider: 'google', providerUserId: 'planted-sub', emailAtLink: demo.email })
            .returning();
        expectRestricted(await as(demo.token)('delete', `/api/auth/identities/${identity.id}`));
        expect(await db.select().from(oauthIdentities).where(eq(oauthIdentities.id, identity.id))).toHaveLength(1);
    });

    it('never finishes a link onto a demo account, even one with a password, and says nothing about it', async () => {
        const demo = await startDemo();
        await db.update(users).set({ password: await bcrypt.hash('planted-password', 4) }).where(eq(users.id, demo.id));
        const ticket = issueTicket({ typ: 'oauth_link', provider: 'google', sub: 'demo-sub', email: demo.email, name: 'Demo' });

        const res = await request(app).post('/api/auth/link').send({ ticket, password: 'planted-password' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Invalid or expired ticket');
        expect(await db.select().from(oauthIdentities).where(eq(oauthIdentities.userId, demo.id))).toHaveLength(0);
    });
});

describe('profile (D10 c)', () => {
    const update = (demo, body) => as(demo.token)('put', '/api/users/updateUser').send({ email: demo.email, ...body });

    it('refuses a new name or a new username, and changes nothing', async () => {
        const demo = await startDemo();
        expectRestricted(await update(demo, { name: 'Real Person' }));
        expectRestricted(await update(demo, { username: 'realperson' }));
        expectRestricted(await update(demo, { username: demo.username.toUpperCase() }));
        const [row] = await db.select().from(users).where(eq(users.id, demo.id));
        expect(row).toMatchObject({ name: 'Demo', username: demo.username });
    });

    it('accepts the same name and username sent back, with a change to languages, UI language and theme', async () => {
        const demo = await startDemo();
        const res = await update(demo, {
            name: demo.name,
            username: demo.username,
            languages: ['Spanish', 'German'],
            uiLanguage: 'Spanish',
            theme: 'dark',
        });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ languages: ['Spanish', 'German'], uiLanguage: 'Spanish', theme: 'dark', isDemo: true });
    });

    it('still lets a normal account change its name and username', async () => {
        const [user] = await db
            .insert(users)
            .values({ name: 'Normal', email: 'normal@example.com', username: 'normal', password: await bcrypt.hash('x-password-1', 4), languages: ['English', 'Spanish'], verified: true })
            .returning();
        const { token } = (await request(app).post('/api/users/login').send({ email: user.email, password: 'x-password-1' })).body;
        const res = await as(token)('put', '/api/users/updateUser').send({ email: user.email, name: 'Renamed', username: 'renamed' });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ name: 'Renamed', username: 'renamed' });
    });
});

describe('password reset', () => {
    it('answers the usual 200 for a demo email, but makes no token and sends nothing', async () => {
        const demo = await startDemo();
        const res = await request(app).post('/api/users/requestPasswordReset').send({ email: demo.email });
        expect(res.status).toBe(200);

        const normal = await request(app).post('/api/users/requestPasswordReset').send({ email: 'nobody@example.com' });
        expect(res.body).toEqual(normal.body);
        expect(await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, demo.id))).toHaveLength(0);
        expect(sendMail).not.toHaveBeenCalled();
    });
});
