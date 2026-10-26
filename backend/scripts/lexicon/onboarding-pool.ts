/**
 * Builds the onboarding pool (.context/plans/onboarding.md, Slice 2; decisions D9, D16, D17).
 * Input: the word lists (word-lists.ts → word-lists/en/<pos>.tsv), the newest translation file
 * (.data/out/translations-en-<date>.jsonl.gz) and the ES/DE/ET/FR lexicon files (for a flag only).
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
 * Explicit entry list (2026-10 refresh, Q7 of .context/onboarding-words-resolutions.md): with
 * `--entries <file>` the candidates are the lines of a TSV instead of the word lists, so a word that
 * has no word-list row (or a rank above the bands) can still be sourced. Columns:
 *
 *   lemma <TAB> pos <TAB> topics <TAB> band [<TAB> rank]
 *
 * `topics` is comma-separated (the first one is the primary topic; `core` is a topic), `band` is
 * beginner | intermediate | advanced (never derived from the rank), `rank` is optional (empty = 0).
 * The list is validated first (topics, band, part of speech, no repeated lemma + part of speech) and
 * the run stops on an error. Entries that are already in pool.tsv are listed and skipped: the reviewed
 * translations are never replaced, only new entries get a candidate line (the sense is the first one
 * with a usable word; edit `sense_key` / the words by hand when it is wrong). Each line is written to
 * word-lists/pool-candidates.tsv. An entry list never writes pool.tsv (not even with `--force`, which
 * would replace the reviewed file with only the new lines): review the new lines and copy them in.
 *
 * Adding French to the reviewed pool (French slice 11, one time): `--add-french` reads pool.tsv in its
 * old layout (no `fr`, `fr_gender`), looks up the hub sense with the concept's own `sense` label for French (the sense numbers differ between languages),
 * and writes the new layout over pool.tsv. A French word is kept only when it is a grammar-tag word (no
 * regional tag) and is in the French lexicon; else the cell stays empty and the concept is listed in
 * the report. A `manual` line gets the first sense with a French word. Nobody reviewed these words yet
 * (decision M1 of .context/plans/language-french.md: the teacher reads them later).
 *
 *   cd backend && npx tsx scripts/lexicon/onboarding-pool.ts [--force] [--entries <file>] [--add-french]
 */

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const zlib: typeof import('zlib') = require('zlib');
const { DATA_DIR, readLines }: typeof import('./common') = require('./common');
const { TOPICS, LEVEL_BANDS }: typeof import('./onboarding-topics') = require('./onboarding-topics');
const { POOL_FILE, POOL_COLUMNS, POOL_TOPICS, POOL_BANDS, POOL_PARTS_OF_SPEECH, CORE_TOPIC, readPool }: typeof import('../../lib/onboardingPool') = require('../../lib/onboardingPool');

const WORD_LISTS_DIR = path.join(__dirname, '..', '..', '..', 'word-lists');
const PER_TOPIC_CELL = 20;
const PER_CORE_CELL = 100;
const LANGUAGES: [string, string][] = [['Spanish', 'es'], ['German', 'de'], ['Estonian', 'et'], ['French', 'fr']];
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
    lemma: string; partOfSpeech: string; rank: number; topic: string; topics: string[]; band: string;
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
                lemma: row.lemma, partOfSpeech, rank, topic: row.topic || CORE_TOPIC, topics: [row.topic || CORE_TOPIC], band,
                posOrder: row.pos_order === '' ? null : Number(row.pos_order), givenName: row.given_name === 'yes',
            });
        }
    }
    return candidates.sort((a, b) => a.rank - b.rank || a.lemma.localeCompare(b.lemma));
}

/** Reads and validates an explicit entry list (see the header). Throws with every problem found. */
function readEntries(file: string): Candidate[] {
    const [header, ...lines] = fs.readFileSync(file, 'utf8').split('\n').filter((line) => line.trim() !== '');
    if (!header.startsWith('lemma\tpos\ttopics\tband')) throw new Error(`${file}: the header must start with lemma, pos, topics, band`);
    const errors: string[] = [];
    const seen = new Set<string>();
    const entries: Candidate[] = [];
    lines.forEach((line, index) => {
        const [lemma, pos, topicList, band, rank = ''] = line.split('\t').map((cell) => cell.trim());
        const where = `line ${index + 2} (${lemma})`;
        const topics = (topicList ?? '').split(',').map((topic) => topic.trim()).filter(Boolean);
        if (!lemma) errors.push(`${where}: empty lemma`);
        if (!POOL_PARTS_OF_SPEECH.includes(pos)) errors.push(`${where}: unknown part of speech "${pos}"`);
        if (!topics.length || topics.some((topic) => !POOL_TOPICS.includes(topic))) errors.push(`${where}: unknown topic in "${topicList}"`);
        if (new Set(topics).size !== topics.length) errors.push(`${where}: repeated topic in "${topicList}"`);
        if (!(POOL_BANDS as readonly string[]).includes(band)) errors.push(`${where}: unknown band "${band}"`);
        if (rank !== '' && !/^\d+$/.test(rank)) errors.push(`${where}: rank "${rank}" is not a number`);
        if (seen.has(`${pos}|${lemma}`)) errors.push(`${where}: repeated ${pos} ${lemma}`);
        seen.add(`${pos}|${lemma}`);
        entries.push({ lemma, partOfSpeech: pos, rank: Number(rank || 0), topic: topics[0], topics, band, posOrder: null, givenName: false });
    });
    if (errors.length) throw new Error(`${file}:\n  ${errors.join('\n  ')}`);
    return entries;
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
            candidate.topic, candidate.topics.join(','), candidate.band, candidate.partOfSpeech, String(candidate.rank), candidate.lemma,
            cell('Spanish', 'word'), cell('Spanish', 'gender'), cell('German', 'word'), cell('German', 'gender'), cell('Estonian', 'word'),
            cell('French', 'word'), cell('French', 'gender'),
            senseRows[0].sense.replace(/\s+/g, ' '), senseKey, flags.join(' '),
        ];
    }
    return null;
}

