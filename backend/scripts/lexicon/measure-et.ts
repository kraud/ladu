/**
 * Slice 0 step 0e: Estonian coverage of the keyless local sources.
 *
 * Sample: Pikhof word list (Ekilex base words) with an OpenSubtitles frequency rank, per part
 * of speech (s = noun, v = verb, adj/adjg = adjective), top N each.
 * For each sampled lemma:
 * - Eesthetic: does it have the lexeme, and which of our case fields does it fill? The cell →
 *   case map mirrors today's frontend transforms (features/autocomplete/transforms.ts), which
 *   read the same Ekilex codes from api.sonapi.ee;
 * - kaikki (et): does it have a lemma entry with any forms?
 * Today's api.sonapi.ee is NOT called (third-party community service).
 *
 * Writes .data/measure-et.md.
 *
 *   cd backend && npx tsx scripts/lexicon/measure-et.ts [topN=5000]
 */

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const { DATA_DIR, EESTHETIC_DIR, PIKHOF_FILE, kaikkiFile, readLines }: typeof import('./common') = require('./common');

const TOP_N = Number(process.argv[2]) || 5000;

/** Eesthetic cell (+ required overabundance tag) → app case names. One cell can fill several cases. */
const NOUN_CELLS: [string, string | null, string[]][] = [
    ['nom.sg', null, ['singularNimetavEE']],
    ['nom.pl', null, ['pluralNimetavEE']],
    ['gen.sg', null, ['singularOmastavEE']],
    ['gen.pl', null, ['pluralOmastavEE']],
    ['part.sg', null, ['singularOsastavEE']],
    ['part.pl', null, ['pluralOsastavEE']],
    ['ill.sg', 'aditive', ['shortFormEE']],
];
const VERB_CELLS: [string, string | null, string[]][] = [
    ['sup', null, ['infinitiveMaEE']],
    ['inf', null, ['infinitiveDaEE']],
    ...['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'].flatMap((p): [string, string | null, string[]][] => {
        const slot = p.replace('sg', 's');
        return [
            [`ind.prs.${p}`, null, [`kindelPresent${slot}EE`]],
            [`ind.pst.ipfv.${p}`, null, [`kindelSimplePast${slot}EE`]],
        ];
    }),
    // Today's transform copies the past participle into all six past-perfect cells.
    ['ptcp.pst.pers', null, ['1s', '2s', '3s', '1pl', '2pl', '3pl'].map((s) => `kindelPastPerfect${s}EE`)],
];
const POS_CODES: Record<string, string> = { s: 'Noun', v: 'Verb', adj: 'Adjective', adjg: 'Adjective' };

interface Lexeme { id: string; pos: string; homonym: number }

function parseCsvLine(line: string): string[] {
    // Eesthetic CSVs have no quoted commas in the columns we read.
    return line.split(',');
}

function loadPikhofSample(): Record<string, { lemma: string; rank: number }[]> {
    const byPos: Record<string, { lemma: string; rank: number }[]> = {};
    for (const line of fs.readFileSync(PIKHOF_FILE, 'utf8').split('\n').slice(1)) {
        const [word, rank, , pos] = line.split('\t');
        if (!word || !(Number(rank) > 0)) continue;
        const appPos = new Set((pos ?? '').split(',').map((code) => POS_CODES[code]).filter(Boolean));
        for (const p of appPos) (byPos[p] ??= []).push({ lemma: word, rank: Number(rank) });
    }
    for (const list of Object.values(byPos)) list.sort((a, b) => a.rank - b.rank);
    return byPos;
}

function loadEesthetic() {
    const lexemes = new Map<string, Lexeme[]>();
    for (const line of fs.readFileSync(path.join(EESTHETIC_DIR, 'estonian_lexemes.csv'), 'utf8').split('\n').slice(1)) {
        const [id, lemma, , , pos, , homonym] = parseCsvLine(line);
        if (!id) continue;
        (lexemes.get(lemma) ?? lexemes.set(lemma, []).get(lemma)!).push({ id, pos, homonym: Number(homonym) });
    }
    /** lexeme id → cell → forms (with their overabundance tag), in file order. */
    const cells = new Map<string, Map<string, { form: string; tag: string }[]>>();
    let overabundantCells = 0;
    for (const line of fs.readFileSync(path.join(EESTHETIC_DIR, 'estonian_paradigms.csv'), 'utf8').split('\n').slice(1)) {
        const [, lexeme, cell, , , orth, , overabundance] = parseCsvLine(line);
        if (!lexeme || !orth) continue;
        const byCell = cells.get(lexeme) ?? cells.set(lexeme, new Map()).get(lexeme)!;
        const list = byCell.get(cell) ?? byCell.set(cell, []).get(cell)!;
        if (list.length === 1) overabundantCells++;
        list.push({ form: orth, tag: overabundance });
    }
    return { lexemes, cells, overabundantCells };
}

