/**
 * The onboarding pool (.context/plans/onboarding.md, Slice 2): the reviewed concepts that a
 * first-login onboarding can create as Words. Source of truth: `scripts/onboarding/pool.tsv`,
 * built by `scripts/lexicon/onboarding-pool.ts` and edited by hand. Only `keep` lines are used.
 *
 * One line = one concept: an English lemma and part of speech, its topic ("core" = no topic) and
 * level band, and one word per language (with the noun gender for German and Spanish). The words
 * go through the same lookup as the "Start from a word" draft route to get their forms.
 */

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const { TOPICS, LEVEL_BANDS }: typeof import('../scripts/lexicon/onboarding-topics') = require('../scripts/lexicon/onboarding-topics');

export const POOL_FILE = path.resolve(__dirname, '../scripts/onboarding/pool.tsv');
export const POOL_COLUMNS = [
    'status', 'id', 'topic', 'band', 'pos', 'rank', 'en', 'es', 'es_gender', 'de', 'de_gender', 'et', 'sense', 'flags',
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
    topic: string;
    band: string;
    partOfSpeech: string;
    rank: number;
    sense: string;
    flags: string[];
    /** Language (the app's value: 'English', 'Spanish', …) → word and, for nouns, gender. */
    words: Record<string, { word: string; gender: string | null }>;
}

const LANGUAGE_COLUMNS: [string, string, string | null][] = [
    ['English', 'en', null], ['Spanish', 'es', 'es_gender'], ['German', 'de', 'de_gender'], ['Estonian', 'et', null],
];

/** Parses pool.tsv. Throws on a wrong header or a line with the wrong number of columns. */
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
        return {
            status: cell.status as PoolStatus,
            id: cell.id,
            topic: cell.topic,
            band: cell.band,
            partOfSpeech: cell.pos,
            rank: Number(cell.rank),
            sense: cell.sense,
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

/** True when `cases` has every key case of the language and part of speech (one of each group). */
export function hasKeyCases(partOfSpeech: string, language: string, cases: Record<string, string>): boolean {
    const groups = KEY_CASES[partOfSpeech]?.[language];
    return !!groups && groups.every((group) => group.some((caseName) => !!cases[caseName]));
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
