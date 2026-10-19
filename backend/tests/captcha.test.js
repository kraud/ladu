// Captcha, Slice 1: the Turnstile check on `POST /api/demo`, `POST /api/users` and
// `POST /api/users/requestPasswordReset`, and the public site key in `GET /api/access`.
// Cloudflare is mocked at `global.fetch` (supertest uses `http`, so it is not affected).
// See .context/plans/captcha.md.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());
const sendMail = require('../utils/sendEmail');
jest.mock('@sentry/node', () => ({
    ...jest.requireActual('@sentry/node'),
    captureMessage: jest.fn(),
}));
const Sentry = require('@sentry/node');

const request = require('./request');
const { eq, ne } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, demoRefusals } = require('../src/db/schema');
const { seedDemoTemplate, TEMPLATE_USERNAME } = require('../lib/demoTemplate');
const { resetDemoStartLimiter } = require('../lib/demo');

const SITE_KEY = '1x00000000000000000000AA';
const SECRET_KEY = '1x0000000000000000000000000000000AA';
const realFetch = global.fetch;

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    resetDemoStartLimiter();
    await seedDemoTemplate();
    sendMail.mockClear();
    Sentry.captureMessage.mockClear();
    process.env.TURNSTILE_SITE_KEY = SITE_KEY;
    process.env.TURNSTILE_SECRET_KEY = SECRET_KEY;
    await pool.query(`UPDATE access_settings SET demo_enabled = true, captcha_enabled = true WHERE id = 1`);
});
afterEach(() => {
    global.fetch = realFetch;
});
afterAll(async () => {
    delete process.env.TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    await testDb.closeDB();
    await pool.end();
});

/** Makes Cloudflare answer with this body (or fail with this error). Returns the mock to inspect. */
const cloudflare = (answer) => {
    global.fetch = jest.fn(async () => {
        if (answer instanceof Error) throw answer;
        return { ok: answer.status === undefined || answer.status < 400, status: answer.status ?? 200, json: async () => answer.body };
    });
    return global.fetch;
};
const passes = (action) => cloudflare({ body: { success: true, action } });
const refuses = () => cloudflare({ body: { success: false, 'error-codes': ['invalid-input-response'] } });

let ipSeq = 0;
const freshIp = () => `203.0.113.${++ipSeq}`;
const startDemo = (body = {}) => request(app).post('/api/demo').set('X-Forwarded-For', freshIp()).send(body);

const registerBody = (n, extra = {}) => ({
    name: `New ${n}`,
    email: `new${n}@example.com`,
    username: `new${n}`,
    password: 'a-good-password-1',
    languages: ['English', 'Spanish'],
    ...extra,
});
const register = (body) => request(app).post('/api/users').send(body);
const accounts = () => db.select().from(users).where(ne(users.username, TEMPLATE_USERNAME));

