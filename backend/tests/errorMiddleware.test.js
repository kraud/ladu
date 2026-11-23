// The error handler must not send the text of an unexpected error to the client.
// A database error message holds the SQL text and its parameters (once, in a
// registration race, a password hash). See .context/features/admin.md §6.
const express = require('express');
const asyncHandler = require('express-async-handler');
const request = require('./request');
const { errorHandler, UNEXPECTED_ERROR_MESSAGE } = require('../middleware/errorMiddleware');

// Same text shape as a Drizzle query error: SQL, then the parameters.
const SQL_ERROR_TEXT =
    'Failed query: insert into "users" ("email", "password") values ($1, $2)\n' +
    'params: new@example.com,$2b$10$abcdefghijklmnopqrstuuSECRETHASHVALUE';

const probe = express();
probe.get('/unexpected', () => {
    throw new Error(SQL_ERROR_TEXT);
});
// Controllers wrap their handlers in asyncHandler, which passes a rejection to next().
probe.get(
    '/unexpected-async',
    asyncHandler(async () => {
        throw new Error(SQL_ERROR_TEXT);
    }),
);
probe.get('/deliberate-400', (req, res) => {
    res.status(400);
    throw new Error('Email already in use');
});
probe.get('/deliberate-503', (req, res) => {
    res.status(503);
    throw new Error('Admin API is not configured');
});
probe.get('/api-code', (req, res) => {
    res.status(403);
    const err = new Error('Change your password first');
    err.apiCode = 'PASSWORD_CHANGE_REQUIRED';
    throw err;
});
probe.get('/unexpected-api-code', () => {
    // Code that forgot to set a status still must not show its message.
    const err = new Error(SQL_ERROR_TEXT);
    err.apiCode = 'SOME_CODE';
    throw err;
});
probe.use(errorHandler);

describe('errorHandler', () => {
    it('answers 500 with a fixed message when an unexpected error is thrown, and shows no SQL or parameters', async () => {
        const res = await request(probe).get('/unexpected');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ message: UNEXPECTED_ERROR_MESSAGE });
        expect(res.text).not.toContain('insert into');
        expect(res.text).not.toContain('SECRETHASHVALUE');
        expect(res.text).not.toContain('new@example.com');
    });

    it('does the same for an error thrown inside an async handler', async () => {
        const res = await request(probe).get('/unexpected-async');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ message: UNEXPECTED_ERROR_MESSAGE });
    });

    it('keeps the message of an error the code threw on purpose with a 4xx status', async () => {
        const res = await request(probe).get('/deliberate-400');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'Email already in use' });
    });

    it('keeps the message of an error the code threw on purpose with a 5xx status', async () => {
        const res = await request(probe).get('/deliberate-503');

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ message: 'Admin API is not configured' });
    });

    it('sends the apiCode of a deliberate error', async () => {
        const res = await request(probe).get('/api-code');

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ message: 'Change your password first', code: 'PASSWORD_CHANGE_REQUIRED' });
    });

    it('still hides the message when an unexpected error carries an apiCode', async () => {
        const res = await request(probe).get('/unexpected-api-code');

        expect(res.status).toBe(500);
        expect(res.body.message).toBe(UNEXPECTED_ERROR_MESSAGE);
        expect(res.text).not.toContain('SECRETHASHVALUE');
    });
});
