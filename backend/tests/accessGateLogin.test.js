// Access gates, PR 2: the login gate. See .context/plans/access-gates.md.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());
// The Google callback talks to a provider. Replace the three pieces that reach the network.
jest.mock('jose', () => ({ jwtVerify: jest.fn(), createRemoteJWKSet: jest.fn() }));
jest.mock('../lib/oauth/discovery', () => ({
    getDiscoveryDocument: jest.fn().mockResolvedValue({
        issuer: 'https://issuer.test',
        authorization_endpoint: 'https://issuer.test/authorize',
        token_endpoint: 'https://issuer.test/token',
        jwks_uri: 'https://issuer.test/jwks',
    }),
    getJwks: jest.fn().mockReturnValue({}),
}));
const { jwtVerify } = require('jose');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, tokens, accessSettings, loginAllowedUsers, oauthIdentities } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');
const { issueTicket } = require('../lib/oauth/ticket');
const { issueStateToken } = require('../lib/oauth/stateToken');

const PASSWORD = 'learner-password-1';
const savedEnv = { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET };

beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    await testDb.connectDB();
});
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    process.env.GOOGLE_CLIENT_ID = savedEnv.id;
    process.env.GOOGLE_CLIENT_SECRET = savedEnv.secret;
    await testDb.closeDB();
    await pool.end();
});

const setLogin = (loginMode, loginNote = '') => db.update(accessSettings).set({ loginMode, loginNote }).where(eq(accessSettings.id, 1));
const setRegistration = (registrationMode) => db.update(accessSettings).set({ registrationMode }).where(eq(accessSettings.id, 1));
const allow = (userId) => db.insert(loginAllowedUsers).values({ userId });
const disallow = (userId) => db.delete(loginAllowedUsers).where(eq(loginAllowedUsers.userId, userId));
const userRow = async (id) => (await db.select().from(users).where(eq(users.id, id)))[0];

let seq = 0;
const makeUser = async (overrides = {}) => {
    seq += 1;
    const [user] = await db
        .insert(users)
        .values({
            name: `User ${seq}`,
            email: `user${seq}@example.com`,
            username: `user${seq}`,
            password: await bcrypt.hash(PASSWORD, 4),
            languages: ['English', 'Spanish'],
            uiLanguage: 'English',
            verified: true,
            ...overrides,
        })
        .returning();
    return user;
};
const login = (user, body = {}) => request(app).post('/api/users/login').send({ email: user.email, password: PASSWORD, ...body });

describe('password login', () => {
    it('open: signs in, as before', async () => {
        const user = await makeUser();
        const res = await login(user);
        expect(res.status).toBe(200);
        expect(res.body.token).toBeTruthy();
    });

    it('closed: refuses everybody with a code, gives no token, and records nothing', async () => {
        await setLogin('closed');
        const user = await makeUser();
        const res = await login(user, { uiLanguage: 'German', theme: 'dark' });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('login_closed');
        expect(res.body.token).toBeUndefined();
        // A refusal must not look like a sign-in: no login record, no saved language or theme.
        const row = await userRow(user.id);
        expect(row.lastLoginAt).toBeNull();
        expect(row.uiLanguage).toBe('English');
        expect(row.theme).toBeNull();
    });

    it('closed: refuses even an account that is on the allowed list', async () => {
        await setLogin('closed');
        const user = await makeUser();
        await allow(user.id);
        expect((await login(user)).body.code).toBe('login_closed');
    });

    it('limited: refuses an account that is not on the list, and lets a listed one in', async () => {
        await setLogin('limited');
        const listed = await makeUser();
        const other = await makeUser();
        await allow(listed.id);

        const refused = await login(other);
        expect(refused.status).toBe(403);
        expect(refused.body.code).toBe('login_not_allowed');
        expect(refused.body.token).toBeUndefined();

        const ok = await login(listed);
        expect(ok.status).toBe(200);
        expect(ok.body.token).toBeTruthy();
    });

    it('limited: an account added to the list can sign in at once, and one removed cannot', async () => {
        await setLogin('limited');
        const user = await makeUser();
        expect((await login(user)).status).toBe(403);
        await allow(user.id);
        expect((await login(user)).status).toBe(200);
        await disallow(user.id);
        expect((await login(user)).status).toBe(403);
    });

    it('takes effect on the next request when the state changes', async () => {
        const user = await makeUser();
        expect((await login(user)).status).toBe(200);
        await setLogin('closed');
        expect((await login(user)).status).toBe(403);
        await setLogin('open');
        expect((await login(user)).status).toBe(200);
    });

    it('matches the allowed list by user id, so an email change keeps the access', async () => {
        await setLogin('limited');
        const user = await makeUser();
        await allow(user.id);
        await db.update(users).set({ email: 'changed@example.com' }).where(eq(users.id, user.id));
        const res = await request(app).post('/api/users/login').send({ email: 'changed@example.com', password: PASSWORD });
        expect(res.status).toBe(200);
    });
});

