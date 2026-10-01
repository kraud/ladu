// Admin dashboard slice 2 — staff login, requireStaff and the role map.
// See .context/plans/admin-dashboard.md §2.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { staffAccounts, auditLog, users } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');
const { requireStaff } = require('../middleware/staffAuth');
const { ROLES, ROLE_PERMISSIONS, hasPermission } = require('../lib/adminPermissions');
const { errorHandler } = require('../middleware/errorMiddleware');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const PASSWORD = 'correct-horse-battery';

const makeStaff = (overrides = {}) =>
    createStaff({ email: 'staff@example.com', name: 'Staff', password: PASSWORD, role: 'owner', ...overrides });

const login = (body = { email: 'staff@example.com', password: PASSWORD }, headers = {}) =>
    request(app).post('/api/admin/auth/login').set(headers).send(body);

describe('role map', () => {
    it('gives the roles the permissions in the plan', () => {
        expect(hasPermission('owner', 'staff.manage')).toBe(true);
        expect(hasPermission('owner', 'users.purge')).toBe(true);
        expect(hasPermission('admin', 'users.purge')).toBe(false);
        expect(hasPermission('owner', 'access.manage')).toBe(true);
        for (const role of ['admin', 'support', 'viewer']) expect(hasPermission(role, 'access.manage')).toBe(false);
        expect(hasPermission('admin', 'users.delete')).toBe(true);
        expect(hasPermission('admin', 'staff.manage')).toBe(false);
        expect(hasPermission('support', 'users.ban')).toBe(true);
        expect(hasPermission('support', 'users.delete')).toBe(false);
        expect(hasPermission('viewer', 'users.read')).toBe(true);
        expect(hasPermission('viewer', 'users.ban')).toBe(false);
    });

    it('gives an unknown role nothing, including inherited object keys', () => {
        expect(hasPermission('root', 'users.read')).toBe(false);
        expect(hasPermission('constructor', 'users.read')).toBe(false);
    });

    it('lets owner do everything any other role can', () => {
        for (const role of ROLES) {
            for (const permission of ROLE_PERMISSIONS[role]) {
                expect(hasPermission('owner', permission)).toBe(true);
            }
        }
    });
});

