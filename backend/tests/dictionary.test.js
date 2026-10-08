// GET /api/dictionary/:language/:partOfSpeech/:query (autocomplete-data-source-strategy.md, Slice A).
// EN/ES/DE run the local lexicon (loaded from the committed fixtures) and the real libraries as the fallback.
// jest.mock comes before require('../app'): this .js file is not transformed, so Jest does not hoist
// it, and userController.ts must capture the mock, not the real nodemailer-backed module.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const path = require('path');
const request = require('supertest');
const app = require('../app');
const db = require('./db');
const { pool } = require('../src/db');
const { loadLexiconFile } = require('../scripts/lexicon/load');

const FIXTURE = path.join(__dirname, '../scripts/lexicon/fixtures/lexicon-de-fixture.jsonl');
const ES_FIXTURE = path.join(__dirname, '../scripts/lexicon/fixtures/lexicon-es-fixture.jsonl');
const EN_FIXTURE = path.join(__dirname, '../scripts/lexicon/fixtures/lexicon-en-fixture.jsonl');

beforeAll(() => db.connectDB());
beforeEach(() => db.clearDB());
afterAll(async () => {
    await pool.end();
    await db.closeDB();
});

let token;
beforeEach(async () => {
    await request(app).post('/api/users').send({
        name: 'Dict User', email: 'dict@test.com', username: 'dictuser', password: 'pass123', languages: ['English', 'German'],
    });
    token = (await request(app).post('/api/users/login').send({ email: 'dict@test.com', password: 'pass123' })).body.token;
});

const lookup = (path) => request(app).get(`/api/dictionary/${path}`).set('Authorization', `Bearer ${token}`);
const casesOf = (body) => Object.fromEntries(body.cases.map(({ caseName, word }) => [caseName, word]));

describe('English (Slice C2: verbs lexicon-first with the library fallback; nouns lexicon only)', () => {
    describe('with the lexicon loaded (the committed fixture)', () => {
        beforeEach(() => loadLexiconFile(pool, EN_FIXTURE));

        it('a verb is found, with the bare verb in future and conditional and its regularity', async () => {
            const res = await lookup('English/Verb/run');
            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe('found');
            expect(casesOf(res.body)).toMatchObject({
                regularityEN: 'irregular',
                simplePresent3sEN: 'runs',
                simplePast1sEN: 'ran',
                simpleFuture1sEN: 'run',
                simpleConditional3plEN: 'run',
            });
        });

        it('modal verbs are right (the old library said "caned")', async () => {
            expect(casesOf((await lookup('English/Verb/can')).body).simplePast1sEN).toBe('could');
        });

        it('nouns get their plural for the first time, irregular and unchanged ones too', async () => {
            expect(casesOf((await lookup('English/Noun/child')).body)).toEqual({ singularEN: 'child', pluralEN: 'children' });
            expect(casesOf((await lookup('English/Noun/sheep')).body)).toEqual({ singularEN: 'sheep', pluralEN: 'sheep' });
        });

        it('a noun not in the lexicon is not-found: there is no library for English nouns', async () => {
            expect((await lookup('English/Noun/zorplate')).body).toEqual({ status: 'not-found', cases: [] });
        });
    });

    describe('with an empty lexicon (no is-word gate since C2, decision D17)', () => {
        it('the library answers as partial, also for a made-up verb', async () => {
            expect((await lookup('English/Verb/run')).body.status).toBe('partial');
            const made = await lookup('English/Verb/zorplate');
            expect(made.body.status).toBe('partial');
            expect(casesOf(made.body).simplePresent3sEN).toBe('zorplates');
        });
    });

});

