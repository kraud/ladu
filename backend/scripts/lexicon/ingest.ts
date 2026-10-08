/**
 * Builds the versioned lexicon file for one language (autocomplete-data-source-strategy.md
 * Slice B1; decisions D11–D14). Runs on a developer machine only, after download.ts,
 * extract.ts and sample.ts.
 *
 * For every lemma entry (not a pure form_of entry) of a supported part of speech, it applies
 * that language's selector table (lib/lexicon/selectors/) and writes one line with every case
 * value. An entry whose cases add nothing beyond its own lemma is skipped (a noun with no
 * gender and no table). Identical rows (same part of speech, lemma and forms) are written once;
 * homographs with different forms stay separate rows. The frequency rank comes from
 * sample-<lang>.json.
 *
 * Output (gzip JSONL, the format load.js reads): .data/out/lexicon-<lang>-<sourceVersion>.jsonl.gz
 * With --fixture: a small plain-JSONL file of fixed words, committed for tests, CI and e2e:
 * scripts/lexicon/fixtures/lexicon-<lang>-fixture.jsonl
 *
 *   cd backend && npx tsx scripts/lexicon/ingest.ts de [--fixture]
 */

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const zlib: typeof import('zlib') = require('zlib');
const { DATA_DIR, MANIFEST_FILE, POS_MAP, kaikkiFile, sampleFile, readLines }: typeof import('./common') = require('./common');
const { selectCases }: typeof import('../../lib/lexicon/select') = require('../../lib/lexicon/select');
const de: typeof import('../../lib/lexicon/selectors/de') = require('../../lib/lexicon/selectors/de');
const es: typeof import('../../lib/lexicon/selectors/es') = require('../../lib/lexicon/selectors/es');
type LangCode = import('./common').LangCode;
type CaseSelector = import('../../lib/lexicon/select').CaseSelector;

/** Languages the ingest supports so far. English joins in Slice C2. */
const LANGUAGES: Partial<Record<LangCode, { language: string; selectors: Record<string, CaseSelector[]> }>> = {
    de: { language: 'German', selectors: { noun: de.NOUN_SELECTORS_DE, verb: de.VERB_SELECTORS_DE } },
    es: { language: 'Spanish', selectors: { noun: es.NOUN_SELECTORS_ES, verb: es.VERB_SELECTORS_ES } },
};

/**
 * The committed fixture: the words the tests use, common nouns, and the 20 most frequent verbs.
 * Nouns are listed by hand: the frequency list's top "nouns" are homograph noise ("Ich", "Wenn").
 * "See" is a homograph (der See / die See); "Polizei" is a noun today's library cannot decline.
 */
const FIXTURE_WORDS: Partial<Record<LangCode, string[]>> = {
    de: [
        'Haus|noun', 'Junge|noun', 'See|noun', 'Polizei|noun', 'Mann|noun', 'Frau|noun', 'Kind|noun', 'Tag|noun',
        'Zeit|noun', 'Auto|noun', 'Stadt|noun', 'Hund|noun', 'Katze|noun', 'Wasser|noun', 'Buch|noun', 'Schule|noun',
        'tanzen|verb', 'gehen|verb', 'anrufen|verb', 'sichern|verb', 'sammeln|verb', 'sputen|verb',
    ],
    // "leche"/"crisis": genders the old library got wrong; "estudiante": both genders (el/la);
    // "sentir"/"venir"/"oír": verbs the old library conjugated wrongly; "quejarse": reflexive (D8).
    es: [
        'casa|noun', 'estudiante|noun', 'leche|noun', 'crisis|noun', 'mano|noun', 'día|noun', 'agua|noun',
        'hombre|noun', 'mujer|noun', 'libro|noun', 'perro|noun', 'ciudad|noun', 'tiempo|noun', 'problema|noun',
        'bailar|verb', 'tener|verb', 'ir|verb', 'sentir|verb', 'venir|verb', 'oír|verb', 'pensar|verb', 'quejarse|verb',
    ],
};
const FIXTURE_TOP_N = 20;
const MAX_LEMMA_LENGTH = 100; // the dictionary route refuses longer queries

const ATTRIBUTION =
    'Derived from English Wiktionary (https://en.wiktionary.org) via kaikki.org / Wiktextract, CC BY-SA 4.0. ' +
    'Frequency ranks from FrequencyWords (github.com/hermitdave/FrequencyWords), CC BY-SA 4.0.';