describe('createStaff', () => {
    it('lowercases the email and stores a hash, not the password', async () => {
        const staff = await makeStaff({ email: '  Staff@Example.COM ' });
        expect(staff.email).toBe('staff@example.com');

        const [row] = await db.select().from(staffAccounts).where(eq(staffAccounts.id, staff.id));
        expect(row.passwordHash).not.toContain(PASSWORD);
        expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('rejects a short password, a bad role and a bad email', async () => {
        await expect(makeStaff({ password: 'short' })).rejects.toThrow('at least 12');
        await expect(makeStaff({ role: 'root' })).rejects.toThrow('Invalid role');
        await expect(makeStaff({ email: 'nope' })).rejects.toThrow('Invalid email');
    });

    it('rejects a duplicate email, whatever its case', async () => {
        await makeStaff();
        await expect(makeStaff({ email: 'STAFF@example.com' })).rejects.toThrow();
    });
});

describe('POST /api/admin/auth/login', () => {
    it('returns a token with aud "admin" and an 8 hour lifetime', async () => {
        const staff = await makeStaff({ role: 'support' });

        const res = await login({ email: 'STAFF@example.com', password: PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ id: staff.id, email: 'staff@example.com', role: 'support' });
        expect(res.body.permissions).toEqual(['users.read', 'users.ban', 'users.email', 'health.read']);
        expect(res.body.environment).toBe('local');
        expect(res.body).not.toHaveProperty('passwordHash');
        const claims = jwt.verify(res.body.token, process.env.ADMIN_JWT_SECRET);
        expect(claims.aud).toBe('admin');
        expect(claims.exp - claims.iat).toBe(8 * 60 * 60);
    });

    it('writes last_login_at and one audit row', async () => {
        const staff = await makeStaff();

        await login(undefined, { 'CF-IPCountry': 'ee' });

        const [row] = await db.select().from(staffAccounts).where(eq(staffAccounts.id, staff.id));
        expect(row.lastLoginAt).toBeInstanceOf(Date);
        const audit = await db.select().from(auditLog);
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({
            staffId: staff.id,
            action: 'staff.login',
            targetType: 'staff',
            targetId: staff.id,
            metadata: { country: 'EE' },
        });
    });

    it('answers a wrong password, an unknown email and a disabled account the same way', async () => {
        const staff = await makeStaff();

        const wrongPassword = await login({ email: 'staff@example.com', password: 'wrong-password-1' });
        const unknownEmail = await login({ email: 'nobody@example.com', password: PASSWORD });
        await db.update(staffAccounts).set({ disabledAt: new Date() }).where(eq(staffAccounts.id, staff.id));
        const disabled = await login();

        for (const res of [wrongPassword, unknownEmail, disabled]) {
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Invalid credentials');
        }
        expect(await db.select().from(auditLog)).toHaveLength(0);
    });

    it('rejects a missing or non-string body without crashing', async () => {
        await makeStaff();

        expect((await request(app).post('/api/admin/auth/login')).status).toBe(400);
        expect((await login({ email: { $ne: '' }, password: ['x'] })).status).toBe(400);
    });

    it('returns 503 and no audit row when ADMIN_JWT_SECRET is not set', async () => {
        await makeStaff();
        const secret = process.env.ADMIN_JWT_SECRET;
        delete process.env.ADMIN_JWT_SECRET;
        try {
            const res = await login();
            expect(res.status).toBe(503);
            expect(await db.select().from(auditLog)).toHaveLength(0);
        } finally {
            process.env.ADMIN_JWT_SECRET = secret;
        }
    });
});

describe('requireStaff', () => {
    // A tiny app with one route per case, so the permission checks are tested
    // before the real routes exist (slices 4 and 5 add them).
    const probe = express();
    probe.get('/any', requireStaff(), (req, res) => res.json(req.staff));
    probe.get('/read', requireStaff('users.read'), (req, res) => res.json({ ok: true }));
    probe.post('/ban', requireStaff('users.ban'), (req, res) => res.json({ ok: true }));
    probe.post('/manage', requireStaff('staff.manage'), (req, res) => res.json({ ok: true }));
    probe.use(errorHandler);

    const tokenFor = async (role) => {
        const staff = await makeStaff({ role, email: `${role}@example.com` });
        const res = await login({ email: staff.email, password: PASSWORD });
        return { staff, token: res.body.token };
    };
    const bearer = (token) => ({ Authorization: `Bearer ${token}` });

    it('lets a viewer read but not ban', async () => {
        const { token } = await tokenFor('viewer');

        expect((await request(probe).get('/read').set(bearer(token))).status).toBe(200);
        expect((await request(probe).post('/ban').set(bearer(token))).status).toBe(403);
    });

    it('lets support ban but not manage staff', async () => {
        const { token } = await tokenFor('support');

        expect((await request(probe).post('/ban').set(bearer(token))).status).toBe(200);
        expect((await request(probe).post('/manage').set(bearer(token))).status).toBe(403);
    });

    it('lets owner manage staff', async () => {
        const { token } = await tokenFor('owner');

        expect((await request(probe).post('/manage').set(bearer(token))).status).toBe(200);
    });

    it('rejects a request with no token', async () => {
        expect((await request(probe).get('/any')).status).toBe(401);
    });

    it('rejects a learner token, even one whose user id matches nothing', async () => {
        const [user] = await db
            .insert(users)
            .values({ name: 'L', email: 'l@example.com', username: 'l', languages: ['English', 'Spanish'] })
            .returning();

        // Signed with the learner secret, no audience.
        expect((await request(probe).get('/any').set(bearer(global.signin(user.id)))).status).toBe(401);
        // Even signed with the staff secret, a token without aud "admin" fails.
        const noAudience = jwt.sign({ id: user.id }, process.env.ADMIN_JWT_SECRET);
        expect((await request(probe).get('/any').set(bearer(noAudience))).status).toBe(401);
    });

    it('rejects a staff token on the learner routes', async () => {
        const { token } = await tokenFor('owner');

        expect((await request(app).get('/api/users/me').set(bearer(token))).status).toBe(401);
    });

    it('rejects an expired token and a token for another algorithm', async () => {
        const { staff } = await tokenFor('owner');
        const expired = jwt.sign({ id: staff.id }, process.env.ADMIN_JWT_SECRET, {
            audience: 'admin',
            expiresIn: -10,
        });
        const none = jwt.sign({ id: staff.id }, '', { algorithm: 'none', audience: 'admin' });

        expect((await request(probe).get('/any').set(bearer(expired))).status).toBe(401);
        expect((await request(probe).get('/any').set(bearer(none))).status).toBe(401);
    });

    it('stops working at once when the account is disabled or deleted', async () => {
        const { staff, token } = await tokenFor('owner');
        expect((await request(probe).get('/any').set(bearer(token))).status).toBe(200);

        await db.update(staffAccounts).set({ disabledAt: new Date() }).where(eq(staffAccounts.id, staff.id));

        expect((await request(probe).get('/any').set(bearer(token))).status).toBe(401);
    });

    it('applies a role change on the next request', async () => {
        const { staff, token } = await tokenFor('support');
        expect((await request(probe).post('/ban').set(bearer(token))).status).toBe(200);

        await db.update(staffAccounts).set({ role: 'viewer' }).where(eq(staffAccounts.id, staff.id));

        expect((await request(probe).post('/ban').set(bearer(token))).status).toBe(403);
    });
});

describe('GET /api/admin/auth/me', () => {
    it('returns the signed-in staff member without a password hash', async () => {
        const staff = await makeStaff({ role: 'admin' });
        const { token } = (await login()).body;

        const res = await request(app).get('/api/admin/auth/me').set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            id: staff.id,
            email: 'staff@example.com',
            name: 'Staff',
            role: 'admin',
            permissions: ['users.read', 'users.ban', 'users.email', 'users.delete', 'health.read', 'audit.read'],
            mustChangePassword: false,
            environment: 'local',
        });
    });

    it('rejects a learner token', async () => {
        const [user] = await db
            .insert(users)
            .values({ name: 'L', email: 'l@example.com', username: 'l', languages: ['English', 'Spanish'] })
            .returning();

        const res = await request(app).get('/api/admin/auth/me').set('Authorization', `Bearer ${global.signin(user.id)}`);

        expect(res.status).toBe(401);
    });
});
