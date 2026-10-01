// Admin dashboard slice 1 — login capture, and ban / delete / token-version
// enforcement. See .context/plans/admin-dashboard.md §4.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, loginEvents } = require('../src/db/schema');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const PASSWORD = 'password123';

const createUser = async (overrides = {}) => {
    const [user] = await db
        .insert(users)
        .values({
            name: 'Test User',
            email: 'test@example.com',
            username: 'testuser',
            password: await bcrypt.hash(PASSWORD, 4),
            languages: ['English', 'Spanish'],
            verified: true,
            ...overrides,
        })
        .returning();
    return user;
};

const login = (headers = {}) =>
    request(app).post('/api/users/login').set(headers).send({ email: 'test@example.com', password: PASSWORD });

const getUser = async (id) => (await db.select().from(users).where(eq(users.id, id)))[0];

describe('login capture', () => {
    it('records last login time, country and a login event', async () => {
        const user = await createUser();

        const res = await login({ 'CF-IPCountry': 'ee' });
        expect(res.status).toBe(200);

        const row = await getUser(user.id);
        expect(row.lastLoginAt).toBeInstanceOf(Date);
        expect(row.lastLoginCountry).toBe('EE');

        const events = await db.select().from(loginEvents).where(eq(loginEvents.userId, user.id));
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ method: 'password', country: 'EE' });
    });

    it('stores NULL country when the header is missing or not a real country', async () => {
        const user = await createUser();

        await login();
        await login({ 'CF-IPCountry': 'XX' });
        await login({ 'CF-IPCountry': 'T1' });

        const events = await db.select().from(loginEvents).where(eq(loginEvents.userId, user.id));
        expect(events).toHaveLength(3);
        expect(events.every((e) => e.country === null)).toBe(true);
        expect((await getUser(user.id)).lastLoginCountry).toBeNull();
    });

    it('does not record a failed login', async () => {
        const user = await createUser();

        await request(app).post('/api/users/login').send({ email: user.email, password: 'wrong' });

        expect(await db.select().from(loginEvents)).toHaveLength(0);
        expect((await getUser(user.id)).lastLoginAt).toBeNull();
    });
});

describe('last_seen_at (protect)', () => {
    it('is set on the first request and not rewritten within the hour', async () => {
        const user = await createUser();
        const token = global.signin(user.id);

        await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(200);
        const first = (await getUser(user.id)).lastSeenAt;
        expect(first).toBeInstanceOf(Date);

        await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(200);
        expect((await getUser(user.id)).lastSeenAt.getTime()).toBe(first.getTime());
    });

    it('is refreshed when the stored value is older than one hour', async () => {
        const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const user = await createUser({ lastSeenAt: stale });

        await request(app).get('/api/users/me').set('Authorization', `Bearer ${global.signin(user.id)}`).expect(200);

        expect((await getUser(user.id)).lastSeenAt.getTime()).toBeGreaterThan(stale.getTime());
    });

    it('does not leak the admin columns through GET /me', async () => {
        const user = await createUser();

        const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${global.signin(user.id)}`);

        for (const key of ['bannedAt', 'deletedAt', 'tokenVersion', 'lastSeenAt', 'banReason']) {
            expect(res.body).not.toHaveProperty(key);
        }
    });
});

describe('banned account', () => {
    it('is rejected by login with 403, after the password check', async () => {
        await createUser({ bannedAt: new Date(), banReason: 'spam' });

        const res = await login();
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('This account is suspended');

        // A wrong password must not reveal the ban.
        const wrong = await request(app).post('/api/users/login').send({ email: 'test@example.com', password: 'nope' });
        expect(wrong.status).toBe(400);
        expect(await db.select().from(loginEvents)).toHaveLength(0);
    });

    it('is rejected by protect on the next request, even with a valid token', async () => {
        const user = await createUser();
        const token = global.signin(user.id);
        await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(200);

        await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, user.id));

        await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(401);
    });
});

describe('soft-deleted account', () => {
    it('looks like it does not exist at login', async () => {
        await createUser({ deletedAt: new Date() });

        const res = await login();
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Invalid credentials');
    });

    it('is rejected by protect', async () => {
        const user = await createUser({ deletedAt: new Date() });

        await request(app).get('/api/users/me').set('Authorization', `Bearer ${global.signin(user.id)}`).expect(401);
    });

    it('keeps the email and username reserved', async () => {
        await createUser({ deletedAt: new Date() });

        const res = await request(app)
            .post('/api/users')
            .send({
                name: 'New',
                email: 'test@example.com',
                username: 'someoneelse',
                password: PASSWORD,
                languages: ['English', 'Spanish'],
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Email already in use');
    });
});

describe('token_version (force logout)', () => {
    it('login tokens carry the current version', async () => {
        const user = await createUser({ tokenVersion: 3 });

        const res = await login();

        expect(jwt.decode(res.body.token).tv).toBe(3);
    });

    it('rejects a token older than the stored version, and accepts a new login', async () => {
        const user = await createUser();
        const oldToken = (await login()).body.token;
        await request(app).get('/api/users/me').set('Authorization', `Bearer ${oldToken}`).expect(200);

        await db.update(users).set({ tokenVersion: 1 }).where(eq(users.id, user.id));

        await request(app).get('/api/users/me').set('Authorization', `Bearer ${oldToken}`).expect(401);
        const newToken = (await login()).body.token;
        await request(app).get('/api/users/me').set('Authorization', `Bearer ${newToken}`).expect(200);
    });

    it('treats a token without a `tv` claim as version 0', async () => {
        const user = await createUser();
        const legacy = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        await request(app).get('/api/users/me').set('Authorization', `Bearer ${legacy}`).expect(200);
    });
});
