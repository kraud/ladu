// Access requests, Slice 1: the owner's admin API (list, approve, remove, send the login-allowed
// email) and the clean-up when someone gets access by another path. See .context/plans/access-requests.md.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('./request');
const bcrypt = require('bcryptjs');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, accessRequests, registrationInvites, loginAllowedUsers, auditLog } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');
const sendMail = require('../utils/sendEmail');

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
const as = (token) => (method, url) => request(app)[method](url).set('Authorization', `Bearer ${token}`);
const audits = (action) => db.select().from(auditLog).where(eq(auditLog.action, action));
const makeUser = async (email, extra = {}) =>
    (
        await db
            .insert(users)
            .values({
                name: 'Person', email, username: email.split('@')[0], password: await bcrypt.hash('x-password-1', 4),
                languages: ['English', 'Spanish'], verified: true, ...extra,
            })
            .returning()
    )[0];
const addRequest = async (email, kind) => (await db.insert(accessRequests).values({ email, kind }).returning())[0];
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('permission', () => {
    const calls = [
        ['post', `/api/admin/access/requests/${UNKNOWN_ID}/approve`],
        ['delete', `/api/admin/access/requests/${UNKNOWN_ID}`],
        ['post', `/api/admin/access/login-allowed/${UNKNOWN_ID}/send`],
    ];

    it('is for the owner only, and changes nothing for a refused role', async () => {
        const row = await addRequest('new@example.com', 'registration');
        for (const role of ['admin', 'support', 'viewer']) {
            const token = await staffToken(role);
            for (const [method, url] of calls) expect((await as(token)(method, url).send({})).status).toBe(403);
            expect((await as(token)('post', `/api/admin/access/requests/${row.id}/approve`).send({})).status).toBe(403);
        }
        expect(await db.select().from(accessRequests)).toHaveLength(1);
        expect(await db.select().from(registrationInvites)).toHaveLength(0);
    });

    it('refuses no token', async () => {
        for (const [method, url] of calls) expect((await request(app)[method](url)).status).toBe(401);
    });
});

describe('GET /api/admin/access', () => {
    it('lists the requests by kind, with the account for a login request, and counts them', async () => {
        const token = await staffToken('owner');
        const user = await makeUser('member@example.com', { name: 'Mia' });
        await addRequest('new@example.com', 'registration');
        await addRequest('member@example.com', 'login');
        await addRequest('ghost@example.com', 'login');

        const { body } = await as(token)('get', '/api/admin/access');

        expect(body.requests.registration).toEqual([expect.objectContaining({ email: 'new@example.com' })]);
        expect(body.requests.registration[0]).not.toHaveProperty('account');
        const byEmail = Object.fromEntries(body.requests.login.map((r) => [r.email, r]));
        expect(byEmail['member@example.com'].account).toEqual({ userId: user.id, name: 'Mia', status: 'active' });
        expect(byEmail['ghost@example.com'].account).toBeNull();
        expect(body.counts).toMatchObject({ requestsRegistration: 1, requestsLogin: 2 });
    });

    it('shows a banned or deleted account as such', async () => {
        const token = await staffToken('owner');
        await makeUser('banned@example.com', { bannedAt: new Date() });
        await makeUser('gone@example.com', { deletedAt: new Date() });
        await addRequest('banned@example.com', 'login');
        await addRequest('gone@example.com', 'login');
        const { body } = await as(token)('get', '/api/admin/access');
        const status = Object.fromEntries(body.requests.login.map((r) => [r.email, r.account.status]));
        expect(status).toEqual({ 'banned@example.com': 'banned', 'gone@example.com': 'deleted' });
    });
});