describe('login gate: the order of the checks never confirms an account', () => {
    beforeEach(() => setLogin('closed'));

    it('a wrong password still says "Invalid credentials", with no code', async () => {
        const user = await makeUser();
        const res = await login(user, { password: 'wrong-password' });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'Invalid credentials' });
    });

    it('an unknown email gives the same answer as a wrong password', async () => {
        const unknown = await request(app).post('/api/users/login').send({ email: 'nobody@example.com', password: PASSWORD });
        const user = await makeUser();
        const wrong = await login(user, { password: 'wrong-password' });
        expect(unknown.status).toBe(wrong.status);
        expect(unknown.body).toEqual(wrong.body);
    });

    it('a deleted account stays "Invalid credentials"', async () => {
        const user = await makeUser({ deletedAt: new Date() });
        const res = await login(user);
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'Invalid credentials' });
    });

    it('a banned account with the right password hears about the ban, not the gate', async () => {
        const user = await makeUser({ bannedAt: new Date() });
        const res = await login(user);
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('This account is suspended');
        expect(res.body.code).toBeUndefined();
    });

    it('a password-less account is still pointed at Google, as before', async () => {
        const user = await makeUser({ password: null });
        const res = await login(user);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Sign in with Google');
    });
});

describe('who the gate does not touch', () => {
    it('keeps an open session working: only new sign-ins are blocked', async () => {
        const user = await makeUser();
        const { token } = (await login(user)).body;
        await setLogin('closed');
        expect((await login(user)).status).toBe(403);
        const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
        expect(me.status).toBe(200);
    });

    it('never blocks staff: they sign in through their own routes', async () => {
        await setLogin('closed');
        await createStaff({ email: 'owner@example.com', name: 'Owner', password: 'correct-horse-battery', role: 'owner' });
        const res = await request(app).post('/api/admin/auth/login').send({ email: 'owner@example.com', password: 'correct-horse-battery' });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeTruthy();
    });

    it('does not block registration: a new account is made, but it cannot sign in (registration open, login limited)', async () => {
        await setLogin('limited');
        const created = await request(app).post('/api/users').send({
            name: 'New', email: 'new@example.com', username: 'newone', password: PASSWORD, languages: ['English', 'Spanish'],
        });
        expect(created.status).toBe(201);
        const res = await request(app).post('/api/users/login').send({ email: 'new@example.com', password: PASSWORD });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('login_not_allowed');
    });
});

describe('email verification link', () => {
    const verifyUrl = async (user) => {
        await db.insert(tokens).values({ userId: user.id, token: 'verify-token-1' });
        return `/api/users/${user.id}/verify/verify-token-1`;
    };

    it('open: verifies and returns the profile and a token, as before', async () => {
        const user = await makeUser({ verified: false });
        const res = await request(app).get(await verifyUrl(user));
        expect(res.status).toBe(200);
        expect(res.body.user.token).toBeTruthy();
    });

    it('closed: still verifies the email and uses up the link, but returns no profile and no token', async () => {
        await setLogin('closed');
        const user = await makeUser({ verified: false });
        const res = await request(app).get(await verifyUrl(user));
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: 'Email verified successfully', verified: true, loginBlocked: 'login_closed' });
        expect((await userRow(user.id)).verified).toBe(true);
        expect(await db.select().from(tokens)).toHaveLength(0);
    });

    it('limited: an account that is not listed gets the same, and a listed one gets a token', async () => {
        await setLogin('limited');
        const other = await makeUser({ verified: false });
        const listed = await makeUser({ verified: false });
        await allow(listed.id);

        const refused = await request(app).get(await verifyUrl(other));
        expect(refused.body.loginBlocked).toBe('login_not_allowed');
        expect(refused.body.user).toBeUndefined();

        await db.delete(tokens);
        const ok = await request(app).get(await verifyUrl(listed));
        expect(ok.body.user.token).toBeTruthy();
        expect(ok.body.loginBlocked).toBeUndefined();
    });
});

