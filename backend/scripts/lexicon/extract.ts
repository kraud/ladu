/**
 * Step 2 of the lexicon pipeline: stream the kaikki raw dump once and write one small
 * JSONL file per language (kaikki-<lang>.jsonl) with only the fields the later steps use.
 *
 * The raw dump holds every language that English Wiktionary describes. A line is kept
 * only when its TOP-LEVEL `lang_code` is one of LANG_CODES (common.ts; English entries also carry
 * `lang_code` inside `translations[]`, so a text match alone is not enough).
 *
 * Kept fields: word, pos, tags, forms (form + tags), senses (tags, form_of words, first
 * gloss), and translations for English entries only (Slice 0 step 0e measures them).
 * Conjunctions and adpositions (`conj`, `prep`, `postp`) also keep `categories`, on the entry and on
 * each sense: that is where Wiktionary says "German prepositions governing the dative" or
 * "German subordinating conjunctions" (conjunctions-and-prepositions plan, slice 3b).
 *
 *   cd backend && npx tsx scripts/lexicon/extract.ts
 */

const fs: typeof import('fs') = require('fs');
const zlib: typeof import('zlib') = require('zlib');
const { once }: typeof import('events') = require('events');
const { LANG_CODES, KAIKKI_RAW_FILE, kaikkiFile, readLines }: typeof import('./common') = require('./common');
type LangCode = import('./common').LangCode;

const LANG_PREFILTER = new RegExp(`"lang_code":\\s*"(${LANG_CODES.join('|')})"`);

/** English is the hub: its entries keep the translations into every other language of the list. */
const TRANSLATION_TARGETS: string[] = LANG_CODES.filter((lang) => lang !== 'en');

/** The kaikki parts of speech whose `categories` the selectors read. Kept only for these: the field is large. */
const KEEP_CATEGORIES_FOR = new Set(['conj', 'prep', 'postp']);

function trim(entry: any): object {
    const withCategories = KEEP_CATEGORIES_FOR.has(entry.pos);
    const trimmed: any = {
        word: entry.word,
        pos: entry.pos,
        tags: entry.tags,
        forms: entry.forms?.map((f: any) => ({ form: f.form, tags: f.tags })),
        senses: entry.senses?.map((s: any) => ({
            tags: s.tags,
            form_of: s.form_of?.map((f: any) => f.word),
            gloss: s.glosses?.[0],
            ...(withCategories ? { categories: s.categories } : {}),
        })),
        ...(withCategories ? { categories: entry.categories } : {}),
    };
    if (entry.lang_code === 'en' && entry.translations) {
        trimmed.translations = entry.translations
            .filter((t: any) => TRANSLATION_TARGETS.includes(t.lang_code ?? t.code))
            .map((t: any) => ({ lang: t.lang_code ?? t.code, word: t.word, tags: t.tags, sense: t.sense }));
    }
    return trimmed;
}

async function main(): Promise<void> {
    if (!fs.existsSync(KAIKKI_RAW_FILE)) throw new Error(`${KAIKKI_RAW_FILE} is missing — run download.ts first`);

    const outputs = new Map<LangCode, import('fs').WriteStream>(
        LANG_CODES.map((lang) => [lang, fs.createWriteStream(kaikkiFile(lang))])
    );
    const counts: Record<string, Record<string, number>> = {};
    const lines = readLines(fs.createReadStream(KAIKKI_RAW_FILE).pipe(zlib.createGunzip()));

    let read = 0;
    for await (const line of lines) {
        read++;
        if (read % 1_000_000 === 0) console.log(`${read / 1_000_000}M lines read`);
        if (!LANG_PREFILTER.test(line)) continue;

        const entry = JSON.parse(line);
        const out = outputs.get(entry.lang_code);
        if (!out || !entry.word || !entry.pos) continue;

        counts[entry.lang_code] ??= {};
        counts[entry.lang_code][entry.pos] = (counts[entry.lang_code][entry.pos] ?? 0) + 1;
        if (!out.write(JSON.stringify(trim(entry)) + '\n')) await once(out, 'drain');
    }

    for (const out of outputs.values()) out.end();
    await Promise.all([...outputs.values()].map((out) => once(out, 'finish')));
    console.log(`${read} lines read. Entries kept per language and kaikki PoS:`);
    console.log(JSON.stringify(counts, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