async function loadKaikkiEt(): Promise<Map<string, number>> {
    /** "pos|word" → number of usable form rows, for lemma entries. */
    const result = new Map<string, number>();
    for await (const line of readLines(fs.createReadStream(kaikkiFile('et')))) {
        const entry = JSON.parse(line);
        if (!(entry.senses ?? []).some((sense: any) => !sense.form_of)) continue;
        const forms = (entry.forms ?? []).filter((row: any) => row.form && row.form !== '-' && !(row.tags ?? []).includes('table-tags')).length;
        const key = `${entry.pos}|${entry.word}`;
        result.set(key, Math.max(result.get(key) ?? 0, forms));
    }
    return result;
}

const pct = (part: number, whole: number) => (whole === 0 ? '—' : `${((100 * part) / whole).toFixed(1)}%`);

async function main(): Promise<void> {
    const sample = loadPikhofSample();
    const { lexemes, cells, overabundantCells } = loadEesthetic();
    const kaikki = await loadKaikkiEt();
    const KAIKKI_POS: Record<string, string> = { Noun: 'noun', Verb: 'verb', Adjective: 'adj' };

    const lines = [`# Slice 0 Estonian measurement (generated ${new Date().toISOString()})`, ''];
    lines.push(`Sample: Pikhof base words with a frequency rank, top ${TOP_N} per part of speech. Eesthetic v1.0.5 has ${[...lexemes.values()].flat().length} lexemes; ${overabundantCells} cells have more than one form.`, '');
    lines.push('| part of speech | sampled | in Eesthetic (any POS) | in Eesthetic (same POS) | kaikki entry | kaikki entry with forms | in neither Eesthetic nor kaikki |', '|---|---|---|---|---|---|---|');

    const caseTables: string[] = [];
    for (const pos of ['Noun', 'Verb', 'Adjective']) {
        const lemmas = (sample[pos] ?? []).slice(0, TOP_N);
        const caseMap = pos === 'Verb' ? VERB_CELLS : NOUN_CELLS;
        const eesPos = pos === 'Verb' ? 'verb' : 'noun';
        const filled = new Map<string, number>();
        let anyPos = 0, samePos = 0, kaikkiEntry = 0, kaikkiForms = 0, neither = 0;
        const missingExamples: string[] = [];

        for (const { lemma } of lemmas) {
            const candidates = lexemes.get(lemma) ?? [];
            const lexeme = candidates.filter((l) => l.pos === eesPos).sort((a, b) => a.homonym - b.homonym)[0];
            if (candidates.length) anyPos++;
            if (lexeme) samePos++;
            const forms = kaikki.get(`${KAIKKI_POS[pos]}|${lemma}`);
            if (forms !== undefined) kaikkiEntry++;
            if (forms) kaikkiForms++;
            if (!candidates.length && !forms) {
                neither++;
                if (missingExamples.length < 25) missingExamples.push(lemma);
            }
            const byCell = lexeme ? cells.get(lexeme.id) : undefined;
            for (const [cell, tag, caseNames] of caseMap) {
                const hit = byCell?.get(cell)?.find((f) => tag === null || f.tag === tag);
                if (hit) for (const caseName of caseNames) filled.set(caseName, (filled.get(caseName) ?? 0) + 1);
            }
        }

        lines.push(`| ${pos} | ${lemmas.length} | ${pct(anyPos, lemmas.length)} | ${pct(samePos, lemmas.length)} | ${pct(kaikkiEntry, lemmas.length)} | ${pct(kaikkiForms, lemmas.length)} | ${pct(neither, lemmas.length)} |`);
        caseTables.push(`### ${pos}: Eesthetic fill rate per case`, '', '| case | filled |', '|---|---|');
        for (const caseName of caseMap.flatMap(([, , names]) => names)) caseTables.push(`| ${caseName} | ${pct(filled.get(caseName) ?? 0, lemmas.length)} |`);
        caseTables.push('', `Most frequent lemmas in neither source: ${missingExamples.join(', ')}`, '');
    }
    lines.push('', ...caseTables);

    fs.writeFileSync(path.join(DATA_DIR, 'measure-et.md'), lines.join('\n') + '\n');
    console.log(lines.join('\n'));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
