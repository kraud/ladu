/**
 * Builds the versioned lexicon file for one language (autocomplete-data-source-strategy.md
 * Slice B1; decisions D11–D14). Runs on a developer machine only, after download.ts,
 * extract.ts and sample.ts.
 *
 * For every lemma entry (not a pure form_of entry) of a supported part of speech, it applies
 * that language's selector table (lib/lexicon/selectors/) and writes one line with every case
 * value. An entry that fills only lemma copies is skipped (a noun with no gender and no table;
 * see `lemmaCopies`), except adjectives and adverbs (D24). Identical rows (same part of speech, lemma and forms) are written once;
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
const { DATA_DIR, MANIFEST_FILE, POS_MAP, kaikkiFile, sampleFile, readLines, writeLexiconFile }: typeof import('./common') = require('./common');
const { selectCases }: typeof import('../../lib/lexicon/select') = require('../../lib/lexicon/select');
const { mergeAdpositionRows }: typeof import('../../lib/lexicon/adpositions') = require('../../lib/lexicon/adpositions');
const de: typeof import('../../lib/lexicon/selectors/de') = require('../../lib/lexicon/selectors/de');
const es: typeof import('../../lib/lexicon/selectors/es') = require('../../lib/lexicon/selectors/es');
const en: typeof import('../../lib/lexicon/selectors/en') = require('../../lib/lexicon/selectors/en');
const fr: typeof import('../../lib/lexicon/selectors/fr') = require('../../lib/lexicon/selectors/fr');
type LangCode = import('./common').LangCode;
type CaseSelector = import('../../lib/lexicon/select').CaseSelector;

/**
 * Languages the ingest supports so far. Estonian comes from other sources (Slice D). French has no verb table yet
 * (language-french.md, slice 9b): a French verb entry has no selectors, so it is skipped.
 */
