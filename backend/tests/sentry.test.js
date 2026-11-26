/**
 * What reaches Sentry (lib/sentry.ts): crashes only, and never what the person sent.
 * The real SDK with the real options, and a transport that keeps the reports in memory.
 */

// The SDK must start before the app loads, as in api/index.js, so keep this order.
const Sentry = require('@sentry/node');
const { sentryOptions } = require('../lib/sentry');

const sent = [];
Sentry.init({
    dsn: 'http://key@127.0.0.1:9/1',
    ...sentryOptions,
    transport: () => ({
        send: async (envelope) => {
            sent.push(envelope);
            return {};
        },
        flush: async () => true,
    }),
});

const request = require('./request');
const app = require('../app');
const testDb = require('./db');
const { pool } = require('../src/db');

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    sent.length = 0;
});
afterAll(async () => {
    await Sentry.close();
    await testDb.closeDB();
    await pool.end();
});

/** A login with a password, a token and a cookie that must stay on the server. */
const login = (email) =>
    request(app)
        .post('/api/users/login')
        .set('Authorization', 'Bearer SECRET-TOKEN')
        .set('Cookie', 'session=SECRET-COOKIE')
        .send({ email, password: 'SECRET-PASSWORD' });

const errorReports = async () => {
    await Sentry.flush(2000);
    return sent.flatMap(([, items]) => items.filter(([header]) => header.type === 'event').map(([, event]) => event));
};

describe('error reports to Sentry', () => {
    it('does not report a refusal (4xx)', async () => {
        const res = await login('nobody@example.com');

        expect(res.status).toBe(400);
        expect(await errorReports()).toHaveLength(0);
    });

    it('reports a crash (500) without the body, the cookies or the login token', async () => {
        // Postgres refuses a NUL character, so the query fails: an unexpected error.
        const res = await login('nobody\u0000@example.com');

        expect(res.status).toBe(500);
        const reports = await errorReports();
        expect(reports).toHaveLength(1);
        expect(reports[0].request).toMatchObject({ method: 'POST', url: expect.stringContaining('/api/users/login') });
        expect(JSON.stringify(reports[0])).not.toMatch(/SECRET-(PASSWORD|TOKEN|COOKIE)/);
    });
});
