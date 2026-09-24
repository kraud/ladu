// `jest.mock` + the mocked module's own `require` MUST come before `require('../app')`
// below. This file is plain CommonJS (not Babel/ts-jest transformed — only `.tsx?`
// files go through the `transform` in jest.config.js), so Jest's automatic
// `jest.mock` hoisting (which only rewrites `import` syntax) never applies here:
// these lines run in the literal order they're written. `require('../app')` pulls
// in `userController.ts`, which does its own top-level
// `require("../utils/sendEmail")` — if that happened before this mock was
// registered, the controller would capture the *real* nodemailer-backed module
// (hitting live SMTP in every test run) instead of the mock.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());
const sendMail = require('../utils/sendEmail');

const crypto = require('crypto');
const request = require('supertest');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, tokens, passwordResetTokens } = require('../src/db/schema');

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    sendMail.mockClear();
});
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const validUser = {
    name: 'Test User',
    email: 'test@example.com',
    username: 'testuser',
    password: 'password123',
    // Registration now requires >= 2 supported languages (Phase 1 final change).
    // `uiLanguage` is intentionally omitted so the default-"English" path stays covered.
    languages: ['English', 'Spanish'],
};

// Send a registration request with optional field overrides for duplicate and validation cases.
const registerUser = (overrides = {}) =>
    request(app).post('/api/users').send({ ...validUser, ...overrides });

// Read a user row by email so tests can verify persisted data independently of the API response.
const findUserByEmail = async (email) => {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
};

// Read every password-reset token row for a user, newest first — tests assert
// on count, `usedAt`, and `createdAt` across these rows.
const findPasswordResetTokensByUserId = async (userId) =>
    db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, userId))
        .orderBy(passwordResetTokens.createdAt);

// Read the verification token row by user id to assert token creation and deletion behavior.
const findTokenByUserId = async (userId) => {
    const [token] = await db.select().from(tokens).where(eq(tokens.userId, userId)).limit(1);
    return token || null;
};

// Inserts a password-less account directly — there's no signup flow that
// creates one yet (Phase 2/3), but the DB row shape (password: null,
// verified: true, matching a real OAuth signup) is what Phase 1's login
// guard has to handle.
const createOAuthOnlyUser = (overrides = {}) =>
    db
        .insert(users)
        .values({
            name: 'OAuth Only',
            email: 'oauth-only@example.com',
            username: 'oauthonly',
            password: null,
            languages: ['English', 'Spanish'],
            uiLanguage: 'English',
            verified: true,
            ...overrides,
        })
        .returning();

