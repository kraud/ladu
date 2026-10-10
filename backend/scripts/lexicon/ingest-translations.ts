/**
 * Builds the versioned translation file (autocomplete-data-source-strategy.md Slice F, decision
 * D22) from the English Wiktionary entries: every `translations[]` item into Spanish, German or
 * Estonian, for nouns, verbs, adjectives and adverbs (lib/lexicon/translations.ts). Runs on a
 * developer machine only, after download.ts and extract.ts (which keep `translations` for English).
 *
 * `entryOrder` numbers the English entries per lemma and part of speech in source order
 * (0 = Wiktionary's first entry), counting entries with no translations too.
 *
 * Output (gzip JSONL, header format "ladu-translations/1", read by load.js):
 *   .data/out/translations-en-<sourceVersion>.jsonl.gz
 * With --fixture: the translations of a few fixed English words, committed for tests, CI and e2e:
 *   scripts/lexicon/fixtures/translations-en-fixture.jsonl
 *
 *   cd backend && npx tsx scripts/lexicon/ingest-translations.ts [--fixture]
 */

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const { DATA_DIR, MANIFEST_FILE, kaikkiFile, readLines, writeLexiconFile }: typeof import('./common') = require('./common');
const { TRANSLATION_POS, translationRows }: typeof import('../../lib/lexicon/translations') = require('../../lib/lexicon/translations');
type TranslationFileRow = import('../../lib/lexicon/translations').TranslationFileRow;

/**
 * The committed fixture. "lake"/"sea": German See (der) and See (die) come from different English
 * words; "run": the Estonian "search in English" verb (jooksma); "bank": several senses.
 */
const FIXTURE_WORDS = [
    'lake|noun', 'sea|noun', 'house|noun', 'bank|noun', 'dog|noun', 'water|noun',
    'run|verb', 'dance|verb', 'eat|verb', 'big|adj', 'quickly|adv',
];

const ATTRIBUTION = 'Derived from English Wiktionary (https://en.wiktionary.org) via kaikki.org / Wiktextract, CC BY-SA 4.0.';

function sourceVersion(): string {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
    const lastModified = Object.values<any>(manifest).find((m) => m.url.includes('kaikki'))?.lastModified;
    if (!lastModified) throw new Error('manifest.json has no kaikki entry — run download.ts first');
    return new Date(lastModified).toISOString().slice(0, 10);
}

async function main(): Promise<void> {
    const fixture = process.argv.includes('--fixture');
    const wanted = new Set(FIXTURE_WORDS);
    const version = sourceVersion();
    const rows: TranslationFileRow[] = [];
    const entriesPerLemma = new Map<string, number>();

    for await (const line of readLines(fs.createReadStream(kaikkiFile('en')))) {
        const entry = JSON.parse(line);
        if (!TRANSLATION_POS[entry.pos] || typeof entry.word !== 'string') continue;
        const lemmaKey = `${entry.word}|${entry.pos}`;
        const entryOrder = entriesPerLemma.get(lemmaKey) ?? 0;
        entriesPerLemma.set(lemmaKey, entryOrder + 1);
        if (fixture && !wanted.has(lemmaKey)) continue;
        rows.push(...translationRows(entry, entryOrder));
    }

    const file = fixture
        ? path.join(__dirname, 'fixtures', 'translations-en-fixture.jsonl')
        : path.join(DATA_DIR, 'out', `translations-en-${version}.jsonl.gz`);
    writeLexiconFile(
        file,
        { format: 'ladu-translations/1', language: 'English', source: 'kaikki', licence: 'CC BY-SA 4.0', sourceVersion: version, attribution: ATTRIBUTION },
        rows,
    );

    const count = (key: keyof TranslationFileRow) =>
        JSON.stringify(rows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [String(row[key])]: (acc[String(row[key])] ?? 0) + 1 }), {}));
    console.log(`English ${version}: ${rows.length} translations, by language ${count('language')}, by part of speech ${count('partOfSpeech')}`);
    console.log(`wrote ${file} (${fs.statSync(file).size} bytes)`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
