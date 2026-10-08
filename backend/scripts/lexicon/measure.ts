/**
 * Step 4 of Slice 0: measure kaikki against today's autocomplete, case by case.
 *
 * For every sampled lemma (top N per part of speech, from sample-<lang>.json):
 * - kaikki: the selector tables in lib/lexicon/selectors/ applied to the lemma's entry;
 * - today: the production dictionary adapters (services/dictionary/generators.ts), so the
 *   library calls behave exactly as the route's fallback does (no is-word gate since C2). Estonian is not
 *   measured here (network; step 0e).
 *
 * The Slice 0 report (2026-10-08) was made with the old autocompleteTranslationController,
 * before Slice A: its "today errors" column (library throws → HTTP 500) is now `not-found`.
 *
 * Bias: the sample is drawn from kaikki, so every sampled lemma exists in kaikki. What kaikki
 * does NOT know shows in the "unmatched frequency words" list instead.
 *
 * A light check covers the other parts of speech (adjective, adverb, …): how many lemmas
 * have any forms, and which kinds of forms are most common.
 *
 * Writes .data/measure.json and .data/measure.md.
 *
 *   cd backend && npx tsx scripts/lexicon/measure.ts [topN=5000]
 */

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const { DATA_DIR, POS_MAP, kaikkiFile, sampleFile, readLines }: typeof import('./common') = require('./common');
const { selectCases, EXCLUDED_TAGS }: typeof import('../../lib/lexicon/select') = require('../../lib/lexicon/select');
const de: typeof import('../../lib/lexicon/selectors/de') = require('../../lib/lexicon/selectors/de');
const es: typeof import('../../lib/lexicon/selectors/es') = require('../../lib/lexicon/selectors/es');
const en: typeof import('../../lib/lexicon/selectors/en') = require('../../lib/lexicon/selectors/en');
const generators: typeof import('../../services/dictionary/generators') = require('../../services/dictionary/generators');
type LangCode = import('./common').LangCode;
type DictionaryAdapter = import('../../services/dictionary/types').DictionaryAdapter;
type CaseSelector = import('../../lib/lexicon/select').CaseSelector;
type LexiconEntry = import('../../lib/lexicon/select').LexiconEntry;

const TOP_N = Number(process.argv[2]) || 5000;
const OTHER_POS_TOP_N = 1000;
const EXAMPLES_PER_CASE = 5;

interface TodayResult {
    status: 'found' | 'partial' | 'not-found' | 'error';
    cases: Map<string, string>;
}

/** Runs one production adapter; a throw counts as `error`. */
async function today(adapter: DictionaryAdapter, lemma: string): Promise<TodayResult> {
    try {
        const { status, cases } = await adapter(lemma, {});
        return { status, cases: new Map(cases.map(({ caseName, word }) => [caseName, word])) };
    } catch {
        return { status: 'error', cases: new Map() };
    }
}

interface Group {
    lang: LangCode;
    kaikkiPos: string;
    selectors: CaseSelector[];
    /** Undefined when no route exists today (English nouns). */
    today?: (lemma: string) => Promise<TodayResult>;
}

const GROUPS: Group[] = [
    { lang: 'de', kaikkiPos: 'noun', selectors: de.NOUN_SELECTORS_DE, today: (w) => today(generators.germanNoun, w) },
    { lang: 'de', kaikkiPos: 'verb', selectors: de.VERB_SELECTORS_DE, today: (w) => today(generators.germanVerb, w) },
    { lang: 'es', kaikkiPos: 'noun', selectors: es.NOUN_SELECTORS_ES, today: (w) => today(generators.spanishNoun, w) },
    { lang: 'es', kaikkiPos: 'verb', selectors: es.VERB_SELECTORS_ES, today: (w) => today(generators.spanishVerb, w) },
    { lang: 'en', kaikkiPos: 'noun', selectors: en.NOUN_SELECTORS_EN },
    { lang: 'en', kaikkiPos: 'verb', selectors: en.VERB_SELECTORS_EN, today: (w) => today(generators.englishVerb, w) },
];

