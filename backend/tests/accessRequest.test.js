// Access requests, Slice 1: the public `POST /api/access/request`. See .context/plans/access-requests.md.
// Cloudflare is mocked at `global.fetch` (supertest uses `http`, so it is not affected).
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());
const sendMail = require('../utils/sendEmail');
jest.mock('@sentry/node', () => ({
    ...jest.requireActual('@sentry/node'),
    captureMessage: jest.fn(),
}));
const Sentry = require('@sentry/node');

const request = require('./request');
const bcrypt = require('bcryptjs');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, accessRequests, registrationInvites, loginAllowedUsers, auditLog } = require('../src/db/schema');
const { MAX_PENDING_REQUESTS } = require('../lib/accessRequests');

const realFetch = global.fetch;

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    sendMail.mockClear();
    Sentry.captureMessage.mockClear();
    process.env.ACCESS_REQUEST_EMAIL = 'team@example.com';
    await pool.query(`UPDATE access_settings SET registration_mode = 'limited', login_mode = 'limited' WHERE id = 1`);
});
afterEach(() => {
    global.fetch = realFetch;
});
afterAll(async () => {
    delete process.env.ACCESS_REQUEST_EMAIL;
    delete process.env.TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    await testDb.closeDB();
    await pool.end();
});

const ask = (body) => request(app).post('/api/access/request').send(body);
const rows = () => db.select().from(accessRequests);
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

describe('a valid request', () => {
    it('saves a registration request, writes an audit row and mails the team once', async () => {
        const res = await ask({ email: ' New@Example.com ', hasAccount: false });

        expect(res.status).toBe(202);
        expect(res.body).toEqual({ received: true });
        const [row] = await rows();
        expect(row).toMatchObject({ email: 'new@example.com', kind: 'registration' });
        const [entry] = await audits('access.request_create');
        expect(entry.staffId).toBeNull();
        expect(entry.metadata).toEqual({ email: 'new@example.com', kind: 'registration' });
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(sendMail).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'team@example.com', requestEmail: 'new@example.com', kind: 'registration', type: 'accessRequest' }),
        );
    });

    it('saves a login request for an account that exists', async () => {
        await makeUser('member@example.com');
        expect((await ask({ email: 'MEMBER@example.com', hasAccount: true })).status).toBe(202);
        expect((await rows())[0]).toMatchObject({ email: 'member@example.com', kind: 'login' });
        expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ kind: 'login' }));
    });

    it('works while the gate is closed', async () => {
        await pool.query(`UPDATE access_settings SET registration_mode = 'closed'`);
        expect((await ask({ email: 'new@example.com', hasAccount: false })).status).toBe(202);
        expect(await rows()).toHaveLength(1);
    });

    it('does not mail a second time for a repeat request, and answers the same', async () => {
        await ask({ email: 'new@example.com', hasAccount: false });
        const again = await ask({ email: 'NEW@example.com', hasAccount: false });
        expect(again.status).toBe(202);
        expect(again.body).toEqual({ received: true });
        expect(await rows()).toHaveLength(1);
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(await audits('access.request_create')).toHaveLength(1);
    });

    it('keeps one row for each kind of the same email', async () => {
        await makeUser('both@example.com');
        // A registration request for an email with an account is useless, so use another email for it.
        await ask({ email: 'both@example.com', hasAccount: true });
        await ask({ email: 'other@example.com', hasAccount: false });
        expect((await rows()).map((r) => r.kind).sort()).toEqual(['login', 'registration']);
    });

    it('saves the row and does not fail when no team address is set', async () => {
        delete process.env.ACCESS_REQUEST_EMAIL;
        const res = await ask({ email: 'new@example.com', hasAccount: false });
        expect(res.status).toBe(202);
        expect(await rows()).toHaveLength(1);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('answers 202 when the mail fails', async () => {
        sendMail.mockRejectedValueOnce(new Error('smtp down'));
        const res = await ask({ email: 'new@example.com', hasAccount: false });
        expect(res.status).toBe(202);
        expect(await rows()).toHaveLength(1);
    });
});

describe('the answer never tells what exists (same 202, no row, no mail)', () => {
    const expectSilent = async (body) => {
        const res = await ask(body);
        expect(res.status).toBe(202);
        expect(res.body).toEqual({ received: true });
        expect(await rows()).toHaveLength(0);
        expect(sendMail).not.toHaveBeenCalled();
    };

    it('registration kind: the email already has an account', async () => {
        await makeUser('member@example.com');
        await expectSilent({ email: 'member@example.com', hasAccount: false });
    });

    it('registration kind: the email is already on the invite list', async () => {
        await db.insert(registrationInvites).values({ email: 'listed@example.com' });
        await expectSilent({ email: 'Listed@example.com', hasAccount: false });
    });

    it('login kind: no account has this email', async () => {
        await expectSilent({ email: 'nobody@example.com', hasAccount: true });
    });

    it('login kind: the account is deleted or banned', async () => {
        await makeUser('gone@example.com', { deletedAt: new Date() });
        await makeUser('banned@example.com', { bannedAt: new Date() });
        await expectSilent({ email: 'gone@example.com', hasAccount: true });
        await expectSilent({ email: 'banned@example.com', hasAccount: true });
    });

    it('login kind: the account is already allowed', async () => {
        const user = await makeUser('member@example.com');
        await db.insert(loginAllowedUsers).values({ userId: user.id });
        await expectSilent({ email: 'member@example.com', hasAccount: true });
    });
});

