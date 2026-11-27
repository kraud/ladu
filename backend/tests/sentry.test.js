/**
 * What reaches Sentry (lib/sentry.ts): crashes only, and never what the person sent.
 * The real SDK with the real options, and a transport that keeps the reports in memory.
 */

// The SDK must start before the app loads, as in api/index.js, so keep this order.
const Sentry = require('@sentry/node');
const { sentryOptions, reportCrash } = require('../lib/sentry');

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
const { errorHandler } = require('../middleware/errorMiddleware');
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

/**
 * The one report that the crash made, also as text. Fails if there is not exactly one. The text
 * leaves out the source lines around the crash: they show this file, with the words it tests.
 */
const onlyReport = async () => {
    const reports = await errorReports();
    expect(reports).toHaveLength(1);
    const withoutSource = (key, value) => (['pre_context', 'context_line', 'post_context'].includes(key) ? undefined : value);
    return { report: reports[0], text: JSON.stringify(reports[0], withoutSource) };
};

/** An error with a status the app did not choose, from a route that only this test has. */
const crashApp = (route) => {
    const express = require('express');
    const server = express();
    server.set('trust proxy', 1);
    server.all('/*path', route);
    server.use(reportCrash);
    server.use(errorHandler);
    return server;
};

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

    it('refuses a body that is not valid JSON with 400, and does not report it', async () => {
        const res = await request(app).post('/api/users/login').set('Content-Type', 'application/json').send('{"email":');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'Invalid request body' });
        expect(await errorReports()).toHaveLength(0);
    });

    it('reports a crash without query values, user data or local variables', async () => {
        const server = crashApp(() => {
            const local = 'SECRET-LOCAL';
            throw new Error(`crash of ${local.length} characters`);
        });

        await request(server)
            .post('/api/thing?code=SECRET-QUERY')
            .set('X-Forwarded-For', '203.0.113.9')
            .set('Cf-Connecting-Ip', '203.0.113.10')
            .set('Referer', 'https://app.test/words?search=SECRET-REFERER')
            .send({ word: 'SECRET-BODY' });

        const { report, text } = await onlyReport();
        expect(text).not.toMatch(/SECRET-/);
        expect(text).not.toContain('203.0.113.');
        expect(report.user).toBeUndefined();
        expect(report.exception.values[0].stacktrace.frames.some((frame) => frame.vars)).toBe(false);
        expect(report.request.headers.referer).toBe('https://app.test/words');
    });

    it.each([
        ['/api/users/42/verify/abc123token', '/api/users/42/verify/[token]'],
        ['/resetPassword/42/abc123token', '/resetPassword/42/[token]'],
        ['/api/dictionary/DE/Noun/geheimwort', '/api/dictionary/DE/Noun/[word]'],
        ['/api/dictionary/translate/DE/Noun/geheimwort', '/api/dictionary/translate/DE/Noun/[word]'],
    ])('replaces the secret part of %s', async (path, sentPath) => {
        // A different message each time: the SDK drops a report that repeats the one before.
        const server = crashApp(() => {
            throw new Error(`crash in a path of ${path.length} characters`);
        });

        await request(server).get(path).set('Referer', `https://app.test${path}`);

        const { report, text } = await onlyReport();
        expect(report.request.url).toContain(sentPath);
        expect(report.request.headers.referer).toContain(sentPath);
        expect(text).not.toMatch(/abc123token|geheimwort/);
    });

    it('keeps the SQL text of a failed query, and removes its values', async () => {
        const { sql } = require('drizzle-orm');
        const { db } = require('../src/db');
        const server = crashApp(async () => {
            await db.execute(sql`select ${'geheimwort'}::uuid`);
        });

        await request(server).get('/api/thing');

        const { report, text } = await onlyReport();
        expect(text).not.toContain('geheimwort');
        const messages = report.exception.values.map((exception) => exception.value);
        expect(messages).toContain('invalid input syntax for type uuid: [removed]');
        expect(messages.join('\n')).toContain('Failed query: select $1::uuid');
    });

    it('does not keep console lines', async () => {
        const server = crashApp(() => {
            console.log('geheimwort');
            throw new Error('crash after a console line');
        });

        await request(server).get('/api/thing');

        const { text } = await onlyReport();
        expect(text).not.toContain('geheimwort');
    });
});
