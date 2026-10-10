/**
 * Shared constants for the lexicon scripts (autocomplete-data-source-strategy.md, Slice 0).
 * Every script reads and writes inside DATA_DIR, which git ignores.
 */

const path: typeof import('path') = require('path');

export const DATA_DIR = path.join(__dirname, '.data');

/** kaikki `lang_code` values we keep. FrequencyWords uses the same codes for its folders. */
export const LANG_CODES = ['en', 'es', 'de', 'et'] as const;
export type LangCode = (typeof LANG_CODES)[number];

/** kaikki `pos` value → the app's `PartOfSpeech` value (frontend/src/ts/enums.ts). Other kaikki PoS are ignored. */
export const POS_MAP: Record<string, string> = {
    noun: 'Noun',
    verb: 'Verb',
    adj: 'Adjective',
    adv: 'Adverb',
    prep: 'Preposition',
    conj: 'Conjunction',
    pron: 'Pronoun',
    intj: 'Interjection',
    name: 'Proper noun',
    num: 'Numerals',
};

/**
 * Yield the lines of a text stream, split on "\n" only. Do not use `readline` for kaikki
 * files: it also splits on U+2028/U+2029, which appear raw inside JSON strings.
 */
export async function* readLines(input: NodeJS.ReadableStream): AsyncGenerator<string> {
    let buffer = '';
    input.setEncoding('utf8');
    for await (const chunk of input) {
        const parts = (buffer + chunk).split('\n');
        buffer = parts.pop() ?? '';
        yield* parts;
    }
    if (buffer) yield buffer;
}

export const KAIKKI_RAW_URL = 'https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz';
export const KAIKKI_RAW_FILE = path.join(DATA_DIR, 'raw-wiktextract-data.jsonl.gz');
export const MANIFEST_FILE = path.join(DATA_DIR, 'manifest.json');

/** One line of a lexicon file after the header (the format load.js reads). */
export interface LexiconFileRow {
    partOfSpeech: string;
    lemma: string;
    frequencyRank: number | null;
    entryOrder: number;
    forms: Record<string, string>;
}

/**
 * Writes a lexicon file: a header line, then one row per line. Gzipped for the real files
 * (.data/out/…jsonl.gz), plain for committed fixtures (readable diffs). `format` is
 * "ladu-lexicon/1" (lexemes, the default) or "ladu-translations/1" (Slice F; load.js reads both).
 */
export function writeLexiconFile(
    file: string,
    header: { format?: string; language: string; source: string; licence: string; sourceVersion: string; attribution: string },
    rows: object[],
): void {
    const fsModule: typeof import('fs') = require('fs');
    const zlib: typeof import('zlib') = require('zlib');
    const { format = 'ladu-lexicon/1', ...rest } = header;
    const text = [{ format, ...rest }, ...rows].map((value) => JSON.stringify(value)).join('\n') + '\n';
    fsModule.mkdirSync(path.dirname(file), { recursive: true });
    fsModule.writeFileSync(file, file.endsWith('.gz') ? zlib.gzipSync(text) : text);
}

/** Eesthetic v1.0.5 (Zenodo 14069724, CC BY 4.0): labelled Estonian paradigms, top ~5,000 nouns and verbs. */
export const EESTHETIC_URL = 'https://zenodo.org/api/records/14069724/files/eesthetic-v1.0.5.zip/content';
export const EESTHETIC_ZIP = path.join(DATA_DIR, 'eesthetic-v1.0.5.zip');
export const EESTHETIC_DIR = path.join(DATA_DIR, 'eesthetic');
/** Pikhof Estonian word list (CC BY-SA 4.0): 160k Ekilex base words with part of speech and frequency rank. */
export const PIKHOF_URL = 'https://raw.githubusercontent.com/KristjanPikhof/Estonian-Wordlist-Enriched-Ekilex/main/data/est_words_160k.tsv';
export const PIKHOF_FILE = path.join(DATA_DIR, 'pikhof-est_words_160k.tsv');

export const frequencyUrl =(lang: LangCode): string =>
    `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${lang}/${lang}_50k.txt`;
export const frequencyFile = (lang: LangCode): string => path.join(DATA_DIR, `frequency-${lang}.txt`);
export const kaikkiFile = (lang: LangCode): string => path.join(DATA_DIR, `kaikki-${lang}.jsonl`);
export const sampleFile = (lang: LangCode): string => path.join(DATA_DIR, `sample-${lang}.json`);
