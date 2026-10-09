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
const ET_FIXTURE = path.join(__dirname, '../scripts/lexicon/fixtures/lexicon-et-fixture.jsonl');

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

describe('Estonian (the Ekilex API, fetch replaced by a fake Ekilex)', () => {
    // This Jest sandbox has no global fetch (Node has it), so set a fake and restore it (as in accessGateLogin.test.js).
    const originalFetch = global.fetch;
    const forms = (pairs) => pairs.map(([morphCode, value]) => ({ morphCode, value }));
    /** word → [word id, paradigm]; ids 1x are nouns/adjectives, 2x verbs. */
    const WORDS = {
        õun: [11, { wordClass: 'noomen', paradigmForms: forms([['SgN', 'õun'], ['PlN', 'õunad']]) }],
        hea: [12, { wordClass: 'noomen', paradigmForms: forms([['SgN', 'hea'], ['PlP', 'häid'], ['PlP', 'heasid']]) }],
        jooksma: [21, { wordClass: 'verb', paradigmForms: forms([['Sup', 'jooksma'], ['Inf', 'joosta']]) }],
    };
    /** A fake Ekilex: answers by path, like e2e/fixtures/eki-stub/server.ts. */
    function fakeEkilex({ ok = true } = {}) {
        global.fetch = jest.fn(async (url) => {
            const path = decodeURIComponent(new URL(url).pathname);
            const json = (body) => ({ ok, status: ok ? 200 : 503, json: async () => body });
            let match;
            if ((match = /^\/api\/word\/ids\/(.+)\/eki\/est$/.exec(path))) return json(WORDS[match[1]] ? [WORDS[match[1]][0]] : []);
            if ((match = /^\/api\/paradigm\/details\/(\d+)$/.exec(path))) {
                const entry = Object.values(WORDS).find(([id]) => id === Number(match[1]));
                return json(entry ? [entry[1]] : []);
            }
            if ((match = /^\/api\/meaning\/search\/(.+)$/.exec(path))) {
                // Like the real answer for "run": "astuma" (to step) is listed first, "jooksma" is in more meanings.
                const meaning = (...est) => ({ meaningWords: [...est.map((wordValue) => ({ wordValue, lang: 'est' })), { wordValue: 'run', lang: 'eng' }] });
                return json({ results: match[1] === 'run' ? [meaning('astuma'), meaning('jooks', 'jooksma'), meaning('jooksma')] : [] });
            }
            return json({});
        });
        return global.fetch;
    }

    beforeAll(() => {
        process.env.EKILEX_API_URL = 'https://ekilex.test';
        process.env.EKILEX_API_KEY = 'test-key';
    });
    afterEach(() => { global.fetch = originalFetch; });

    it('looks the word up (ids, then paradigm), sends the key, and encodes the word', async () => {
        const fetchMock = fakeEkilex();
        const res = await lookup(`Estonian/Noun/${encodeURIComponent('õun')}`);
        expect(res.body).toEqual({ status: 'found', cases: [{ caseName: 'singularNimetavEE', word: 'õun' }, { caseName: 'pluralNimetavEE', word: 'õunad' }] });
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            'https://ekilex.test/api/word/ids/%C3%B5un/eki/est',
            'https://ekilex.test/api/paradigm/details/11',
        ]);
        expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'ekilex-api-key': 'test-key' });
    });

    it('an adjective declines like a noun and takes the first listed variant (D18, D19)', async () => {
        fakeEkilex();
        const res = await lookup('Estonian/Adjective/hea');
        expect(casesOf(res.body)).toEqual({ algvorreEE: 'hea', pluralOsastavEE: 'häid' });
    });

    it('a word with the wrong word class, or no entry, is not-found', async () => {
        fakeEkilex();
        expect((await lookup('Estonian/Verb/hea')).body).toEqual({ status: 'not-found', cases: [] });
        expect((await lookup('Estonian/Noun/zorplata')).body).toEqual({ status: 'not-found', cases: [] });
    });

    it('searchInEnglish takes the Estonian -ma verb found in the most meanings, then its paradigm', async () => {
        const fetchMock = fakeEkilex();
        const res = await lookup('Estonian/Verb/run?searchInEnglish=true');
        expect(casesOf(res.body)).toEqual({ infinitiveMaEE: 'jooksma', infinitiveDaEE: 'joosta' });
        expect(fetchMock.mock.calls[0][0]).toBe('https://ekilex.test/api/meaning/search/run');
    });

    it('uses https://ekilex.ee when EKILEX_API_URL is not set', async () => {
        const configured = process.env.EKILEX_API_URL;
        delete process.env.EKILEX_API_URL;
        try {
            const fetchMock = fakeEkilex();
            await lookup('Estonian/Noun/maja');
            expect(fetchMock.mock.calls[0][0]).toBe('https://ekilex.ee/api/word/ids/maja/eki/est');
        } finally {
            process.env.EKILEX_API_URL = configured;
        }
    });

    describe('with the Estonian lexicon loaded (Eesthetic fixture, Slice D2)', () => {
        beforeEach(() => loadLexiconFile(pool, ET_FIXTURE));

        it('a noun in the lexicon is answered locally: found, and Ekilex is not called', async () => {
            const fetchMock = fakeEkilex();
            const res = await lookup('Estonian/Noun/maja');
            expect(res.body.status).toBe('found');
            expect(casesOf(res.body)).toMatchObject({ pluralNimetavEE: 'majad', pluralOsastavEE: 'maju', shortFormEE: 'majja' });
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('a verb in the lexicon fills all persons and the past participle', async () => {
            fakeEkilex();
            const cases = casesOf((await lookup('Estonian/Verb/tantsima')).body);
            expect(cases).toMatchObject({ infinitiveDaEE: 'tantsida', kindelPresent1sEE: 'tantsin', kindelSimplePast3plEE: 'tantsisid', kindelPastPerfect2plEE: 'tantsinud' });
        });

        it('a word not in the lexicon goes to Ekilex, and its answer stays found (a dictionary, not a guess)', async () => {
            const fetchMock = fakeEkilex();
            const res = await lookup(`Estonian/Noun/${encodeURIComponent('õun')}`);
            expect(res.body.status).toBe('found');
            expect(fetchMock).toHaveBeenCalled();
        });

        it('search in English skips the lexicon and asks Ekilex', async () => {
            const fetchMock = fakeEkilex();
            await lookup('Estonian/Verb/run?searchInEnglish=true');
            expect(fetchMock.mock.calls[0][0]).toBe('https://ekilex.test/api/meaning/search/run');
        });
    });

    it('answers 502 when the service is unreachable, answers an error, or no key is set', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('upstream unreachable'));
        expect((await lookup('Estonian/Adjective/hea')).statusCode).toBe(502);

        fakeEkilex({ ok: false });
        expect((await lookup('Estonian/Noun/maja')).statusCode).toBe(502);

        const key = process.env.EKILEX_API_KEY;
        delete process.env.EKILEX_API_KEY;
        try {
            fakeEkilex();
            expect((await lookup('Estonian/Noun/õun')).statusCode).toBe(502);
        } finally {
            process.env.EKILEX_API_KEY = key;
        }
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
