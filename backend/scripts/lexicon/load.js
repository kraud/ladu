/**
 * Loads one versioned lexicon file into the `lexemes` table of one database
 * (autocomplete-data-source-strategy.md Slice B1; decisions D11–D14), or one translation file
 * into the `lexeme_translations` table (Slice F, decision D22). The header's `format` says which.
 *
 * The file (written by ingest.ts, or a committed fixture) is JSONL, optionally gzipped:
 *   line 1  header  {"format":"ladu-lexicon/1","language":"German","source":"kaikki",
 *                    "licence":"CC BY-SA 4.0","sourceVersion":"2026-10-03","attribution":"…"}
 *   line 2+ lexeme  {"partOfSpeech":"Noun","lemma":"Haus","frequencyRank":118,"entryOrder":0,"forms":{"genderDE":"das",…}}
 *                   (entryOrder: 0 = the source's first entry for that lemma; optional, default 0)
 *
 * A translation file (written by ingest-translations.ts) has the same layout:
 *   line 1  header  {"format":"ladu-translations/1","language":"English",…}   (English: the hub)
 *   line 2+ row     {"englishLemma":"lake","partOfSpeech":"Noun","entryOrder":0,"sense":"body of water",
 *                    "senseOrder":0,"language":"German","word":"See","gender":"der","tags":["masculine"]}
 *
 * In ONE transaction it deletes every row of the file's language (a translation file: every
 * translation row) and inserts the file's rows, so a failure changes nothing, and a reader never
 * sees a half-loaded language. Other languages are not touched. `search_key` (and for translations
 * `english_search_key`) is computed here (lib/lexicon/searchKey.ts).
 *
 *   node scripts/lexicon/load.js <file>... [--if-empty]   (several files: one after the other)
 *     --if-empty  do nothing when the language already has rows (for test and e2e databases:
 *                 the committed fixture never replaces a full local load)
 *
 * On the VPS (decision D12, via Ansible):  docker exec backend-<env> node scripts/lexicon/load.js /tmp/<file>
 */

// Polyfill SlowBuffer for Node.js 24+ compatibility (as in purge.js)
const buffer = require('buffer');
if (!buffer.SlowBuffer) {
    buffer.SlowBuffer = buffer.Buffer;
}

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), override: true });
}

const FORMAT = 'ladu-lexicon/1';
const TRANSLATION_FORMAT = 'ladu-translations/1';
const LANGUAGES = ['English', 'Spanish', 'German', 'Estonian'];
const TRANSLATION_TARGETS = ['Spanish', 'German', 'Estonian'];
const PARTS_OF_SPEECH = ['Noun', 'Verb', 'Adjective', 'Adverb', 'Preposition', 'Conjunction', 'Pronoun', 'Interjection', 'Proper noun', 'Numerals'];
const BATCH = 1000;
const COLUMNS = ['language', 'part_of_speech', 'lemma', 'search_key', 'forms', 'frequency_rank', 'entry_order', 'source', 'licence', 'source_version'];
const TRANSLATION_COLUMNS = [
    'english_lemma', 'english_search_key', 'part_of_speech', 'entry_order', 'sense', 'sense_order',
    'language', 'word', 'search_key', 'gender', 'tags', 'source', 'licence', 'source_version',
];

/** Checks one translation row; throws naming the line. */
function checkTranslationRow(row, where) {
    if (!PARTS_OF_SPEECH.includes(row.partOfSpeech)) throw new Error(`${where}: unknown partOfSpeech "${row.partOfSpeech}"`);
    if (!TRANSLATION_TARGETS.includes(row.language)) throw new Error(`${where}: unknown target language "${row.language}"`);
    for (const key of ['englishLemma', 'word']) {
        if (typeof row[key] !== 'string' || row[key].trim() === '') throw new Error(`${where}: ${key} is missing`);
    }
    if (typeof row.sense !== 'string') throw new Error(`${where}: sense must be a string`);
    for (const key of ['entryOrder', 'senseOrder']) {
        if (!Number.isInteger(row[key])) throw new Error(`${where}: ${key} must be an integer`);
    }
    if (row.gender != null && typeof row.gender !== 'string') throw new Error(`${where}: gender must be a string or null`);
    if (!Array.isArray(row.tags) || row.tags.some((tag) => typeof tag !== 'string')) throw new Error(`${where}: tags must be an array of strings`);
}