describe('the gate', () => {
    it('answers 409 access_not_needed when registration is open', async () => {
        await pool.query(`UPDATE access_settings SET registration_mode = 'open'`);
        const res = await ask({ email: 'new@example.com', hasAccount: false });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('access_not_needed');
        expect(await rows()).toHaveLength(0);
    });

    it('checks the gate of the kind: login open, registration limited', async () => {
        await pool.query(`UPDATE access_settings SET login_mode = 'open'`);
        await makeUser('member@example.com');
        expect((await ask({ email: 'member@example.com', hasAccount: true })).status).toBe(409);
        expect((await ask({ email: 'new@example.com', hasAccount: false })).status).toBe(202);
    });
});

describe('input', () => {
    it.each([
        [{ hasAccount: false }],
        [{ email: 'not-an-email', hasAccount: false }],
        [{ email: 'a@b', hasAccount: false }],
        [{ email: 42, hasAccount: false }],
        [{ email: `${'a'.repeat(250)}@example.com`, hasAccount: false }],
        [{ email: 'new@example.com' }],
        [{ email: 'new@example.com', hasAccount: 'yes' }],
    ])('answers 400 for %j', async (body) => {
        const res = await ask(body);
        expect(res.status).toBe(400);
        expect(await rows()).toHaveLength(0);
        expect(sendMail).not.toHaveBeenCalled();
    });
});

describe('the cap', () => {
    it('saves nothing past the cap, warns Sentry, and answers the same', async () => {
        await db
            .insert(accessRequests)
            .values(Array.from({ length: MAX_PENDING_REQUESTS }, (_, i) => ({ email: `p${i}@example.com`, kind: 'registration' })));
        const res = await ask({ email: 'late@example.com', hasAccount: false });
        expect(res.status).toBe(202);
        expect(await rows()).toHaveLength(MAX_PENDING_REQUESTS);
        expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
        expect(sendMail).not.toHaveBeenCalled();
    });
});

describe('the captcha', () => {
    const cloudflare = (answer) => {
        global.fetch = jest.fn(async () => {
            if (answer instanceof Error) throw answer;
            return { ok: true, status: 200, json: async () => answer };
        });
        return global.fetch;
    };

    beforeEach(async () => {
        process.env.TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
        process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
        await pool.query(`UPDATE access_settings SET captcha_enabled = true`);
    });

    it('saves the request with a good token for the action access_request', async () => {
        const fetchMock = cloudflare({ success: true, action: 'access_request' });
        const res = await ask({ email: 'new@example.com', hasAccount: false, captchaToken: 'tok' });
        expect(res.status).toBe(202);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(await rows()).toHaveLength(1);
    });

    it('answers 400 captcha_failed with no token or a bad token', async () => {
        cloudflare({ success: false });
        const noToken = await ask({ email: 'new@example.com', hasAccount: false });
        const bad = await ask({ email: 'new@example.com', hasAccount: false, captchaToken: 'bad' });
        for (const res of [noToken, bad]) {
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('captcha_failed');
        }
        expect(await rows()).toHaveLength(0);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('refuses a token made for another form', async () => {
        cloudflare({ success: true, action: 'register' });
        const res = await ask({ email: 'new@example.com', hasAccount: false, captchaToken: 'tok' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('captcha_failed');
    });

    it('refuses with 503 when Cloudflare cannot be reached', async () => {
        cloudflare(new Error('network down'));
        const res = await ask({ email: 'new@example.com', hasAccount: false, captchaToken: 'tok' });
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('captcha_unavailable');
        expect(await rows()).toHaveLength(0);
    });

    it('does not call Cloudflare while the switch is off', async () => {
        await pool.query(`UPDATE access_settings SET captcha_enabled = false`);
        const fetchMock = cloudflare({ success: false });
        expect((await ask({ email: 'new@example.com', hasAccount: false })).status).toBe(202);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('the team email', () => {
    const accessRequest = require('../utils/resources/accessRequest');

    it('escapes the address that the visitor typed', () => {
        const html = accessRequest.getHtmlComponent({ requestEmail: '<img src=x onerror=alert(1)>@example.com', kind: 'registration' });
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img');
    });

    it('says which tab to open for each kind', () => {
        expect(accessRequest.getTextComponent({ requestEmail: 'a@b.co', kind: 'login' })).toContain('Login tab');
        expect(accessRequest.getTextComponent({ requestEmail: 'a@b.co', kind: 'registration' })).toContain('Registration tab');
    });
});
