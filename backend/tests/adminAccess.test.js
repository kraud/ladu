// Access gates, PR 1: the owner's admin API (settings and invites). See .context/plans/access-gates.md.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, accessSettings, registrationInvites, auditLog } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');
const sendMail = require('../utils/sendEmail');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
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

const settingsRow = async () => (await db.select().from(accessSettings))[0];
const audits = (action) => db.select().from(auditLog).where(eq(auditLog.action, action));

describe('permission', () => {
    const calls = [
        ['get', '/api/admin/access'],
        ['put', '/api/admin/access/registration'],
        ['post', '/api/admin/access/invites'],
        ['delete', '/api/admin/access/invites/00000000-0000-4000-8000-000000000000'],
        ['post', '/api/admin/access/invites/00000000-0000-4000-8000-000000000000/send'],
    ];

    it('is for the owner only', async () => {
        for (const role of ['admin', 'support', 'viewer']) {
            const token = await staffToken(role);
            for (const [method, url] of calls) {
                expect((await as(token)(method, url).send({})).status).toBe(403);
            }
        }
        expect((await as(await staffToken('owner'))('get', '/api/admin/access')).status).toBe(200);
    });

    it('refuses no token and a learner token', async () => {
        for (const [method, url] of calls) expect((await request(app)[method](url)).status).toBe(401);
        const [learner] = await db.insert(users).values({
            name: 'L', email: 'l@example.com', username: 'l', password: await bcrypt.hash('x-password-1', 4), languages: ['English', 'Spanish'], verified: true,
        }).returning();
        const learnerToken = require('../controllers/userController').generateToken(learner);
        expect((await request(app).get('/api/admin/access').set('Authorization', `Bearer ${learnerToken}`)).status).toBe(401);
    });

    it('changes nothing for a refused role', async () => {
        const token = await staffToken('admin');
        await as(token)('put', '/api/admin/access/registration').send({ mode: 'closed' });
        await as(token)('post', '/api/admin/access/invites').send({ emails: ['a@example.com'] });
        expect((await settingsRow()).registrationMode).toBe('open');
        expect(await db.select().from(registrationInvites)).toHaveLength(0);
    });
});

describe('GET /api/admin/access', () => {
    it('returns the settings, the invites with who added them, and the counts', async () => {
        const token = await staffToken('owner');
        await as(token)('post', '/api/admin/access/invites').send({ emails: ['a@example.com', 'b@example.com'] });
        const res = await as(token)('get', '/api/admin/access');
        expect(res.status).toBe(200);
        expect(res.body.registration).toEqual({ mode: 'open', note: '' });
        expect(res.body.login).toEqual({ mode: 'open', note: '' });
        expect(res.body.counts).toEqual({ invites: 2, loginAllowed: 0 });
        expect(res.body.invites.map((i) => i.email).sort()).toEqual(['a@example.com', 'b@example.com']);
        expect(res.body.invites[0]).toMatchObject({ addedBy: 'owner person' });
        expect(res.body.invites[0].createdAt).toBeTruthy();
    });
});

describe('PUT /api/admin/access/registration', () => {
    const put = (token, body) => as(token)('put', '/api/admin/access/registration').send(body);

    it('changes the mode and the note, and writes an audit row', async () => {
        const token = await staffToken('owner');
        const res = await put(token, { mode: 'closed', note: '  Back at 14:00 UTC  ', reason: 'incident' });
        expect(res.status).toBe(200);
        expect(res.body.registration).toEqual({ mode: 'closed', note: 'Back at 14:00 UTC' });
        expect(res.body.updatedBy).toBe('owner person');

        const rows = await audits('access.registration_mode');
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ targetType: 'access', targetId: 'registration', reason: 'incident' });
        expect(rows[0].metadata).toEqual({ from: 'open', to: 'closed', noteChanged: true });
        // The change is live for the public endpoint at once.
        expect((await request(app).get('/api/access')).body.registration).toEqual({ mode: 'closed', note: 'Back at 14:00 UTC' });
    });

    it('keeps the note when none is sent, and clears it with an empty one', async () => {
        const token = await staffToken('owner');
        await put(token, { mode: 'limited', note: 'Invite only' });
        await put(token, { mode: 'open' });
        expect((await settingsRow()).registrationNote).toBe('Invite only');
        await put(token, { mode: 'open', note: '' });
        expect((await settingsRow()).registrationNote).toBe('');
    });

    it('writes no audit row when nothing changes', async () => {
        const token = await staffToken('owner');
        expect((await put(token, { mode: 'open' })).status).toBe(200);
        expect(await audits('access.registration_mode')).toHaveLength(0);
    });

    it('refuses a bad mode, a long or non-text note, and a long reason, and changes nothing', async () => {
        const token = await staffToken('owner');
        expect((await put(token, { mode: 'maybe' })).status).toBe(400);
        expect((await put(token, {})).status).toBe(400);
        expect((await put(token, { mode: 'closed', note: 'x'.repeat(301) })).status).toBe(400);
        expect((await put(token, { mode: 'closed', note: 5 })).status).toBe(400);
        expect((await put(token, { mode: 'closed', reason: 'x'.repeat(501) })).status).toBe(400);
        expect((await settingsRow()).registrationMode).toBe('open');
        expect(await audits('access.registration_mode')).toHaveLength(0);
    });

    it('stores a note as plain text, never changed into markup', async () => {
        const token = await staffToken('owner');
        await put(token, { mode: 'closed', note: '<b>soon</b> https://x.test' });
        expect((await request(app).get('/api/access')).body.registration.note).toBe('<b>soon</b> https://x.test');
    });
});