/** Reads and validates the whole file. Throws on the first bad line, naming it. */
function readLexiconFile(file) {
    const raw = fs.readFileSync(file);
    const text = file.endsWith('.gz') ? zlib.gunzipSync(raw).toString('utf8') : raw.toString('utf8');
    const lines = text.split('\n').filter((line) => line.trim() !== '');
    if (lines.length === 0) throw new Error(`${file} is empty`);

    const header = JSON.parse(lines[0]);
    if (header.format !== FORMAT && header.format !== TRANSLATION_FORMAT) {
        throw new Error(`${file}: header format must be "${FORMAT}" or "${TRANSLATION_FORMAT}"`);
    }
    if (!LANGUAGES.includes(header.language)) throw new Error(`${file}: unknown language "${header.language}"`);
    for (const key of ['source', 'licence', 'sourceVersion']) {
        if (typeof header[key] !== 'string' || header[key] === '') throw new Error(`${file}: header needs "${key}"`);
    }

    const rows = lines.slice(1).map((line, i) => {
        const row = JSON.parse(line);
        const where = `${file} line ${i + 2}`;
        if (header.format === TRANSLATION_FORMAT) {
            checkTranslationRow(row, where);
            return row;
        }
        if (!PARTS_OF_SPEECH.includes(row.partOfSpeech)) throw new Error(`${where}: unknown partOfSpeech "${row.partOfSpeech}"`);
        if (typeof row.lemma !== 'string' || row.lemma.trim() === '') throw new Error(`${where}: lemma is missing`);
        const forms = row.forms;
        if (!forms || typeof forms !== 'object' || Object.values(forms).some((value) => typeof value !== 'string')) {
            throw new Error(`${where}: forms must be an object of strings`);
        }
        if (row.frequencyRank != null && !Number.isInteger(row.frequencyRank)) throw new Error(`${where}: frequencyRank must be an integer`);
        if (row.entryOrder != null && !Number.isInteger(row.entryOrder)) throw new Error(`${where}: entryOrder must be an integer`);
        return row;
    });
    return { header, rows };
}

/**
 * The table, the rows a load replaces, and each file row's column values, per file format.
 * @param {string} format
 * @param {object} header
 */
function target(format, header) {
    const { searchKey } = require('../../lib/lexicon/searchKey');
    if (format === TRANSLATION_FORMAT) {
        return {
            kind: 'translations',
            table: 'lexeme_translations',
            columns: TRANSLATION_COLUMNS,
            // A translation file holds every target language: it replaces the whole table.
            scope: { where: 'TRUE', params: [] },
            values: (row) => [
                row.englishLemma, searchKey(row.englishLemma), row.partOfSpeech, row.entryOrder, row.sense, row.senseOrder,
                row.language, row.word, searchKey(row.word), row.gender ?? null, JSON.stringify(row.tags),
                header.source, header.licence, header.sourceVersion,
            ],
        };
    }
    return {
        kind: 'lexemes',
        table: 'lexemes',
        columns: COLUMNS,
        scope: { where: 'language = $1', params: [header.language] },
        values: (row) => [
            header.language, row.partOfSpeech, row.lemma, searchKey(row.lemma), JSON.stringify(row.forms),
            row.frequencyRank ?? null, row.entryOrder ?? 0, header.source, header.licence, header.sourceVersion,
        ],
    };
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} file
 * @param {{ ifEmpty?: boolean }} [options]
 * @returns {Promise<{ kind: 'lexemes' | 'translations', language: string, loaded: number, skipped: boolean }>}
 */
async function loadLexiconFile(pool, file, options = {}) {
    // `target` requires searchKey there, not at the top: from the command line, tsx must be registered
    // first (see the bottom of this file); under Jest, ts-jest compiles it and `tsx/cjs` cannot be resolved.
    const { header, rows } = readLexiconFile(file);
    const { kind, table, columns, scope, values: rowValues } = target(header.format, header);
    const result = (loaded, skipped) => ({ kind, language: header.language, loaded, skipped });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (options.ifEmpty) {
            const { rows: existing } = await client.query(`SELECT 1 FROM ${table} WHERE ${scope.where} LIMIT 1`, scope.params);
            if (existing.length > 0) {
                await client.query('ROLLBACK');
                return result(0, true);
            }
        }
        await client.query(`DELETE FROM ${table} WHERE ${scope.where}`, scope.params);
        for (let start = 0; start < rows.length; start += BATCH) {
            const batch = rows.slice(start, start + BATCH);
            const values = [];
            const placeholders = batch.map((row, i) => {
                values.push(...rowValues(row));
                return `(${columns.map((_, c) => `$${i * columns.length + c + 1}`).join(', ')})`;
            });
            await client.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`, values);
        }
        await client.query('COMMIT');
        return result(rows.length, false);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { loadLexiconFile, readLexiconFile };

if (require.main === module) {
    // Lets this plain-JS script require the TypeScript modules (src/db, lib/lexicon), as purge.js does.
    require('tsx/cjs');
    const args = process.argv.slice(2);
    const files = args.filter((arg) => !arg.startsWith('--'));
    if (files.length === 0) {
        console.error('usage: node scripts/lexicon/load.js <file>... [--if-empty]');
        process.exit(1);
    }
    const { pool } = require('../../src/db');
    (async () => {
        // One file after the other; each is its own transaction. A failure stops before the next file.
        for (const file of files) {
            const { kind, language, loaded, skipped } = await loadLexiconFile(pool, path.resolve(file), { ifEmpty: args.includes('--if-empty') });
            const what = kind === 'translations' ? `${language} translations` : language;
            console.log(skipped ? `${what}: rows already present, nothing loaded (--if-empty)` : `${what}: loaded ${loaded} ${kind} from ${file}`);
        }
    })()
        .catch((error) => {
            console.error('Lexicon load failed; that file changed nothing:', error.message);
            process.exitCode = 1;
        })
        .finally(() => pool.end());
}
