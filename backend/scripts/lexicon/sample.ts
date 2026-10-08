/**
 * Step 3 of the lexicon pipeline: turn each FrequencyWords list into a ranked list of
 * (lemma, part of speech) pairs, written to sample-<lang>.json.
 *
 * A frequency list holds inflected, lowercase words ("tanzt", "haus"). To find the lemma:
 *   1. an entry whose word matches and whose senses have `form_of` → those lemmas,
 *      following chains of form_of entries to the real lemma ("querida" → "querido" → "querer");
 *   2. an entry whose word matches, without `form_of` → the entry itself is a lemma;
 *   3. only when no entry matches: a lemma whose `forms[]` contains the word (covers forms
 *      with no page of their own). Not earlier: German "an" is a form of every separable verb.
 * An entry matches when its word is the frequency word, or the frequency word with a
 * capital first letter: always in German (nouns: "haus" → "Haus"), elsewhere only when no
 * exact entry exists. Single-letter, all-caps and multi-word lemmas are skipped.
 *
 * Known limit: FrequencyWords is lowercase, so German "ich" also ranks the noun "Ich"
 * (the ego). This adds a little noise at the top of the noun list only.
 *
 * Homographs: each candidate scores the number of senses that reach it. A candidate below
 * half of the best score is dropped ("haben" keeps the verb and drops the noun "Haben";
 * "run" keeps both noun and verb).
 * Each kept lemma gets the rank of the FIRST frequency word that reached it.
 *
 * The output is not capped. The measurement step takes the top N per part of speech.
 *
 *   cd backend && npx tsx scripts/lexicon/sample.ts
 */

const fs: typeof import('fs') = require('fs');
const {
    LANG_CODES, POS_MAP, MANIFEST_FILE, frequencyFile, kaikkiFile, sampleFile, readLines,
}: typeof import('./common') = require('./common');
type LangCode = import('./common').LangCode;

/** Form rows that are table metadata or noise, not word forms (strategy doc §4.1). */
const NOISE_TAGS = new Set(['table-tags', 'inflection-template', 'class']);

/** word → ("<PartOfSpeech>\t<lemma>" → score). */
type LemmaIndex = Map<string, Map<string, number>>;

/** Multi-word, single-letter and all-caps lemmas ("A", "IM", "TU") are not useful sample words. */
function isUsefulLemma(lemma: string): boolean {
    return lemma.length > 1 && !lemma.includes(' ') && lemma !== lemma.toUpperCase();
}

function addToIndex(index: LemmaIndex, word: string, pos: string, lemma: string, score = 1): void {
    if (!isUsefulLemma(lemma)) return;
    let candidates = index.get(word);
    if (!candidates) index.set(word, (candidates = new Map()));
    const key = `${pos}\t${lemma}`;
    candidates.set(key, (candidates.get(key) ?? 0) + score);
}

interface Index {
    /** Exact entry word → candidates (rules 1 and 2). */
    entries: LemmaIndex;
    /** Lowercase form → candidates (rule 3). */
    forms: LemmaIndex;
    /** "<PartOfSpeech>\t<word>" of every entry that has at least one real (non-form_of) sense. */
    lemmas: Set<string>;
    /** "<PartOfSpeech>\t<word>" of a form_of-only entry → its targets. */
    formOf: Map<string, string[]>;
}

async function buildIndex(lang: LangCode): Promise<Index> {
    const index: Index = { entries: new Map(), forms: new Map(), lemmas: new Set(), formOf: new Map() };
    const { entries, forms } = index;
    for await (const line of readLines(fs.createReadStream(kaikkiFile(lang)))) {
        const entry = JSON.parse(line);
        const pos = POS_MAP[entry.pos];
        if (!pos) continue;

        let lemmaSenses = 0;
        const targets: string[] = [];
        for (const sense of entry.senses ?? []) {
            if (sense.form_of?.length) {
                targets.push(...sense.form_of);
                for (const lemma of sense.form_of) addToIndex(entries, entry.word, pos, lemma);
            } else {
                lemmaSenses++;
            }
        }
        if (lemmaSenses === 0) {
            index.formOf.set(`${pos}\t${entry.word}`, targets);
            continue;
        }
        index.lemmas.add(`${pos}\t${entry.word}`);

        addToIndex(entries, entry.word, pos, entry.word, lemmaSenses);
        for (const form of entry.forms ?? []) {
            if (!form.form || form.form === '-' || form.form.includes(' ')) continue;
            if (form.tags?.some((tag: string) => NOISE_TAGS.has(tag))) continue;
            addToIndex(forms, form.form.toLowerCase(), pos, entry.word);
        }
    }
    return index;
}

