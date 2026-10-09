/**
 * Dictionary lookup for autocomplete: one route for every language and part of speech
 * (autocomplete-data-source-strategy.md, Slice A). The adapters live in services/dictionary/.
 */

const asyncHandler = require('express-async-handler');
const { HttpError }: typeof import('../lib/httpError') = require('../lib/httpError');
const { findAdapter }: typeof import('../services/dictionary/registry') = require('../services/dictionary/registry');
const { lexiconSuggestions }: typeof import('../services/dictionary/lexicon') = require('../services/dictionary/lexicon');

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

module.exports = { lookup, suggest };
