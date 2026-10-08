/**
 * Slice 0 step 0e: translation coverage of kaikki `translations[]` (English entries only),
 * for Slice F (translation table) and the "one term → whole Word" plan (strategy doc §13).
 *
 * - Forward: for the top N English noun/verb lemmas, the share with at least one translation
 *   per target language, and the share of their translated senses that reach each language.
 * - Reverse: for the top N noun/verb lemmas of ES, DE and ET, the share that appear as a
 *   translation word of some English entry (so the language can be the START of a lookup).
 *   ET uses the Pikhof sample (see measure-et.ts).
 *
 * Writes .data/measure-translations.md.
 *
 *   cd backend && npx tsx scripts/lexicon/measure-translations.ts [topN=5000]
 */

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const { DATA_DIR, PIKHOF_FILE, kaikkiFile, sampleFile, readLines }: typeof import('./common') = require('./common');

const TOP_N = Number(process.argv[2]) || 5000;
const TARGETS = ['es', 'de', 'et'] as const;
const pct = (part: number, whole: number) => (whole === 0 ? '—' : `${((100 * part) / whole).toFixed(1)}%`);

function topLemmas(lang: 'en' | 'es' | 'de', pos: 'Noun' | 'Verb'): string[] {
    return JSON.parse(fs.readFileSync(sampleFile(lang), 'utf8')).byPos[pos].slice(0, TOP_N).map((x: any) => x.lemma);
}

function topPikhof(code: string): string[] {
    return fs.readFileSync(PIKHOF_FILE, 'utf8').split('\n').slice(1)
        .map((line) => line.split('\t'))
        .filter(([word, rank, , pos]) => word && Number(rank) > 0 && (pos ?? '').split(',').includes(code))
        .sort((a, b) => Number(a[1]) - Number(b[1]))
        .slice(0, TOP_N)
        .map(([word]) => word);
}

async function main(): Promise<void> {
    const forwardWanted = { noun: new Set(topLemmas('en', 'Noun')), verb: new Set(topLemmas('en', 'Verb')) };
    /** target lang → pos → set of words that appear as a translation. */
    const reverse: Record<string, Record<string, Set<string>>> = {};
    const forward: Record<string, { lemmas: number; withLang: Record<string, number>; senses: number; sensesWithLang: Record<string, number> }> = {};
    const seen = new Set<string>();

    for await (const line of readLines(fs.createReadStream(kaikkiFile('en')))) {
        const entry = JSON.parse(line);
        if (entry.pos !== 'noun' && entry.pos !== 'verb') continue;
        for (const t of entry.translations ?? []) {
            ((reverse[t.lang] ??= {})[entry.pos] ??= new Set()).add(t.word);
        }

        const key = `${entry.pos}|${entry.word}`;
        if (!forwardWanted[entry.pos as 'noun' | 'verb'].has(entry.word) || seen.has(key)) continue;
        if (!(entry.senses ?? []).some((sense: any) => !sense.form_of)) continue;
        seen.add(key);

        const stats = (forward[entry.pos] ??= { lemmas: 0, withLang: {}, senses: 0, sensesWithLang: {} });
        stats.lemmas++;
        const bySense = new Map<string, Set<string>>();
        for (const t of entry.translations ?? []) {
            const sense = t.sense ?? '(no sense)';
            (bySense.get(sense) ?? bySense.set(sense, new Set()).get(sense)!).add(t.lang);
        }
        stats.senses += bySense.size;
        for (const lang of TARGETS) {
            if ([...bySense.values()].some((langs) => langs.has(lang))) stats.withLang[lang] = (stats.withLang[lang] ?? 0) + 1;
            stats.sensesWithLang[lang] = (stats.sensesWithLang[lang] ?? 0) + [...bySense.values()].filter((langs) => langs.has(lang)).length;
        }
    }

    const lines = [`# Slice 0 translation measurement (generated ${new Date().toISOString()})`, ''];
    lines.push(`## Forward: English → other languages (top ${TOP_N} English lemmas)`, '');
    lines.push('| English | lemmas | translated senses | lemmas with ES | with DE | with ET | senses with ES | with DE | with ET |', '|---|---|---|---|---|---|---|---|---|');
    for (const [pos, s] of Object.entries(forward)) {
        lines.push(`| ${pos} | ${s.lemmas} | ${s.senses} | ${TARGETS.map((l) => pct(s.withLang[l] ?? 0, s.lemmas)).join(' | ')} | ${TARGETS.map((l) => pct(s.sensesWithLang[l] ?? 0, s.senses)).join(' | ')} |`);
    }

    lines.push('', `## Reverse: can the language start a lookup? (top ${TOP_N} lemmas found as a translation word)`, '');
    lines.push('| language | nouns | verbs |', '|---|---|---|');
    const reverseSamples: [string, string[], string[]][] = [
        ['es', topLemmas('es', 'Noun'), topLemmas('es', 'Verb')],
        ['de', topLemmas('de', 'Noun'), topLemmas('de', 'Verb')],
        ['et', topPikhof('s'), topPikhof('v')],
    ];
    for (const [lang, nouns, verbs] of reverseSamples) {
        const hit = (pos: string, words: string[]) => words.filter((w) => reverse[lang]?.[pos]?.has(w)).length;
        lines.push(`| ${lang} | ${pct(hit('noun', nouns), nouns.length)} of ${nouns.length} | ${pct(hit('verb', verbs), verbs.length)} of ${verbs.length} |`);
    }

    fs.writeFileSync(path.join(DATA_DIR, 'measure-translations.md'), lines.join('\n') + '\n');
    console.log(lines.join('\n'));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