/**
 * Follows form_of chains to a real lemma: "querida" → "querido" (itself only a participle
 * form) → "querer"; "adentrarse" → "adentrar". A key that reaches no lemma is dropped.
 */
function resolve(index: Index, key: string, depth = 0): string[] {
    if (index.lemmas.has(key)) return [key];
    const targets = index.formOf.get(key);
    if (!targets || depth >= 3) return [];
    const pos = key.split('\t')[0];
    return targets.flatMap((target) => resolve(index, `${pos}\t${target}`, depth + 1));
}

function lookup(lang: LangCode, index: Index, word: string): string[] {
    return [...new Set(candidates(lang, index, word).flatMap((key) => resolve(index, key)))];
}

function candidates(lang: LangCode, index: Index, word: string): string[] {
    const exact = index.entries.get(word);
    // German nouns are always capitalized, so German always also tries "Haus" for "haus".
    // Other languages only try it when there is no exact entry.
    const capitalized = word[0].toUpperCase() + word.slice(1);
    const useCapitalized = capitalized !== word && (lang === 'de' || !exact);
    const merged = new Map<string, number>();
    for (const candidates of [exact, useCapitalized ? index.entries.get(capitalized) : undefined]) {
        for (const [key, score] of candidates ?? []) merged.set(key, (merged.get(key) ?? 0) + score);
    }
    if (merged.size === 0) return [...(index.forms.get(word)?.keys() ?? [])];

    const best = Math.max(...merged.values());
    return [...merged].filter(([, score]) => score * 2 >= best).map(([key]) => key);
}

async function sample(lang: LangCode, kaikkiVersion: string | null): Promise<void> {
    const index = await buildIndex(lang);
    const byPos: Record<string, { lemma: string; rank: number }[]> = {};
    const seen = new Set<string>();
    let frequencyWords = 0;
    let unmatched = 0;
    /** The most frequent words with no kaikki match, for the coverage report. */
    const unmatchedTop: { word: string; rank: number }[] = [];

    const lines = fs.readFileSync(frequencyFile(lang), 'utf8').split('\n');
    for (const line of lines) {
        const word = line.split(' ')[0];
        if (!word) continue;
        frequencyWords++;
        // Single letters ("i", "s") are abbreviations of dozens of unrelated lemmas.
        if (word.length < 2) {
            unmatched++;
            continue;
        }
        const matches = lookup(lang, index, word);
        if (matches.length === 0) {
            unmatched++;
            if (unmatchedTop.length < 200) unmatchedTop.push({ word, rank: frequencyWords });
            continue;
        }
        for (const key of matches) {
            if (seen.has(key)) continue;
            seen.add(key);
            const [pos, lemma] = key.split('\t');
            (byPos[pos] ??= []).push({ lemma, rank: frequencyWords });
        }
    }

    const summary = Object.fromEntries(Object.entries(byPos).map(([pos, list]) => [pos, list.length]));
    fs.writeFileSync(
        sampleFile(lang),
        JSON.stringify({ lang, kaikkiVersion, frequencyWords, unmatched, unmatchedTop, summary, byPos }, null, 1)
    );
    console.log(`${lang}: ${frequencyWords} frequency words, ${unmatched} unmatched, lemmas per PoS:`, summary);
}

async function main(): Promise<void> {
    const manifest = fs.existsSync(MANIFEST_FILE) ? JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8')) : {};
    const kaikkiVersion = Object.values<any>(manifest).find((m) => m.url.includes('kaikki'))?.lastModified ?? null;
    for (const lang of LANG_CODES) await sample(lang, kaikkiVersion);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