describe('POST /api/users - Registration', () => {
    it('registers a new user and returns user data without password', async () => {
        const res = await registerUser();

        // The public registration response mirrors the legacy contract and hides sensitive fields.
        expect(res.statusCode).toBe(201);
        expect(res.body).toMatchObject({
            email: 'test@example.com',
            languages: ['English', 'Spanish'],
            name: 'Test User',
            nativeLanguage: null,
            uiLanguage: 'English',
            username: 'testuser',
            verified: false,
        });
        expect(res.body.id).toBeDefined();
        expect(res.body).not.toHaveProperty('_id');
        expect(res.body).not.toHaveProperty('password');
        expect(res.body).not.toHaveProperty('token');
    });

    it('creates a Token document for email verification', async () => {
        await registerUser();

        // Registration persists a separate one-time token used by the email verification route.
        const user = await findUserByEmail('test@example.com');
        const token = await findTokenByUserId(user.id);
        expect(token).toBeDefined();
        expect(token.token).toBeDefined();
    });

    it('hashes the password', async () => {
        await registerUser();

        // Password hashes are stored in PostgreSQL; plaintext input must never be persisted.
        const user = await findUserByEmail('test@example.com');
        expect(user.password).not.toBe('password123');
    });

    it('fails with 400 when name is missing', async () => {
        const res = await registerUser({ name: undefined });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 when email is missing', async () => {
        const res = await registerUser({ email: undefined });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 when username is missing', async () => {
        const res = await registerUser({ username: undefined });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 when password is missing', async () => {
        const res = await registerUser({ password: undefined });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 for duplicate email (case-insensitive)', async () => {
        await registerUser();
        const res = await registerUser({
            email: 'TEST@example.com',
            username: 'otheruser',
        });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 for duplicate username (case-insensitive)', async () => {
        await registerUser();
        const res = await registerUser({
            username: 'TestUser',
            email: 'other@example.com',
        });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 when fewer than 2 languages are selected', async () => {
        const res = await registerUser({ languages: ['English'] });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/at least 2 languages/i);
    });

    it('fails with 400 when languages is omitted', async () => {
        const res = await registerUser({ languages: undefined });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 for an unsupported language', async () => {
        const res = await registerUser({ languages: ['English', 'Klingon'] });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/invalid language/i);
    });

    it('stores the selected languages in the order they were sent', async () => {
        const res = await registerUser({ languages: ['German', 'English', 'Spanish'] });
        expect(res.statusCode).toBe(201);
        expect(res.body.languages).toEqual(['German', 'English', 'Spanish']);
    });

    it('persists a supported uiLanguage from the register request', async () => {
        const res = await registerUser({ uiLanguage: 'Spanish' });
        expect(res.statusCode).toBe(201);
        expect(res.body.uiLanguage).toBe('Spanish');

        const user = await findUserByEmail('test@example.com');
        expect(user.uiLanguage).toBe('Spanish');
    });

    it('fails with 400 for an unsupported uiLanguage', async () => {
        const res = await registerUser({ uiLanguage: 'Klingon' });
        expect(res.statusCode).toBe(400);
    });

    it('sends the verification email in the language chosen at registration', async () => {
        await registerUser({ uiLanguage: 'German' });

        expect(sendMail).toHaveBeenCalledTimes(1);
        const [emailData] = sendMail.mock.calls[0];
        expect(emailData).toMatchObject({
            type: 'verifyEmail',
            email: 'test@example.com',
            language: 'German',
        });
    });
});

describe('GET /api/users/:id/verify/:token - Email Verification', () => {
    it('verifies the user and returns a JWT', async () => {
        await registerUser();
        const user = await findUserByEmail('test@example.com');
        const tokenDoc = await findTokenByUserId(user.id);

        // The verification URL consumes the stored token and returns an authenticated user payload.
        const res = await request(app).get(
            `/api/users/${user.id}/verify/${tokenDoc.token}`
        );

        expect(res.statusCode).toBe(200);
        expect(res.body.user.token).toBeDefined();
        expect(res.body.user).not.toHaveProperty('password');
        expect(res.body.user).not.toHaveProperty('passwordTokens');

        const updated = await findUserByEmail('test@example.com');
        expect(updated.verified).toBe(true);
    });

    it('fails with invalid token', async () => {
        await registerUser();
        const user = await findUserByEmail('test@example.com');

        // A valid user id alone is insufficient; the token must match the tokens table.
        const res = await request(app).get(
            `/api/users/${user.id}/verify/invalidtoken123`
        );

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/invalid link/i);
    });

    it('deletes the Token document after successful verification', async () => {
        await registerUser();
        const user = await findUserByEmail('test@example.com');
        const tokenDoc = await findTokenByUserId(user.id);

        await request(app).get(
            `/api/users/${user.id}/verify/${tokenDoc.token}`
        );

        // Consumed verification tokens are removed so the same URL cannot be reused.
        const remaining = await findTokenByUserId(user.id);
        expect(remaining).toBeNull();
    });
});