describe('POST /api/admin/access/requests/:id/approve', () => {
    it('registration: adds the invite, removes the request, sends no email, writes an audit row', async () => {
        const token = await staffToken('owner');
        const row = await addRequest('new@example.com', 'registration');

        const res = await as(token)('post', `/api/admin/access/requests/${row.id}/approve`).send({ reason: 'friend of a friend' });

        expect(res.status).toBe(200);
        expect(res.body.requests.registration).toHaveLength(0);
        expect(res.body.invites.map((i) => i.email)).toEqual(['new@example.com']);
        expect(await db.select().from(accessRequests)).toHaveLength(0);
        expect(sendMail).not.toHaveBeenCalled();
        const [entry] = await audits('access.request_approve');
        expect(entry.metadata).toEqual({ email: 'new@example.com', kind: 'registration' });
        expect(entry.reason).toBe('friend of a friend');
        expect(entry.targetId).toBe(row.id);
    });

    it('registration: a person who now has an account is 409, and the request stays', async () => {
        const token = await staffToken('owner');
        const row = await addRequest('late@example.com', 'registration');
        await makeUser('late@example.com');
        const res = await as(token)('post', `/api/admin/access/requests/${row.id}/approve`).send({});
        expect(res.status).toBe(409);
        expect(await db.select().from(accessRequests)).toHaveLength(1);
        expect(await db.select().from(registrationInvites)).toHaveLength(0);
    });

    it('registration: an email that is already invited still clears the request', async () => {
        const token = await staffToken('owner');
        await db.insert(registrationInvites).values({ email: 'new@example.com' });
        const row = await addRequest('new@example.com', 'registration');
        expect((await as(token)('post', `/api/admin/access/requests/${row.id}/approve`).send({})).status).toBe(200);
        expect(await db.select().from(registrationInvites)).toHaveLength(1);
        expect(await db.select().from(accessRequests)).toHaveLength(0);
    });

    it('login: allows the account, removes the request, sends no email, and writes both audit rows', async () => {
        const token = await staffToken('owner');
        const user = await makeUser('member@example.com');
        const row = await addRequest('member@example.com', 'login');

        const res = await as(token)('post', `/api/admin/access/requests/${row.id}/approve`).send({});

        expect(res.status).toBe(200);
        expect((await db.select().from(loginAllowedUsers)).map((r) => r.userId)).toEqual([user.id]);
        expect(await db.select().from(accessRequests)).toHaveLength(0);
        expect(sendMail).not.toHaveBeenCalled();
        expect((await audits('access.request_approve'))[0].metadata).toEqual({ email: 'member@example.com', kind: 'login' });
        const [allow] = await audits('access.login_allow');
        expect(allow).toMatchObject({ targetType: 'user', targetId: user.id });
    });

    it('login: no account or a deleted account is 409, and the request stays', async () => {
        const token = await staffToken('owner');
        await makeUser('gone@example.com', { deletedAt: new Date() });
        const none = await addRequest('ghost@example.com', 'login');
        const deleted = await addRequest('gone@example.com', 'login');
        for (const row of [none, deleted]) {
            expect((await as(token)('post', `/api/admin/access/requests/${row.id}/approve`).send({})).status).toBe(409);
        }
        expect(await db.select().from(accessRequests)).toHaveLength(2);
        expect(await db.select().from(loginAllowedUsers)).toHaveLength(0);
    });

    it('works while the gate is closed', async () => {
        await pool.query(`UPDATE access_settings SET registration_mode = 'closed'`);
        const token = await staffToken('owner');
        const row = await addRequest('new@example.com', 'registration');
        expect((await as(token)('post', `/api/admin/access/requests/${row.id}/approve`).send({})).status).toBe(200);
        expect(await db.select().from(registrationInvites)).toHaveLength(1);
    });

    it('answers 404 for an unknown or malformed id', async () => {
        const token = await staffToken('owner');
        expect((await as(token)('post', `/api/admin/access/requests/${UNKNOWN_ID}/approve`).send({})).status).toBe(404);
        expect((await as(token)('post', '/api/admin/access/requests/nope/approve').send({})).status).toBe(404);
        expect(await audits('access.request_approve')).toHaveLength(0);
    });

    it('refuses a too-long reason before any write', async () => {
        const token = await staffToken('owner');
        const row = await addRequest('new@example.com', 'registration');
        // A reason that is too long is refused before any write.
        const res = await as(token)('post', `/api/admin/access/requests/${row.id}/approve`).send({ reason: 'x'.repeat(501) });
        expect(res.status).toBe(400);
        expect(await db.select().from(accessRequests)).toHaveLength(1);
        expect(await db.select().from(registrationInvites)).toHaveLength(0);
    });
});

describe('DELETE /api/admin/access/requests/:id', () => {
    it('removes the request with an audit row, and adds nothing to a list', async () => {
        const token = await staffToken('owner');
        const row = await addRequest('new@example.com', 'registration');

        const res = await as(token)('delete', `/api/admin/access/requests/${row.id}`).send({ reason: 'spam' });

        expect(res.status).toBe(200);
        expect(await db.select().from(accessRequests)).toHaveLength(0);
        expect(await db.select().from(registrationInvites)).toHaveLength(0);
        const [entry] = await audits('access.request_remove');
        expect(entry.metadata).toEqual({ email: 'new@example.com', kind: 'registration' });
        expect(entry.reason).toBe('spam');
    });

    it('answers 404 for an unknown id, and writes nothing', async () => {
        const token = await staffToken('owner');
        expect((await as(token)('delete', `/api/admin/access/requests/${UNKNOWN_ID}`).send({})).status).toBe(404);
        expect(await audits('access.request_remove')).toHaveLength(0);
    });
});