const LANGUAGES: Partial<Record<LangCode, { language: string; selectors: Record<string, CaseSelector[]> }>> = {
    de: { language: 'German', selectors: { noun: de.NOUN_SELECTORS_DE, verb: de.VERB_SELECTORS_DE, adj: de.ADJECTIVE_SELECTORS_DE, adv: de.ADVERB_SELECTORS_DE, conj: de.CONJUNCTION_SELECTORS_DE, prep: de.PREPOSITION_SELECTORS_DE, postp: de.PREPOSITION_SELECTORS_DE } },
    es: { language: 'Spanish', selectors: { noun: es.NOUN_SELECTORS_ES, verb: es.VERB_SELECTORS_ES, adj: es.ADJECTIVE_SELECTORS_ES, adv: es.ADVERB_SELECTORS_ES, conj: es.CONJUNCTION_SELECTORS_ES, prep: es.PREPOSITION_SELECTORS_ES, postp: es.PREPOSITION_SELECTORS_ES } },
    en: { language: 'English', selectors: { noun: en.NOUN_SELECTORS_EN, verb: en.VERB_SELECTORS_EN, adj: en.ADJECTIVE_SELECTORS_EN, adv: en.ADVERB_SELECTORS_EN, conj: en.CONJUNCTION_SELECTORS_EN, prep: en.PREPOSITION_SELECTORS_EN, postp: en.PREPOSITION_SELECTORS_EN } },
    fr: { language: 'French', selectors: { noun: fr.NOUN_SELECTORS_FR, adj: fr.ADJECTIVE_SELECTORS_FR, adv: fr.ADVERB_SELECTORS_FR, conj: fr.CONJUNCTION_SELECTORS_FR, prep: fr.PREPOSITION_SELECTORS_FR, postp: fr.PREPOSITION_SELECTORS_FR } },
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
        // "sputen": always reflexive ("sich sputen"); "waschen"/"geben": the reflexive use is only one of several (D28).
        // "nehmen"/"denken"/"vorstellen": reflexive senses with a dative pronoun (some / all / one of several).
        'waschen|verb', 'geben|verb', 'nehmen|verb', 'denken|verb', 'vorstellen|verb',
        // "lila": no forms at all (D24); "oft"/"gern": adverbs with a comparative; "hier": gradable = no.
        'gut|adj', 'schön|adj', 'groß|adj', 'lila|adj', 'oft|adv', 'gern|adv', 'hier|adv',
        // Conjunctions and adpositions: "und": marked coordinating; "weil": marked both, so no type; "weder"/"obwohl": unmarked;
        // "sowohl ... als auch": a pair; "nach"/"zufolge": a preposition and a postposition (one row); "in": no case category.
        'und|conj', 'weil|conj', 'weder|conj', 'obwohl|conj', 'sowohl ... als auch|conj',
        'wegen|prep', 'nach|prep', 'zufolge|prep', 'an|prep', 'in|prep',
    ],
    // "leche"/"crisis": genders the old library got wrong; "estudiante": both genders (el/la);
    // "sentir"/"venir"/"oír": verbs the old library conjugated wrongly; "quejarse": reflexive (D8).
    es: [
        'casa|noun', 'estudiante|noun', 'leche|noun', 'crisis|noun', 'mano|noun', 'día|noun', 'agua|noun',
        'hombre|noun', 'mujer|noun', 'libro|noun', 'perro|noun', 'ciudad|noun', 'tiempo|noun', 'problema|noun',
        'bailar|verb', 'tener|verb', 'ir|verb', 'sentir|verb', 'venir|verb', 'oír|verb', 'pensar|verb', 'quejarse|verb',
        // "quejarse": the reflexive lemma; "lavar": has a reflexive sense, but its lemma is not "-se" (D28).
        'lavar|verb',
        // "rojo": M/F; "feliz"/"grande": Neutral (one shape for both genders); "rápidamente": no forms (D24).
        'rojo|adj', 'feliz|adj', 'grande|adj', 'bonito|adj', 'bien|adv', 'rápidamente|adv', 'mucho|adv',
        // "para que": marked subordinating; "porque"/"aunque": unmarked; prepositions govern no case.
        'para que|conj', 'porque|conj', 'aunque|conj', 'de|prep', 'en|prep',
    ],
    // "can"/"will": modals the old library got wrong ("caned"); "child"/"sheep"/"mouse": irregular plurals.
    en: [
        'child|noun', 'sheep|noun', 'mouse|noun', 'house|noun', 'book|noun', 'city|noun', 'woman|noun', 'man|noun',
        'run|verb', 'walk|verb', 'bake|verb', 'be|verb', 'go|verb', 'can|verb', 'will|verb', 'swim|verb', 'cry|verb',
        // "beautiful"/"unique"/"quickly": "more …" forms; "big"/"fast": plain -er/-est.
        'big|adj', 'good|adj', 'beautiful|adj', 'unique|adj', 'happy|adj', 'quickly|adv', 'fast|adv', 'well|adv',
        // "because"/"although": marked subordinating; "neither … nor": a pair; "ago": a postposition.
        'because|conj', 'although|conj', 'neither … nor|conj', 'in|prep', 'ago|prep',
    ],
    // "cheval"/"œil"/"travail": irregular plurals; "enfant": both genders (le/la); "souris": invariable; "gens": plural only.
    // "beau": the vowel form "bel"; "facile": one shape for both genders; "marron": invariable; "bon": the irregular comparative.
    // "bien": the irregular degrees; "vite": no degree rows. "parce que"/"ni … ni": a conjunction and a pair; "pendant": a preposition.
    fr: [
        'maison|noun', 'cheval|noun', 'œil|noun', 'travail|noun', 'enfant|noun', 'souris|noun', 'gens|noun', 'homme|noun', 'ville|noun', 'livre|noun',
        'grand|adj', 'beau|adj', 'facile|adj', 'marron|adj', 'bon|adj', 'heureux|adj',
        'bien|adv', 'vite|adv', 'beaucoup|adv',
        'parce que|conj', 'et|conj', 'ni … ni|conj', 'dans|prep', 'pendant|prep',
    ],
};
const FIXTURE_TOP_N = 20;
const MAX_LEMMA_LENGTH = 100; // the dictionary route refuses longer queries

