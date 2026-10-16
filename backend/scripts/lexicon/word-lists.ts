/**
 * Writes simplified English word lists, one TSV file per part of speech, into the repo-root
 * `word-lists/en/` folder (git ignores it). They show which autocomplete words exist, with
 * metadata for a future onboarding feature (topics of interest → pre-filled words).
 *
 * Input: the newest .data/out/lexicon-en-<date>.jsonl.gz (ingest.ts), the kaikki raw dump and
 * Open English WordNet (download.ts).
 * Only lemmas with a frequency rank are kept (~37k). Columns:
 *
 *   lemma          the autocomplete lemma
 *   rank           FrequencyWords rank (1 = most common). It belongs to the spelling, not the
 *                  part of speech: noun and verb "dictionary" share one rank.
 *   page_topics    Wiktionary topical categories ("Fruits; Trees"). The dump puts them on the
 *                  page, so every English entry of the page has them: verb "apple" gets "Fruits".
 *   sense_domains  Sense-level domain labels ("Nautical; Computing"), from senses that are not
 *                  obsolete, archaic, rare, dated or dialectal (first 3 such senses per entry).
 *   supersenses    WordNet lexicographer files of the first 3 WordNet senses, distinct, in sense
 *                  order ("noun.food; noun.plant"). WordNet orders senses by corpus frequency, so
 *                  the first is usually, not always, the main meaning (bank: noun.object first).
 *                  Adjectives and adverbs only have adj.all / adj.pert / adj.ppl / adv.all.
 *
 *   cd backend && npx tsx scripts/lexicon/word-lists.ts
 */

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const zlib: typeof import('zlib') = require('zlib');
const { DATA_DIR, KAIKKI_RAW_FILE, POS_MAP, WORDNET_FILE, readLines }: typeof import('./common') = require('./common');

const OUT_DIR = path.join(__dirname, '..', '..', '..', 'word-lists', 'en');
const PARTS_OF_SPEECH = ['Noun', 'Verb', 'Adjective', 'Adverb'];
const SKIPPED_SENSE_TAGS = new Set(['obsolete', 'archaic', 'rare', 'dated', 'dialectal']);
const SENSES_PER_ENTRY = 3;
/** WordNet partOfSpeech → the app's value. "s" is a satellite adjective. */
const WORDNET_POS: Record<string, string> = { n: 'Noun', v: 'Verb', a: 'Adjective', s: 'Adjective', r: 'Adverb' };

interface WordRow { lemma: string; rank: number; pageTopics: Set<string>; senseDomains: Set<string>; supersenses: string[] }

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
        if (!row) rows.set(key, { lemma, rank: frequencyRank, pageTopics: new Set(), senseDomains: new Set(), supersenses: [] });
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

const xmlAttribute = (line: string, name: string): string | undefined =>
    line.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
        ?.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/**
 * WordNet-LMF XML has one element per line: entries (Lemma, then Senses in order) come first,
 * synsets (with their lexfile) after. Two lemma entries for one lemma and part of speech are merged.
 */
async function addSupersenses(rows: Map<string, WordRow>): Promise<void> {
    if (!fs.existsSync(WORDNET_FILE)) throw new Error(`${WORDNET_FILE} is missing — run download.ts first`);
    const synsetsOf = new Map<string, string[]>();
    const lexfileOf = new Map<string, string>();
    let current: string[] | undefined;
    for await (const line of readLines(fs.createReadStream(WORDNET_FILE).pipe(zlib.createGunzip()))) {
        if (line.includes('<Lemma ')) {
            const key = `${WORDNET_POS[xmlAttribute(line, 'partOfSpeech') ?? '']}|${xmlAttribute(line, 'writtenForm')}`;
            current = synsetsOf.get(key) ?? [];
            synsetsOf.set(key, current);
        } else if (line.includes('<Sense ') && current) {
            current.push(xmlAttribute(line, 'synset')!);
        } else if (line.includes('<Synset ')) {
            current = undefined;
            lexfileOf.set(xmlAttribute(line, 'id')!, xmlAttribute(line, 'lexfile')!);
        }
    }
    for (const [key, row] of rows) {
        // WordNet lowercases common words; the lexicon keeps Wiktionary's case ("Monday").
        const [pos] = key.split('|');
        const synsets = synsetsOf.get(key) ?? synsetsOf.get(`${pos}|${row.lemma.toLowerCase()}`) ?? [];
        row.supersenses = [...new Set(synsets.slice(0, SENSES_PER_ENTRY).map((id) => lexfileOf.get(id)!))];
    }
}

async function main(): Promise<void> {
    const lexiconFile = newestLexiconFile();
    console.log(`Reading ${path.basename(lexiconFile)}`);
    const rows = await readRankedLemmas(lexiconFile);
    await addTopics(rows);
    await addSupersenses(rows);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const join = (s: Set<string>): string => [...s].sort().join('; ');
    for (const pos of PARTS_OF_SPEECH) {
        const list = [...rows].filter(([key]) => key.startsWith(`${pos}|`)).map(([, row]) => row)
            .sort((a, b) => a.rank - b.rank || a.lemma.localeCompare(b.lemma));
        const lines = list.map((r) => [r.lemma, r.rank, join(r.pageTopics), join(r.senseDomains), r.supersenses.join('; ')].join('\t'));
        const file = path.join(OUT_DIR, `${pos.toLowerCase()}.tsv`);
        fs.writeFileSync(file, ['lemma\trank\tpage_topics\tsense_domains\tsupersenses', ...lines].join('\n') + '\n');
        const withTopics = list.filter((r) => r.pageTopics.size || r.senseDomains.size).length;
        const withSupersenses = list.filter((r) => r.supersenses.length).length;
        console.log(`${path.relative(process.cwd(), file)}: ${list.length} lemmas, ${withTopics} with topics, ${withSupersenses} with supersenses`);
    }
    fs.writeFileSync(path.join(OUT_DIR, '..', 'README.md'), [
        '# Word lists (generated, git-ignored)',
        '',
        `Made by \`backend/scripts/lexicon/word-lists.ts\` from \`${path.basename(lexiconFile)}\`, the kaikki raw dump and \`${path.basename(WORDNET_FILE)}\`.`,
        'See the top of that script for the columns. Run it again after each lexicon re-ingest.',
        '',
        'Derived from English Wiktionary (https://en.wiktionary.org) via kaikki.org / Wiktextract, CC BY-SA 4.0.',
        'Frequency ranks from FrequencyWords (github.com/hermitdave/FrequencyWords), CC BY-SA 4.0.',
        'Supersenses from Open English WordNet (github.com/globalwordnet/english-wordnet), CC BY 4.0, by the Open English',
        'Wordnet team, derived from Princeton WordNet (WordNet 3.0 Copyright 2006 by Princeton University, WordNet License).',
        '',
    ].join('\n'));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
