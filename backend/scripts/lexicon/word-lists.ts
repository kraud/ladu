/**
 * Writes simplified English word lists, one TSV file per part of speech, into the repo-root
 * `word-lists/en/` folder (git ignores it). They show which autocomplete words exist, with
 * metadata for a future onboarding feature (topics of interest → pre-filled words).
 *
 * Input: the newest .data/out/lexicon-en-<date>.jsonl.gz (ingest.ts) and the kaikki raw dump.
 * Only lemmas with a frequency rank are kept (~37k). Columns:
 *
 *   lemma          the autocomplete lemma
 *   rank           FrequencyWords rank (1 = most common). It belongs to the spelling, not the
 *                  part of speech: noun and verb "dictionary" share one rank.
 *   page_topics    Wiktionary topical categories ("Fruits; Trees"). The dump puts them on the
 *                  page, so every English entry of the page has them: verb "apple" gets "Fruits".
 *   sense_domains  Sense-level domain labels ("Nautical; Computing"), from senses that are not
 *                  obsolete, archaic, rare, dated or dialectal (first 3 such senses per entry).
 *
 *   cd backend && npx tsx scripts/lexicon/word-lists.ts
 */

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const zlib: typeof import('zlib') = require('zlib');
const { DATA_DIR, KAIKKI_RAW_FILE, POS_MAP, readLines }: typeof import('./common') = require('./common');

const OUT_DIR = path.join(__dirname, '..', '..', '..', 'word-lists', 'en');
const PARTS_OF_SPEECH = ['Noun', 'Verb', 'Adjective', 'Adverb'];
const SKIPPED_SENSE_TAGS = new Set(['obsolete', 'archaic', 'rare', 'dated', 'dialectal']);
const SENSES_PER_ENTRY = 3;

interface WordRow { lemma: string; rank: number; pageTopics: Set<string>; senseDomains: Set<string> }

const topicsOf = (categories: unknown): string[] =>
    Array.isArray(categories)
        ? categories.filter((c): c is string => typeof c === 'string' && c.startsWith('en:')).map((c) => c.slice(3))
        : [];

function newestLexiconFile(): string {
    const outDir = path.join(DATA_DIR, 'out');
    const files = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => /^lexicon-en-.*\.jsonl\.gz$/.test(f)).sort() : [];
    if (!files.length) throw new Error(`no lexicon-en-*.jsonl.gz in ${outDir} — run ingest.ts en first`);
    return path.join(outDir, files[files.length - 1]);
}

async function readRankedLemmas(file: string): Promise<Map<string, WordRow>> {
    const rows = new Map<string, WordRow>();
    let header = true;
    for await (const line of readLines(fs.createReadStream(file).pipe(zlib.createGunzip()))) {
        if (header) { header = false; continue; }
        if (!line) continue;
        const { partOfSpeech, lemma, frequencyRank } = JSON.parse(line);
        if (frequencyRank == null || !PARTS_OF_SPEECH.includes(partOfSpeech)) continue;
        const key = `${partOfSpeech}|${lemma}`;
        const row = rows.get(key);
        if (!row) rows.set(key, { lemma, rank: frequencyRank, pageTopics: new Set(), senseDomains: new Set() });
        else row.rank = Math.min(row.rank, frequencyRank);
    }
    return rows;
}

async function addTopics(rows: Map<string, WordRow>): Promise<void> {
    if (!fs.existsSync(KAIKKI_RAW_FILE)) throw new Error(`${KAIKKI_RAW_FILE} is missing — run download.ts first`);
    let read = 0;
    for await (const line of readLines(fs.createReadStream(KAIKKI_RAW_FILE).pipe(zlib.createGunzip()))) {
        if (++read % 1_000_000 === 0) console.log(`${read / 1_000_000}M lines read`);
        if (!line.includes('"lang_code": "en"')) continue;
        const entry = JSON.parse(line);
        // Translations also carry lang_code "en"; only the top-level value marks an English entry.
        if (entry.lang_code !== 'en') continue;
        const row = rows.get(`${POS_MAP[entry.pos]}|${entry.word}`);
        if (!row) continue;

        topicsOf(entry.categories).forEach((t) => row.pageTopics.add(t));
        const senses = (entry.senses ?? []).filter((s: any) => !(s.tags ?? []).some((t: string) => SKIPPED_SENSE_TAGS.has(t)));
        for (const sense of senses.slice(0, SENSES_PER_ENTRY)) topicsOf(sense.categories).forEach((t) => row.senseDomains.add(t));
    }
    // A sense domain is also a page category; keep it in one column only.
    for (const row of rows.values()) row.senseDomains.forEach((t) => row.pageTopics.delete(t));
}

async function main(): Promise<void> {
    const lexiconFile = newestLexiconFile();
    console.log(`Reading ${path.basename(lexiconFile)}`);
    const rows = await readRankedLemmas(lexiconFile);
    await addTopics(rows);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const join = (s: Set<string>): string => [...s].sort().join('; ');
    for (const pos of PARTS_OF_SPEECH) {
        const list = [...rows].filter(([key]) => key.startsWith(`${pos}|`)).map(([, row]) => row)
            .sort((a, b) => a.rank - b.rank || a.lemma.localeCompare(b.lemma));
        const lines = list.map((r) => [r.lemma, r.rank, join(r.pageTopics), join(r.senseDomains)].join('\t'));
        const file = path.join(OUT_DIR, `${pos.toLowerCase()}.tsv`);
        fs.writeFileSync(file, ['lemma\trank\tpage_topics\tsense_domains', ...lines].join('\n') + '\n');
        const withTopics = list.filter((r) => r.pageTopics.size || r.senseDomains.size).length;
        console.log(`${path.relative(process.cwd(), file)}: ${list.length} lemmas, ${withTopics} with topics`);
    }
    fs.writeFileSync(path.join(OUT_DIR, '..', 'README.md'), [
        '# Word lists (generated, git-ignored)',
        '',
        `Made by \`backend/scripts/lexicon/word-lists.ts\` from \`${path.basename(lexiconFile)}\` and the kaikki raw dump.`,
        'See the top of that script for the columns. Run it again after each lexicon re-ingest.',
        '',
        'Derived from English Wiktionary (https://en.wiktionary.org) via kaikki.org / Wiktextract, CC BY-SA 4.0.',
        'Frequency ranks from FrequencyWords (github.com/hermitdave/FrequencyWords), CC BY-SA 4.0.',
        '',
    ].join('\n'));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
