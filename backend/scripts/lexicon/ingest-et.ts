/**
 * Builds the Estonian lexicon file from Eesthetic v1.0.5 (Zenodo 14069724, CC BY 4.0; about
 * 10,500 frequent nouns and verbs with every form labelled). Autocomplete Slice D2; run after
 * download.ts. Estonian is not in the kaikki ingest (ingest.ts): English Wiktionary has too
 * little Estonian (Slice 0 report §5).
 *
 * Cell → case map: the Ekilex codes the old transforms read (SgN …, IndPrSg1 …), here as
 * Eesthetic cell ids (estonian_cells.csv): nom.sg → singularNimetavEE, ind.prs.1sg →
 * kindelPresent1sEE, … The short form is the illative singular row tagged `aditive` (Ekilex
 * SgAdt). Several forms in one cell: the first listed (decision D19). Homonyms keep Eesthetic's
 * order (entryOrder, decision D15). Eesthetic has (almost) no adjectives: adjective lookups go
 * to Ekilex.
 *
 * Output: .data/out/lexicon-et-eesthetic-v1.0.5.jsonl.gz, or with --fixture the committed
 * scripts/lexicon/fixtures/lexicon-et-fixture.jsonl.
 *
 *   cd backend && npx tsx scripts/lexicon/ingest-et.ts [--fixture]
 */

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const { DATA_DIR, EESTHETIC_DIR, PIKHOF_FILE, writeLexiconFile }: typeof import('./common') = require('./common');
type LexiconFileRow = import('./common').LexiconFileRow;

const VERSION = 'v1.0.5';
const ATTRIBUTION =
    'Eesthetic: Estonian Paradigms in Phonemic Notation, v1.0.5 (https://doi.org/10.5281/zenodo.14069724), ' +
    'built from EKI Ekilex data, CC BY 4.0. Frequency ranks from the Estonian Wordlist Enriched with Ekilex ' +
    '(github.com/KristjanPikhof/Estonian-Wordlist-Enriched-Ekilex), CC BY-SA 4.0.';

/** [Eesthetic cell, required overabundance tag or null, app case names]. One cell can fill several cases. */
type CellMap = [cell: string, tag: string | null, caseNames: string[]][];
const PERSONS: [cell: string, slot: string][] = [['1sg', '1s'], ['2sg', '2s'], ['3sg', '3s'], ['1pl', '1pl'], ['2pl', '2pl'], ['3pl', '3pl']];
const NOUN_CELLS: CellMap = [
    ['nom.sg', null, ['singularNimetavEE']],
    ['nom.pl', null, ['pluralNimetavEE']],
    ['gen.sg', null, ['singularOmastavEE']],
    ['gen.pl', null, ['pluralOmastavEE']],
    ['part.sg', null, ['singularOsastavEE']],
    ['part.pl', null, ['pluralOsastavEE']],
    ['ill.sg', 'aditive', ['shortFormEE']],
];
const VERB_CELLS: CellMap = [
    ['sup', null, ['infinitiveMaEE']],
    ['inf', null, ['infinitiveDaEE']],
    ...PERSONS.map(([cell, slot]): CellMap[number] => [`ind.prs.${cell}`, null, [`kindelPresent${slot}EE`]]),
    ...PERSONS.map(([cell, slot]): CellMap[number] => [`ind.pst.ipfv.${cell}`, null, [`kindelSimplePast${slot}EE`]]),
    // Past perfect: the same participle for all six persons (the form shows the auxiliary).
    ['ptcp.pst.pers', null, PERSONS.map(([, slot]) => `kindelPastPerfect${slot}EE`)],
];
const POS: Record<string, { partOfSpeech: string; cells: CellMap; lemmaCase: string }> = {
    noun: { partOfSpeech: 'Noun', cells: NOUN_CELLS, lemmaCase: 'singularNimetavEE' },
    verb: { partOfSpeech: 'Verb', cells: VERB_CELLS, lemmaCase: 'infinitiveMaEE' },
};

