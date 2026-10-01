// Admin dashboard slice 8 — a staff member changes their own password.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { staffAccounts, auditLog } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const OLD = 'correct-horse-battery';
const NEW = 'a-completely-new-password';

const setup = async (overrides = {}) => {
    const staff = await createStaff({ email: 'staff@example.com', name: 'Staff', password: OLD, role: 'support', ...overrides });
    const login = await request(app).post('/api/admin/auth/login').send({ email: staff.email, password: OLD });
    return { staff, token: login.body.token };
};
const change = (token, body) => request(app).post('/api/admin/auth/change-password').set('Authorization', `Bearer ${token}`).send(body);
const row = async (id) => (await db.select().from(staffAccounts).where(eq(staffAccounts.id, id)))[0];

describe('POST /api/admin/auth/change-password', () => {
    it('changes the password, ends other sessions, and keeps this one with a new token', async () => {
        const { staff, token: oldToken } = await setup();

        const res = await change(oldToken, { currentPassword: OLD, newPassword: NEW });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ id: staff.id, email: staff.email, role: 'support', mustChangePassword: false });
        expect(res.body.permissions).toEqual(['users.read', 'users.ban', 'users.email', 'health.read']);
        expect(jwt.decode(res.body.token).tv).toBe(1);
        // The old token is refused, the new one works.
        expect((await request(app).get('/api/admin/auth/me').set('Authorization', `Bearer ${oldToken}`)).status).toBe(401);
        expect((await request(app).get('/api/admin/auth/me').set('Authorization', `Bearer ${res.body.token}`)).status).toBe(200);
        // The old password is gone, the new one signs in.
        expect((await request(app).post('/api/admin/auth/login').send({ email: staff.email, password: OLD })).status).toBe(400);
        expect((await request(app).post('/api/admin/auth/login').send({ email: staff.email, password: NEW })).status).toBe(200);
        expect((await row(staff.id)).passwordChangedAt).toBeInstanceOf(Date);
    });

    it('clears a temporary password, and the audit row says it was temporary, without the password', async () => {
        const { staff, token } = await setup({ mustChangePassword: true });

        const res = await change(token, { currentPassword: OLD, newPassword: NEW });

        expect(res.status).toBe(200);
        expect((await row(staff.id)).mustChangePassword).toBe(false);
        const audit = (await db.select().from(auditLog)).filter((r) => r.action === 'staff.password_change');
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({ staffId: staff.id, targetType: 'staff', targetId: staff.id, metadata: { email: staff.email, wasTemporary: true } });
        expect(JSON.stringify(await db.select().from(auditLog))).not.toContain(NEW);
        expect(JSON.stringify(await db.select().from(auditLog))).not.toContain(OLD);
    });

    it('asks for the current password: a wrong one changes nothing', async () => {
        const { staff, token } = await setup();

        for (const currentPassword of ['wrong-current-password', '', undefined, 12345, ['x']]) {
            const res = await change(token, { currentPassword, newPassword: NEW });
            expect([String(currentPassword), res.status]).toEqual([String(currentPassword), 400]);
        }
        expect((await request(app).post('/api/admin/auth/login').send({ email: staff.email, password: OLD })).status).toBe(200);
        expect((await db.select().from(auditLog)).filter((r) => r.action === 'staff.password_change')).toHaveLength(0);
        expect((await row(staff.id)).tokenVersion).toBe(0);
    });

    it('refuses a new password that is weak, too long, the same as the old one, or not text', async () => {
        const { token } = await setup();

        for (const newPassword of ['short', 'a'.repeat(73), OLD, undefined, 1234567890123456, ['x']]) {
            const res = await change(token, { currentPassword: OLD, newPassword });
            expect([String(newPassword).slice(0, 10), res.status]).toEqual([String(newPassword).slice(0, 10), 400]);
        }
        expect((await change(token, undefined)).status).toBe(400);
    });

    it('needs a staff token', async () => {
        expect((await request(app).post('/api/admin/auth/change-password').send({ currentPassword: OLD, newPassword: NEW })).status).toBe(401);
        expect((await change('not-a-token', { currentPassword: OLD, newPassword: NEW })).status).toBe(401);
    });

    it('is refused for a disabled account', async () => {
        const { staff, token } = await setup();
        await db.update(staffAccounts).set({ disabledAt: new Date() }).where(eq(staffAccounts.id, staff.id));

        expect((await change(token, { currentPassword: OLD, newPassword: NEW })).status).toBe(401);
    });

    it('can be done twice in a row, each time with the token from the last answer', async () => {
        const { token } = await setup();
        const first = await change(token, { currentPassword: OLD, newPassword: NEW });

        const second = await change(first.body.token, { currentPassword: NEW, newPassword: 'and-yet-another-password' });

        expect(second.status).toBe(200);
        expect(jwt.decode(second.body.token).tv).toBe(2);
    });
});
