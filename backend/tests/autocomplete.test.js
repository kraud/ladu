const request = require('supertest');
const https = require('https');
const app = require('../app');
const db = require('./db');

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());
jest.mock('is-word', () => {
    const mockDict = { check: () => true };
    return () => mockDict;
});

beforeAll(() => db.connectDB());
beforeEach(() => db.clearDB());
afterAll(() => db.closeDB());

const registerAndLogin = async () => {
    await request(app).post('/api/users').send({
        name: 'AC User', email: 'ac@test.com', username: 'acuser', password: 'pass123',
    });
    const r = await request(app).post('/api/users/login').send({ email: 'ac@test.com', password: 'pass123' });
    return r.body.token;
};

describe('GET /api/autocompleteTranslations/english/verb/:infinitive - English Verb', () => {
    let token;

    beforeEach(async () => { token = await registerAndLogin(); });

    it('returns conjugation data for a known verb', async () => {
        const res = await request(app)
            .get('/api/autocompleteTranslations/english/verb/run')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('foundVerb', true);
        expect(res.body.verbData).toBeDefined();
    });
});

describe('GET /api/autocompleteTranslations/spanish/noun/:noun - Spanish Noun Gender', () => {
    let token;

    beforeEach(async () => { token = await registerAndLogin(); });

    it('returns gender data for a noun', async () => {
        const res = await request(app)
            .get('/api/autocompleteTranslations/spanish/noun/casa')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.nounData).toBeDefined();
        expect(res.body.nounData.cases).toBeDefined();
    });
});

describe('GET /api/autocompleteTranslations/german/noun/:noun - German Noun', () => {
    let token;

    beforeEach(async () => { token = await registerAndLogin(); });

    it('returns declension data for a noun', async () => {
        const res = await request(app)
            .get('/api/autocompleteTranslations/german/noun/Haus')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
    });
});

describe('GET /api/autocompleteTranslations/estonian/verb/:verb - Estonian Verb (mocked)', () => {
    let token;

    beforeEach(async () => {
        token = await registerAndLogin();
        jest.spyOn(https, 'get').mockImplementation((url, cb) => {
            const mockRes = {
                on: (event, handler) => {
                    if (event === 'data') handler(JSON.stringify({ entries: [{ root: 'jooksma' }] }));
                    if (event === 'end') handler();
                },
            };
            cb(mockRes);
            return { on: () => {} };
        });
    });

    afterEach(() => { jest.restoreAllMocks(); });

    it('returns data from the external Estonian API', async () => {
        const res = await request(app)
            .get('/api/autocompleteTranslations/estonian/verb/jooksma')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
    });
});

describe('Protected routes - 401 without auth', () => {
    it('rejects unauthenticated requests', async () => {
        const res = await request(app).get('/api/autocompleteTranslations/english/verb/run');
        expect(res.statusCode).toBe(401);
    });
});
