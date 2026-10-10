// scripts/lexicon/load.js against the test database (autocomplete Slice B1).
// Uses the committed German fixture (scripts/lexicon/fixtures/lexicon-de-fixture.jsonl).
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('./db');
const { pool } = require('../src/db');
const { loadLexiconFile } = require('../scripts/lexicon/load');
const { searchKey } = require('../lib/lexicon/searchKey');

const FIXTURE = path.join(__dirname, '../scripts/lexicon/fixtures/lexicon-de-fixture.jsonl');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexicon-load-'));

beforeAll(() => db.connectDB());
beforeEach(() => db.clearDB());
afterAll(async () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await pool.end();
    await db.closeDB();
});

const header = (language) => ({ format: 'ladu-lexicon/1', language, source: 'test', licence: 'CC BY-SA 4.0', sourceVersion: '2026-01-01' });
function writeFile(name, lines) {
    const file = path.join(tmpDir, name);
    fs.writeFileSync(file, lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n') + '\n');
    return file;
}
const count = async (language) =>
    Number((await pool.query('SELECT count(*) FROM lexemes WHERE language = $1', [language])).rows[0].count);

describe('loadLexiconFile', () => {
    it('loads the German fixture with source, licence, version and search keys', async () => {
        const result = await loadLexiconFile(pool, FIXTURE);
        const lines = fs.readFileSync(FIXTURE, 'utf8').trim().split('\n').length - 1;
        expect(result).toEqual({ kind: 'lexemes', language: 'German', loaded: lines, skipped: false });
        expect(await count('German')).toBe(lines);

        const { rows } = await pool.query(
            `SELECT lemma, search_key, forms, source, licence FROM lexemes
             WHERE language = 'German' AND part_of_speech = 'Noun' AND search_key = $1`,
            [searchKey('HAUS')],
        );
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ lemma: 'Haus', search_key: 'haus', source: 'kaikki', licence: 'CC BY-SA 4.0' });
        expect(rows[0].forms).toMatchObject({ genderDE: 'das', pluralDativDE: 'Häusern' });
    });

    it('keeps homographs as separate rows (der See / die See)', async () => {
        await loadLexiconFile(pool, FIXTURE);
        const { rows } = await pool.query(
            `SELECT forms->>'genderDE' AS gender FROM lexemes WHERE language = 'German' AND search_key = 'see' ORDER BY 1`,
        );
        expect(rows.map((row) => row.gender)).toEqual(['der', 'die']);
    });

    it('a second load replaces the language, it does not add to it', async () => {
        await loadLexiconFile(pool, FIXTURE);
        const first = await count('German');
        await loadLexiconFile(pool, FIXTURE);
        expect(await count('German')).toBe(first);
    });

    it('leaves the other languages alone', async () => {
        const estonian = writeFile('et.jsonl', [header('Estonian'), { partOfSpeech: 'Noun', lemma: 'maja', forms: { pluralNimetavEE: 'majad' } }]);
        await loadLexiconFile(pool, estonian);
        await loadLexiconFile(pool, FIXTURE);
        expect(await count('Estonian')).toBe(1);
    });

    it('--if-empty loads into an empty language and skips a filled one', async () => {
        expect((await loadLexiconFile(pool, FIXTURE, { ifEmpty: true })).skipped).toBe(false);
        const small = writeFile('de-small.jsonl', [header('German'), { partOfSpeech: 'Noun', lemma: 'Tisch', forms: { genderDE: 'der' } }]);
        expect(await loadLexiconFile(pool, small, { ifEmpty: true })).toEqual({ kind: 'lexemes', language: 'German', loaded: 0, skipped: true });
        expect(await count('German')).toBeGreaterThan(1);
    });

    it('a bad line stops the load before anything changes', async () => {
        await loadLexiconFile(pool, FIXTURE);
        const before = await count('German');
        const broken = writeFile('broken.jsonl', [
            header('German'),
            { partOfSpeech: 'Noun', lemma: 'Tisch', forms: { genderDE: 'der' } },
            { partOfSpeech: 'Klingon', lemma: 'x', forms: {} },
        ]);
        await expect(loadLexiconFile(pool, broken)).rejects.toThrow(/line 3: unknown partOfSpeech "Klingon"/);
        expect(await count('German')).toBe(before);
    });

    it('a database error rolls the whole load back', async () => {
        await loadLexiconFile(pool, FIXTURE);
        const before = await count('German');
        // The file check accepts any non-empty source; the source column is varchar(32), so the INSERT fails
        // after the DELETE has already run inside the transaction.
        const tooLong = writeFile('too-long.jsonl', [
            { ...header('German'), source: 'x'.repeat(33) },
            { partOfSpeech: 'Noun', lemma: 'Tisch', forms: { genderDE: 'der' } },
        ]);
        await expect(loadLexiconFile(pool, tooLong)).rejects.toThrow(/too long/);
        expect(await count('German')).toBe(before);
    });

    it('refuses a file with a wrong header', async () => {
        const noFormat = writeFile('no-format.jsonl', [{ language: 'German' }]);
        await expect(loadLexiconFile(pool, noFormat)).rejects.toThrow(/header format/);
        const unknownLanguage = writeFile('unknown.jsonl', [header('Klingon')]);
        await expect(loadLexiconFile(pool, unknownLanguage)).rejects.toThrow(/unknown language/);
    });
});

