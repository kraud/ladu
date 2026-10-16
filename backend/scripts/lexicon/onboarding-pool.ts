/**
 * Builds the onboarding pool (.context/plans/onboarding.md, Slice 2; decisions D9, D16, D17).
 * Input: the word lists (word-lists.ts → word-lists/en/<pos>.tsv), the newest translation file
 * (.data/out/translations-en-<date>.jsonl.gz) and the ES/DE/ET lexicon files (for a flag only).
 *
 * Per topic × level band: the 20 most frequent candidates (not restricted) that have a usable
 * translation; per band, the 100 most frequent "core" candidates (no topic; nouns and verbs need a
 * WordNet supersense, which removes junk such as "it" and "what"). For each candidate it takes the
 * first Wiktionary sense (entry, then sense order) that has a usable word in Spanish, German or
 * Estonian, and in each language the first usable word:
 *   - first pass: only grammar tags (masculine, plural…);
 *   - second pass: also regional tags (Spain, Austria…), flagged "<lang>:regional";
 *   - never: rare, dated, slang, vulgar, dialect… words.
 * Status is "keep" when there is no flag, else "check".
 *
 * Output: word-lists/pool-candidates.tsv (always), and the committed, hand-reviewed
 * scripts/onboarding/pool.tsv only when it does not exist yet, or with --force (it discards the review).
 *
 *   cd backend && npx tsx scripts/lexicon/onboarding-pool.ts [--force]
 */

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const zlib: typeof import('zlib') = require('zlib');
const { DATA_DIR, readLines }: typeof import('./common') = require('./common');
const { TOPICS, LEVEL_BANDS }: typeof import('./onboarding-topics') = require('./onboarding-topics');
const { POOL_FILE, POOL_COLUMNS, CORE_TOPIC }: typeof import('../../lib/onboardingPool') = require('../../lib/onboardingPool');

const WORD_LISTS_DIR = path.join(__dirname, '..', '..', '..', 'word-lists');
const PER_TOPIC_CELL = 20;
const PER_CORE_CELL = 100;
const LANGUAGES: [string, string][] = [['Spanish', 'es'], ['German', 'de'], ['Estonian', 'et']];
const GRAMMAR_TAGS = new Set([
    'masculine', 'feminine', 'neuter', 'common-gender', 'by-personal-gender', 'singular', 'plural',
    'reflexive', 'formal', 'informal', 'colloquial', 'noun', 'verb', 'adjective', 'adverb',
]);
const NEVER_TAGS = new Set([
    'rare', 'uncommon', 'dated', 'obsolete', 'archaic', 'historical', 'poetic', 'literary', 'humorous',
    'slang', 'vulgar', 'derogatory', 'pejorative', 'offensive', 'slur', 'ethnic', 'dialectal',
    'Alemannic-German', 'Bavaria', 'Rhine-Franconian', 'jargon', 'diminutive', 'prefix', 'idiomatic',
]);

interface Candidate {
    lemma: string; partOfSpeech: string; rank: number; topic: string; band: string;
    posOrder: number | null; givenName: boolean;
}
interface HubRow { entryOrder: number; senseOrder: number; sense: string; language: string; word: string; wordOrder: number; gender: string | null; tags: string[] }

const bandOf = (rank: number): string | null => LEVEL_BANDS.find((band) => rank <= band.maxRank)?.level ?? null;

function readCandidates(): Candidate[] {
    const candidates: Candidate[] = [];
    for (const partOfSpeech of ['Noun', 'Verb', 'Adjective', 'Adverb']) {
        const file = path.join(WORD_LISTS_DIR, 'en', `${partOfSpeech.toLowerCase()}.tsv`);
        if (!fs.existsSync(file)) throw new Error(`${file} is missing — run word-lists.ts first`);
        const [header, ...lines] = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
        const columns = header.split('\t');
        for (const line of lines) {
            const row = Object.fromEntries(line.split('\t').map((value, i) => [columns[i], value]));
            const rank = Number(row.rank);
            const band = bandOf(rank);
            if (!band || row.restricted === 'yes') continue;
            // Core nouns and verbs without a WordNet sense are mostly junk ("it", "what", "made").
            if (!row.topic && (partOfSpeech === 'Noun' || partOfSpeech === 'Verb') && !row.supersenses) continue;
            candidates.push({
                lemma: row.lemma, partOfSpeech, rank, topic: row.topic || CORE_TOPIC, band,
                posOrder: row.pos_order === '' ? null : Number(row.pos_order), givenName: row.given_name === 'yes',
            });
        }
    }
    return candidates.sort((a, b) => a.rank - b.rank || a.lemma.localeCompare(b.lemma));
}

function newestOut(pattern: RegExp): string {
    const dir = path.join(DATA_DIR, 'out');
    const files = fs.readdirSync(dir).filter((f) => pattern.test(f)).sort();
    if (!files.length) throw new Error(`no file matching ${pattern} in ${dir}`);
    return path.join(dir, files[files.length - 1]);
}

async function readJsonl(file: string, onRow: (row: any) => void): Promise<void> {
    let header = true;
    for await (const line of readLines(fs.createReadStream(file).pipe(zlib.createGunzip()))) {
        if (header) { header = false; continue; }
        if (line) onRow(JSON.parse(line));
    }
}

/** `${partOfSpeech}|${englishLemma}` → hub rows, for the candidates only. */
async function readHub(candidates: Candidate[]): Promise<Map<string, HubRow[]>> {
    const wanted = new Set(candidates.map((c) => `${c.partOfSpeech}|${c.lemma}`));
    const hub = new Map<string, HubRow[]>();
    await readJsonl(newestOut(/^translations-en-.*\.jsonl\.gz$/), (row) => {
        const key = `${row.partOfSpeech}|${row.englishLemma}`;
        if (!wanted.has(key)) return;
        if (!hub.has(key)) hub.set(key, []);
        hub.get(key)!.push(row);
    });
    return hub;
}

