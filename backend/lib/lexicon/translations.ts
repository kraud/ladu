/**
 * English Wiktionary `translations[]` → `lexeme_translations` rows (autocomplete-data-source-strategy.md
 * Slice F, decision D22). Pure functions: the ingest script (scripts/lexicon/ingest-translations.ts)
 * runs them on every English entry, and the unit tests run them on small made-up entries.
 *
 * A kaikki translation item: { lang: 'de', word: 'See', tags: ['masculine'], sense: 'body of water' }.
 */

/** Target languages: the kaikki code → the app's value. English is the hub, never a target. */
export const TRANSLATION_LANGUAGES: Record<string, string> = { es: 'Spanish', de: 'German', et: 'Estonian' };

/** kaikki part of speech → the app's value. Nouns, verbs, adjectives and adverbs (D22). */
export const TRANSLATION_POS: Record<string, string> = { noun: 'Noun', verb: 'Verb', adj: 'Adjective', adv: 'Adverb' };

const MAX_WORD_LENGTH = 100; // the dictionary routes refuse longer queries

const GENDERS: Record<string, Record<string, string>> = {
    German: { masculine: 'der', feminine: 'die', neuter: 'das' },
    Spanish: { masculine: 'el', feminine: 'la' },
};

/**
 * The noun gender as the form stores it, or null.
 * - German: one of masculine / feminine / neuter → der / die / das. Two genders → null: the
 *   German form has no "der/das" option.
 * - Spanish: masculine → el, feminine → la, both → "el/la" (the form's GenderES.N).
 * - Estonian has no gender.
 */
export function translationGender(language: string, tags: string[] = []): string | null {
    const genders = GENDERS[language];
    if (!genders) return null;
    const found = Object.keys(genders).filter((tag) => tags.includes(tag));
    if (found.length === 1) return genders[found[0]];
    if (language === 'Spanish' && found.length === 2) return 'el/la';
    return null;
}

export interface TranslationFileRow {
    englishLemma: string;
    partOfSpeech: string;
    entryOrder: number;
    sense: string;
    senseOrder: number;
    language: string;
    word: string;
    wordOrder: number;
    gender: string | null;
    tags: string[];
}

/**
 * The rows of one English entry. `senseOrder` numbers the sense labels in their order of first
 * appearance (Wiktionary lists the main sense's table first); `wordOrder` numbers the written
 * words per sense and language in source order (the first listed is usually the common one).
 * A target item with no word, an unknown language or a too-long word is skipped; the same
 * (sense, language, word) is written once.
 */
export function translationRows(entry: any, entryOrder: number): TranslationFileRow[] {
    const partOfSpeech = TRANSLATION_POS[entry.pos];
    if (!partOfSpeech || typeof entry.word !== 'string' || entry.word.length > MAX_WORD_LENGTH) return [];

    const senseOrders = new Map<string, number>();
    const seen = new Set<string>();
    const wordsPerSenseLanguage = new Map<string, number>();
    const rows: TranslationFileRow[] = [];
    for (const item of entry.translations ?? []) {
        const sense = typeof item.sense === 'string' ? item.sense.trim() : '';
        if (!senseOrders.has(sense)) senseOrders.set(sense, senseOrders.size);
        const language = TRANSLATION_LANGUAGES[item.lang];
        const word = typeof item.word === 'string' ? item.word.trim() : '';
        if (!language || word === '' || word.length > MAX_WORD_LENGTH) continue;

        const key = `${sense}\u0000${language}\u0000${word}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const senseLanguage = `${sense}\u0000${language}`;
        const wordOrder = wordsPerSenseLanguage.get(senseLanguage) ?? 0;
        wordsPerSenseLanguage.set(senseLanguage, wordOrder + 1);
        const tags: string[] = Array.isArray(item.tags) ? item.tags.filter((tag: unknown) => typeof tag === 'string') : [];
        rows.push({
            englishLemma: entry.word,
            partOfSpeech,
            entryOrder,
            sense,
            senseOrder: senseOrders.get(sense)!,
            language,
            word,
            wordOrder,
            gender: partOfSpeech === 'Noun' ? translationGender(language, tags) : null,
            tags,
        });
    }
    return rows;
}
