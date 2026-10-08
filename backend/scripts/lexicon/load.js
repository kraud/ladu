/**
 * Loads one versioned lexicon file into the `lexemes` table of one database
 * (autocomplete-data-source-strategy.md Slice B1; decisions D11–D14).
 *
 * The file (written by ingest.ts, or a committed fixture) is JSONL, optionally gzipped:
 *   line 1  header  {"format":"ladu-lexicon/1","language":"German","source":"kaikki",
 *                    "licence":"CC BY-SA 4.0","sourceVersion":"2026-10-03","attribution":"…"}
 *   line 2+ lexeme  {"partOfSpeech":"Noun","lemma":"Haus","frequencyRank":118,"entryOrder":0,"forms":{"genderDE":"das",…}}
 *                   (entryOrder: 0 = the source's first entry for that lemma; optional, default 0)
 *
 * In ONE transaction it deletes every row of the file's language and inserts the file's rows,
 * so a failure changes nothing, and a reader never sees a half-loaded language. Other
 * languages are not touched. `search_key` is computed here (lib/lexicon/searchKey.ts).
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
const LANGUAGES = ['English', 'Spanish', 'German', 'Estonian'];
const PARTS_OF_SPEECH = ['Noun', 'Verb', 'Adjective', 'Adverb', 'Preposition', 'Conjunction', 'Pronoun', 'Interjection', 'Proper noun', 'Numerals'];
const BATCH = 1000;
const COLUMNS = ['language', 'part_of_speech', 'lemma', 'search_key', 'forms', 'frequency_rank', 'entry_order', 'source', 'licence', 'source_version'];

/** Reads and validates the whole file. Throws on the first bad line, naming it. */
function readLexiconFile(file) {
    const raw = fs.readFileSync(file);
    const text = file.endsWith('.gz') ? zlib.gunzipSync(raw).toString('utf8') : raw.toString('utf8');
    const lines = text.split('\n').filter((line) => line.trim() !== '');
    if (lines.length === 0) throw new Error(`${file} is empty`);

    const header = JSON.parse(lines[0]);
    if (header.format !== FORMAT) throw new Error(`${file}: header format must be "${FORMAT}"`);
    if (!LANGUAGES.includes(header.language)) throw new Error(`${file}: unknown language "${header.language}"`);
    for (const key of ['source', 'licence', 'sourceVersion']) {
        if (typeof header[key] !== 'string' || header[key] === '') throw new Error(`${file}: header needs "${key}"`);
    }

    const rows = lines.slice(1).map((line, i) => {
        const row = JSON.parse(line);
        const where = `${file} line ${i + 2}`;
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
 * @param {import('pg').Pool} pool
 * @param {string} file
 * @param {{ ifEmpty?: boolean }} [options]
 * @returns {Promise<{ language: string, loaded: number, skipped: boolean }>}
 */
async function loadLexiconFile(pool, file, options = {}) {
    // Required here, not at the top: from the command line, tsx must be registered first (see the bottom
    // of this file); under Jest, ts-jest compiles it and `tsx/cjs` cannot be resolved.
    const { searchKey } = require('../../lib/lexicon/searchKey');
    const { header, rows } = readLexiconFile(file);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (options.ifEmpty) {
            const { rows: existing } = await client.query('SELECT 1 FROM lexemes WHERE language = $1 LIMIT 1', [header.language]);
            if (existing.length > 0) {
                await client.query('ROLLBACK');
                return { language: header.language, loaded: 0, skipped: true };
            }
        }
        await client.query('DELETE FROM lexemes WHERE language = $1', [header.language]);
        for (let start = 0; start < rows.length; start += BATCH) {
            const batch = rows.slice(start, start + BATCH);
            const values = [];
            const placeholders = batch.map((row, i) => {
                values.push(
                    header.language, row.partOfSpeech, row.lemma, searchKey(row.lemma), JSON.stringify(row.forms),
                    row.frequencyRank ?? null, row.entryOrder ?? 0, header.source, header.licence, header.sourceVersion,
                );
                return `(${COLUMNS.map((_, c) => `$${i * COLUMNS.length + c + 1}`).join(', ')})`;
            });
            await client.query(`INSERT INTO lexemes (${COLUMNS.join(', ')}) VALUES ${placeholders.join(', ')}`, values);
        }
        await client.query('COMMIT');
        return { language: header.language, loaded: rows.length, skipped: false };
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
            const { language, loaded, skipped } = await loadLexiconFile(pool, path.resolve(file), { ifEmpty: args.includes('--if-empty') });
            console.log(skipped ? `${language}: rows already present, nothing loaded (--if-empty)` : `${language}: loaded ${loaded} lexemes from ${file}`);
        }
    })()
        .catch((error) => {
            console.error('Lexicon load failed; that file changed nothing:', error.message);
            process.exitCode = 1;
        })
        .finally(() => pool.end());
}
