// Same trap as auth.test.js:1-11 — `jest.mock` must come before `require('../app')`,
// which pulls in userController.ts's own top-level `require("../utils/sendEmail")`.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());
const sendMail = require('../utils/sendEmail');

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, oauthIdentities, tokens } = require('../src/db/schema');
const { generateCodeVerifier, generateCodeChallenge, generateNonce } = require('../lib/oauth/pkce');
const { issueStateToken, verifyStateToken } = require('../lib/oauth/stateToken');
const { issueTicket, verifyTicket } = require('../lib/oauth/ticket');

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    sendMail.mockClear();
});
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

describe('PKCE helpers', () => {
    it('the challenge is the base64url SHA-256 digest of the verifier', () => {
        const verifier = generateCodeVerifier();
        const challenge = generateCodeChallenge(verifier);
        const expected = crypto.createHash('sha256').update(verifier).digest('base64url');
        expect(challenge).toBe(expected);
    });

    it('generates a fresh, unpredictable verifier and nonce on every call', () => {
        expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
        expect(generateNonce()).not.toBe(generateNonce());
    });
});

describe('OAuth state token', () => {
    it('round-trips provider/verifier/nonce/jti through issue -> verify', () => {
        const token = issueStateToken({ provider: 'google', verifier: 'v', nonce: 'n', jti: 'j' });
        const payload = verifyStateToken(token);
        expect(payload).toMatchObject({ typ: 'oauth_state', provider: 'google', verifier: 'v', nonce: 'n', jti: 'j' });
    });

    it('rejects a real 30-day session JWT — the typ guard, not just a shared secret', () => {
        const sessionToken = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET, { expiresIn: '30d' });
        expect(() => verifyStateToken(sessionToken)).toThrow();
    });

    it('rejects a tampered token', () => {
        const token = issueStateToken({ provider: 'google', verifier: 'v', nonce: 'n', jti: 'j' });
        expect(() => verifyStateToken(`${token}x`)).toThrow();
    });
});

describe('GET /api/auth/providers', () => {
    const originalId = process.env.GOOGLE_CLIENT_ID;
    const originalSecret = process.env.GOOGLE_CLIENT_SECRET;

    afterEach(() => {
        if (originalId === undefined) delete process.env.GOOGLE_CLIENT_ID;
        else process.env.GOOGLE_CLIENT_ID = originalId;
        if (originalSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
        else process.env.GOOGLE_CLIENT_SECRET = originalSecret;
    });

    it('reports google: true once GOOGLE_CLIENT_ID/SECRET are both set', async () => {
        process.env.GOOGLE_CLIENT_ID = 'test-client-id';
        process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

        const res = await request(app).get('/api/auth/providers');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ google: true });
    });

    it('reports google: false when either is unset', async () => {
        delete process.env.GOOGLE_CLIENT_ID;
        process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

        const res = await request(app).get('/api/auth/providers');
        expect(res.body).toEqual({ google: false });
    });
});

describe('GET /api/auth/:provider/start', () => {
    it('404s for an unknown provider name', async () => {
        const res = await request(app).get('/api/auth/microsoft/start');
        expect(res.statusCode).toBe(404);
    });

    it('404s for a known provider that is not configured', async () => {
        const originalId = process.env.GOOGLE_CLIENT_ID;
        delete process.env.GOOGLE_CLIENT_ID;

        const res = await request(app).get('/api/auth/google/start');
        expect(res.statusCode).toBe(404);

        if (originalId !== undefined) process.env.GOOGLE_CLIENT_ID = originalId;
    });
});

describe('OAuth ticket', () => {
    it('round-trips provider/sub/email/name through issue -> verify', () => {
        const token = issueTicket({
            typ: 'oauth_signup',
            provider: 'google',
            sub: 's',
            email: 'e@x.com',
            name: 'N',
        });
        const payload = verifyTicket(token, 'oauth_signup');
        expect(payload).toMatchObject({
            typ: 'oauth_signup',
            provider: 'google',
            sub: 's',
            email: 'e@x.com',
            name: 'N',
        });
    });

    it('rejects a ticket checked against the wrong expected typ', () => {
        const token = issueTicket({ typ: 'oauth_signup', provider: 'google', sub: 's', email: 'e@x.com', name: 'N' });
        expect(() => verifyTicket(token, 'oauth_link')).toThrow();
    });

    it('rejects a real 30-day session JWT', () => {
        const sessionToken = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET, { expiresIn: '30d' });
        expect(() => verifyTicket(sessionToken, 'oauth_signup')).toThrow();
    });
});

