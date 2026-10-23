/**
 * Dictionary lookup for autocomplete: one route for every language and part of speech
 * (autocomplete-data-source-strategy.md, Slice A). The adapters live in services/dictionary/.
 */

const asyncHandler = require('express-async-handler');
const { HttpError }: typeof import('../lib/httpError') = require('../lib/httpError');
const { findAdapter }: typeof import('../services/dictionary/registry') = require('../services/dictionary/registry');
const { lexiconSuggestions }: typeof import('../services/dictionary/lexicon') = require('../services/dictionary/lexicon');
const translation: typeof import('../services/dictionary/translate') = require('../services/dictionary/translate');
const draftService: typeof import('../services/dictionary/draft') = require('../services/dictionary/draft');

const MAX_QUERY_LENGTH = 100;
const MIN_PREFIX_LENGTH = 2;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The adapter for the pair, or a 400. */
function adapterOr400(res: any, language: string, partOfSpeech: string) {
    const adapter = findAdapter(language, partOfSpeech);
    if (!adapter) {
        res.status(400);
        throw new Error(`No dictionary for ${language} ${partOfSpeech}`);
    }
    return adapter;
}

// @desc    Look up the case forms of one word
// @route   GET /api/dictionary/:language/:partOfSpeech/:query
//          ?searchInEnglish=true (Estonian verb) · ?entry=<id> (a type-ahead pick: that exact entry)
// @access  Private
// @returns 200 { status: 'found' | 'partial' | 'not-found', cases: [{ caseName, word }] }
//          400 no dictionary for that language and part of speech, or a bad query; 502 upstream failure
const lookup = asyncHandler(async (req: any, res: any) => {
    const { language, partOfSpeech, query } = req.params;
    const adapter = adapterOr400(res, language, partOfSpeech);
    const word = String(query).trim();
    if (word === '' || word.length > MAX_QUERY_LENGTH) {
        res.status(400);
        throw new Error('The query must be 1 to 100 characters');
    }
    const entry = req.query.entry;
    if (entry !== undefined && !(typeof entry === 'string' && UUID.test(entry))) {
        res.status(400);
        throw new Error('entry must be an entry id from the suggestions');
    }

    try {
        const result = await adapter(word, { searchInEnglish: req.query.searchInEnglish === 'true', entryId: entry });
        res.status(200).json(result);
    } catch (error) {
        if (error instanceof HttpError) res.status(error.status);
        throw error;
    }
});

// @desc    The type-ahead list (autocomplete-data-source-strategy.md, Slice E): dictionary
//          words that start with the typed text, most frequent first. From the local lexicon
//          only, so a pair without one (Estonian adjectives) returns an empty list.
// @route   GET /api/dictionary/:language/:partOfSpeech?prefix=<text>&limit=<1..20, default 10>
// @access  Private
// @returns 200 { suggestions: [{ entryId, lemma, hint? }] }  (hint: the noun's article, der/die)
//          400 no dictionary for that pair, a prefix shorter than 2 or longer than 100, or a bad limit
const suggest = asyncHandler(async (req: any, res: any) => {
    const { language, partOfSpeech } = req.params;
    adapterOr400(res, language, partOfSpeech);
    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix.trim() : '';
    if (prefix.length < MIN_PREFIX_LENGTH || prefix.length > MAX_QUERY_LENGTH) {
        res.status(400);
        throw new Error('The prefix must be 2 to 100 characters');
    }
    const limit = req.query.limit === undefined ? DEFAULT_LIMIT : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        res.status(400);
        throw new Error('The limit must be 1 to 20');
    }

    res.status(200).json({ suggestions: await lexiconSuggestions(language, partOfSpeech, prefix, limit) });
});

// @desc    Translate one word (autocomplete-data-source-strategy.md Slice F, step F2): the senses it
//          belongs to and, per sense, the words in all four languages (services/dictionary/translate.ts).
// @route   GET /api/dictionary/translate/:fromLanguage/:partOfSpeech/:query
//          fromLanguage: English | Spanish | German | Estonian; partOfSpeech: Noun | Verb | Adjective | Adverb
// @access  Private
// @returns 200 { senses: [{ english, sense, words: { English, Spanish, German, Estonian: [{ word, gender? }] } }],
//               ekilex?: { estonian: [{ word }] } | { unavailable: true } }   (ekilex: only when no sense has Estonian)
//          400 an unknown language or part of speech, or a query that is empty or longer than 100
const translate = asyncHandler(async (req: any, res: any) => {
    const { fromLanguage, partOfSpeech, query } = req.params;
    if (!translation.TRANSLATE_LANGUAGES.includes(fromLanguage) || !translation.TRANSLATE_PARTS_OF_SPEECH.includes(partOfSpeech)) {
        res.status(400);
        throw new Error(`No translations for ${fromLanguage} ${partOfSpeech}`);
    }
    const word = String(query).trim();
    if (word === '' || word.length > MAX_QUERY_LENGTH) {
        res.status(400);
        throw new Error('The query must be 1 to 100 characters');
    }
    res.status(200).json(await translation.translate(fromLanguage, partOfSpeech, word));
});