/** First lemma entry (not form_of-only) per "pos|word", for the wanted words of one language. */
async function loadEntries(lang: LangCode, wanted: Set<string>): Promise<Map<string, LexiconEntry>> {
    const found = new Map<string, LexiconEntry>();
    for await (const line of readLines(fs.createReadStream(kaikkiFile(lang)))) {
        // Cheap text check before parsing: most lines are not wanted.
        const word = line.slice(9, line.indexOf('"', 9));
        if (!wanted.has(word)) continue;
        const entry = JSON.parse(line);
        const key = `${entry.pos}|${entry.word}`;
        if (found.has(key) || !(entry.senses ?? []).some((sense: any) => !sense.form_of)) continue;
        found.set(key, entry);
    }
    return found;
}

interface CaseStats {
    caseName: string;
    kaikki: number;
    today: number;
    both: number;
    equal: number;
    equalIgnoringCase: number;
    examples: string[];
}

const pct = (part: number, whole: number) => (whole === 0 ? '—' : `${((100 * part) / whole).toFixed(1)}%`);

async function measureGroup(group: Group, sample: any, entries: Map<string, LexiconEntry>) {
    const appPos = POS_MAP[group.kaikkiPos];
    const lemmas: string[] = sample.byPos[appPos].slice(0, TOP_N).map((item: any) => item.lemma);
    const stats = new Map<string, CaseStats>(group.selectors.map((s) => [s.caseName, {
        caseName: s.caseName, kaikki: 0, today: 0, both: 0, equal: 0, equalIgnoringCase: 0, examples: [],
    }]));
    const todayStatus: Record<string, number> = { found: 0, partial: 0, 'not-found': 0, error: 0 };
    let kaikkiGainOverNotFound = 0;

    for (const lemma of lemmas) {
        const entry = entries.get(`${group.kaikkiPos}|${lemma}`);
        const kaikkiCases = entry ? selectCases(entry, group.selectors) : new Map<string, string>();
        const todayResult = group.today ? await group.today(lemma) : undefined;
        if (todayResult) {
            todayStatus[todayResult.status]++;
            if (todayResult.status !== 'found' && kaikkiCases.size > 0) kaikkiGainOverNotFound++;
        }

        for (const [caseName, s] of stats) {
            const k = kaikkiCases.get(caseName);
            const t = todayResult?.cases.get(caseName);
            if (k) s.kaikki++;
            if (t) s.today++;
            if (k && t) {
                s.both++;
                if (k === t) s.equal++;
                if (k.toLowerCase() === t.toLowerCase()) s.equalIgnoringCase++;
                else if (s.examples.length < EXAMPLES_PER_CASE) s.examples.push(`${lemma}: kaikki "${k}" / today "${t}"`);
            }
        }
    }
    return { lang: group.lang, pos: appPos, lemmas: lemmas.length, hasToday: !!group.today, todayStatus, kaikkiGainOverNotFound, cases: [...stats.values()] };
}

/** Light check: share of lemmas with any usable form, and the most common form tag sets. */
function measureOtherPos(lang: LangCode, sample: any, entries: Map<string, LexiconEntry>) {
    const result: any[] = [];
    for (const [kaikkiPos, appPos] of Object.entries(POS_MAP)) {
        if (kaikkiPos === 'noun' || kaikkiPos === 'verb' || !sample.byPos[appPos]) continue;
        const lemmas: string[] = sample.byPos[appPos].slice(0, OTHER_POS_TOP_N).map((item: any) => item.lemma);
        let withForms = 0;
        const tagSets = new Map<string, number>();
        for (const lemma of lemmas) {
            const rows = (entries.get(`${kaikkiPos}|${lemma}`)?.forms ?? []).filter(
                (row) => row.form && row.form !== '-' && !(row.tags ?? []).some((tag) => EXCLUDED_TAGS.includes(tag))
            );
            if (rows.length > 0) withForms++;
            for (const tagSet of new Set(rows.map((row) => (row.tags ?? []).slice().sort().join(',')))) {
                tagSets.set(tagSet, (tagSets.get(tagSet) ?? 0) + 1);
            }
        }
        const topTagSets = [...tagSets].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tags, n]) => `${tags || '(no tags)'} ${pct(n, lemmas.length)}`);
        result.push({ pos: appPos, lemmasInSample: sample.byPos[appPos].length, measured: lemmas.length, withForms, topTagSets });
    }
    return result;
}