describe('POST /api/auth/signup/complete', () => {
    const validTicket = (overrides = {}) =>
        issueTicket({
            typ: 'oauth_signup',
            provider: 'google',
            sub: 'sub-1',
            email: 'newuser@example.com',
            name: 'New User',
            ...overrides,
        });

    it('fails with 400 for an invalid ticket', async () => {
        const res = await request(app).post('/api/auth/signup/complete').send({
            ticket: 'not-a-real-ticket',
            username: 'newuser',
            languages: ['English', 'Spanish'],
        });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 for a ticket of the wrong typ (e.g. a state token)', async () => {
        const stateToken = issueStateToken({ provider: 'google', verifier: 'v', nonce: 'n', jti: 'j' });
        const res = await request(app).post('/api/auth/signup/complete').send({
            ticket: stateToken,
            username: 'newuser',
            languages: ['English', 'Spanish'],
        });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 when username is missing', async () => {
        const res = await request(app).post('/api/auth/signup/complete').send({
            ticket: validTicket(),
            languages: ['English', 'Spanish'],
        });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 when fewer than 2 languages are selected', async () => {
        const res = await request(app).post('/api/auth/signup/complete').send({
            ticket: validTicket(),
            username: 'newuser',
            languages: ['English'],
        });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 for a duplicate username (case-insensitive)', async () => {
        await db.insert(users).values({
            name: 'Existing',
            email: 'existing@example.com',
            username: 'NewUser',
            password: 'hash',
            languages: ['English', 'Spanish'],
            uiLanguage: 'English',
            verified: true,
        });

        const res = await request(app).post('/api/auth/signup/complete').send({
            ticket: validTicket(),
            username: 'newuser',
            languages: ['English', 'Spanish'],
        });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('Username already in use');
    });

    it("fails with 400 when the ticket's email is already registered", async () => {
        await db.insert(users).values({
            name: 'Existing',
            email: 'newuser@example.com',
            username: 'someoneelse',
            password: 'hash',
            languages: ['English', 'Spanish'],
            uiLanguage: 'English',
            verified: true,
        });

        const res = await request(app).post('/api/auth/signup/complete').send({
            ticket: validTicket(),
            username: 'brandnewusername',
            languages: ['English', 'Spanish'],
        });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('Email already in use');
    });

    it('creates a password-less, verified account plus exactly one oauth_identities row, and returns a session token', async () => {
        const res = await request(app).post('/api/auth/signup/complete').send({
            ticket: validTicket(),
            username: 'newuser',
            languages: ['English', 'Spanish'],
            uiLanguage: 'German',
        });
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('token');
        expect(res.body.username).toBe('newuser');
        expect(res.body.uiLanguage).toBe('German');

        const [user] = await db.select().from(users).where(eq(users.email, 'newuser@example.com'));
        expect(user.password).toBeNull();
        expect(user.verified).toBe(true);
        expect(user.name).toBe('New User');

        const identities = await db.select().from(oauthIdentities).where(eq(oauthIdentities.userId, user.id));
        expect(identities).toHaveLength(1);
        expect(identities[0]).toMatchObject({
            provider: 'google',
            providerUserId: 'sub-1',
            emailAtLink: 'newuser@example.com',
        });
    });

    it('never sends a verification email — no tokens row is created', async () => {
        await request(app)
            .post('/api/auth/signup/complete')
            .send({
                ticket: validTicket({ sub: 'sub-no-mail', email: 'nomail@example.com' }),
                username: 'nomailuser',
                languages: ['English', 'Spanish'],
            });

        const [user] = await db.select().from(users).where(eq(users.email, 'nomail@example.com'));
        const tokenRows = await db.select().from(tokens).where(eq(tokens.userId, user.id));
        expect(tokenRows).toHaveLength(0);
        expect(sendMail).not.toHaveBeenCalled();
    });
});