// @desc    The sense type-ahead (autocomplete-data-source-strategy.md Slice G, step G1): words of the start
//          language that start with the typed text, one line per sense, from the translation table.
// @route   GET /api/dictionary/translate/:fromLanguage?prefix=<text>&partOfSpeech=Any|Noun|Verb|Adjective|Adverb
//          &limit=<1..20, default 10>  (fromLanguage: the language of the typed text; partOfSpeech default Any)
// @access  Private
// @returns 200 { suggestions: [{ word, partOfSpeech, gender?, english, sense, key: { englishLemma, entryOrder, senseOrder }, languages: [<language the sense has a word in>] }] }
//          400 an unknown language or part of speech, a prefix shorter than 2 or longer than 100, or a bad limit
const suggestSenses = asyncHandler(async (req: any, res: any) => {
    const { fromLanguage } = req.params;
    const partOfSpeech = req.query.partOfSpeech === undefined ? 'Any' : req.query.partOfSpeech;
    if (!translation.TRANSLATE_LANGUAGES.includes(fromLanguage) || !['Any', ...translation.TRANSLATE_PARTS_OF_SPEECH].includes(partOfSpeech)) {
        res.status(400);
        throw new Error(`No translations for ${fromLanguage} ${partOfSpeech}`);
    }
    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix.trim() : '';
    if (prefix.length < MIN_PREFIX_LENGTH || prefix.length > MAX_QUERY_LENGTH) {
        res.status(400);
        throw new Error('The prefix must be 2 to 100 characters');
    }
    const limit = req.query.limit === undefined ? DEFAULT_LIMIT : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        res.status(400);
        throw new Error('The limit must be 1 to 20');
    }
    res.status(200).json({ suggestions: await translation.senseSuggestions(fromLanguage, partOfSpeech, prefix, limit) });
});

// @desc    One sense with its words (autocomplete-data-source-strategy.md Slice G, step G2): the preview of a
//          pick from the sense type-ahead. Only the languages in `languages` (the user's account) are returned.
// @route   GET /api/dictionary/translate/sense/:partOfSpeech?english=<word>&entry=<n>&sense=<n>&languages=<English,German,…>
//          (english, entry, sense: the `key` of a sense suggestion; languages: comma-separated, default all four)
// @access  Private
// @returns 200 { sense: { english, sense, words: { <language>: [{ word, gender? }] } },
//                ekilex?: { estonian: [{ word }] } | { unavailable: true } }   (ekilex: only when Estonian is asked and has no word)
//          400 an unknown part of speech or language, or a bad english, entry or sense; 404 no such sense
const senseOfKey = asyncHandler(async (req: any, res: any) => {
    const { partOfSpeech } = req.params;
    const { english, entry, sense } = req.query;
    const entryOrder = Number(entry);
    const senseOrder = Number(sense);
    const languages = req.query.languages === undefined ? [...translation.TRANSLATE_LANGUAGES] : String(req.query.languages).split(',');
    if (
        !translation.TRANSLATE_PARTS_OF_SPEECH.includes(partOfSpeech) ||
        languages.length === 0 || !languages.every((language: string) => (translation.TRANSLATE_LANGUAGES as readonly string[]).includes(language)) ||
        typeof english !== 'string' || english.trim() === '' || english.length > MAX_QUERY_LENGTH ||
        !Number.isInteger(entryOrder) || entryOrder < 0 || !Number.isInteger(senseOrder) || senseOrder < 0
    ) {
        res.status(400);
        throw new Error('A part of speech, an english word, an entry and a sense number, and known languages are required');
    }
    const result = await translation.senseWords(partOfSpeech, { englishLemma: english, entryOrder, senseOrder }, languages as (typeof translation.TRANSLATE_LANGUAGES)[number][]);
    if (!result) {
        res.status(404);
        throw new Error('No such sense');
    }
    res.status(200).json(result);
});

const MAX_PICKS = 4;

// @desc    The draft of a Word (autocomplete-data-source-strategy.md Slice G, step G3): the forms of the
//          word chosen for each language, in one call. Reads only (a POST because of the body); the
//          Word is saved later by POST /api/words.
// @route   POST /api/dictionary/draft
//          body { partOfSpeech, picks: [{ language, word, gender? }] }  (1 to 4 picks, one per language)
// @access  Private
// @returns 200 { translations: [{ language, word, gender?, status: 'found' | 'partial' | 'not-found' | 'error', cases: [{ caseName, word }] }] }
//          (one entry per pick, same order; `error`: that lookup failed, the others are unaffected)
//          400 an unknown part of speech or language, a repeated language, an empty or too long word, or not 1 to 4 picks
const draft = asyncHandler(async (req: any, res: any) => {
    const { partOfSpeech, picks } = req.body ?? {};
    const valid =
        translation.TRANSLATE_PARTS_OF_SPEECH.includes(partOfSpeech) &&
        Array.isArray(picks) && picks.length >= 1 && picks.length <= MAX_PICKS &&
        new Set(picks.map((pick: any) => pick?.language)).size === picks.length &&
        picks.every(
            (pick: any) =>
                (translation.TRANSLATE_LANGUAGES as readonly string[]).includes(pick?.language) &&
                typeof pick.word === 'string' && pick.word.trim() !== '' && pick.word.length <= MAX_QUERY_LENGTH &&
                (pick.gender === undefined || (typeof pick.gender === 'string' && pick.gender.length <= 8)),
        );
    if (!valid) {
        res.status(400);
        throw new Error('A part of speech and 1 to 4 picks (one per language, each with a word of 1 to 100 characters) are required');
    }
    const clean = picks.map((pick: any) => ({ language: pick.language, word: pick.word.trim(), gender: pick.gender || undefined }));
    res.status(200).json({ translations: await draftService.draft(partOfSpeech, clean) });
});

module.exports = { lookup, suggest, translate, suggestSenses, senseOfKey, draft };