describe('Google', () => {
    const signupTicket = (email = 'g@example.com', sub = 'google-sub-1') =>
        issueTicket({ typ: 'oauth_signup', provider: 'google', sub, email, name: 'Gee Oogle' });
    const signup = (email, username = 'googler') =>
        request(app).post('/api/auth/signup/complete').send({ ticket: signupTicket(email), username, languages: ['English', 'Spanish'] });

    it('sign-up complete, open: returns a session token, as before', async () => {
        const res = await signup('g@example.com');
        expect(res.status).toBe(201);
        expect(res.body.token).toBeTruthy();
    });

    it('sign-up complete, login closed: the account is made, but there is no token', async () => {
        await setLogin('closed');
        const res = await signup('g@example.com');
        expect(res.status).toBe(201);
        expect(res.body.token).toBeUndefined();
        expect(res.body.loginBlocked).toBe('login_closed');
        const [row] = await db.select().from(users).where(eq(users.email, 'g@example.com'));
        expect(row).toBeTruthy();
        expect(row.lastLoginAt).toBeNull();
        expect(await db.select().from(oauthIdentities)).toHaveLength(1);
    });

    it('sign-up complete, login limited: a new account is never on the list, so no token', async () => {
        await setLogin('limited');
        const res = await signup('g@example.com');
        expect(res.status).toBe(201);
        expect(res.body.loginBlocked).toBe('login_not_allowed');
        expect(res.body.token).toBeUndefined();
    });

    describe('link', () => {
        const linkTicket = (user) => issueTicket({ typ: 'oauth_link', provider: 'google', sub: 'link-sub-1', email: user.email, name: user.name });
        const link = (user, password = PASSWORD) => request(app).post('/api/auth/link').send({ ticket: linkTicket(user), password });

        it('open: links and returns a token, as before', async () => {
            const user = await makeUser();
            const res = await link(user);
            expect(res.status).toBe(200);
            expect(res.body.token).toBeTruthy();
        });

        it('closed: refuses with a code after the password check, and links nothing', async () => {
            await setLogin('closed');
            const user = await makeUser();
            const res = await link(user);
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('login_closed');
            expect(await db.select().from(oauthIdentities)).toHaveLength(0);
        });

        it('a wrong password is still "Invalid credentials" while closed', async () => {
            await setLogin('closed');
            const user = await makeUser();
            const res = await link(user, 'wrong-password');
            expect(res.status).toBe(400);
            expect(res.body).toEqual({ message: 'Invalid credentials' });
        });

        it('limited: only a listed account can link and sign in', async () => {
            await setLogin('limited');
            const user = await makeUser();
            expect((await link(user)).body.code).toBe('login_not_allowed');
            await allow(user.id);
            expect((await link(user)).status).toBe(200);
        });
    });

    describe('callback for an identity that is already linked', () => {
        const callback = async (user) => {
            await db.insert(oauthIdentities).values({ userId: user.id, provider: 'google', providerUserId: 'linked-sub', emailAtLink: user.email });
            jwtVerify.mockResolvedValue({ payload: { sub: 'linked-sub', email: user.email, email_verified: true, name: user.name, nonce: 'n' } });
            // This Jest sandbox has no global fetch, so there is nothing to spy on: set a fake, then restore.
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id_token: 'x' }) });
            const state = issueStateToken({ provider: 'google', verifier: 'v', nonce: 'n', jti: 'j' });
            const res = await request(app)
                .get('/api/auth/google/callback?code=abc&state=j')
                .set('Cookie', `__Host-ladu_oauth=${encodeURIComponent(state)}`);
            global.fetch = originalFetch;
            return res;
        };

        it('open: redirects with a token, as before', async () => {
            const user = await makeUser({ password: null });
            const res = await callback(user);
            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('#token=');
        });

        it('closed: redirects with the code, no token, and records no login', async () => {
            await setLogin('closed');
            const user = await makeUser({ password: null });
            const res = await callback(user);
            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('#error=login_closed');
            expect(res.headers.location).not.toContain('token=');
            expect((await userRow(user.id)).lastLoginAt).toBeNull();
        });

        it('limited: a listed account gets a token, and another gets login_not_allowed', async () => {
            await setLogin('limited');
            const other = await makeUser({ password: null });
            expect((await callback(other)).headers.location).toContain('#error=login_not_allowed');

            await db.delete(oauthIdentities);
            const listed = await makeUser({ password: null });
            await allow(listed.id);
            expect((await callback(listed)).headers.location).toContain('#token=');
        });

        it('a banned account gets the dedicated code, not the gate code', async () => {
            await setLogin('closed');
            const user = await makeUser({ password: null, bannedAt: new Date() });
            const res = await callback(user);
            expect(res.headers.location).toContain('#error=oauth_account_banned');
        });

        it('a deleted account still gets the generic failure, not the gate code', async () => {
            await setLogin('closed');
            const user = await makeUser({ password: null, deletedAt: new Date() });
            const res = await callback(user);
            expect(res.headers.location).toContain('#error=oauth_failed');
        });
    });
});

describe('the allowed list', () => {
    it('goes away with the account (a purge)', async () => {
        const user = await makeUser();
        await allow(user.id);
        await db.delete(users).where(eq(users.id, user.id));
        expect(await db.select().from(loginAllowedUsers)).toHaveLength(0);
    });

    it('holds a user once', async () => {
        const user = await makeUser();
        await allow(user.id);
        await expect(allow(user.id)).rejects.toThrow();
    });
});
