/**
 * Seeds the LOCAL dev database with a test account that owns 200 popular words in one Public tag,
 * so a second account can follow that tag and test pagination (`.context/plans/words-pagination.md`).
 *
 * Every word goes through the same autocomplete routes the app uses:
 *   1. The English words come from the lexicon, most frequent first (`lexemes.frequency_rank`).
 *   2. GET  /api/dictionary/translate/English/<PoS>/<word>  gives the same sense in Spanish, German and Estonian.
 *   3. POST /api/dictionary/draft                           fills the case forms of the chosen words.
 *   4. POST /api/words                                      saves the word with the tag.
 * A word is only taken when its main sense has words in at least 3 of the 4 languages (a sign of a
 * common concept, not a quirk of one dictionary). Not every language is kept: a word keeps 2, 3 or 4
 * of them (chosen at random, fixed seed), but only translations whose headline form was found, as the
 * Add word form requires.
 *
 *   cd backend
 *   node api/index.js &                                    # the API, on :5001 (or `npm run dev`)
 *   npx tsx scripts/seed-pagination-words.ts               # tops the tag up to 200 words; safe to run again
 *   npx tsx scripts/seed-pagination-words.ts --reset       # first deletes ALL words of the seed account, then seeds
 *
 * It refuses to run unless DATABASE_URL and the API both point at this machine. The account and the
 * tag are documented in `.dev-context/infrastructure-guide/02-environments-and-databases.md`.
 */

import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const SEED_ACCOUNT = {
    name: 'Pagination Seed',
    username: 'pagination_seed',
    email: 'pagination-seed@ladu.test',
    // A throwaway password for a local database only. It is meant to be written down.
    password: 'LocalDev-Seed-2026',
    languages: ['English', 'Spanish', 'German', 'Estonian'],
};
const SEED_TAG = {
    label: 'Pagination test (200 words)',
    description: 'Popular words in all four languages, to test the word tables with several pages. Made by scripts/seed-pagination-words.ts.',
};

const API = process.env.SEED_API_URL ?? 'http://localhost:5001';
const TARGET = 200;
/** How many of the 200 words each part of speech gets. */
const QUOTA: Record<PartOfSpeech, number> = { Noun: 80, Verb: 55, Adjective: 45, Adverb: 20 };
/** Not worth learning as a "popular word": numbers (the frequency list is full of them). */
const NOT_POPULAR = new Set([
    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'twenty', 'thirty',
    'forty', 'fifty', 'hundred', 'thousand', 'million', 'first', 'second', 'third', 'okay', 'yeah', 'gonna', 'wanna', 'gotta',
]);
/** Vulgar words (the frequency list comes from film subtitles), and nouns that are really another part of speech. */
const NOT_POPULAR_EITHER = new Set(['shit', 'fuck', 'fucking', 'damn', 'hell', 'ass', 'bitch', 'want', 'mean', 'whatever']);
/**
 * The frequency list ranks a spelling, not a part of speech, so "last" and "real" come up as nouns too.
 * Adjectives and adverbs choose first, and an English word is used once: the nouns get what is left.
 */
const ORDER: PartOfSpeech[] = ['Adjective', 'Adverb', 'Noun', 'Verb'];
/** Fixed seed: the same run picks the same languages and the same order. */
const RANDOM_SEED = 20261013;

type PartOfSpeech = 'Noun' | 'Verb' | 'Adjective' | 'Adverb';
type Language = 'English' | 'Spanish' | 'German' | 'Estonian';
const LANGUAGES: Language[] = ['English', 'Spanish', 'German', 'Estonian'];