describe('POST /api/auth/link', () => {
    const bcrypt = require('bcryptjs');

    const validTicket = (overrides = {}) =>
        issueTicket({
            typ: 'oauth_link',
            provider: 'google',
            sub: 'link-sub-1',
            email: 'haspassword@example.com',
            name: 'Has Password',
            ...overrides,
        });

    async function seedPasswordUser(overrides = {}) {
        const hashed = await bcrypt.hash('correct-password', 10);
        const [user] = await db
            .insert(users)
            .values({
                name: 'Has Password',
                email: 'haspassword@example.com',
                username: 'haspassword',
                password: hashed,
                languages: ['English', 'Spanish'],
                uiLanguage: 'English',
                verified: true,
                ...overrides,
            })
            .returning();
        return user;
    }

    it('fails with 400 for an invalid ticket', async () => {
        const res = await request(app).post('/api/auth/link').send({ ticket: 'garbage', password: 'x' });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 for a ticket of the wrong typ (e.g. a signup ticket)', async () => {
        const signupTicket = issueTicket({
            typ: 'oauth_signup',
            provider: 'google',
            sub: 's',
            email: 'e@x.com',
            name: 'N',
        });
        const res = await request(app).post('/api/auth/link').send({ ticket: signupTicket, password: 'x' });
        expect(res.statusCode).toBe(400);
    });

    it("fails with 400 when the ticket's email has no matching account", async () => {
        const res = await request(app).post('/api/auth/link').send({ ticket: validTicket(), password: 'x' });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('Invalid or expired ticket');
    });

    it('rejects a password-less account as a link target (defensive — link tickets should never point at one)', async () => {
        await db.insert(users).values({
            name: 'No Password',
            email: 'haspassword@example.com',
            username: 'nopassword',
            password: null,
            languages: ['English', 'Spanish'],
            uiLanguage: 'English',
            verified: true,
        });
        const res = await request(app).post('/api/auth/link').send({ ticket: validTicket(), password: 'anything' });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('Invalid or expired ticket');
    });

    it('rejects a wrong password without linking anything, and the ticket stays usable for a retry', async () => {
        const user = await seedPasswordUser();

        const wrongRes = await request(app).post('/api/auth/link').send({ ticket: validTicket(), password: 'wrong' });
        expect(wrongRes.statusCode).toBe(400);
        expect(wrongRes.body.message).toBe('Invalid credentials');

        const identitiesAfterWrong = await db
            .select()
            .from(oauthIdentities)
            .where(eq(oauthIdentities.userId, user.id));
        expect(identitiesAfterWrong).toHaveLength(0);

        // Same ticket, right password this time — nothing consumed it above.
        const rightRes = await request(app)
            .post('/api/auth/link')
            .send({ ticket: validTicket(), password: 'correct-password' });
        expect(rightRes.statusCode).toBe(200);
    });

    it('links on the correct password and returns a session token', async () => {
        const user = await seedPasswordUser();

        const res = await request(app)
            .post('/api/auth/link')
            .send({ ticket: validTicket(), password: 'correct-password' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.email).toBe('haspassword@example.com');

        const identities = await db.select().from(oauthIdentities).where(eq(oauthIdentities.userId, user.id));
        expect(identities).toHaveLength(1);
        expect(identities[0]).toMatchObject({
            provider: 'google',
            providerUserId: 'link-sub-1',
            emailAtLink: 'haspassword@example.com',
        });
    });

    it('fails with 400 when the identity is already linked to an account', async () => {
        const user = await seedPasswordUser();
        await db.insert(oauthIdentities).values({
            userId: user.id,
            provider: 'google',
            providerUserId: 'link-sub-1',
            emailAtLink: 'haspassword@example.com',
        });

        const res = await request(app)
            .post('/api/auth/link')
            .send({ ticket: validTicket(), password: 'correct-password' });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('This Google account is already linked to an account');
    });
});

describe('POST /api/auth/:provider/link (protected start, Phase 5)', () => {
    const bcrypt = require('bcryptjs');

    it('fails with 401 when not authenticated', async () => {
        const res = await request(app).post('/api/auth/google/link');
        expect(res.statusCode).toBe(401);
    });

    it('fails with 404 for an unknown provider name, even authenticated', async () => {
        const [user] = await db
            .insert(users)
            .values({
                name: 'Connector',
                email: 'connector@example.com',
                username: 'connector',
                password: await bcrypt.hash('x', 10),
                languages: ['English', 'Spanish'],
                uiLanguage: 'English',
                verified: true,
            })
            .returning();
        const token = global.signin(user.id);

        const res = await request(app)
            .post('/api/auth/microsoft/link')
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(404);
    });

    // The 200 { url } success path needs a real discovery fetch (this
    // endpoint shares buildAuthorize with startAuth, whose own success path
    // is Jest-untested for the same reason — see "GET /api/auth/:provider/start"
    // above) — covered end to end against the Phase 0 stub in
    // oauth-5-connected-methods.spec.ts instead.
});

describe('GET /api/auth/identities', () => {
    const bcrypt = require('bcryptjs');

    async function seedUser(overrides = {}) {
        const [user] = await db
            .insert(users)
            .values({
                name: 'Identities User',
                email: 'identities@example.com',
                username: 'identitiesuser',
                password: await bcrypt.hash('x', 10),
                languages: ['English', 'Spanish'],
                uiLanguage: 'English',
                verified: true,
                ...overrides,
            })
            .returning();
        return user;
    }

    it('fails with 401 when not authenticated', async () => {
        const res = await request(app).get('/api/auth/identities');
        expect(res.statusCode).toBe(401);
    });

    it('reports hasPassword: true and an empty list for a fresh password account', async () => {
        const user = await seedUser();
        const token = global.signin(user.id);

        const res = await request(app).get('/api/auth/identities').set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ hasPassword: true, identities: [] });
    });

    it('lists linked identities and reports hasPassword: false for a password-less account', async () => {
        const user = await seedUser({ password: null });
        await db.insert(oauthIdentities).values({
            userId: user.id,
            provider: 'google',
            providerUserId: 'sub-identities-1',
            emailAtLink: 'identities@example.com',
        });
        const token = global.signin(user.id);

        const res = await request(app).get('/api/auth/identities').set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.hasPassword).toBe(false);
        expect(res.body.identities).toHaveLength(1);
        expect(res.body.identities[0]).toMatchObject({ provider: 'google' });
        expect(res.body.identities[0]).toHaveProperty('id');
    });
});

