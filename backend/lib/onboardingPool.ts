/**
 * The onboarding pool (.context/plans/onboarding.md, Slice 2): the reviewed concepts that a
 * first-login onboarding can create as Words. Source of truth: `scripts/onboarding/pool.tsv`,
 * built by `scripts/lexicon/onboarding-pool.ts` and edited by hand. Only `keep` lines are used.
 *
 * One line = one concept: an English lemma and part of speech, its primary topic and the list of
 * all its topics ("core" = no topic; a concept can have a second topic and then gets both tags),
 * its level band, and one word per language (with the noun gender for German and Spanish). The
 * words go through the same lookup as the "Start from a word" draft route to get their forms.
 * Decisions of the 2026-10 refresh: .context/onboarding-words-resolutions.md.
 */

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const { TOPICS, LEVEL_BANDS }: typeof import('../scripts/lexicon/onboarding-topics') = require('../scripts/lexicon/onboarding-topics');

export const POOL_FILE = path.resolve(__dirname, '../scripts/onboarding/pool.tsv');
export const POOL_COLUMNS = [
    'status', 'id', 'topic', 'topics', 'band', 'pos', 'rank', 'en', 'es', 'es_gender', 'de', 'de_gender', 'et', 'sense', 'sense_key', 'flags',
] as const;
/** `keep`: used. `check`: the script found something to look at (see `flags`). `drop`: never used. */
export const POOL_STATUSES = ['keep', 'check', 'drop'] as const;
export const CORE_TOPIC = 'core';
export const POOL_TOPICS = [...TOPICS.map((topic) => topic.id), CORE_TOPIC];
export const POOL_BANDS = LEVEL_BANDS.map((band) => band.level);
export const POOL_PARTS_OF_SPEECH = ['Noun', 'Verb', 'Adjective', 'Adverb'];
export const POOL_GENDERS: Record<'es' | 'de', string[]> = { es: ['el', 'la', 'el/la'], de: ['der', 'die', 'das'] };

export type PoolStatus = (typeof POOL_STATUSES)[number];
export interface PoolConcept {
    status: PoolStatus;
    id: string;
    /** The primary topic. */
    topic: string;
    /** Every topic of the concept, the primary one included; a Word gets one tag for each picked topic. */
    topics: string[];
    band: string;
    partOfSpeech: string;
    rank: number;
    sense: string;
    /** `<entryOrder>.<senseOrder>` of the hub sense the words come from, or `manual` (no hub sense). */
    senseKey: string;
    flags: string[];
    /** Language (the app's value: 'English', 'Spanish', …) → word and, for nouns, gender. */
    words: Record<string, { word: string; gender: string | null }>;
}

const LANGUAGE_COLUMNS: [string, string, string | null][] = [
    ['English', 'en', null], ['Spanish', 'es', 'es_gender'], ['German', 'de', 'de_gender'], ['Estonian', 'et', null],
];

/**
 * Parses pool.tsv. Throws on a wrong header, a line with the wrong number of columns, an unknown
 * topic, band, status, part of speech or gender, a primary topic that is not in `topics`, or a bad
 * `sense_key`.
 */
export function parsePool(text: string): PoolConcept[] {
    const [header, ...lines] = text.split('\n').filter((line) => line.trim() !== '');
    if (header !== POOL_COLUMNS.join('\t')) throw new Error(`pool.tsv: unexpected header "${header}"`);
    return lines.map((line, index) => {
        const cells = line.split('\t');
        if (cells.length !== POOL_COLUMNS.length) {
            throw new Error(`pool.tsv line ${index + 2}: ${cells.length} columns, expected ${POOL_COLUMNS.length}`);
        }
        const cell = Object.fromEntries(POOL_COLUMNS.map((column, i) => [column, cells[i].trim()])) as Record<(typeof POOL_COLUMNS)[number], string>;
        const words: PoolConcept['words'] = {};
        for (const [language, column, genderColumn] of LANGUAGE_COLUMNS) {
            const word = cell[column as keyof typeof cell];
            if (word) words[language] = { word, gender: genderColumn ? cell[genderColumn as keyof typeof cell] || null : null };
        }
        const topics = cell.topics.split(',').map((topic) => topic.trim()).filter(Boolean);
        for (const topic of [cell.topic, ...topics]) {
            if (!POOL_TOPICS.includes(topic)) throw new Error(`pool.tsv line ${index + 2}: unknown topic "${topic}"`);
        }
        if (!topics.includes(cell.topic)) throw new Error(`pool.tsv line ${index + 2}: topics "${cell.topics}" must include the primary topic "${cell.topic}"`);
        const fail = (message: string): never => { throw new Error(`pool.tsv line ${index + 2}: ${message}`); };
        if (!(POOL_STATUSES as readonly string[]).includes(cell.status)) fail(`unknown status "${cell.status}"`);
        if (!POOL_PARTS_OF_SPEECH.includes(cell.pos)) fail(`unknown part of speech "${cell.pos}"`);
        if (cell.es_gender && !POOL_GENDERS.es.includes(cell.es_gender)) fail(`unknown Spanish gender "${cell.es_gender}"`);
        if (cell.de_gender && !POOL_GENDERS.de.includes(cell.de_gender)) fail(`unknown German gender "${cell.de_gender}"`);
        if (!(POOL_BANDS as readonly string[]).includes(cell.band)) throw new Error(`pool.tsv line ${index + 2}: unknown band "${cell.band}"`);
        if (!/^(\d+\.\d+|manual)$/.test(cell.sense_key)) throw new Error(`pool.tsv line ${index + 2}: sense_key "${cell.sense_key}" must be <entry>.<sense> or manual`);
        return {
            status: cell.status as PoolStatus,
            id: cell.id,
            topic: cell.topic,
            topics,
            band: cell.band,
            partOfSpeech: cell.pos,
            rank: Number(cell.rank),
            sense: cell.sense,
            senseKey: cell.sense_key,
            flags: cell.flags ? cell.flags.split(' ') : [],
            words,
        };
    });
}