/** Language → `${partOfSpeech}|${lemma}` of the local lexicon (a missing word is only a flag). */
async function readLexicons(): Promise<Map<string, Set<string>>> {
    const lexicons = new Map<string, Set<string>>();
    for (const [language, code] of LANGUAGES) {
        const keys = new Set<string>();
        await readJsonl(newestOut(new RegExp(`^lexicon-${code}-.*\\.jsonl\\.gz$`)), (row) => keys.add(`${row.partOfSpeech}|${row.lemma}`));
        lexicons.set(language, keys);
    }
    return lexicons;
}

/** The first usable word of one language in one sense, and whether it needed a regional tag. */
function pickWord(rows: HubRow[]): { row: HubRow; regional: boolean } | null {
    const sorted = [...rows].sort((a, b) => a.wordOrder - b.wordOrder);
    const strict = sorted.find((row) => row.tags.every((tag) => GRAMMAR_TAGS.has(tag)));
    if (strict) return { row: strict, regional: false };
    const regional = sorted.find((row) => !row.tags.some((tag) => NEVER_TAGS.has(tag)));
    return regional ? { row: regional, regional: true } : null;
}

function poolLine(candidate: Candidate, rows: HubRow[], lexicons: Map<string, Set<string>>): string[] | null {
    const senses = new Map<string, HubRow[]>();
    for (const row of [...rows].sort((a, b) => a.entryOrder - b.entryOrder || a.senseOrder - b.senseOrder)) {
        const key = `${row.entryOrder}.${row.senseOrder}`;
        if (!senses.has(key)) senses.set(key, []);
        senses.get(key)!.push(row);
    }
    for (const [senseKey, senseRows] of senses) {
        const picks = new Map<string, { row: HubRow; regional: boolean }>();
        for (const [language] of LANGUAGES) {
            const pick = pickWord(senseRows.filter((row) => row.language === language));
            if (pick) picks.set(language, pick);
        }
        if (!picks.size) continue;

        const flags: string[] = [];
        if (senseKey !== '0.0') flags.push(`sense:${senseKey}`);
        if (candidate.posOrder) flags.push(`pos_order:${candidate.posOrder}`);
        if (candidate.givenName) flags.push('given_name');
        for (const [language, code] of LANGUAGES) {
            const pick = picks.get(language);
            if (pick?.regional) flags.push(`${code}:regional`);
            // Estonian words outside the local lexicon are filled online (Ekilex): no flag.
            if (pick && code !== 'et' && !lexicons.get(language)!.has(`${candidate.partOfSpeech}|${pick.row.word}`)) flags.push(`${code}:not_in_lexicon`);
        }
        const cell = (language: string, field: 'word' | 'gender'): string =>
            (field === 'word' ? picks.get(language)?.row.word : picks.get(language)?.row.gender) ?? '';
        return [
            flags.length ? 'check' : 'keep',
            `${candidate.partOfSpeech.toLowerCase()}:${candidate.lemma}`,
            candidate.topic, candidate.band, candidate.partOfSpeech, String(candidate.rank), candidate.lemma,
            cell('Spanish', 'word'), cell('Spanish', 'gender'), cell('German', 'word'), cell('German', 'gender'), cell('Estonian', 'word'),
            senseRows[0].sense.replace(/\s+/g, ' '), flags.join(' '),
        ];
    }
    return null;
}

async function main(): Promise<void> {
    const force = process.argv.includes('--force');
    const candidates = readCandidates();
    const [hub, lexicons] = await Promise.all([readHub(candidates), readLexicons()]);

    const lines: string[][] = [];
    const report: string[] = [];
    for (const topic of [...TOPICS.map((t) => t.id), CORE_TOPIC]) {
        const counts = LEVEL_BANDS.map(({ level }) => {
            const size = topic === CORE_TOPIC ? PER_CORE_CELL : PER_TOPIC_CELL;
            const cell: string[][] = [];
            for (const candidate of candidates) {
                if (cell.length >= size) break;
                if (candidate.topic !== topic || candidate.band !== level) continue;
                const line = poolLine(candidate, hub.get(`${candidate.partOfSpeech}|${candidate.lemma}`) ?? [], lexicons);
                if (line) cell.push(line);
            }
            lines.push(...cell);
            return `${level} ${cell.length}/${size} (${cell.filter((l) => l[0] === 'check').length} check)`;
        });
        report.push(`${topic.padEnd(17)} ${counts.join(', ')}`);
    }

    const text = [POOL_COLUMNS.join('\t'), ...lines.map((line) => line.join('\t'))].join('\n') + '\n';
    const candidatesFile = path.join(WORD_LISTS_DIR, 'pool-candidates.tsv');
    fs.writeFileSync(candidatesFile, text);
    console.log(report.join('\n'));
    console.log(`${lines.length} concepts → ${path.relative(process.cwd(), candidatesFile)}`);
    if (fs.existsSync(POOL_FILE) && !force) {
        console.log(`${path.relative(process.cwd(), POOL_FILE)} exists (reviewed): not changed. --force replaces it.`);
    } else {
        fs.mkdirSync(path.dirname(POOL_FILE), { recursive: true });
        fs.writeFileSync(POOL_FILE, text);
        console.log(`wrote ${path.relative(process.cwd(), POOL_FILE)}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
