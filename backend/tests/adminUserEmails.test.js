// Admin user emails — "Resend verification email" and "Send password reset".
// See .context/plans/admin-user-emails.md.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());
const sendMail = require('../utils/sendEmail');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { and, eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, tokens, passwordResetTokens, auditLog } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');
const { hasPermission } = require('../lib/adminPermissions');

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    sendMail.mockClear();
});
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const STAFF_PASSWORD = 'correct-horse-battery';

const staffToken = async (role) => {
    const email = `${role}@example.com`;
    await createStaff({ email, name: `${role} person`, password: STAFF_PASSWORD, role });
    return (await request(app).post('/api/admin/auth/login').send({ email, password: STAFF_PASSWORD })).body.token;
};

let seq = 0;
const makeUser = async (overrides = {}) => {
    seq += 1;
    const [user] = await db
        .insert(users)
        .values({
            name: `User ${seq}`,
            email: `user${seq}@example.com`,
            username: `user${seq}`,
            password: await bcrypt.hash('learner-password-1', 4),
            languages: ['English', 'Spanish'],
            uiLanguage: 'Spanish',
            verified: false,
            ...overrides,
        })
        .returning();
    return user;
};

const act = (id, name, token, body = {}) =>
    request(app).post(`/api/admin/users/${id}/${name}`).set('Authorization', `Bearer ${token}`).send(body);
const auditFor = (id, action) =>
    db.select().from(auditLog).where(and(eq(auditLog.targetId, id), eq(auditLog.action, action)));
const verifyTokens = (id) => db.select().from(tokens).where(eq(tokens.userId, id));
const resetTokens = (id) => db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, id));
/** Moves the audit rows of an action into the past, so the cooldown is over. */
const ageAudit = (id, action) =>
    db
        .update(auditLog)
        .set({ createdAt: new Date(Date.now() - 6 * 60_000) })
        .where(and(eq(auditLog.targetId, id), eq(auditLog.action, action)));

const ACTIONS = [
    ['resend-verification', 'user.resend_verification', 'verifyEmail'],
    ['send-password-reset', 'user.send_password_reset', 'resetPassword'],
];