export function readPool(file: string = POOL_FILE): PoolConcept[] {
    return parsePool(fs.readFileSync(file, 'utf8'));
}

// --- Precomputed forms (Slice 3a, decision D20) ---------------------------------------------------

export const FORMS_FILE = path.resolve(__dirname, '../scripts/onboarding/pool-forms.json');

/**
 * The cases a translation must have to be saved: the ones the word list shows for that language and
 * part of speech (wordController `getRequiredFieldsData`). A Spanish adjective needs one of its two.
 */
export const KEY_CASES: Record<string, Record<string, string[][]>> = {
    Noun: {
        English: [['singularEN']], Spanish: [['genderES'], ['singularES']],
        German: [['genderDE'], ['singularNominativDE']], Estonian: [['singularNimetavEE']],
    },
    Verb: {
        English: [['simplePresent1sEN']], Spanish: [['infinitiveNonFiniteSimpleES']],
        German: [['infinitiveDE']], Estonian: [['infinitiveMaEE']],
    },
    Adjective: {
        English: [['positiveEN']], Spanish: [['maleSingularES', 'neutralSingularES']],
        German: [['positiveDE']], Estonian: [['algvorreEE']],
    },
    Adverb: {
        English: [['adverbEN']], Spanish: [['adverbES']], German: [['adverbDE']], Estonian: [['adverbEE']],
    },
};

/**
 * English nouns that exist only as a plural (Q25 of the 2026-10 refresh). The English lexicon has no
 * noun entry for them, so the lookup finds nothing; their word is the plural form itself.
 */
export const PLURAL_ONLY_NOUNS_EN: readonly string[] = ['clothes', 'pants', 'news', 'data', 'stairs'];

/**
 * The cases of a plural-only English noun: the plural is the word itself. `singularEN` repeats it
 * because the word list shows that case (wordController `getRequiredFieldsData`).
 */
export const pluralOnlyCases = (word: string): Record<string, string> => ({ singularEN: word, pluralEN: word });

/**
 * True when `cases` has every key case of the language and part of speech (one of each group).
 * A plural-only English noun (PLURAL_ONLY_NOUNS_EN, needs `word`) may have `pluralEN` instead of
 * `singularEN`; every other noun still needs its singular.
 */
export function hasKeyCases(partOfSpeech: string, language: string, cases: Record<string, string>, word?: string): boolean {
    const groups = KEY_CASES[partOfSpeech]?.[language];
    if (!groups) return false;
    const pluralOnly = partOfSpeech === 'Noun' && language === 'English' && !!word && PLURAL_ONLY_NOUNS_EN.includes(word.toLowerCase());
    return groups.every((group) => group.some((caseName) => !!cases[caseName]) || (pluralOnly && !!cases.pluralEN));
}

/** One concept's precomputed translations: language → the pool word and its cases. */
export type ConceptForms = Record<string, { word: string; cases: Record<string, string> }>;

export interface FormsFile {
    format: 'ladu-onboarding-forms/1';
    generatedAt: string;
    concepts: Record<string, ConceptForms>;
}

export function readForms(file: string = FORMS_FILE): FormsFile {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}
