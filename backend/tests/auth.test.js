const crypto = require('crypto');
const request = require('supertest');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, tokens } = require('../src/db/schema');

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const validUser = {
    name: 'Test User',
    email: 'test@example.com',
    username: 'testuser',
    password: 'password123',
};

// Send a registration request with optional field overrides for duplicate and validation cases.
const registerUser = (overrides = {}) =>
    request(app).post('/api/users').send({ ...validUser, ...overrides });

// Read a user row by email so tests can verify persisted data independently of the API response.
const findUserByEmail = async (email) => {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
};

// Read the verification token row by user id to assert token creation and deletion behavior.
const findTokenByUserId = async (userId) => {
    const [token] = await db.select().from(tokens).where(eq(tokens.userId, userId)).limit(1);
    return token || null;
};

describe('POST /api/users - Registration', () => {
    it('registers a new user and returns user data without password', async () => {
        const res = await registerUser();

        // The public registration response mirrors the legacy contract and hides sensitive fields.
        expect(res.statusCode).toBe(201);
        expect(res.body).toMatchObject({
            email: 'test@example.com',
            languages: [],
            name: 'Test User',
            nativeLanguage: null,
            uiLanguage: 'English',
            username: 'testuser',
            verified: false,
        });
        expect(res.body._id).toBeDefined();
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
        userId = loginRes.body._id;
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
        expect(res.body).toHaveProperty('_id', userId);
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

    it('stores a token in user.passwordTokens', async () => {
        await request(app)
            .post('/api/users/requestPasswordReset')
            .send({ email: 'test@example.com' });

        // Password reset tokens are stored on the user row and consumed by updatePassword.
        const user = await findUserByEmail('test@example.com');
        expect(user.passwordTokens.length).toBe(1);
    });

    it('fails when email is not registered', async () => {
        const res = await request(app)
            .post('/api/users/requestPasswordReset')
            .send({ email: 'unknown@example.com' });

        expect(res.statusCode).toBe(400);
    });

    describe('PUT /api/users/updatePassword', () => {
        let user;

        beforeEach(async () => {
            await request(app)
                .post('/api/users/requestPasswordReset')
                .send({ email: 'test@example.com' });
            user = await findUserByEmail('test@example.com');
        });

        it('updates the password with valid token', async () => {
            const token = user.passwordTokens[0];

            const res = await request(app)
                .put('/api/users/updatePassword')
                .send({
                    userId: user.id,
                    password: 'newpassword456',
                    token,
                });

            expect(res.statusCode).toBe(200);

            // Verify the new hash by logging in with the replacement password.
            const loginRes = await request(app)
                .post('/api/users/login')
                .send({ email: 'test@example.com', password: 'newpassword456' });
            expect(loginRes.statusCode).toBe(200);
        });

        it('clears passwordTokens after update', async () => {
            const token = user.passwordTokens[0];

            await request(app)
                .put('/api/users/updatePassword')
                .send({
                    userId: user.id,
                    password: 'newpassword456',
                    token,
                });

            // Clearing tokens prevents reset links from being reused after a successful password change.
            const updated = await findUserByEmail('test@example.com');
            expect(updated.passwordTokens).toEqual([]);
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
                    token: user.passwordTokens[0],
                });

            expect(res.statusCode).toBe(400);
        });
    });
});