describe('DELETE /api/auth/identities/:id', () => {
    const bcrypt = require('bcryptjs');

    async function seedUser(email, overrides = {}) {
        const [user] = await db
            .insert(users)
            .values({
                name: 'Delete Identity User',
                email,
                username: email.split('@')[0],
                password: await bcrypt.hash('x', 10),
                languages: ['English', 'Spanish'],
                uiLanguage: 'English',
                verified: true,
                ...overrides,
            })
            .returning();
        return user;
    }

    it('fails with 401 when not authenticated', async () => {
        const res = await request(app).delete('/api/auth/identities/00000000-0000-0000-0000-000000000000');
        expect(res.statusCode).toBe(401);
    });

    it('fails with 404 for a non-uuid id', async () => {
        const user = await seedUser('del-notuuid@example.com');
        const token = global.signin(user.id);

        const res = await request(app)
            .delete('/api/auth/identities/not-a-uuid')
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(404);
    });

    it("fails with 404 for another user's identity id, and leaves it untouched", async () => {
        const owner = await seedUser('del-owner@example.com');
        const [identity] = await db
            .insert(oauthIdentities)
            .values({
                userId: owner.id,
                provider: 'google',
                providerUserId: 'sub-del-owner',
                emailAtLink: 'del-owner@example.com',
            })
            .returning();
        const attacker = await seedUser('del-attacker@example.com');
        const token = global.signin(attacker.id);

        const res = await request(app)
            .delete(`/api/auth/identities/${identity.id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(404);

        const stillThere = await db.select().from(oauthIdentities).where(eq(oauthIdentities.id, identity.id));
        expect(stillThere).toHaveLength(1);
    });

    it('refuses to remove a password-less account\'s only sign-in method', async () => {
        const user = await seedUser('del-only@example.com', { password: null });
        const [identity] = await db
            .insert(oauthIdentities)
            .values({ userId: user.id, provider: 'google', providerUserId: 'sub-del-only', emailAtLink: 'del-only@example.com' })
            .returning();
        const token = global.signin(user.id);

        const res = await request(app)
            .delete(`/api/auth/identities/${identity.id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('Cannot remove your only sign-in method');

        const stillThere = await db.select().from(oauthIdentities).where(eq(oauthIdentities.id, identity.id));
        expect(stillThere).toHaveLength(1);
    });

    it('allows removing the identity when the account also has a password', async () => {
        const user = await seedUser('del-haspw@example.com');
        const [identity] = await db
            .insert(oauthIdentities)
            .values({ userId: user.id, provider: 'google', providerUserId: 'sub-del-haspw', emailAtLink: 'del-haspw@example.com' })
            .returning();
        const token = global.signin(user.id);

        const res = await request(app)
            .delete(`/api/auth/identities/${identity.id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);

        const remaining = await db.select().from(oauthIdentities).where(eq(oauthIdentities.userId, user.id));
        expect(remaining).toHaveLength(0);
    });

    it('allows removing one identity when a second one would still remain', async () => {
        const user = await seedUser('del-two@example.com', { password: null });
        const [identityA] = await db
            .insert(oauthIdentities)
            .values({ userId: user.id, provider: 'google', providerUserId: 'sub-del-two-a', emailAtLink: 'del-two@example.com' })
            .returning();
        await db.insert(oauthIdentities).values({
            userId: user.id,
            provider: 'google',
            providerUserId: 'sub-del-two-b',
            emailAtLink: 'del-two@example.com',
        });
        const token = global.signin(user.id);

        const res = await request(app)
            .delete(`/api/auth/identities/${identityA.id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);

        const remaining = await db.select().from(oauthIdentities).where(eq(oauthIdentities.userId, user.id));
        expect(remaining).toHaveLength(1);
        expect(remaining[0].providerUserId).toBe('sub-del-two-b');
    });
});