interface LexiconRow {
    partOfSpeech: string;
    lemma: string;
    frequencyRank: number | null;
    /** 0, 1, … in source order among the written rows of the same part of speech and lemma (decision D15). */
    entryOrder: number;
    forms: Record<string, string>;
}

function sourceVersion(): string {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
    const lastModified = Object.values<any>(manifest).find((m) => m.url.includes('kaikki'))?.lastModified;
    if (!lastModified) throw new Error('manifest.json has no kaikki entry — run download.ts first');
    return new Date(lastModified).toISOString().slice(0, 10);
}

/** "Noun|Haus" → rank, from sample.ts. */
function frequencyRanks(lang: LangCode): Map<string, number> {
    const ranks = new Map<string, number>();
    if (!fs.existsSync(sampleFile(lang))) return ranks;
    const sample = JSON.parse(fs.readFileSync(sampleFile(lang), 'utf8'));
    for (const [pos, list] of Object.entries<{ lemma: string; rank: number }[]>(sample.byPos)) {
        for (const { lemma, rank } of list) ranks.set(`${pos}|${lemma}`, rank);
    }
    return ranks;
}

async function main(): Promise<void> {
    const lang = process.argv[2] as LangCode;
    const fixture = process.argv.includes('--fixture');
    const config = LANGUAGES[lang];
    if (!config) throw new Error(`usage: ingest.ts <${Object.keys(LANGUAGES).join('|')}> [--fixture]`);

    const version = sourceVersion();
    const ranks = frequencyRanks(lang);
    const rows: LexiconRow[] = [];
    const seen = new Set<string>();
    const entriesPerLemma = new Map<string, number>();
    let skippedEmpty = 0;

    for await (const line of readLines(fs.createReadStream(kaikkiFile(lang)))) {
        const entry = JSON.parse(line);
        const selectors = config.selectors[entry.pos];
        if (!selectors || !entry.word || entry.word.length > MAX_LEMMA_LENGTH) continue;
        if (!(entry.senses ?? []).some((sense: any) => !sense.form_of)) continue;

        const forms = Object.fromEntries(selectCases(entry, selectors));
        if (!Object.values(forms).some((value) => value !== entry.word)) {
            skippedEmpty++;
            continue;
        }
        const partOfSpeech = POS_MAP[entry.pos];
        const key = `${partOfSpeech}|${entry.word}|${JSON.stringify(forms)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const lemmaKey = `${partOfSpeech}|${entry.word}`;
        const entryOrder = entriesPerLemma.get(lemmaKey) ?? 0;
        entriesPerLemma.set(lemmaKey, entryOrder + 1);
        rows.push({ partOfSpeech, lemma: entry.word, frequencyRank: ranks.get(lemmaKey) ?? null, entryOrder, forms });
    }

    let output = rows;
    if (fixture) {
        const wanted = new Set((FIXTURE_WORDS[lang] ?? []).map((pair) => {
            const [word, pos] = pair.split('|');
            return `${POS_MAP[pos]}|${word}`;
        }));
        rows.filter((row) => row.partOfSpeech === 'Verb' && row.frequencyRank !== null)
            .sort((a, b) => a.frequencyRank! - b.frequencyRank!)
            .slice(0, FIXTURE_TOP_N)
            .forEach((row) => wanted.add(`${row.partOfSpeech}|${row.lemma}`));
        output = rows.filter((row) => wanted.has(`${row.partOfSpeech}|${row.lemma}`));
    }

    const header = { format: 'ladu-lexicon/1', language: config.language, source: 'kaikki', licence: 'CC BY-SA 4.0', sourceVersion: version, attribution: ATTRIBUTION };
    const text = [header, ...output].map((value) => JSON.stringify(value)).join('\n') + '\n';
    const file = fixture
        ? path.join(__dirname, 'fixtures', `lexicon-${lang}-fixture.jsonl`)
        : path.join(DATA_DIR, 'out', `lexicon-${lang}-${version}.jsonl.gz`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, fixture ? text : zlib.gzipSync(text));

    const byPos = output.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.partOfSpeech]: (acc[row.partOfSpeech] ?? 0) + 1 }), {});
    console.log(`${config.language} ${version}: ${output.length} lexemes ${JSON.stringify(byPos)}, ${skippedEmpty} entries skipped (nothing beyond the lemma)`);
    console.log(`wrote ${file} (${fs.statSync(file).size} bytes)`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
