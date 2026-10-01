// Access gates, PR 1: the registration gate. See .context/plans/access-gates.md.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());
const sendMail = require('../utils/sendEmail');
// Wraps the real function, so one test can make the token insert fail inside the transaction.
jest.mock('../lib/accountEmails', () => {
    const actual = jest.requireActual('../lib/accountEmails');
    return { ...actual, issueVerificationEmail: jest.fn(actual.issueVerificationEmail) };
});
const { issueVerificationEmail } = require('../lib/accountEmails');

const request = require('supertest');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, tokens, accessSettings, registrationInvites, auditLog, oauthIdentities } = require('../src/db/schema');
const { issueTicket } = require('../lib/oauth/ticket');

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    sendMail.mockClear();
});
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const setMode = (registrationMode, registrationNote = '') =>
    db.update(accessSettings).set({ registrationMode, registrationNote }).where(eq(accessSettings.id, 1));
const invite = (email) => db.insert(registrationInvites).values({ email });
const inviteEmails = async () => (await db.select().from(registrationInvites)).map((r) => r.email);
const userCount = async () => (await db.select().from(users)).length;

const body = (n, email = `new${n}@example.com`) => ({
    name: `New ${n}`,
    email,
    username: `new${n}`,
    password: 'a-good-password-1',
    languages: ['English', 'Spanish'],
});
const register = (b) => request(app).post('/api/users').send(b);

const googleTicket = (email, sub = 'google-sub-1') =>
    issueTicket({ typ: 'oauth_signup', provider: 'google', sub, email, name: 'Gee Oogle' });
const googleSignup = (email, username = 'googler', sub) =>
    request(app)
        .post('/api/auth/signup/complete')
        .send({ ticket: googleTicket(email, sub), username, languages: ['English', 'Spanish'] });

describe('the settings row', () => {
    it('starts open, with empty notes', async () => {
        const [row] = await db.select().from(accessSettings);
        expect(row).toMatchObject({ id: 1, registrationMode: 'open', registrationNote: '', loginMode: 'open', loginNote: '' });
    });

    it('allows one row, and only the three modes', async () => {
        await expect(pool.query(`INSERT INTO access_settings (id) VALUES (2)`)).rejects.toThrow();
        await expect(pool.query(`UPDATE access_settings SET registration_mode = 'maybe'`)).rejects.toThrow();
        await expect(pool.query(`UPDATE access_settings SET login_note = repeat('x', 301)`)).rejects.toThrow();
    });
});

describe('GET /api/access', () => {
    it('is public, never cached, and shows only the modes and notes', async () => {
        await setMode('limited', 'Back at 14:00 UTC');
        await invite('secret@example.com');

        const res = await request(app).get('/api/access');
        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({
            registration: { mode: 'limited', note: 'Back at 14:00 UTC' },
            login: { mode: 'open', note: '' },
        });
        expect(JSON.stringify(res.body)).not.toContain('secret@example.com');
    });

    it('shows a change at once', async () => {
        expect((await request(app).get('/api/access')).body.registration.mode).toBe('open');
        await setMode('closed');
        expect((await request(app).get('/api/access')).body.registration.mode).toBe('closed');
    });
});