describe('the switch and the keys', () => {
    it('does not call Cloudflare while the switch is off', async () => {
        await pool.query(`UPDATE access_settings SET captcha_enabled = false`);
        const fetchMock = passes('demo');
        expect((await startDemo()).status).toBe(201);
        expect((await register(registerBody(1))).status).toBe(201);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not call Cloudflare while a key is missing, and does not lock anyone out', async () => {
        delete process.env.TURNSTILE_SECRET_KEY;
        const fetchMock = passes('demo');
        expect((await startDemo()).status).toBe(201);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('GET /api/access carries the site key only when the switch is on and both keys are set', async () => {
        expect((await request(app).get('/api/access')).body.captcha).toEqual({ enabled: true, siteKey: SITE_KEY });

        delete process.env.TURNSTILE_SECRET_KEY;
        expect((await request(app).get('/api/access')).body.captcha).toEqual({ enabled: false });

        process.env.TURNSTILE_SECRET_KEY = SECRET_KEY;
        await pool.query(`UPDATE access_settings SET captcha_enabled = false`);
        expect((await request(app).get('/api/access')).body.captcha).toEqual({ enabled: false });
    });
});

describe('POST /api/demo', () => {
    it('starts a demo with a good token, and sends the secret, the token and the IP to Cloudflare', async () => {
        const fetchMock = passes('demo');
        const res = await startDemo({ captchaToken: 'good-token' });
        expect(res.status).toBe(201);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
        expect(init.method).toBe('POST');
        expect(init.body.get('secret')).toBe(SECRET_KEY);
        expect(init.body.get('response')).toBe('good-token');
        expect(init.body.get('remoteip')).toMatch(/^203\.0\.113\./);
    });

    it('refuses with 400 captcha_failed and makes no account when Cloudflare says no', async () => {
        refuses();
        const res = await startDemo({ captchaToken: 'bad-token' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('captcha_failed');
        expect(await accounts()).toHaveLength(0);
    });

    it('refuses with no token, without calling Cloudflare', async () => {
        const fetchMock = passes('demo');
        const res = await startDemo();
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('captcha_failed');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses a token that was made for another form (action binding)', async () => {
        passes('register');
        const res = await startDemo({ captchaToken: 'register-token' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('captcha_failed');
    });

    it('refuses with 503 captcha_unavailable when Cloudflare cannot be reached (a timeout, an error, a 5xx)', async () => {
        for (const answer of [new Error('timeout'), { status: 502, body: {} }]) {
            cloudflare(answer);
            const res = await startDemo({ captchaToken: 'any' });
            expect(res.status).toBe(503);
            expect(res.body.code).toBe('captcha_unavailable');
        }
        expect(await accounts()).toHaveLength(0);
    });

    it('checks the captcha BEFORE the IP limit: a refused token does not use one of the starts', async () => {
        process.env.DEMO_STARTS_PER_IP = '1';
        try {
            const ip = freshIp();
            refuses();
            const send = (token) => request(app).post('/api/demo').set('X-Forwarded-For', ip).send({ captchaToken: token });
            expect((await send('bad')).body.code).toBe('captcha_failed');
            expect((await send('bad')).body.code).toBe('captcha_failed');
            passes('demo');
            expect((await send('good')).status).toBe(201);
        } finally {
            delete process.env.DEMO_STARTS_PER_IP;
        }
    });

    it('checks the cheap input first: a bad language choice does not call Cloudflare', async () => {
        const fetchMock = passes('demo');
        const res = await startDemo({ languages: ['English'], captchaToken: 'good-token' });
        expect(res.body.code).toBe('demo_invalid_languages');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('counts a failed check in the refusal statistics (C10)', async () => {
        refuses();
        await startDemo({ captchaToken: 'bad-token' });
        const rows = await db.select().from(demoRefusals).where(eq(demoRefusals.code, 'captcha_failed'));
        expect(rows).toHaveLength(1);
        expect(rows[0].count).toBe(1);
    });
});

describe('POST /api/users', () => {
    it('registers with a good token', async () => {
        passes('register');
        expect((await register(registerBody(1, { captchaToken: 'good-token' }))).status).toBe(201);
        expect(await accounts()).toHaveLength(1);
    });

    it('refuses with 400 captcha_failed and makes no account when the token is bad or missing', async () => {
        refuses();
        const bad = await register(registerBody(1, { captchaToken: 'bad-token' }));
        expect(bad.status).toBe(400);
        expect(bad.body.code).toBe('captcha_failed');

        const missing = await register(registerBody(2));
        expect(missing.status).toBe(400);
        expect(missing.body.code).toBe('captcha_failed');
        expect(await accounts()).toHaveLength(0);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('refuses a token that was made for the demo form', async () => {
        passes('demo');
        const res = await register(registerBody(1, { captchaToken: 'demo-token' }));
        expect(res.body.code).toBe('captcha_failed');
    });

    it('goes on when Cloudflare cannot be reached, and warns Sentry (C6)', async () => {
        cloudflare(new Error('network down'));
        const res = await register(registerBody(1, { captchaToken: 'any' }));
        expect(res.status).toBe(201);
        expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
        expect(Sentry.captureMessage.mock.calls[0][1]).toBe('warning');
    });

    it('keeps the cheap input checks first: a missing field is "Please add all fields", not a captcha error', async () => {
        const fetchMock = passes('register');
        const res = await register({ ...registerBody(1), password: '', captchaToken: 'good-token' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Please add all fields');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('POST /api/users/requestPasswordReset', () => {
    beforeEach(async () => {
        await pool.query(`UPDATE access_settings SET captcha_enabled = false`);
        await register(registerBody(1));
        sendMail.mockClear();
        await pool.query(`UPDATE access_settings SET captcha_enabled = true`);
    });
    const reset = (body) => request(app).post('/api/users/requestPasswordReset').send({ email: 'new1@example.com', ...body });

    it('sends the email with a good token', async () => {
        passes('password_reset');
        expect((await reset({ captchaToken: 'good-token' })).status).toBe(200);
        expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it('refuses with 400 captcha_failed and sends nothing when the token is bad or missing', async () => {
        refuses();
        const bad = await reset({ captchaToken: 'bad-token' });
        expect(bad.status).toBe(400);
        expect(bad.body.code).toBe('captcha_failed');
        expect((await reset({})).body.code).toBe('captcha_failed');
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('answers the same for an email with no account (the captcha does not reveal accounts)', async () => {
        refuses();
        const res = await reset({ email: 'nobody@example.com', captchaToken: 'bad-token' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('captcha_failed');
    });

    it('goes on when Cloudflare cannot be reached (C6)', async () => {
        cloudflare(new Error('network down'));
        expect((await reset({ captchaToken: 'any' })).status).toBe(200);
        expect(sendMail).toHaveBeenCalledTimes(1);
    });
});