describe('permissions', () => {
    it('the role map gives users.email to support, admin and owner, not viewer', () => {
        expect(['support', 'admin', 'owner'].map((r) => hasPermission(r, 'users.email'))).toEqual([true, true, true]);
        expect(hasPermission('viewer', 'users.email')).toBe(false);
    });

    it.each(ACTIONS)('%s: viewer gets 403, a learner token gets 401/403, and no email is sent', async (name) => {
        const user = await makeUser();
        expect((await act(user.id, name, await staffToken('viewer'))).status).toBe(403);

        const learner = await makeUser();
        const login = await request(app).post('/api/users/login').send({ email: learner.email, password: 'learner-password-1' });
        expect([401, 403]).toContain((await act(user.id, name, login.body.token)).status);
        expect((await act(user.id, name, 'garbage')).status).toBeGreaterThanOrEqual(401);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it.each(['support', 'admin', 'owner'])('%s may send both emails', async (role) => {
        const token = await staffToken(role);
        for (const [name] of ACTIONS) {
            const user = await makeUser();
            expect([name, (await act(user.id, name, token)).status]).toEqual([name, 200]);
        }
    });
});

describe('who can get an email', () => {
    it('verification: refuses a verified and a deleted account (409)', async () => {
        const token = await staffToken('support');
        const verified = await makeUser({ verified: true });
        const deleted = await makeUser({ deletedAt: new Date() });

        const a = await act(verified.id, 'resend-verification', token);
        expect([a.status, a.body.message]).toEqual([409, 'This account is already verified']);
        const b = await act(deleted.id, 'resend-verification', token);
        expect([b.status, b.body.message]).toEqual([409, 'This account is deleted']);
        expect(sendMail).not.toHaveBeenCalled();
        expect(await auditFor(verified.id, 'user.resend_verification')).toHaveLength(0);
    });

    it('reset: refuses a Google-only (no password) and a deleted account (409); a banned account may get it', async () => {
        const token = await staffToken('support');
        const googleOnly = await makeUser({ password: null });
        const deleted = await makeUser({ deletedAt: new Date() });
        const banned = await makeUser({ bannedAt: new Date() });

        const a = await act(googleOnly.id, 'send-password-reset', token);
        expect([a.status, a.body.message]).toEqual([409, 'This account has no password']);
        expect((await act(deleted.id, 'send-password-reset', token)).status).toBe(409);
        expect((await act(banned.id, 'send-password-reset', token)).status).toBe(200);
        expect(await resetTokens(googleOnly.id)).toHaveLength(0);
        expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it.each(ACTIONS)('%s: an unknown id and a non-UUID give 404', async (name) => {
        const token = await staffToken('support');
        expect((await act('00000000-0000-4000-8000-000000000000', name, token)).status).toBe(404);
        expect((await act('not-a-uuid', name, token)).status).toBe(404);
        expect(sendMail).not.toHaveBeenCalled();
    });
});

describe('verification email', () => {
    it('creates the token row when there is none, and reuses it each time after', async () => {
        const token = await staffToken('support');
        const user = await makeUser();

        await act(user.id, 'resend-verification', token);
        const [first] = await verifyTokens(user.id);
        expect(first).toBeDefined();

        await ageAudit(user.id, 'user.resend_verification');
        await act(user.id, 'resend-verification', token);
        const rows = await verifyTokens(user.id);
        expect(rows).toHaveLength(1);
        expect(rows[0].token).toBe(first.token);

        const urls = sendMail.mock.calls.map(([data]) => data.url);
        expect(urls).toEqual(Array(2).fill(`${process.env.BASE_URL}/user/${user.id}/verify/${first.token}`));
    });

    it('sends once, with the right recipient, type and language (the uiLanguage of the user)', async () => {
        const user = await makeUser();
        await act(user.id, 'resend-verification', await staffToken('support'));

        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(sendMail.mock.calls[0][0]).toMatchObject({
            email: user.email,
            name: user.name,
            type: 'verifyEmail',
            language: 'Spanish',
        });
    });
});

describe('password reset email', () => {
    it('creates a new token row each time and keeps the old ones', async () => {
        const token = await staffToken('support');
        const user = await makeUser();
        const [old] = await db.insert(passwordResetTokens).values({ userId: user.id, token: 'old-token' }).returning();

        await act(user.id, 'send-password-reset', token);
        await ageAudit(user.id, 'user.send_password_reset');
        await act(user.id, 'send-password-reset', token);

        const rows = await resetTokens(user.id);
        expect(rows).toHaveLength(3);
        expect(rows.map((r) => r.id)).toContain(old.id);

        expect(sendMail).toHaveBeenCalledTimes(2);
        const [{ url, type, email, language }] = sendMail.mock.calls.map(([d]) => d);
        expect([type, email, language]).toEqual(['resetPassword', user.email, 'Spanish']);
        expect(url.startsWith(`${process.env.BASE_URL}/resetPassword/${user.id}/`)).toBe(true);
        const sentTokens = sendMail.mock.calls.map(([d]) => d.url.split('/').pop());
        expect(rows.map((r) => r.token)).toEqual(expect.arrayContaining(sentTokens));
    });
});

describe('cooldown', () => {
    it.each(ACTIONS)('%s: a second try gets 429 and sends nothing; after the window it works', async (name, action) => {
        const token = await staffToken('support');
        const user = await makeUser();

        expect((await act(user.id, name, token)).status).toBe(200);
        const second = await act(user.id, name, token);
        expect(second.status).toBe(429);
        expect(second.body.message).toMatch(/Try again in \d+ minutes?/);
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(await auditFor(user.id, action)).toHaveLength(1);

        await ageAudit(user.id, action);
        expect((await act(user.id, name, token)).status).toBe(200);
        expect(sendMail).toHaveBeenCalledTimes(2);
    });

    it('is per user and per email type', async () => {
        const token = await staffToken('support');
        const a = await makeUser();
        const b = await makeUser();
        expect((await act(a.id, 'resend-verification', token)).status).toBe(200);
        expect((await act(a.id, 'send-password-reset', token)).status).toBe(200);
        expect((await act(b.id, 'resend-verification', token)).status).toBe(200);
    });

    it('two parallel clicks send one email', async () => {
        const token = await staffToken('support');
        const user = await makeUser();

        const results = await Promise.all([act(user.id, 'send-password-reset', token), act(user.id, 'send-password-reset', token)]);
        expect(results.map((r) => r.status).sort()).toEqual([200, 429]);
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(await resetTokens(user.id)).toHaveLength(1);
    });
});

describe('transaction', () => {
    it('sends no email, and keeps no token or audit row, when the transaction fails', async () => {
        const token = await staffToken('support');
        const user = await makeUser();
        const original = db.transaction.bind(db);
        const spy = jest.spyOn(db, 'transaction').mockImplementationOnce((callback) =>
            original(async (tx) => {
                await callback(tx); // everything ran, the email is ready ...
                throw new Error('forced failure'); // ... but the commit never happens
            }),
        );

        const res = await act(user.id, 'send-password-reset', token);
        spy.mockRestore();

        expect(res.status).toBe(500);
        expect(sendMail).not.toHaveBeenCalled();
        expect(await resetTokens(user.id)).toHaveLength(0);
        expect(await auditFor(user.id, 'user.send_password_reset')).toHaveLength(0);
    });
});

describe('audit and response', () => {
    it.each(ACTIONS)('%s: writes one row with the email, language and reason, and no token or link anywhere', async (name, action) => {
        const user = await makeUser();
        const res = await act(user.id, name, await staffToken('support'), { reason: 'user wrote to support' });
        expect(res.status).toBe(200);

        const [row] = await auditFor(user.id, action);
        expect(row.reason).toBe('user wrote to support');
        expect(row.metadata).toMatchObject({ email: user.email, language: 'Spanish' });

        const sentToken = sendMail.mock.calls[0][0].url.split('/').pop();
        for (const text of [JSON.stringify(row), JSON.stringify(res.body)]) {
            expect(text).not.toContain(sentToken);
            expect(text).not.toContain('/verify/');
            expect(text).not.toContain('/resetPassword/');
        }
    });
});
