// GET /api/dictionary/:language/:partOfSpeech/:query (autocomplete-data-source-strategy.md, Slice A).
// EN/ES/DE run the real libraries and the real is-word lists. Estonian replaces global fetch.
// jest.mock comes before require('../app'): this .js file is not transformed, so Jest does not hoist
// it, and userController.ts must capture the mock, not the real nodemailer-backed module.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const app = require('../app');
const db = require('./db');

beforeAll(() => db.connectDB());
beforeEach(() => db.clearDB());
afterAll(() => db.closeDB());

let token;
beforeEach(async () => {
    await request(app).post('/api/users').send({
        name: 'Dict User', email: 'dict@test.com', username: 'dictuser', password: 'pass123', languages: ['English', 'German'],
    });
    token = (await request(app).post('/api/users/login').send({ email: 'dict@test.com', password: 'pass123' })).body.token;
});

const lookup = (path) => request(app).get(`/api/dictionary/${path}`).set('Authorization', `Bearer ${token}`);
const casesOf = (body) => Object.fromEntries(body.cases.map(({ caseName, word }) => [caseName, word]));

describe('EN, ES and DE (rule-based libraries)', () => {
    it('English verb: found, with the bare verb in future and conditional', async () => {
        const res = await lookup('English/Verb/run');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('found');
        expect(casesOf(res.body)).toMatchObject({
            simplePresent3sEN: 'runs',
            simplePast1sEN: 'ran',
            simpleFuture1sEN: 'run',
            simpleConditional3plEN: 'run',
        });
    });

    it('Spanish verb: found', async () => {
        const res = await lookup('Spanish/Verb/bailar');
        expect(res.body.status).toBe('found');
        expect(casesOf(res.body)).toMatchObject({
            infinitiveNonFiniteSimpleES: 'bailar',
            participleNonFiniteSimpleES: 'bailado',
            indicativePresent1sES: 'bailo',
            indicativeFuture3plES: 'bailarán',
        });
    });

    it('Spanish noun: a known word is found, an unknown word gets a guessed gender as partial', async () => {
        const known = await lookup('Spanish/Noun/casa');
        expect(known.body).toEqual({ status: 'found', cases: [{ caseName: 'genderES', word: 'la' }, { caseName: 'singularES', word: 'casa' }] });

        const guessed = await lookup('Spanish/Noun/zorplata');
        expect(guessed.body.status).toBe('partial');
        expect(casesOf(guessed.body).singularES).toBe('zorplata');
    });

    it('German verb and noun: found', async () => {
        const verb = await lookup('German/Verb/tanzen');
        expect(verb.body.status).toBe('found');
        expect(casesOf(verb.body)).toMatchObject({ infinitiveDE: 'tanzen', indicativePresent1sDE: 'tanze', indicativePerfect1sDE: 'getanzt' });

        const noun = await lookup('German/Noun/haus');
        expect(noun.body.status).toBe('found');
        expect(casesOf(noun.body)).toMatchObject({ genderDE: 'das', singularNominativDE: 'Haus', pluralDativDE: 'Häusern' });
    });

    it('a word the word list does not know is not-found', async () => {
        const res = await lookup('German/Verb/zorplatieren');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ status: 'not-found', cases: [] });
    });

    it('a word the library cannot decline is not-found, not a server error (old route: HTTP 500)', async () => {
        // is-word knows "Polizei", but german-words-dict has no entry and throws.
        const res = await lookup('German/Noun/Polizei');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ status: 'not-found', cases: [] });
    });
});

describe('Estonian (api.sonapi.ee, fetch replaced)', () => {
    // This Jest sandbox has no global fetch (Node has it), so set a fake and restore it (as in accessGateLogin.test.js).
    const originalFetch = global.fetch;
    const sonapi = (body, ok = true) =>
        (global.fetch = jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 503, json: async () => body }));
    const NOUN = { searchResult: [{ wordClasses: ['noomen'], wordForms: [{ code: 'SgN', value: 'õun' }, { code: 'PlN', value: 'õunad' }] }] };

    beforeAll(() => { process.env.URL_EESTI_LANG_API = 'https://sonapi.test/v2'; });
    afterEach(() => { global.fetch = originalFetch; });

    it('maps the answer and encodes the word in the URL', async () => {
        const fetchMock = sonapi(NOUN);
        const res = await lookup(`Estonian/Noun/${encodeURIComponent('õun')}`);
        expect(res.body).toEqual({ status: 'found', cases: [{ caseName: 'singularNimetavEE', word: 'õun' }, { caseName: 'pluralNimetavEE', word: 'õunad' }] });
        expect(fetchMock.mock.calls[0][0]).toBe('https://sonapi.test/v2/%C3%B5un');
    });

    it('uses the public sonapi URL when URL_EESTI_LANG_API is not set', async () => {
        const configured = process.env.URL_EESTI_LANG_API;
        delete process.env.URL_EESTI_LANG_API;
        try {
            const fetchMock = sonapi({ searchResult: [] });
            await lookup('Estonian/Noun/maja');
            expect(fetchMock.mock.calls[0][0]).toBe('https://api.sonapi.ee/v2/maja');
        } finally {
            process.env.URL_EESTI_LANG_API = configured;
        }
    });

    it('the verb passes searchInEnglish on as ?lg=en', async () => {
        const fetchMock = sonapi({ searchResult: [] });
        const res = await lookup('Estonian/Verb/run?searchInEnglish=true');
        expect(res.body.status).toBe('not-found');
        expect(fetchMock.mock.calls[0][0]).toBe('https://sonapi.test/v2/run?lg=en');
    });

    it('answers 502 when the service is unreachable or answers an error', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('upstream unreachable'));
        expect((await lookup('Estonian/Adjective/hea')).statusCode).toBe(502);

        sonapi({}, false);
        expect((await lookup('Estonian/Noun/maja')).statusCode).toBe(502);
    });
});

describe('validation and access', () => {
    it('400 for a language and part of speech without a dictionary', async () => {
        expect((await lookup('English/Adjective/big')).statusCode).toBe(400);
        expect((await lookup('Klingon/Verb/x')).statusCode).toBe(400);
    });

    it('400 for a query longer than 100 characters', async () => {
        expect((await lookup(`English/Verb/${'a'.repeat(101)}`)).statusCode).toBe(400);
    });

    it('401 without a token', async () => {
        expect((await request(app).get('/api/dictionary/English/Verb/run')).statusCode).toBe(401);
    });
});