describe('POST /api/users/login - Login', () => {
    beforeEach(async () => {
        await registerUser();
    });

    it('logs in with valid credentials', async () => {
        const res = await request(app)
            .post('/api/users/login')
            .send({ email: 'test@example.com', password: 'password123' });

        // A successful login returns profile data plus the JWT used by protected routes.
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('name', 'Test User');
        expect(res.body).toHaveProperty('email', 'test@example.com');
        expect(res.body).toHaveProperty('username', 'testuser');
    });

    it('fails with wrong password', async () => {
        const res = await request(app)
            .post('/api/users/login')
            .send({ email: 'test@example.com', password: 'wrongpassword' });

        expect(res.statusCode).toBe(400);
    });

    it('fails with non-existent email', async () => {
        const res = await request(app)
            .post('/api/users/login')
            .send({ email: 'nonexistent@example.com', password: 'password123' });

        expect(res.statusCode).toBe(400);
    });

    it('fails with missing password', async () => {
        const res = await request(app)
            .post('/api/users/login')
            .send({ email: 'test@example.com' });

        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toBeTruthy();
    });

    it('persists a uiLanguage chosen on the login screen', async () => {
        const res = await request(app)
            .post('/api/users/login')
            .send({ email: 'test@example.com', password: 'password123', uiLanguage: 'German' });

        expect(res.statusCode).toBe(200);
        expect(res.body.uiLanguage).toBe('German');

        const user = await findUserByEmail('test@example.com');
        expect(user.uiLanguage).toBe('German');
    });

    it('leaves uiLanguage unchanged when the login request omits it', async () => {
        const res = await request(app)
            .post('/api/users/login')
            .send({ email: 'test@example.com', password: 'password123' });

        expect(res.statusCode).toBe(200);
        expect(res.body.uiLanguage).toBe('English');
    });

    it('rejects an unsupported uiLanguage on login', async () => {
        const res = await request(app)
            .post('/api/users/login')
            .send({ email: 'test@example.com', password: 'password123', uiLanguage: 'Klingon' });

        expect(res.statusCode).toBe(400);
    });

    it('points a password-less (OAuth-only) account at the provider instead of "Invalid credentials"', async () => {
        await createOAuthOnlyUser();

        const res = await request(app)
            .post('/api/users/login')
            .send({ email: 'oauth-only@example.com', password: 'anything' });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('Sign in with Google');
    });

    it('gives the same guard message with no password sent at all', async () => {
        await createOAuthOnlyUser();

        const res = await request(app)
            .post('/api/users/login')
            .send({ email: 'oauth-only@example.com' });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('Sign in with Google');
    });

    it('leaves an ordinary password account unaffected by the guard', async () => {
        // Already covered by "logs in with valid credentials" above; this
        // asserts the negative directly — a password account never sees the
        // OAuth-specific message.
        const res = await request(app)
            .post('/api/users/login')
            .send({ email: 'test@example.com', password: 'wrongpassword' });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).not.toBe('Sign in with Google');
    });
});

