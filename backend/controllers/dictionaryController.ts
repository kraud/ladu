/**
 * Dictionary lookup for autocomplete: one route for every language and part of speech
 * (autocomplete-data-source-strategy.md, Slice A). The adapters live in services/dictionary/.
 */

const asyncHandler = require('express-async-handler');
const { HttpError }: typeof import('../lib/httpError') = require('../lib/httpError');
const { findAdapter }: typeof import('../services/dictionary/registry') = require('../services/dictionary/registry');

const MAX_QUERY_LENGTH = 100;

// @desc    Look up the case forms of one word
// @route   GET /api/dictionary/:language/:partOfSpeech/:query  (Estonian verb: ?searchInEnglish=true)
// @access  Private
// @returns 200 { status: 'found' | 'partial' | 'not-found', cases: [{ caseName, word }] }
//          400 no dictionary for that language and part of speech, or a bad query; 502 upstream failure
const lookup = asyncHandler(async (req: any, res: any) => {
    const { language, partOfSpeech, query } = req.params;
    const adapter = findAdapter(language, partOfSpeech);
    if (!adapter) {
        res.status(400);
        throw new Error(`No dictionary for ${language} ${partOfSpeech}`);
    }
    const word = String(query).trim();
    if (word === '' || word.length > MAX_QUERY_LENGTH) {
        res.status(400);
        throw new Error('The query must be 1 to 100 characters');
    }

    try {
        const result = await adapter(word, { searchInEnglish: req.query.searchInEnglish === 'true' });
        res.status(200).json(result);
    } catch (error) {
        if (error instanceof HttpError) res.status(error.status);
        throw error;
    }
});

module.exports = { lookup };