/** The case a word cannot be saved without, per language (mirrors `getRequiredFieldsData` in wordController.ts). */
const HEADLINE_CASES: Record<PartOfSpeech, Record<Language, string[][]>> = {
    Noun: {
        English: [['singularEN']],
        Spanish: [['genderES', 'singularES']],
        German: [['genderDE', 'singularNominativDE']],
        Estonian: [['singularNimetavEE']],
    },
    Verb: {
        English: [['simplePresent1sEN']],
        Spanish: [['infinitiveNonFiniteSimpleES']],
        German: [['infinitiveDE']],
        Estonian: [['infinitiveMaEE']],
    },
    Adjective: {
        English: [['positiveEN']],
        Spanish: [['maleSingularES'], ['neutralSingularES']], // either one
        German: [['positiveDE']],
        Estonian: [['algvorreEE']],
    },
    Adverb: {
        English: [['adverbEN']],
        Spanish: [['adverbES']],
        German: [['adverbDE']],
        Estonian: [['adverbEE']],
    },
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** A small seeded random generator (mulberry32), so a run can be repeated. */
function makeRandom(seed: number) {
    let state = seed;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const random = makeRandom(RANDOM_SEED);

function shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function isLocal(value: string): boolean {
    try {
        return ['localhost', '127.0.0.1', '::1'].includes(new URL(value).hostname);
    } catch {
        return false;
    }
}

interface Pick { language: Language; word: string; gender?: string }
interface Case { caseName: string; word: string }
interface DraftTranslation { language: Language; word: string; status: string; cases: Case[] }
interface PreparedWord { partOfSpeech: PartOfSpeech; english: string; translations: { language: Language; cases: Case[] }[] }

let token = '';

async function api<T>(method: string, route: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API}/api${route}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${method} ${route} → ${response.status} ${text.slice(0, 200)}`);
    return (text ? JSON.parse(text) : {}) as T;
}

// ---------------------------------------------------------------------------
// Account and tag
// ---------------------------------------------------------------------------

async function signIn(pool: pg.Pool): Promise<void> {
    const login = () =>
        fetch(`${API}/api/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: SEED_ACCOUNT.email, password: SEED_ACCOUNT.password }),
        });

    let response = await login();
    if (!response.ok) {
        console.log(`No usable account yet: registering ${SEED_ACCOUNT.email}`);
        await api('POST', '/users', { ...SEED_ACCOUNT, uiLanguage: 'English' });
        // No inbox locally: read the verification token from the database, like the e2e suite does.
        const { rows } = await pool.query<{ id: string; token: string }>(
            `SELECT u.id, t.token FROM users u JOIN tokens t ON t.user_id = u.id WHERE lower(u.email) = lower($1)`,
            [SEED_ACCOUNT.email],
        );
        if (!rows[0]) throw new Error('No verification token found for the new account');
        await api('GET', `/users/${rows[0].id}/verify/${rows[0].token}`);
        response = await login();
        if (!response.ok) throw new Error(`Login failed after registering: ${response.status} ${await response.text()}`);
    }
    token = ((await response.json()) as { token: string }).token;
}

interface TagSummary { id: string; label: string; wordCount: number }

async function ensureTag(): Promise<TagSummary> {
    const found = await api<{ items: TagSummary[] }>('GET', `/tags?scope=owned&q=${encodeURIComponent(SEED_TAG.label)}&limit=20`);
    const existing = found.items.find((tag) => tag.label === SEED_TAG.label);
    if (existing) return existing;
    const created = await api<TagSummary>('POST', '/tags', { ...SEED_TAG, visibility: 'Public' });
    return { ...created, wordCount: 0 };
}

// ---------------------------------------------------------------------------
// Picking words
// ---------------------------------------------------------------------------

/** Most frequent English lemmas of one part of speech: plain lowercase letters only. */
async function candidateLemmas(pool: pg.Pool, partOfSpeech: PartOfSpeech, limit: number): Promise<string[]> {
    const { rows } = await pool.query<{ lemma: string }>(
        `SELECT lemma FROM lexemes
          WHERE language = 'English' AND part_of_speech = $1 AND frequency_rank IS NOT NULL AND lemma ~ '^[a-z]{3,}$'
          GROUP BY lemma ORDER BY min(frequency_rank) LIMIT $2`,
        [partOfSpeech, limit],
    );
    return rows
        .map((row) => row.lemma)
        // "going" as a noun, "coming" as an adjective: forms of a verb that have an entry of their own.
        .filter((lemma) => !NOT_POPULAR.has(lemma) && !NOT_POPULAR_EITHER.has(lemma) && (partOfSpeech === 'Verb' || partOfSpeech === 'Adverb' || !/(ing|ed)$/.test(lemma)));
}

interface Sense { words: Partial<Record<Language, { word: string; gender?: string }[]>> }

/** The main sense (the first one with words in at least three languages) → one pick per language. */
async function mainSensePicks(partOfSpeech: PartOfSpeech, lemma: string): Promise<Pick[]> {
    const { senses } = await api<{ senses: Sense[] }>('GET', `/dictionary/translate/English/${partOfSpeech}/${encodeURIComponent(lemma)}`);
    for (const sense of senses) {
        const picks: Pick[] = [];
        for (const language of LANGUAGES) {
            const first = sense.words[language]?.[0];
            if (first && first.word.trim() !== '' && first.word.length <= 100) picks.push({ language, word: first.word, gender: first.gender });
        }
        if (picks.length >= 3) return picks;
    }
    return [];
}

/** How many languages a word keeps: 2, 3 or 4 (20 % / 40 % / 40 %). */
function languagesToKeep(): number {
    const roll = random();
    return roll < 0.2 ? 2 : roll < 0.6 ? 3 : 4;
}

function hasHeadline(partOfSpeech: PartOfSpeech, translation: DraftTranslation): boolean {
    const have = new Set(translation.cases.filter((c) => c.word.trim() !== '').map((c) => c.caseName));
    return HEADLINE_CASES[partOfSpeech][translation.language].some((group) => group.every((name) => have.has(name)));
}