describe('POST /api/admin/access/invites', () => {
    const post = (token, body) => as(token)('post', '/api/admin/access/invites').send(body);

    it('adds many, trims and lowercases, and reports what it skipped and why', async () => {
        const token = await staffToken('owner');
        await db.insert(users).values({
            name: 'E', email: 'Exists@Example.com', username: 'exists', password: 'p', languages: ['English', 'Spanish'], verified: true,
        });
        await db.insert(registrationInvites).values({ email: 'listed@example.com' });

        const res = await post(token, {
            emails: ['  New@Example.com ', 'new@example.com', 'listed@example.com', 'exists@example.com', 'not-an-email', '', 'two@example.com'],
        });
        expect(res.status).toBe(201);
        expect(res.body.added.sort()).toEqual(['new@example.com', 'two@example.com']);
        const bySkip = Object.fromEntries(res.body.skipped.map((s) => [s.email, s.reason]));
        expect(bySkip).toEqual({
            'new@example.com': 'duplicate_in_request',
            'listed@example.com': 'already_listed',
            'exists@example.com': 'has_account',
            'not-an-email': 'invalid',
        });
        expect(res.body.counts.invites).toBe(3);

        const rows = await audits('access.invite_add');
        expect(rows).toHaveLength(1);
        expect(rows[0].metadata.count).toBe(2);
        expect(rows[0].metadata.emails.sort()).toEqual(['new@example.com', 'two@example.com']);
    });

    it('records who added each email', async () => {
        const token = await staffToken('owner');
        await post(token, { emails: ['a@example.com'] });
        const [row] = await db.select().from(registrationInvites);
        expect(row.createdByStaffId).toBeTruthy();
    });

    it('answers 200 and writes no audit row when nothing was added', async () => {
        const token = await staffToken('owner');
        const res = await post(token, { emails: ['bad'] });
        expect(res.status).toBe(200);
        expect(res.body.added).toEqual([]);
        expect(await audits('access.invite_add')).toHaveLength(0);
    });

    it('refuses a body that is not a list of text, an empty list, and too many', async () => {
        const token = await staffToken('owner');
        expect((await post(token, {})).status).toBe(400);
        expect((await post(token, { emails: 'a@example.com' })).status).toBe(400);
        expect((await post(token, { emails: [1] })).status).toBe(400);
        expect((await post(token, { emails: [] })).status).toBe(400);
        const many = Array.from({ length: 501 }, (_, i) => `u${i}@example.com`);
        expect((await post(token, { emails: many })).status).toBe(400);
        expect(await db.select().from(registrationInvites)).toHaveLength(0);
    });

    it('lets two owners add the same email at once: it is listed once', async () => {
        const token = await staffToken('owner');
        const results = await Promise.all([post(token, { emails: ['a@example.com'] }), post(token, { emails: ['a@example.com'] })]);
        expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
        expect(await db.select().from(registrationInvites)).toHaveLength(1);
    });

    it('makes a listed email able to register while limited (end to end)', async () => {
        const token = await staffToken('owner');
        await as(token)('put', '/api/admin/access/registration').send({ mode: 'limited' });
        await post(token, { emails: ['Friend@Example.com'] });
        const res = await request(app).post('/api/users').send({
            name: 'F', email: 'friend@example.com', username: 'friend', password: 'a-good-password-1', languages: ['English', 'Spanish'],
        });
        expect(res.status).toBe(201);
        expect((await as(token)('get', '/api/admin/access')).body.counts.invites).toBe(0);
    });
});