describe('Spanish (Slice C1: the lexicon first, the library as a partial fallback)', () => {
    describe('with the lexicon loaded (the committed fixture)', () => {
        beforeEach(() => loadLexiconFile(pool, ES_FIXTURE));

        it('a verb is found, with gerund, regularity and the ustedes form in 2nd person plural (D10)', async () => {
            const res = await lookup('Spanish/Verb/bailar');
            expect(res.body.status).toBe('found');
            expect(casesOf(res.body)).toMatchObject({
                infinitiveNonFiniteSimpleES: 'bailar',
                gerundNonFiniteSimpleES: 'bailando',
                participleNonFiniteSimpleES: 'bailado',
                regularityES: 'regular',
                indicativePresent2sES: 'bailas',
                indicativePresent2plES: 'bailan',
                indicativeFuture3plES: 'bailarán',
            });
        });

        it('stem-changing and irregular verbs are right (the old library said "sento", "veniré")', async () => {
            expect(casesOf((await lookup('Spanish/Verb/sentir')).body)).toMatchObject({ indicativePresent1sES: 'siento', regularityES: 'irregular' });
            expect(casesOf((await lookup('Spanish/Verb/venir')).body)).toMatchObject({ indicativeFuture1sES: 'vendré' });
        });

        it('a reflexive verb is stored without the pronoun (D8)', async () => {
            expect(casesOf((await lookup('Spanish/Verb/quejarse')).body)).toMatchObject({ indicativePresent1sES: 'quejo' });
        });

        it('nouns get the right gender and a plural (the old library said "el leche")', async () => {
            expect((await lookup('Spanish/Noun/casa')).body).toEqual({
                status: 'found',
                cases: expect.arrayContaining([
                    { caseName: 'genderES', word: 'la' },
                    { caseName: 'singularES', word: 'casa' },
                    { caseName: 'pluralES', word: 'casas' },
                ]),
            });
            expect(casesOf((await lookup('Spanish/Noun/leche')).body).genderES).toBe('la');
            expect(casesOf((await lookup('Spanish/Noun/estudiante')).body).genderES).toBe('el/la');
        });

        it('an unknown noun still gets the guessed gender, as partial', async () => {
            const res = await lookup('Spanish/Noun/zorplata');
            expect(res.body.status).toBe('partial');
            expect(casesOf(res.body).singularES).toBe('zorplata');
        });
    });

    describe('with an empty lexicon', () => {
        it('the library answers as partial, also with the ustedes form (D10)', async () => {
            const res = await lookup('Spanish/Verb/bailar');
            expect(res.body.status).toBe('partial');
            expect(casesOf(res.body)).toMatchObject({ indicativePresent1sES: 'bailo', indicativePresent2plES: 'bailan', indicativeFuture2plES: 'bailarán' });
        });
    });
});

describe('German (Slice B2: the lexicon first, the library as a partial fallback)', () => {
    describe('with the lexicon loaded (the committed fixture)', () => {
        beforeEach(() => loadLexiconFile(pool, FIXTURE));

        it('a noun is found in the lexicon, typed in any case', async () => {
            const res = await lookup('German/Noun/haus');
            expect(res.body.status).toBe('found');
            // Dative singular "Haus" is the lexicon's answer; the library said "Hause".
            expect(casesOf(res.body)).toMatchObject({ genderDE: 'das', singularNominativDE: 'Haus', singularDativDE: 'Haus', pluralDativDE: 'Häusern' });
        });

        it('a noun the library cannot decline is found now (old route: HTTP 500)', async () => {
            const res = await lookup('German/Noun/Polizei');
            expect(res.body.status).toBe('found');
            expect(casesOf(res.body)).toMatchObject({ genderDE: 'die', pluralNominativDE: 'Polizeien' });
        });

        it('a "sein" verb gets its auxiliary, and verbs get regularity and the separable prefix', async () => {
            const gehen = casesOf((await lookup('German/Verb/gehen')).body);
            expect(gehen).toMatchObject({ auxVerbDE: 'sein', regularityDE: 'irregular', indicativePerfect3sDE: 'gegangen' });

            const anrufen = casesOf((await lookup('German/Verb/anrufen')).body);
            expect(anrufen).toMatchObject({ prefixDE: 'an', indicativePresent3sDE: 'anruft', auxVerbDE: 'haben' });
        });

        it('a homograph returns its main sense (der See, not die See — decision D15)', async () => {
            const res = await lookup('German/Noun/See');
            expect(res.body.status).toBe('found');
            expect(casesOf(res.body).genderDE).toBe('der');
        });

        it('a stub entry never wins over a full one ("Tag": the entry with a plural, D15 refined)', async () => {
            expect(casesOf((await lookup('German/Noun/Tag')).body)).toMatchObject({ genderDE: 'der', pluralNominativDE: 'Tage' });
        });

        it('a word not in the lexicon falls back to the library, as partial', async () => {
            const res = await lookup('German/Verb/abkleben');
            expect(res.body.status).toBe('partial');
            expect(casesOf(res.body)).toMatchObject({ infinitiveDE: 'abkleben' });
        });

        it('a word in neither is not-found', async () => {
            expect((await lookup('German/Verb/zorplatieren')).body).toEqual({ status: 'not-found', cases: [] });
        });
    });

    describe('with an empty lexicon (e.g. right after a database restore)', () => {
        it('library answers come back as partial', async () => {
            const res = await lookup('German/Noun/haus');
            expect(res.body.status).toBe('partial');
            expect(casesOf(res.body)).toMatchObject({ genderDE: 'das', pluralDativDE: 'Häusern' });
        });

        it('a word the library cannot decline is not-found, not a server error', async () => {
            // german-words-dict has no entry for "Polizei" and throws.
            const res = await lookup('German/Noun/Polizei');
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ status: 'not-found', cases: [] });
        });
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