/** The one-time migration of the reviewed pool.tsv: adds the `fr` and `fr_gender` columns (see the header). */
async function addFrench(): Promise<void> {
    const oldHeader = POOL_COLUMNS.filter((column) => column !== 'fr' && column !== 'fr_gender');
    const [header, ...rows] = fs.readFileSync(POOL_FILE, 'utf8').split('\n').filter((line) => line.trim() !== '');
    if (header.split('\t').includes('fr')) throw new Error('pool.tsv already has the French columns');
    if (header !== oldHeader.join('\t')) throw new Error(`pool.tsv: unexpected header "${header}"`);
    const concepts = rows.map((row) => {
        const cells = row.split('\t');
        if (cells.length !== oldHeader.length) throw new Error(`pool.tsv: a line has ${cells.length} columns, expected ${oldHeader.length}: ${cells[1]}`);
        return Object.fromEntries(oldHeader.map((column, i) => [column, cells[i]])) as Record<string, string>;
    });
    const candidates: Candidate[] = concepts.map((c) => ({
        lemma: c.en, partOfSpeech: c.pos, rank: Number(c.rank), topic: c.topic, topics: [], band: c.band, posOrder: null, givenName: false,
    }));
    const [hub, lexicons] = await Promise.all([readHub(candidates), readLexicons()]);
    const french = lexicons.get('French')!;

    const filled: string[] = [];
    const empty: string[] = [];
    const out = concepts.map((concept) => {
        const rows = (hub.get(`${concept.pos}|${concept.en}`) ?? []).filter((row) => row.language === 'French');
        // The sense numbers are not shared between languages (the hub numbers the senses that have a word in
        // that language), so the sense is found by its label, as the reviewer read it in `sense`.
        const bySense = new Map<string, HubRow[]>();
        for (const row of rows) {
            const label = row.sense.replace(/\s+/g, ' ');
            if (!bySense.has(label)) bySense.set(label, []);
            bySense.get(label)!.push(row);
        }
        // A hand-typed concept ("manual") has no hub sense: it takes the first sense that has a word.
        const senses = concept.sense_key === 'manual' ? [...bySense.values()] : [bySense.get(concept.sense) ?? []];
        let word = '';
        let gender = '';
        for (const senseRows of senses) {
            const pick = pickWord(senseRows);
            if (!pick || pick.regional || !french.has(`${concept.pos}|${pick.row.word}`)) continue;
            word = pick.row.word;
            gender = concept.pos === 'Noun' ? pick.row.gender ?? '' : '';
            break;
        }
        (word ? filled : empty).push(concept.id);
        const cells = { ...concept, fr: word, fr_gender: gender };
        return POOL_COLUMNS.map((column) => (cells as Record<string, string>)[column]).join('\t');
    });
    fs.writeFileSync(POOL_FILE, [POOL_COLUMNS.join('\t'), ...out].join('\n') + '\n');
    console.log(`French words: ${filled.length} of ${concepts.length} concepts; ${empty.length} left empty (no hub word in the reviewed sense, a regional word, or not in the lexicon)`);
    console.log(`left empty: ${empty.join(' ')}`);
    console.log(`wrote ${path.relative(process.cwd(), POOL_FILE)}`);
}

async function main(): Promise<void> {
    if (process.argv.includes('--add-french')) return addFrench();
    const force = process.argv.includes('--force');
    const entriesAt = process.argv.indexOf('--entries');
    const entriesFile = entriesAt >= 0 ? process.argv[entriesAt + 1] : null;
    if (entriesAt >= 0 && !entriesFile) throw new Error('--entries needs a file');
    const explicit = entriesFile ? readEntries(path.resolve(entriesFile)) : null;
    const candidates = explicit ?? readCandidates();
    const [hub, lexicons] = await Promise.all([readHub(candidates), readLexicons()]);

    const lines: string[][] = [];
    const report: string[] = [];
    if (explicit) {
        // Entries already in the reviewed pool keep their reviewed words: only new ones get a line.
        const reviewed = new Set(fs.existsSync(POOL_FILE) ? readPool().map((concept) => concept.id) : []);
        const skipped: string[] = [];
        const noRow: string[] = [];
        for (const candidate of explicit) {
            const id = `${candidate.partOfSpeech.toLowerCase()}:${candidate.lemma}`;
            if (reviewed.has(id)) { skipped.push(id); continue; }
            const line = poolLine(candidate, hub.get(`${candidate.partOfSpeech}|${candidate.lemma}`) ?? [], lexicons);
            if (line) lines.push(line); else noRow.push(id);
        }
        report.push(`${explicit.length} entries: ${lines.length} new candidate lines, ${skipped.length} already in pool.tsv (kept as reviewed)`);
        if (noRow.length) report.push(`no usable translation row (check the hub spelling): ${noRow.join(' ')}`);
    } else for (const topic of [...TOPICS.map((t) => t.id), CORE_TOPIC]) {
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
    if (explicit) {
        // --force would replace the reviewed file with only the new lines, so an entry list never writes it.
        console.log(`${path.relative(process.cwd(), POOL_FILE)} not changed (an entry list only writes the candidates file: review the new lines, then copy them in).`);
    } else if (fs.existsSync(POOL_FILE) && !force) {
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