describe('POST /api/admin/access/invites/:id/send', () => {
    const addOne = async (token, email = 'friend@example.com') => {
        await as(token)('post', '/api/admin/access/invites').send({ emails: [email] });
        return (await db.select().from(registrationInvites).where(eq(registrationInvites.email, email)))[0];
    };

    beforeEach(() => sendMail.mockClear());

    it('emails the invited address with a link to the registration page, and writes an audit entry', async () => {
        const token = await staffToken('owner');
        const invite = await addOne(token);

        const res = await as(token)('post', `/api/admin/access/invites/${invite.id}/send`).send({ reason: 'opening day' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ sent: true, email: 'friend@example.com' });
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(sendMail).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'friend@example.com',
                type: 'registrationInvite',
                url: expect.stringMatching(/\/register$/),
            }),
        );
        const [entry] = await audits('access.invite_send');
        expect(entry.metadata).toEqual({ email: 'friend@example.com' });
        expect(entry.reason).toBe('opening day');
        // Sending does not use up or change the invite.
        expect(await db.select().from(registrationInvites)).toHaveLength(1);
    });

    it('can send again to the same address', async () => {
        const token = await staffToken('owner');
        const invite = await addOne(token);
        await as(token)('post', `/api/admin/access/invites/${invite.id}/send`);
        await as(token)('post', `/api/admin/access/invites/${invite.id}/send`);
        expect(sendMail).toHaveBeenCalledTimes(2);
        expect(await audits('access.invite_send')).toHaveLength(2);
    });

    it('answers 404 for an unknown or malformed id, and sends nothing', async () => {
        const token = await staffToken('owner');
        expect((await as(token)('post', '/api/admin/access/invites/00000000-0000-4000-8000-000000000000/send')).status).toBe(404);
        expect((await as(token)('post', '/api/admin/access/invites/nope/send')).status).toBe(404);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('answers 409 and sends nothing when the address has an account by now', async () => {
        const token = await staffToken('owner');
        const invite = await addOne(token, 'late@example.com');
        await db.insert(users).values({
            name: 'Late', email: 'Late@Example.com', username: 'late', password: await bcrypt.hash('x-password-1', 4), languages: ['English', 'Spanish'], verified: true,
        });

        const res = await as(token)('post', `/api/admin/access/invites/${invite.id}/send`);

        expect(res.status).toBe(409);
        expect(sendMail).not.toHaveBeenCalled();
        expect(await audits('access.invite_send')).toHaveLength(0);
    });
});

describe('DELETE /api/admin/access/invites/:id', () => {
    it('removes an invite and writes an audit row with the email', async () => {
        const token = await staffToken('owner');
        const [invite] = await db.insert(registrationInvites).values({ email: 'gone@example.com' }).returning();
        const res = await as(token)('delete', `/api/admin/access/invites/${invite.id}`).send({ reason: 'mistake' });
        expect(res.status).toBe(200);
        expect(res.body.counts.invites).toBe(0);
        const rows = await audits('access.invite_remove');
        expect(rows).toHaveLength(1);
        expect(rows[0].metadata).toEqual({ email: 'gone@example.com' });
        expect(rows[0].reason).toBe('mistake');
    });

    it('answers 404 for an unknown id and for a text that is not an id', async () => {
        const token = await staffToken('owner');
        expect((await as(token)('delete', '/api/admin/access/invites/00000000-0000-4000-8000-000000000000')).status).toBe(404);
        expect((await as(token)('delete', '/api/admin/access/invites/nope')).status).toBe(404);
        expect(await audits('access.invite_remove')).toHaveLength(0);
    });
});

describe('staff are never blocked by a gate', () => {
    it('lets staff sign in while registration and login are closed', async () => {
        const owner = await staffToken('owner');
        await db.update(accessSettings).set({ registrationMode: 'closed', loginMode: 'closed' }).where(eq(accessSettings.id, 1));
        const res = await request(app).post('/api/admin/auth/login').send({ email: 'owner@example.com', password: STAFF_PASSWORD });
        expect(res.status).toBe(200);
        expect((await as(owner)('get', '/api/admin/access')).status).toBe(200);
    });
});
