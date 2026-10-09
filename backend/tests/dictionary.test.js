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
        // An adjective with no one-word superlative (the real Ekilex has few; this one is made up for the test).
        tore: [13, { wordClass: 'noomen', paradigmForms: forms([['SgN', 'tore']]) }],
        jooksma: [21, { wordClass: 'verb', paradigmForms: forms([['Sup', 'jooksma'], ['Inf', 'joosta']]) }],
    };
    /** word id → `api/word/details` (part of speech + comparison relations, D20). */
    const group = (groupTypeCode, words) => ({ groupTypeCode, members: words.map((wordValue) => ({ wordValue })) });
    const DETAILS = {
        11: { lexemes: [{ pos: [{ code: 's' }] }] },
        12: { lexemes: [{ pos: [{ code: 'adj' }] }], wordRelationDetails: { level1WordRelationGroups: [group('komp', ['parem']), group('superl', ['kõige parem', 'parim'])] } },
        13: { lexemes: [{ pos: [{ code: 'adj' }] }], wordRelationDetails: { level1WordRelationGroups: [group('komp', ['toredam']), group('superl', ['kõige toredam'])] } },
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
            if ((match = /^\/api\/word\/details\/(\d+)$/.exec(path))) return json(DETAILS[match[1]] ?? {});
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

    it('an adjective declines like a noun, takes the first listed variant, and gets its comparison (D19, D20)', async () => {
        const fetchMock = fakeEkilex();
        const res = await lookup('Estonian/Adjective/hea');
        expect(casesOf(res.body)).toEqual({
            algvorreEE: 'hea',
            pluralOsastavEE: 'häid',
            keskvorreEE: 'parem',
            ulivorreEE: 'parim',
            periphrasticSuperlativeEE: 'false',
        });
        expect(fetchMock.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
            '/api/word/ids/hea/eki/est',
            '/api/paradigm/details/12',
            '/api/word/details/12',
        ]);
    });

    it('an adjective with only "kõige …" checks the box and sends no superlative (D20)', async () => {
        fakeEkilex();
        expect(casesOf((await lookup('Estonian/Adjective/tore')).body)).toEqual({
            algvorreEE: 'tore',
            keskvorreEE: 'toredam',
            periphrasticSuperlativeEE: 'true',
        });
    });

    it('a noun typed into the adjective form is not-found (the part-of-speech check, D20)', async () => {
        fakeEkilex();
        expect((await lookup(`Estonian/Adjective/${encodeURIComponent('õun')}`)).body).toEqual({ status: 'not-found', cases: [] });
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

describe('type-ahead suggestions (Slice E: GET /api/dictionary/:language/:partOfSpeech?prefix=)', () => {
    const suggest = (path) => request(app).get(`/api/dictionary/${path}`).set('Authorization', `Bearer ${token}`);
    const lemmas = (body) => body.suggestions.map(({ lemma, hint }) => (hint ? `${hint} ${lemma}` : lemma));

    beforeEach(async () => {
        await loadLexiconFile(pool, FIXTURE);
        await loadLexiconFile(pool, ES_FIXTURE);
    });

    it('lists the words that start with the prefix, most frequent first', async () => {
        const res = await suggest('German/Verb?prefix=se');
        expect(res.statusCode).toBe(200);
        expect(lemmas(res.body)).toEqual(['sein', 'sehen']);
    });

    it('equal ranks: the shorter word first, then alphabetical', async () => {
        // ser 8; sentar and sentir both 106.
        expect(lemmas((await suggest('Spanish/Verb?prefix=se')).body)).toEqual(['ser', 'sentar', 'sentir']);
    });

    it('ignores letter case, and every item carries an entry id', async () => {
        const res = await suggest('German/Noun?prefix=HA');
        expect(lemmas(res.body)).toEqual(['das Haus']);
        expect(res.body.suggestions[0].entryId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('a homograph shows once per meaning, with the article as the hint (der See, die See — D15)', async () => {
        expect(lemmas((await suggest('German/Noun?prefix=see')).body)).toEqual(['der See', 'die See']);
        expect(lemmas((await suggest('Spanish/Noun?prefix=man')).body)).toEqual(['la mano', 'el mano']);
    });

    it('a stub entry is not listed ("Tag" and "Buch" show once)', async () => {
        expect(lemmas((await suggest('German/Noun?prefix=ta')).body)).toEqual(['der Tag']);
        expect(lemmas((await suggest('German/Noun?prefix=bu')).body)).toEqual(['das Buch']);
    });

    it('respects the limit', async () => {
        expect(lemmas((await suggest('German/Verb?prefix=se&limit=1')).body)).toEqual(['sein']);
    });

    it('a typed % or _ matches only itself, not any text', async () => {
        expect((await suggest('German/Verb?prefix=s%25')).body.suggestions).toEqual([]);
        expect((await suggest('German/Verb?prefix=s_')).body.suggestions).toEqual([]);
    });

    it('a pair with a dictionary but no lexicon (Estonian adjectives) returns an empty list', async () => {
        expect((await suggest('Estonian/Adjective?prefix=su')).body).toEqual({ suggestions: [] });
    });

    it('400 for a pair without a dictionary, a prefix under 2 characters or a bad limit', async () => {
        expect((await suggest('English/Adjective?prefix=bi')).statusCode).toBe(400);
        expect((await suggest('German/Verb?prefix=s')).statusCode).toBe(400);
        expect((await suggest('German/Verb')).statusCode).toBe(400);
        expect((await suggest('German/Verb?prefix=se&limit=0')).statusCode).toBe(400);
        expect((await suggest('German/Verb?prefix=se&limit=21')).statusCode).toBe(400);
        expect((await suggest('German/Verb?prefix=se&limit=ten')).statusCode).toBe(400);
    });

    it('401 without a token', async () => {
        expect((await request(app).get('/api/dictionary/German/Verb?prefix=se')).statusCode).toBe(401);
    });

    describe('a lookup with ?entry= returns the picked entry', () => {
        const entryOf = async (prefix, hint) =>
            (await suggest(`German/Noun?prefix=${prefix}`)).body.suggestions.find((s) => s.hint === hint).entryId;

        it('die See, not the main sense der See', async () => {
            const res = await lookup(`German/Noun/See?entry=${await entryOf('see', 'die')}`);
            expect(res.body.status).toBe('found');
            expect(casesOf(res.body).genderDE).toBe('die');
        });

        it('an entry of another word is ignored: the usual D15 choice', async () => {
            const haus = await entryOf('ha', 'das');
            expect(casesOf((await lookup(`German/Noun/See?entry=${haus}`)).body).genderDE).toBe('der');
        });

        it('an unknown entry id is ignored', async () => {
            const res = await lookup('German/Noun/See?entry=00000000-0000-0000-0000-000000000000');
            expect(casesOf(res.body).genderDE).toBe('der');
        });

        it('400 for an entry that is not an id', async () => {
            expect((await lookup('German/Noun/See?entry=1')).statusCode).toBe(400);
        });
    });
});

describe('translate (Slice F: GET /api/dictionary/translate/:fromLanguage/:partOfSpeech/:query)', () => {
    const TRANSLATIONS = path.join(__dirname, '../scripts/lexicon/fixtures/translations-en-fixture.jsonl');
    const translate = (path) => request(app).get(`/api/dictionary/translate/${path}`).set('Authorization', `Bearer ${token}`);
    const words = (list) => list.map(({ word, gender }) => (gender ? `${gender} ${word}` : word));
    const originalFetch = global.fetch;
    const saved = {};

    /** A fake Ekilex meaning search: `meanings` per searched word, each a list of [lang, word]. */
    function fakeMeaningSearch(meanings, { ok = true } = {}) {
        global.fetch = jest.fn(async (url) => {
            const word = decodeURIComponent(new URL(url).pathname.replace('/api/meaning/search/', ''));
            const results = (meanings[word] ?? []).map((list) => ({ meaningWords: list.map(([lang, wordValue]) => ({ lang, wordValue })) }));
            return { ok, status: ok ? 200 : 503, json: async () => ({ results }) };
        });
        return global.fetch;
    }

    beforeAll(() => {
        for (const key of ['EKILEX_API_URL', 'EKILEX_API_KEY']) saved[key] = process.env[key];
        process.env.EKILEX_API_URL = 'https://ekilex.test';
        process.env.EKILEX_API_KEY = 'test-key';
    });
    afterAll(() => {
        for (const [key, value] of Object.entries(saved)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });
    beforeEach(async () => {
        await loadLexiconFile(pool, TRANSLATIONS);
        await loadLexiconFile(pool, EN_FIXTURE);
        global.fetch = jest.fn(async () => { throw new Error('Ekilex must not be asked'); });
    });
    afterEach(() => { global.fetch = originalFetch; });

    it('from English: the senses in Wiktionary order, each with all four languages and the noun gender', async () => {
        const res = await translate('English/Noun/lake');
        expect(res.statusCode).toBe(200);
        expect(res.body.senses.map((s) => s.sense)).toEqual(['body of water', 'a kind of coloring agent']);
        const [water] = res.body.senses;
        expect(water.english).toBe('lake');
        expect(Object.fromEntries(Object.entries(water.words).map(([language, list]) => [language, words(list)]))).toEqual({
            English: ['lake'], Spanish: ['el lago'], German: ['der See'], Estonian: ['järv'],
        });
        // Some sense has an Estonian word: Ekilex is not asked.
        expect(res.body.ekilex).toBeUndefined();
    });

    it('from German: "See" belongs to two English words (lake: der See, sea: die See)', async () => {
        const res = await translate('German/Noun/see');
        const byEnglish = Object.fromEntries(res.body.senses.map((s) => [s.english, words(s.words.German)]));
        expect(byEnglish).toEqual({ lake: ['der See'], sea: ['das Meer', 'die See'] });
    });

    it('from Spanish and from Estonian: the reverse lookup reaches the same sense', async () => {
        for (const path of ['Spanish/Noun/lago', `Estonian/Noun/${encodeURIComponent('järv')}`]) {
            const [sense] = (await translate(path)).body.senses;
            expect(sense).toMatchObject({ english: 'lake', sense: 'body of water' });
            expect(words(sense.words.German)).toEqual(['der See']);
        }
    });

    it('reverse order: the senses where the word is listed first come first', async () => {
        // "laufen" is the 1st German word of 5 senses of "run" ("to move quickly", …), and the 2nd of
        // "to move quickly on two feet" (after "rennen"): that sense comes after the 5, in Wiktionary order.
        const senses = (await translate('German/Verb/laufen')).body.senses;
        expect(senses.map((s) => s.sense)).toEqual([
            'to move quickly', 'to have a liquid flowing from', 'to extend in time, to last, to continue',
            'of a machine, to be operating normally', 'to be presented in the media',
            'to move quickly on two feet', 'to compete in a race',
        ]);
        expect(words(senses[5].words.German)).toEqual(['rennen', 'laufen']);
    });

    it('verbs, adjectives and adverbs have no gender; words keep their listed order', async () => {
        const [run] = (await translate('English/Verb/run')).body.senses;
        expect(words(run.words.Spanish)).toEqual(['correr', 'apeonar']);
        expect(words(run.words.Estonian)).toEqual(['jooksma']);
        const big = (await translate('English/Adjective/big')).body.senses;
        expect(big.map((s) => words(s.words.German))).toEqual([['groß'], ['groß']]);
        expect((await translate('Spanish/Adverb/deprisa')).body.senses[0].english).toBe('quickly');
    });

    it('no Estonian in any sense: Ekilex adds the Estonian words of the meanings that list the word', async () => {
        const fetchMock = fakeMeaningSearch({
            laca: [
                [['est', 'lakk'], ['spa', 'laca'], ['eng', 'lacquer']],
                // Another language's "laca" is not this word; a verb ("-ma") is not a noun.
                [['est', 'vale'], ['ita', 'laca']],
                [['est', 'lakkima'], ['spa', 'laca']],
            ],
        });
        const res = await translate('Spanish/Noun/laca');
        expect(res.body.senses.map((s) => s.sense)).toEqual(['a kind of coloring agent']);
        expect(res.body.ekilex).toEqual({ estonian: [{ word: 'lakk' }] });
        expect(fetchMock.mock.calls[0][0]).toBe('https://ekilex.test/api/meaning/search/laca');
    });

    it('a word not in the table: no senses, and Ekilex answers for a verb with "-ma" words only', async () => {
        fakeMeaningSearch({ swim: [[['est', 'ujuma'], ['est', 'ujumine'], ['eng', 'swim']]] });
        expect((await translate('English/Verb/swim')).body).toEqual({ senses: [], ekilex: { estonian: [{ word: 'ujuma' }] } });
    });

    it('Ekilex down: the route still answers, and says Ekilex was unavailable', async () => {
        fakeMeaningSearch({}, { ok: false });
        const res = await translate('Spanish/Noun/laca');
        expect(res.statusCode).toBe(200);
        expect(res.body.senses).toHaveLength(1);
        expect(res.body.ekilex).toEqual({ unavailable: true });
    });

    it('from Estonian: Ekilex is never asked', async () => {
        expect((await translate('Estonian/Noun/tundmatu')).body).toEqual({ senses: [] });
    });

    it('400 for an unknown language or part of speech, or a bad query; 401 without a token', async () => {
        expect((await translate('Klingon/Noun/lake')).statusCode).toBe(400);
        expect((await translate('English/Preposition/in')).statusCode).toBe(400);
        expect((await translate(`English/Noun/${'a'.repeat(101)}`)).statusCode).toBe(400);
        expect((await translate('English/Noun/%20')).statusCode).toBe(400);
        expect((await request(app).get('/api/dictionary/translate/English/Noun/lake')).statusCode).toBe(401);
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
