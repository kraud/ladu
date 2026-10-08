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

export const frequencyUrl = (lang: LangCode): string =>
    `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${lang}/${lang}_50k.txt`;
export const frequencyFile = (lang: LangCode): string => path.join(DATA_DIR, `frequency-${lang}.txt`);
export const kaikkiFile = (lang: LangCode): string => path.join(DATA_DIR, `kaikki-${lang}.jsonl`);
export const sampleFile = (lang: LangCode): string => path.join(DATA_DIR, `sample-${lang}.json`);
