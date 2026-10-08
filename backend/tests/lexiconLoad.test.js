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
        expect(result).toEqual({ language: 'German', loaded: lines, skipped: false });
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
        expect(await loadLexiconFile(pool, small, { ifEmpty: true })).toEqual({ language: 'German', loaded: 0, skipped: true });
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

describe('searchKey', () => {
    it('lowercases and trims, but keeps accents (año and ano stay different)', () => {
        expect(searchKey('  Haus ')).toBe('haus');
        expect(searchKey('ÄRGER')).toBe('ärger');
        expect(searchKey('año')).not.toBe(searchKey('ano'));
        // NFC: a decomposed "ä" (a + combining diaeresis) equals the composed one.
        expect(searchKey('ä')).toBe(searchKey('ä'));
    });
});