/** Words the tests use, plus common ones. "õun" is NOT here: the e2e spec uses it for the Ekilex fallback. */
const FIXTURE_WORDS = [
    'maja|noun', 'raamat|noun', 'inimene|noun', 'laps|noun', 'aasta|noun', 'keel|noun', 'tuba|noun', 'sõna|noun',
    'jooksma|verb', 'tegema|verb', 'olema|verb', 'minema|verb', 'tulema|verb', 'nägema|verb', 'sööma|verb', 'tantsima|verb',
];

function csvRows(file: string): string[][] {
    // Eesthetic's CSVs have no quoted commas in the columns we read.
    return fs.readFileSync(path.join(EESTHETIC_DIR, file), 'utf8').split('\n').slice(1).filter(Boolean).map((line) => line.split(','));
}

function frequencyRanks(): Map<string, number> {
    const ranks = new Map<string, number>();
    for (const line of fs.readFileSync(PIKHOF_FILE, 'utf8').split('\n').slice(1)) {
        const [word, rank] = line.split('\t');
        if (word && Number(rank) > 0 && !ranks.has(word)) ranks.set(word, Number(rank));
    }
    return ranks;
}

function main(): void {
    const fixture = process.argv.includes('--fixture');
    const ranks = frequencyRanks();

    /** lexeme id → cell → forms in file order, with their overabundance tag. */
    const cells = new Map<string, Map<string, { form: string; tag: string }[]>>();
    for (const [, lexeme, cell, , , orth, , overabundance] of csvRows('estonian_paradigms.csv')) {
        if (!lexeme || !orth) continue;
        const byCell = cells.get(lexeme) ?? cells.set(lexeme, new Map()).get(lexeme)!;
        (byCell.get(cell) ?? byCell.set(cell, []).get(cell)!).push({ form: orth, tag: overabundance ?? '' });
    }

    const rows: LexiconFileRow[] = [];
    const entriesPerLemma = new Map<string, number>();
    let skipped = 0;
    for (const [id, lemma, , , pos] of csvRows('estonian_lexemes.csv')) {
        const config = POS[pos];
        if (!config) continue;
        const byCell = cells.get(id) ?? new Map();
        const forms: Record<string, string> = {};
        for (const [cell, tag, caseNames] of config.cells) {
            const first = (byCell.get(cell) ?? []).find((f: { tag: string }) => tag === null || f.tag === tag)?.form;
            if (first) for (const caseName of caseNames) forms[caseName] = first;
        }
        // Keep only entries that fill more than the lemma itself.
        if (!Object.keys(forms).some((caseName) => caseName !== config.lemmaCase)) {
            skipped++;
            continue;
        }
        const key = `${config.partOfSpeech}|${lemma}`;
        const entryOrder = entriesPerLemma.get(key) ?? 0;
        entriesPerLemma.set(key, entryOrder + 1);
        rows.push({ partOfSpeech: config.partOfSpeech, lemma, frequencyRank: ranks.get(lemma) ?? null, entryOrder, forms });
    }

    const wanted = new Set(FIXTURE_WORDS.map((pair) => {
        const [word, pos] = pair.split('|');
        return `${POS[pos].partOfSpeech}|${word}`;
    }));
    const output = fixture ? rows.filter((row) => wanted.has(`${row.partOfSpeech}|${row.lemma}`)) : rows;
    const file = fixture
        ? path.join(__dirname, 'fixtures', 'lexicon-et-fixture.jsonl')
        : path.join(DATA_DIR, 'out', `lexicon-et-eesthetic-${VERSION}.jsonl.gz`);
    writeLexiconFile(file, { language: 'Estonian', source: 'eesthetic', licence: 'CC BY 4.0', sourceVersion: VERSION, attribution: ATTRIBUTION }, output);

    const byPos = output.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.partOfSpeech]: (acc[row.partOfSpeech] ?? 0) + 1 }), {});
    console.log(`Estonian ${VERSION}: ${output.length} lexemes ${JSON.stringify(byPos)}, ${skipped} skipped (nothing beyond the lemma)`);
    console.log(`wrote ${file} (${fs.statSync(file).size} bytes)`);
}

main();