function toMarkdown(results: any[], otherPos: Record<string, any[]>, samples: Record<string, any>): string {
    const lines: string[] = [`# Slice 0 measurement (generated ${new Date().toISOString()})`, ''];
    lines.push(`kaikki version: ${samples.de.kaikkiVersion}. Sample: top ${TOP_N} lemmas per part of speech from FrequencyWords 2018 (50k).`, '');
    for (const r of results) {
        lines.push(`## ${r.lang.toUpperCase()} ${r.pos} — ${r.lemmas} lemmas`, '');
        if (r.hasToday) {
            const s = r.todayStatus;
            lines.push(`Today: found ${pct(s.found, r.lemmas)}, partial ${pct(s.partial, r.lemmas)}, not found ${pct(s['not-found'], r.lemmas)}, error ${pct(s.error, r.lemmas)}. kaikki fills at least one case for ${r.kaikkiGainOverNotFound} lemmas that today does not find.`, '');
        } else {
            lines.push('Today: no route exists.', '');
        }
        lines.push('| case | kaikki | today | agree (both filled) | examples of disagreement |', '|---|---|---|---|---|');
        for (const c of r.cases) {
            lines.push(`| ${c.caseName} | ${pct(c.kaikki, r.lemmas)} | ${r.hasToday ? pct(c.today, r.lemmas) : '—'} | ${c.both ? `${pct(c.equalIgnoringCase, c.both)} (${c.both})` : '—'} | ${c.examples.join('; ')} |`);
        }
        lines.push('');
    }
    lines.push('## Other parts of speech (light check)', '');
    for (const [lang, rows] of Object.entries(otherPos)) {
        lines.push(`### ${lang.toUpperCase()}`, '', '| part of speech | lemmas in sample | measured | with any forms | most common form tags |', '|---|---|---|---|---|');
        for (const row of rows) lines.push(`| ${row.pos} | ${row.lemmasInSample} | ${row.measured} | ${pct(row.withForms, row.measured)} | ${row.topTagSets.join('; ')} |`);
        lines.push('');
    }
    lines.push('## Most frequent words kaikki did not match (first 40)', '');
    for (const [lang, sample] of Object.entries(samples)) {
        lines.push(`- **${lang.toUpperCase()}** (${sample.unmatched} of ${sample.frequencyWords} unmatched): ${sample.unmatchedTop.slice(0, 40).map((u: any) => `${u.word}@${u.rank}`).join(', ')}`);
    }
    return lines.join('\n') + '\n';
}

async function main(): Promise<void> {
    const results: any[] = [];
    const otherPos: Record<string, any[]> = {};
    const samples: Record<string, any> = {};
    for (const lang of ['de', 'es', 'en'] as LangCode[]) {
        const sample = JSON.parse(fs.readFileSync(sampleFile(lang), 'utf8'));
        samples[lang] = sample;
        const wanted = new Set<string>();
        for (const list of Object.values<any[]>(sample.byPos)) for (const item of list.slice(0, TOP_N)) wanted.add(item.lemma);
        const entries = await loadEntries(lang, wanted);

        for (const group of GROUPS.filter((g) => g.lang === lang)) {
            console.log(`measuring ${lang} ${group.kaikkiPos}…`);
            results.push(await measureGroup(group, sample, entries));
        }
        otherPos[lang] = measureOtherPos(lang, sample, entries);
    }

    fs.writeFileSync(path.join(DATA_DIR, 'measure.json'), JSON.stringify({ topN: TOP_N, results, otherPos }, null, 1));
    fs.writeFileSync(path.join(DATA_DIR, 'measure.md'), toMarkdown(results, otherPos, samples));
    console.log(`wrote ${path.join(DATA_DIR, 'measure.md')}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