describe('GET /api/users/me - Profile', () => {
    let token;

    beforeEach(async () => {
        await registerUser();
        const loginRes = await request(app)
            .post('/api/users/login')
            .send({ email: 'test@example.com', password: 'password123' });
        token = loginRes.body.token;
    });

    it('returns the authenticated user profile', async () => {
        const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${token}`);

        // The auth middleware attaches the database user without exposing the password hash.
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('email', 'test@example.com');
        expect(res.body).toHaveProperty('name', 'Test User');
        expect(res.body).not.toHaveProperty('password');
        expect(res.body).not.toHaveProperty('passwordTokens');
    });

    it('fails with 401 when no token is provided', async () => {
        const res = await request(app).get('/api/users/me');

        expect(res.statusCode).toBe(401);
    });

    it('fails with 401 when an invalid token is provided', async () => {
        const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', 'Bearer invalidtoken123');

        expect(res.statusCode).toBe(401);
    });

    it('fails with 401 when Authorization header has no Bearer prefix', async () => {
        const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', token);

        expect(res.statusCode).toBe(401);
    });
});

describe('PUT /api/users/updateUser - Update Profile', () => {
    let token;
    let userId;

    beforeEach(async () => {
        await registerUser();
        const loginRes = await request(app)
            .post('/api/users/login')
            .send({ email: 'test@example.com', password: 'password123' });
        token = loginRes.body.token;
        userId = loginRes.body.id;
    });

    it('updates the name', async () => {
        const res = await request(app)
            .put('/api/users/updateUser')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: 'test@example.com',
                name: 'Updated Name',
                username: 'testuser',
            });

        // The endpoint edits only the authenticated user's profile row.
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('name', 'Updated Name');
        expect(res.body).toHaveProperty('id', userId);
        expect(res.body).not.toHaveProperty('_id');
        expect(res.body).not.toHaveProperty('password');
        expect(res.body).not.toHaveProperty('passwordTokens');
    });

    it('updates the language selection, preserving the order sent', async () => {
        const res = await request(app)
            .put('/api/users/updateUser')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: 'test@example.com',
                name: 'Test User',
                username: 'testuser',
                languages: ['German', 'English', 'Spanish'],
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.languages).toEqual(['German', 'English', 'Spanish']);
    });

    it('fails with 400 when fewer than 2 languages are sent', async () => {
        const res = await request(app)
            .put('/api/users/updateUser')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: 'test@example.com',
                name: 'Test User',
                username: 'testuser',
                languages: ['English'],
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/at least 2 languages/i);
    });

    it('fails with 400 for an unsupported language', async () => {
        const res = await request(app)
            .put('/api/users/updateUser')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: 'test@example.com',
                name: 'Test User',
                username: 'testuser',
                languages: ['English', 'Klingon'],
            });

        expect(res.statusCode).toBe(400);
    });

    it('fails when username is taken by another user', async () => {
        await registerUser({
            name: 'Other User',
            email: 'other@example.com',
            username: 'otheruser',
            password: 'password123',
        });

        const res = await request(app)
            .put('/api/users/updateUser')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: 'test@example.com',
                name: 'Test User',
                username: 'otheruser',
            });

        expect(res.statusCode).toBe(400);
    });

    it('fails with 401 when not authenticated', async () => {
        const res = await request(app)
            .put('/api/users/updateUser')
            .send({
                email: 'test@example.com',
                name: 'Updated Name',
                username: 'testuser',
            });

        expect(res.statusCode).toBe(401);
    });
});

describe('GET /api/users/getUser/:id - Private lookup', () => {
    let token;
    let userId;

    beforeEach(async () => {
        await registerUser();
        const loginRes = await request(app)
            .post('/api/users/login')
            .send({ email: 'test@example.com', password: 'password123' });
        token = loginRes.body.token;
        userId = loginRes.body.id;
    });

    it('returns the user without the password hash or reset tokens', async () => {
        const res = await request(app)
            .get(`/api/users/getUser/${userId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('id', userId);
        expect(res.body).toHaveProperty('email', 'test@example.com');
        expect(res.body).not.toHaveProperty('password');
        expect(res.body).not.toHaveProperty('passwordTokens');
        expect(res.body).not.toHaveProperty('_id');
    });

    it('fails with 401 when not authenticated', async () => {
        const res = await request(app).get(`/api/users/getUser/${userId}`);

        expect(res.statusCode).toBe(401);
    });
});

describe('Password Reset Flow', () => {
    beforeEach(async () => {
        await registerUser();
    });

    it('POST /api/users/requestPasswordReset returns 200', async () => {
        const res = await request(app)
            .post('/api/users/requestPasswordReset')
            .send({ email: 'test@example.com' });

        expect(res.statusCode).toBe(200);
    });

    it('inserts a password_reset_tokens row for the user', async () => {
        await request(app)
            .post('/api/users/requestPasswordReset')
            .send({ email: 'test@example.com' });

        const user = await findUserByEmail('test@example.com');
        const rows = await findPasswordResetTokensByUserId(user.id);
        expect(rows.length).toBe(1);
        expect(rows[0].usedAt).toBeNull();
    });

    it('sends the reset email in the account\'s stored uiLanguage', async () => {
        await registerUser({
            email: 'es-reset@example.com',
            username: 'esreset',
            uiLanguage: 'Spanish',
        });

        await request(app)
            .post('/api/users/requestPasswordReset')
            .send({ email: 'es-reset@example.com' });

        const call = sendMail.mock.calls.find(
            ([data]) => data.type === 'resetPassword' && data.email === 'es-reset@example.com',
        );
        expect(call).toBeDefined();
        expect(call[0].language).toBe('Spanish');
    });

    it('fails when email is not registered', async () => {
        const res = await request(app)
            .post('/api/users/requestPasswordReset')
            .send({ email: 'unknown@example.com' });

        expect(res.statusCode).toBe(400);
    });

    describe('PUT /api/users/updatePassword', () => {
        let user;
        let token;

        beforeEach(async () => {
            await request(app)
                .post('/api/users/requestPasswordReset')
                .send({ email: 'test@example.com' });
            user = await findUserByEmail('test@example.com');
            [token] = await findPasswordResetTokensByUserId(user.id);
        });

        it('updates the password with a valid token', async () => {
            const res = await request(app)
                .put('/api/users/updatePassword')
                .send({
                    userId: user.id,
                    password: 'newpassword456',
                    token: token.token,
                });

            expect(res.statusCode).toBe(200);

            // Verify the new hash by logging in with the replacement password.
            const loginRes = await request(app)
                .post('/api/users/login')
                .send({ email: 'test@example.com', password: 'newpassword456' });
            expect(loginRes.statusCode).toBe(200);
        });

        it('marks the used token used and deletes every other outstanding row for the user', async () => {
            // A second outstanding request from another device/tab.
            await request(app)
                .post('/api/users/requestPasswordReset')
                .send({ email: 'test@example.com' });
            expect((await findPasswordResetTokensByUserId(user.id)).length).toBe(2);

            await request(app)
                .put('/api/users/updatePassword')
                .send({ userId: user.id, password: 'newpassword456', token: token.token });

            // The successful reset invalidates every OTHER outstanding row for
            // this user — old links must stop working — while the used row
            // itself is kept (marked `usedAt`) rather than deleted.
            const remaining = await findPasswordResetTokensByUserId(user.id);
            expect(remaining.length).toBe(1);
            expect(remaining[0].id).toBe(token.id);
            expect(remaining[0].usedAt).not.toBeNull();
        });

        it('rejects the same token on a second use', async () => {
            await request(app)
                .put('/api/users/updatePassword')
                .send({ userId: user.id, password: 'newpassword456', token: token.token });

            const res = await request(app)
                .put('/api/users/updatePassword')
                .send({ userId: user.id, password: 'yetanother789', token: token.token });

            expect(res.statusCode).toBe(400);
        });

        it('rejects a token older than the 30-minute TTL', async () => {
            // Backdate the row past the expiry window directly in the DB —
            // there is no API surface for simulating elapsed time.
            await db
                .update(passwordResetTokens)
                .set({ createdAt: new Date(Date.now() - 31 * 60_000) })
                .where(eq(passwordResetTokens.id, token.id));

            const res = await request(app)
                .put('/api/users/updatePassword')
                .send({ userId: user.id, password: 'newpassword456', token: token.token });

            expect(res.statusCode).toBe(400);
        });

        it('fails with invalid token', async () => {
            const res = await request(app)
                .put('/api/users/updatePassword')
                .send({
                    userId: user.id,
                    password: 'newpassword456',
                    token: 'invalidtoken',
                });

            expect(res.statusCode).toBe(400);
        });

        it('fails with invalid userId', async () => {
            const res = await request(app)
                .put('/api/users/updatePassword')
                .send({
                    userId: crypto.randomUUID(),
                    password: 'newpassword456',
                    token: token.token,
                });

            expect(res.statusCode).toBe(400);
        });
    });
});