describe('registration: open', () => {
    it('lets anybody register, as before', async () => {
        const res = await register(body(1));
        expect(res.status).toBe(201);
        expect(await userCount()).toBe(1);
        expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it('keeps leftover invites for other emails, and takes the one that matches', async () => {
        await invite('other@example.com');
        await invite('new1@example.com');
        expect((await register(body(1))).status).toBe(201);
        expect(await inviteEmails()).toEqual(['other@example.com']);
        const audit = await db.select().from(auditLog).where(eq(auditLog.action, 'access.invite_used'));
        expect(audit).toHaveLength(1);
        expect(audit[0].staffId).toBeNull();
        expect(audit[0].metadata).toEqual({ email: 'new1@example.com' });
    });
});

describe('registration: closed', () => {
    beforeEach(() => setMode('closed'));

    it('refuses everybody with a code, and creates nothing', async () => {
        const res = await register(body(1));
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('registration_closed');
        expect(await userCount()).toBe(0);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('refuses an invited email too', async () => {
        await invite('new1@example.com');
        const res = await register(body(1));
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('registration_closed');
        expect(await inviteEmails()).toEqual(['new1@example.com']);
    });

    it('does not reveal which emails exist: an existing email gets the same answer', async () => {
        await setMode('open');
        await register(body(1));
        await setMode('closed');
        const existing = await register(body(2, 'new1@example.com'));
        const fresh = await register(body(3));
        expect(existing.status).toBe(403);
        expect(existing.body).toEqual(fresh.body);
    });

    it('refuses a Google sign-up', async () => {
        const res = await googleSignup('g@example.com');
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('registration_closed');
        expect(await userCount()).toBe(0);
    });
});

describe('registration: limited', () => {
    beforeEach(() => setMode('limited'));

    it('lets a listed email register, and removes it from the list', async () => {
        await invite('new1@example.com');
        const res = await register(body(1));
        expect(res.status).toBe(201);
        expect(await inviteEmails()).toEqual([]);
        expect(sendMail).toHaveBeenCalledTimes(1);
        const audit = await db.select().from(auditLog).where(eq(auditLog.action, 'access.invite_used'));
        expect(audit).toHaveLength(1);
    });

    it('matches the email without regard to case', async () => {
        await invite('new1@example.com');
        const res = await register(body(1, 'New1@Example.COM'));
        expect(res.status).toBe(201);
        expect(await inviteEmails()).toEqual([]);
    });

    it('refuses an unlisted email with a code, and creates nothing', async () => {
        await invite('someone@example.com');
        const res = await register(body(1));
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('registration_not_invited');
        expect(await userCount()).toBe(0);
        expect(sendMail).not.toHaveBeenCalled();
        expect(await inviteEmails()).toEqual(['someone@example.com']);
    });

    it('does not reveal which emails are on the list or have an account', async () => {
        // An account that exists, an email that is listed, and one that is neither.
        await setMode('open');
        await register(body(1));
        await setMode('limited');
        const existing = await register(body(2, 'new1@example.com'));
        const unlisted = await register(body(3));
        expect(existing.status).toBe(403);
        expect(existing.body).toEqual(unlisted.body);
    });

    it('lets exactly one of two parallel sign-ups with one invite win', async () => {
        await invite('new1@example.com');
        // Emails that differ only in case both pass the first check and both insert a user
        // (the users table is case-sensitive); only the invite delete can tell them apart.
        const results = await Promise.all([
            register(body(1, 'new1@example.com')),
            register(body(2, 'NEW1@example.com')),
        ]);
        // The loser is 403 when it reaches the invite delete after the winner took the invite,
        // or 400 ("Email already in use") when the winner had already committed. Never a second account.
        const statuses = results.map((r) => r.status).sort();
        expect(statuses[0]).toBe(201);
        expect([400, 403]).toContain(statuses[1]);
        expect(await userCount()).toBe(1);
        expect(await inviteEmails()).toEqual([]);
    });

    it('never makes two accounts from two parallel sign-ups with the exact same email', async () => {
        await invite('new1@example.com');
        const results = await Promise.all([register(body(1)), register(body(2, 'new1@example.com'))]);
        expect(results.filter((r) => r.status === 201)).toHaveLength(1);
        expect(await userCount()).toBe(1);
    });

    it('keeps the invite when the registration rolls back', async () => {
        await invite('new1@example.com');
        // The verification token step fails inside the transaction, after the invite was taken.
        issueVerificationEmail.mockRejectedValueOnce(new Error('boom'));
        const res = await register(body(1));
        expect(res.status).toBe(500);
        expect(await userCount()).toBe(0);
        expect(await inviteEmails()).toEqual(['new1@example.com']);
        expect(await db.select().from(tokens)).toHaveLength(0);
        expect(await db.select().from(auditLog).where(eq(auditLog.action, 'access.invite_used'))).toHaveLength(0);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('takes effect on the next request', async () => {
        await invite('new1@example.com');
        await setMode('open');
        expect((await register(body(2))).status).toBe(201);
        await setMode('limited');
        expect((await register(body(3))).status).toBe(403);
    });

    it('gates the Google sign-up with the email Google confirmed', async () => {
        const refused = await googleSignup('g@example.com');
        expect(refused.status).toBe(403);
        expect(refused.body.code).toBe('registration_not_invited');
        expect(await userCount()).toBe(0);

        await invite('g@example.com');
        const ok = await googleSignup('G@Example.com');
        expect(ok.status).toBe(201);
        expect(await inviteEmails()).toEqual([]);
        expect(await db.select().from(oauthIdentities)).toHaveLength(1);
    });

    it('keeps the invite when the Google sign-up is refused for another reason', async () => {
        await invite('g@example.com');
        await db.insert(users).values({
            name: 'y', email: 'y@example.com', username: 'googler', password: 'p', languages: ['English', 'Spanish'], verified: true,
        });
        const res = await googleSignup('g@example.com', 'googler');
        expect(res.status).toBe(400);
        expect(await inviteEmails()).toEqual(['g@example.com']);
    });
});