async function prepareWord(partOfSpeech: PartOfSpeech, lemma: string): Promise<PreparedWord | null> {
    const available = await mainSensePicks(partOfSpeech, lemma);
    if (available.length < 3) return null;

    // Ask for every available language first, so a failed lookup can be replaced by another language.
    const { translations } = await api<{ translations: DraftTranslation[] }>('POST', '/dictionary/draft', {
        partOfSpeech,
        picks: available.map(({ language, word, gender }) => ({ language, word, ...(gender ? { gender } : {}) })),
    });
    const usable = translations.filter((t) => (t.status === 'found' || t.status === 'partial') && hasHeadline(partOfSpeech, t));
    if (usable.length < 2) return null;

    const kept = shuffle(usable).slice(0, languagesToKeep());
    return {
        partOfSpeech,
        english: lemma,
        translations: LANGUAGES.filter((language) => kept.some((t) => t.language === language)).map((language) => ({
            language,
            cases: kept.find((t) => t.language === language)!.cases,
        })),
    };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    if (!process.env.DATABASE_URL || !isLocal(process.env.DATABASE_URL.replace(/^postgres(ql)?:/, 'http:')) || !isLocal(API)) {
        throw new Error('Refusing to run: DATABASE_URL and the API must both be on this machine (localhost).');
    }
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
        await signIn(pool);
        if (process.argv.includes('--reset')) {
            // Only this account's own words; the tag stays (its links to the words go with them).
            const own = await api<{ id: string }[]>('GET', '/words');
            if (own.length > 0) await api('DELETE', '/words/deleteMany', { wordsId: own.map((word) => word.id) });
            console.log(`Reset: deleted ${own.length} words of ${SEED_ACCOUNT.username}.`);
        }
        const tag = await ensureTag();
        console.log(`Account ${SEED_ACCOUNT.username} signed in. Tag "${tag.label}" (${tag.id}) has ${tag.wordCount} words.`);

        // English headline words the account already has, so a second run does not make doubles.
        const existing = await api<{ translations: { language: string; cases: Case[] }[] }[]>('GET', '/words');
        const known = new Set(
            existing.flatMap((word) =>
                word.translations.filter((t) => t.language === 'English').flatMap((t) => t.cases.map((c) => c.word.toLowerCase())),
            ),
        );

        const missing = TARGET - tag.wordCount;
        if (missing <= 0) {
            console.log('Nothing to do: the tag already has the full set.');
            return;
        }

        // Phase 1: prepare the words (lookups only, nothing saved yet), part of speech by part of speech.
        const prepared: PreparedWord[] = [];
        for (const partOfSpeech of ORDER) {
            const quota = Math.round((QUOTA[partOfSpeech] * missing) / TARGET);
            const lemmas = await candidateLemmas(pool, partOfSpeech, quota * 8);
            let made = 0;
            let skipped = 0;
            for (const lemma of lemmas) {
                if (made >= quota) break;
                if (known.has(lemma)) continue;
                try {
                    const word = await prepareWord(partOfSpeech, lemma);
                    if (word) {
                        prepared.push(word);
                        known.add(lemma); // once per English word, whatever the part of speech
                        made++;
                    } else skipped++;
                } catch (error) {
                    skipped++;
                    console.warn(`  ${partOfSpeech} "${lemma}" skipped: ${(error as Error).message}`);
                }
            }
            console.log(`${partOfSpeech}: ${made} of ${quota} prepared (${skipped} candidates skipped)`);
        }

        // Phase 2: save in a shuffled order, so every page of the table mixes the parts of speech.
        let saved = 0;
        for (const word of shuffle(prepared)) {
            await api('POST', '/words', { partOfSpeech: word.partOfSpeech, translations: word.translations, tagIds: [tag.id] });
            saved++;
        }

        // Report.
        const byPos: Record<string, number> = {};
        const byLanguageCount: Record<number, number> = {};
        const byLanguage: Record<string, number> = {};
        for (const word of prepared) {
            byPos[word.partOfSpeech] = (byPos[word.partOfSpeech] ?? 0) + 1;
            byLanguageCount[word.translations.length] = (byLanguageCount[word.translations.length] ?? 0) + 1;
            for (const t of word.translations) byLanguage[t.language] = (byLanguage[t.language] ?? 0) + 1;
        }
        console.log(`\nSaved ${saved} words in "${tag.label}".`);
        console.log('Parts of speech:', byPos);
        console.log('Languages per word (count → words):', byLanguageCount);
        console.log('Words with a translation in:', byLanguage);
        if (saved < missing) console.log(`Short of the target by ${missing - saved}: run the script again to top up.`);
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