describe('POST /api/admin/access/login-allowed/:userId/send', () => {
    it('emails the account in its language, writes an audit row, and can send again', async () => {
        const token = await staffToken('owner');
        const user = await makeUser('member@example.com', { name: 'Mia', uiLanguage: 'Spanish' });
        await db.insert(loginAllowedUsers).values({ userId: user.id });

        const res = await as(token)('post', `/api/admin/access/login-allowed/${user.id}/send`).send({ reason: 'opening day' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ sent: true, email: 'member@example.com' });
        expect(sendMail).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'member@example.com', name: 'Mia', type: 'loginAllowed', language: 'Spanish', url: expect.stringMatching(/\/login$/),
            }),
        );
        const [entry] = await audits('access.login_allowed_send');
        expect(entry).toMatchObject({ targetType: 'user', targetId: user.id, reason: 'opening day' });
        expect(entry.metadata).toEqual({ email: 'member@example.com' });
        expect(await db.select().from(loginAllowedUsers)).toHaveLength(1);

        await as(token)('post', `/api/admin/access/login-allowed/${user.id}/send`).send({});
        expect(sendMail).toHaveBeenCalledTimes(2);
    });

    it('uses English when the account has no saved language', async () => {
        const token = await staffToken('owner');
        const user = await makeUser('member@example.com', { uiLanguage: null });
        await db.insert(loginAllowedUsers).values({ userId: user.id });
        await as(token)('post', `/api/admin/access/login-allowed/${user.id}/send`).send({});
        expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ language: 'English' }));
    });

    it('answers 404 and sends nothing for an account that is not on the list, is banned, or is deleted', async () => {
        const token = await staffToken('owner');
        const notListed = await makeUser('a@example.com');
        const banned = await makeUser('b@example.com', { bannedAt: new Date() });
        const deleted = await makeUser('c@example.com', { deletedAt: new Date() });
        await db.insert(loginAllowedUsers).values([{ userId: banned.id }, { userId: deleted.id }]);
        for (const id of [notListed.id, banned.id, deleted.id, UNKNOWN_ID, 'nope']) {
            expect((await as(token)('post', `/api/admin/access/login-allowed/${id}/send`).send({})).status).toBe(404);
        }
        expect(sendMail).not.toHaveBeenCalled();
        expect(await audits('access.login_allowed_send')).toHaveLength(0);
    });
});

describe('the clean-up: a request goes when the person gets access another way', () => {
    it('a sign-up with the email removes the registration request', async () => {
        await pool.query(`UPDATE access_settings SET registration_mode = 'limited'`);
        await db.insert(registrationInvites).values({ email: 'friend@example.com' });
        await addRequest('friend@example.com', 'registration');
        await addRequest('other@example.com', 'registration');

        const res = await request(app).post('/api/users').send({
            name: 'F', email: 'Friend@example.com', username: 'friend', password: 'a-good-password-1', languages: ['English', 'Spanish'],
        });

        expect(res.status).toBe(201);
        expect((await db.select().from(accessRequests)).map((r) => r.email)).toEqual(['other@example.com']);
    });

    it('a sign-up that is refused keeps the request', async () => {
        await pool.query(`UPDATE access_settings SET registration_mode = 'limited'`);
        await addRequest('friend@example.com', 'registration');
        const res = await request(app).post('/api/users').send({
            name: 'F', email: 'friend@example.com', username: 'friend', password: 'a-good-password-1', languages: ['English', 'Spanish'],
        });
        expect(res.status).toBe(403);
        expect(await db.select().from(accessRequests)).toHaveLength(1);
    });

    it('allowing the account directly removes the login request, and only that kind', async () => {
        const token = await staffToken('owner');
        await makeUser('member@example.com');
        await addRequest('member@example.com', 'login');
        await addRequest('member@example.com', 'registration');

        const res = await as(token)('post', '/api/admin/access/login-allowed').send({ emails: ['member@example.com'] });

        expect(res.status).toBe(201);
        const left = await db.select().from(accessRequests);
        expect(left.map((r) => r.kind)).toEqual(['registration']);
    });
});
