// Same trap as auth.test.js:1-11 — `jest.mock` must come before `require('../app')`,
// which pulls in userController.ts's own top-level `require("../utils/sendEmail")`.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');
const testDb = require('./db');
const { pool } = require('../src/db');
const { generateCodeVerifier, generateCodeChallenge, generateNonce } = require('../lib/oauth/pkce');
const { issueStateToken, verifyStateToken } = require('../lib/oauth/stateToken');

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
});
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

describe('PKCE helpers', () => {
    it('the challenge is the base64url SHA-256 digest of the verifier', () => {
        const verifier = generateCodeVerifier();
        const challenge = generateCodeChallenge(verifier);
        const expected = crypto.createHash('sha256').update(verifier).digest('base64url');
        expect(challenge).toBe(expected);
    });

    it('generates a fresh, unpredictable verifier and nonce on every call', () => {
        expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
        expect(generateNonce()).not.toBe(generateNonce());
    });
});

describe('OAuth state token', () => {
    it('round-trips provider/verifier/nonce/jti through issue -> verify', () => {
        const token = issueStateToken({ provider: 'google', verifier: 'v', nonce: 'n', jti: 'j' });
        const payload = verifyStateToken(token);
        expect(payload).toMatchObject({ typ: 'oauth_state', provider: 'google', verifier: 'v', nonce: 'n', jti: 'j' });
    });

    it('rejects a real 30-day session JWT — the typ guard, not just a shared secret', () => {
        const sessionToken = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET, { expiresIn: '30d' });
        expect(() => verifyStateToken(sessionToken)).toThrow();
    });

    it('rejects a tampered token', () => {
        const token = issueStateToken({ provider: 'google', verifier: 'v', nonce: 'n', jti: 'j' });
        expect(() => verifyStateToken(`${token}x`)).toThrow();
    });
});

describe('GET /api/auth/providers', () => {
    const originalId = process.env.GOOGLE_CLIENT_ID;
    const originalSecret = process.env.GOOGLE_CLIENT_SECRET;

    afterEach(() => {
        if (originalId === undefined) delete process.env.GOOGLE_CLIENT_ID;
        else process.env.GOOGLE_CLIENT_ID = originalId;
        if (originalSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
        else process.env.GOOGLE_CLIENT_SECRET = originalSecret;
    });

    it('reports google: true once GOOGLE_CLIENT_ID/SECRET are both set', async () => {
        process.env.GOOGLE_CLIENT_ID = 'test-client-id';
        process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

        const res = await request(app).get('/api/auth/providers');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ google: true });
    });

    it('reports google: false when either is unset', async () => {
        delete process.env.GOOGLE_CLIENT_ID;
        process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

        const res = await request(app).get('/api/auth/providers');
        expect(res.body).toEqual({ google: false });
    });
});

describe('GET /api/auth/:provider/start', () => {
    it('404s for an unknown provider name', async () => {
        const res = await request(app).get('/api/auth/microsoft/start');
        expect(res.statusCode).toBe(404);
    });

    it('404s for a known provider that is not configured', async () => {
        const originalId = process.env.GOOGLE_CLIENT_ID;
        delete process.env.GOOGLE_CLIENT_ID;

        const res = await request(app).get('/api/auth/google/start');
        expect(res.statusCode).toBe(404);

        if (originalId !== undefined) process.env.GOOGLE_CLIENT_ID = originalId;
    });
});