describe('loadLexiconFile with a translation file (Slice F)', () => {
    const TRANSLATIONS = path.join(__dirname, '../scripts/lexicon/fixtures/translations-en-fixture.jsonl');
    const translationHeader = { format: 'ladu-translations/1', language: 'English', source: 'test', licence: 'CC BY-SA 4.0', sourceVersion: '2026-01-01' };
    const row = (word, overrides = {}) => ({
        englishLemma: 'lake', partOfSpeech: 'Noun', entryOrder: 0, sense: 'body of water', senseOrder: 0,
        language: 'German', word, gender: 'der', tags: ['masculine'], ...overrides,
    });
    const countTranslations = async () => Number((await pool.query('SELECT count(*) FROM lexeme_translations')).rows[0].count);

    it('loads the committed fixture into lexeme_translations, with both search keys', async () => {
        const lines = fs.readFileSync(TRANSLATIONS, 'utf8').trim().split('\n').length - 1;
        expect(await loadLexiconFile(pool, TRANSLATIONS)).toEqual({ kind: 'translations', language: 'English', loaded: lines, skipped: false });
        expect(await countTranslations()).toBe(lines);

        const { rows } = await pool.query(
            `SELECT english_lemma, english_search_key, word, search_key, gender, tags, source, licence FROM lexeme_translations
             WHERE language = 'German' AND part_of_speech = 'Noun' AND search_key = 'see' ORDER BY english_lemma`,
        );
        expect(rows.map((r) => [r.english_lemma, r.gender])).toEqual([['lake', 'der'], ['sea', 'die']]);
        expect(rows[0]).toMatchObject({ english_search_key: 'lake', word: 'See', tags: ['masculine'], source: 'kaikki', licence: 'CC BY-SA 4.0' });
    });

    it('does not touch the lexemes table, and a lexicon load does not touch the translations', async () => {
        await loadLexiconFile(pool, FIXTURE);
        const lexemes = await count('German');
        await loadLexiconFile(pool, TRANSLATIONS);
        expect(await count('German')).toBe(lexemes);
        const translations = await countTranslations();
        await loadLexiconFile(pool, FIXTURE);
        expect(await countTranslations()).toBe(translations);
    });

    it('a second load replaces every translation; --if-empty skips a filled table', async () => {
        await loadLexiconFile(pool, TRANSLATIONS);
        const one = writeFile('tr-one.jsonl', [translationHeader, row('See')]);
        expect((await loadLexiconFile(pool, one, { ifEmpty: true })).skipped).toBe(true);
        await loadLexiconFile(pool, one);
        expect(await countTranslations()).toBe(1);
    });

    it('a bad row stops the load before anything changes', async () => {
        await loadLexiconFile(pool, TRANSLATIONS);
        const before = await countTranslations();
        const broken = writeFile('tr-broken.jsonl', [translationHeader, row('See'), row('See', { language: 'Klingon' })]);
        await expect(loadLexiconFile(pool, broken)).rejects.toThrow(/line 3: unknown target language "Klingon"/);
        const noTags = writeFile('tr-no-tags.jsonl', [translationHeader, row('See', { tags: 'masculine' })]);
        await expect(loadLexiconFile(pool, noTags)).rejects.toThrow(/line 2: tags must be an array of strings/);
        expect(await countTranslations()).toBe(before);
    });
});

describe('searchKey', () => {
    it('lowercases and trims, but keeps accents (año and ano stay different)', () => {
        expect(searchKey('  Haus ')).toBe('haus');
        expect(searchKey('ÄRGER')).toBe('ärger');
        expect(searchKey('año')).not.toBe(searchKey('ano'));
        // NFC: a decomposed "ä" (a + combining diaeresis) equals the composed one.
        expect(searchKey('ä')).toBe(searchKey('ä'));
    });
});