const ATTRIBUTION =
    'Derived from English Wiktionary (https://en.wiktionary.org) via kaikki.org / Wiktextract, CC BY-SA 4.0. ' +
    'Frequency ranks from FrequencyWords (github.com/hermitdave/FrequencyWords), CC BY-SA 4.0.';

/** entryOrder: 0, 1, … in source order among the written rows of the same part of speech and lemma (decision D15). */
type LexiconRow = import('./common').LexiconFileRow;

/**
 * The cases a selector table fills from the lemma alone (fallbacks, "the lemma is the singular",
 * the bare English verb): found by running the table on an entry with no forms and no senses.
 * An entry is worth a row only if it fills at least one case NOT in this set. Comparing values
 * with the lemma instead would wrongly drop "sheep" (plural = singular).
 */
const lemmaCopyCache = new Map<CaseSelector[], Set<string>>();
function lemmaCopies(selectors: CaseSelector[]): Set<string> {
    let copies = lemmaCopyCache.get(selectors);
    if (!copies) {
        copies = new Set(selectCases({ word: 'lemma', pos: '', forms: [], senses: [] }, selectors).keys());
        lemmaCopyCache.set(selectors, copies);
    }
    return copies;
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
        // Adjectives and adverbs with no forms beyond the lemma stay (D24): "lila", "rápidamente", "hier".
        // So do conjunctions and adpositions: most have only the word itself.
        const keepLemmaOnly = ['adj', 'adv', 'conj', 'prep', 'postp'].includes(entry.pos);
        if (!keepLemmaOnly && !Object.keys(forms).some((caseName) => !lemmaCopies(selectors).has(caseName))) {
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

    // "nach" is a preposition entry and a postposition entry: one row, "Before or after the noun".
    const merged = mergeAdpositionRows(rows);
    const entryOrders = new Map<string, number>();
    for (const row of merged) {
        const lemmaKey = `${row.partOfSpeech}|${row.lemma}`;
        row.entryOrder = entryOrders.get(lemmaKey) ?? 0;
        entryOrders.set(lemmaKey, row.entryOrder + 1);
    }

    let output = merged;
    if (fixture) {
        const wanted = new Set((FIXTURE_WORDS[lang] ?? []).map((pair) => {
            const [word, pos] = pair.split('|');
            return `${POS_MAP[pos]}|${word}`;
        }));
        merged.filter((row) => row.partOfSpeech === 'Verb' && row.frequencyRank !== null)
            .sort((a, b) => a.frequencyRank! - b.frequencyRank!)
            .slice(0, FIXTURE_TOP_N)
            .forEach((row) => wanted.add(`${row.partOfSpeech}|${row.lemma}`));
        output = merged.filter((row) => wanted.has(`${row.partOfSpeech}|${row.lemma}`));
    }

    const file = fixture
        ? path.join(__dirname, 'fixtures', `lexicon-${lang}-fixture.jsonl`)
        : path.join(DATA_DIR, 'out', `lexicon-${lang}-${version}.jsonl.gz`);
    writeLexiconFile(file, { language: config.language, source: 'kaikki', licence: 'CC BY-SA 4.0', sourceVersion: version, attribution: ATTRIBUTION }, output);

    const byPos = output.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.partOfSpeech]: (acc[row.partOfSpeech] ?? 0) + 1 }), {});
    console.log(`${config.language} ${version}: ${output.length} lexemes ${JSON.stringify(byPos)}, ${skippedEmpty} entries skipped (nothing beyond the lemma)`);
    console.log(`wrote ${file} (${fs.statSync(file).size} bytes)`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
