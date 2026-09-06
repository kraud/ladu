/**
 * Autocomplete Translation Controller — TypeScript migration (no DB changes)
 *
 * This controller is purely computational: it conjugates verbs and declines
 * nouns for Spanish, English, German, and Estonian using third-party npm
 * libraries / external APIs.  No database interactions exist here.
 *
 * Route usage is declared in ../routes/autocompleteTranslationRoutes.js.
 */

const https = require('https');

const asyncHandler = require('express-async-handler');
const isWord = require('is-word');

// const conjugateVerb = require("../../node_modules/conjugator/lib/conjugateVerb.js")
const SpanishVerbs = require('spanish-verbs');
const SpanishGender = require('rosaenlg-gender-es');

const GermanVerbsLib = require('german-verbs');
const GermanWords = require('german-words');
const GermanVerbsDict = require('german-verbs-dict/dist/verbs.json');
const GermanWordsList = require('german-words-dict/dist/words.json');

const EnglishVerbs = require('english-verbs-helper');
const Irregular = require('english-verbs-irregular/dist/verbs.json');
const Gerunds = require('english-verbs-gerunds/dist/gerunds.json');
const EnglishVerbsData = EnglishVerbs.mergeVerbsData(Irregular, Gerunds);

const EESTI_API_URL = process.env.URL_EESTI_LANG_API;

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const getFullArticleES = (articleLetter: string): string => {
    switch (articleLetter) {
        case 'f': return 'la';
        case 'm': return 'el';
        default:  return '-';
    }
};

const getFullArticleDE = (articleLetter: string): string => {
    switch (articleLetter) {
        case 'F': return 'die';
        case 'M': return 'der';
        case 'N': return 'das';
        default:  return '-';
    }
};

const capitalizeNoun = (nounString?: string): string | undefined => {
    if (nounString !== undefined && nounString.length > 1) {
        return nounString[0].toUpperCase() + nounString.slice(1);
    }
    return nounString;
};

/**
 * Extract the conjugated verb from a compound string (e.g. "will run" → "run").
 */
const extractVerb = (compoundVerbString: string): string =>
    compoundVerbString.split(' ')[1];

/**
 * Fetch data from an external API via HTTPS GET.
 * NB! I couldn't make this work as an import from another file (issues with
 * require vs import outside modules?), so it stays here since we only use it
 * for estonian-api requests.
 */
function getDataFromAPI(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';
            response.on('data', (chunk: string) => { data += chunk; });
            response.on('end', () => { resolve(JSON.parse(data)); });
        }).on('error', (error) => { reject(error); });
    });
}

// ===========================================================================
// ENDPOINTS — Spanish
// ===========================================================================

// @desc    Get Spanish noun-gender info by singular-nominative form
// @route   GET /api/autocompleteTranslations/spanish/noun/:singularNominativeNoun
// @access  Private
const getNounGenderES = asyncHandler(async (req: any, res: any) => {
    const spanishNoun = isWord('spanish');
    // TODO: SpanishGender library can infer gender of words that isWord does not know, through grammatical rules.
    //  But SpanishGender also will always return either f or m, even if the word does not exist.
    //  We could include an additional field specifying "certainty" of autocomplete data,
    //  and inform the user when we are not 100% sure if it correct.
    const nounExists = spanishNoun.check(req.params.singularNominativeNoun);
    const matchingGenderResponse = {
        language: 'Spanish',
        cases: [
            { caseName: 'genderES', word: getFullArticleES(SpanishGender(req.params.singularNominativeNoun)) },
            { caseName: 'singularES', word: req.params.singularNominativeNoun },
        ],
    };

    if (nounExists) {
        res.status(200).json({ foundNoun: true, nounData: matchingGenderResponse });
    } else {
        res.status(200).json({ foundNoun: false, possibleMatch: true, nounData: matchingGenderResponse });
    }
});

// @desc    Get Spanish verb info by infinitive form
// @route   GET /api/autocompleteTranslations/spanish/verb/:infinitiveVerb
// @access  Private
const getVerbES = asyncHandler(async (req: any, res: any) => {
    const spanishVerb = isWord('spanish');

    if (spanishVerb.check(req.params.infinitiveVerb)) {
        const verbResponse = {
            language: 'Spanish',
            cases: [
                { word: req.params.infinitiveVerb, caseName: 'infinitiveNonFiniteSimpleES' },
                // TODO: the gerund is not found in any other conjugation, and is not regular, so for now we can't autocomplete it.
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_PRETERITE_PERFECT', 0).split(' ')[1], caseName: 'participleNonFiniteSimpleES' },
                // INDICATIVE - SIMPLE TIME - PRESENT
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_PRESENT', 0), caseName: 'indicativePresent1sES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_PRESENT', 1), caseName: 'indicativePresent2sES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_PRESENT', 2), caseName: 'indicativePresent3sES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_PRESENT', 3), caseName: 'indicativePresent1plES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_PRESENT', 4), caseName: 'indicativePresent2plES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_PRESENT', 5), caseName: 'indicativePresent3plES' },
                // INDICATIVE - SIMPLE TIME - PRET. IMPERFECT
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_IMPERFECT', 0), caseName: 'indicativeImperfectPast1sES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_IMPERFECT', 1), caseName: 'indicativeImperfectPast2sES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_IMPERFECT', 2), caseName: 'indicativeImperfectPast3sES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_IMPERFECT', 3), caseName: 'indicativeImperfectPast1plES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_IMPERFECT', 4), caseName: 'indicativeImperfectPast2plES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_IMPERFECT', 5), caseName: 'indicativeImperfectPast3plES' },
                // INDICATIVE - SIMPLE TIME - PRET. PERFECT
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_PRETERITE', 0), caseName: 'indicativePerfectSimplePast1sES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_PRETERITE', 1), caseName: 'indicativePerfectSimplePast2sES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_PRETERITE', 2), caseName: 'indicativePerfectSimplePast3sES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_PRETERITE', 3), caseName: 'indicativePerfectSimplePast1plES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_PRETERITE', 4), caseName: 'indicativePerfectSimplePast2plES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_PRETERITE', 5), caseName: 'indicativePerfectSimplePast3plES' },
                // INDICATIVE - SIMPLE TIME - FUTURE
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_FUTURE', 0), caseName: 'indicativeFuture1sES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_FUTURE', 1), caseName: 'indicativeFuture2sES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_FUTURE', 2), caseName: 'indicativeFuture3sES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_FUTURE', 3), caseName: 'indicativeFuture1plES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_FUTURE', 4), caseName: 'indicativeFuture2plES' },
                { word: SpanishVerbs.getConjugation(req.params.infinitiveVerb, 'INDICATIVE_FUTURE', 5), caseName: 'indicativeFuture3plES' },
            ],
        };
        res.status(200).json({ foundVerb: true, verbData: verbResponse });
    } else {
        res.status(200).json({ foundVerb: false });
    }
});

// ===========================================================================
// ENDPOINTS — English
// ===========================================================================

// @desc    Get English verb info by infinitive form
// @route   GET /api/autocompleteTranslations/english/verb/:infinitiveVerb
// @access  Private
const getVerbEN = asyncHandler(async (req: any, res: any) => {
    // TODO: maybe also check 'british-english'? To avoid mistakes from different spelling.
    const englishVerb = isWord('american-english');
    // PRONOUNS
    // 0: I | 1: you (singular) | 2: he/she/it | 3: we | 4: you (plural) | 5: they
    // TENSES: SIMPLE_PRESENT, SIMPLE_PAST, SIMPLE_FUTURE, etc.

    if (englishVerb.check(req.params.infinitiveVerb)) {
        const verbResponse = {
            language: 'English',
            cases: [
                // PRESENT
                { caseName: 'simplePresent1sEN', word: EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_PRESENT', 0) },
                { caseName: 'simplePresent2sEN', word: EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_PRESENT', 1) },
                { caseName: 'simplePresent3sEN', word: EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_PRESENT', 2) },
                { caseName: 'simplePresent1plEN', word: EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_PRESENT', 3) },
                { caseName: 'simplePresent3plEN', word: EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_PRESENT', 5) },
                // PAST
                { caseName: 'simplePast1sEN', word: EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_PAST', 0) },
                { caseName: 'simplePast2sEN', word: EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_PAST', 1) },
                { caseName: 'simplePast3sEN', word: EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_PAST', 2) },
                { caseName: 'simplePast1plEN', word: EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_PAST', 3) },
                { caseName: 'simplePast3plEN', word: EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_PAST', 5) },
                // FUTURE (auxiliary verb: 'will')
                { caseName: 'simpleFuture1sEN', word: extractVerb(EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_FUTURE', 0)) },
                { caseName: 'simpleFuture2sEN', word: extractVerb(EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_FUTURE', 1)) },
                { caseName: 'simpleFuture3sEN', word: extractVerb(EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_FUTURE', 2)) },
                { caseName: 'simpleFuture1plEN', word: extractVerb(EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_FUTURE', 3)) },
                { caseName: 'simpleFuture3plEN', word: extractVerb(EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_FUTURE', 5)) },
                // CONDITIONAL (auxiliary verb: 'would')
                { caseName: 'simpleConditional1sEN', word: extractVerb(EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_FUTURE', 0)) },
                { caseName: 'simpleConditional2sEN', word: extractVerb(EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_FUTURE', 1)) },
                { caseName: 'simpleConditional3sEN', word: extractVerb(EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_FUTURE', 2)) },
                { caseName: 'simpleConditional1plEN', word: extractVerb(EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_FUTURE', 3)) },
                { caseName: 'simpleConditional3plEN', word: extractVerb(EnglishVerbs.getConjugation(EnglishVerbsData, req.params.infinitiveVerb, 'SIMPLE_FUTURE', 5)) },
            ],
        };
        res.status(200).json({ foundVerb: true, verbData: verbResponse });
    } else {
        res.status(200).json({ foundVerb: false });
    }
});

// ===========================================================================
// ENDPOINTS — German
// ===========================================================================

// @desc    Get German verb info by infinitive form
// @route   GET /api/autocompleteTranslations/german/verb/:infinitiveVerb
// @access  Private
const getVerbDE = asyncHandler(async (req: any, res: any) => {
    const germanVerb = isWord('ngerman');
    const verbToConjugate = req.params.infinitiveVerb.toLowerCase();

    if (germanVerb.check(verbToConjugate)) {
        const verbResponse = {
            language: 'German',
            cases: [
                { caseName: 'infinitiveDE', word: req.params.infinitiveVerb },
                // INDICATIVE - PRESENT
                { caseName: 'indicativePresent1sDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PRASENS', 1, 'S')[0] },
                { caseName: 'indicativePresent2sDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PRASENS', 2, 'S')[0] },
                { caseName: 'indicativePresent3sDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PRASENS', 3, 'S')[0] },
                { caseName: 'indicativePresent1plDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PRASENS', 1, 'P')[0] },
                { caseName: 'indicativePresent2plDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PRASENS', 2, 'P')[0] },
                { caseName: 'indicativePresent3plDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PRASENS', 3, 'P')[0] },
                // PERFEKT
                { caseName: 'indicativePerfect1sDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PERFEKT', 1, 'S', 'HABEN')[1] },
                { caseName: 'indicativePerfect2sDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PERFEKT', 2, 'S', 'HABEN')[1] },
                { caseName: 'indicativePerfect3sDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PERFEKT', 3, 'S', 'HABEN')[1] },
                { caseName: 'indicativePerfect1plDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PERFEKT', 1, 'P', 'HABEN')[1] },
                { caseName: 'indicativePerfect2plDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PERFEKT', 2, 'P', 'HABEN')[1] },
                { caseName: 'indicativePerfect3plDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PERFEKT', 3, 'P', 'HABEN')[1] },
                // Futur I
                { caseName: 'indicativeSimpleFuture1sDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'FUTUR1', 1, 'S')[1] },
                { caseName: 'indicativeSimpleFuture2sDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'FUTUR1', 2, 'S')[1] },
                { caseName: 'indicativeSimpleFuture3sDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'FUTUR1', 3, 'S')[1] },
                { caseName: 'indicativeSimpleFuture1plDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'FUTUR1', 1, 'P')[1] },
                { caseName: 'indicativeSimpleFuture2plDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'FUTUR1', 2, 'P')[1] },
                { caseName: 'indicativeSimpleFuture3plDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'FUTUR1', 3, 'P')[1] },
                // PRATERITUM
                { caseName: 'indicativeSimplePast1sDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PRATERITUM', 1, 'S')[0] },
                { caseName: 'indicativeSimplePast2sDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PRATERITUM', 2, 'S')[0] },
                { caseName: 'indicativeSimplePast3sDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PRATERITUM', 3, 'S')[0] },
                { caseName: 'indicativeSimplePast1plDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PRATERITUM', 1, 'P')[0] },
                { caseName: 'indicativeSimplePast2plDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PRATERITUM', 2, 'P')[0] },
                { caseName: 'indicativeSimplePast3plDE', word: GermanVerbsLib.getConjugation(GermanVerbsDict, verbToConjugate, 'PRATERITUM', 3, 'P')[0] },
                // Past Perfect (PLUSQUAMPERFEKT) / Future Perfect (Futur II) — TODO
            ],
        };
        res.status(200).json({ foundVerb: true, verbData: verbResponse });
    } else {
        res.status(200).json({ foundVerb: false });
    }
});

// @desc    Get German noun info by basic case form
// @route   GET /api/autocompleteTranslations/german/noun/:singularNominativeNoun
// @access  Private
const getNounDE = asyncHandler(async (req: any, res: any) => {
    const germanVerb = isWord('ngerman');
    const nounToAutocomplete = capitalizeNoun(req.params.singularNominativeNoun);

    if (germanVerb.check(nounToAutocomplete)) {
        const nounResponse = {
            language: 'German',
            cases: [
                { caseName: 'genderDE', word: getFullArticleDE(GermanWords.getGenderGermanWord(null, GermanWordsList, nounToAutocomplete)) },
                { caseName: 'singularNominativDE', word: GermanWords.getCaseGermanWord(null, GermanWordsList, nounToAutocomplete, 'NOMINATIVE', 'S') },
                { caseName: 'pluralNominativDE', word: GermanWords.getCaseGermanWord(null, GermanWordsList, nounToAutocomplete, 'NOMINATIVE', 'P') },
                { caseName: 'singularAkkusativDE', word: GermanWords.getCaseGermanWord(null, GermanWordsList, nounToAutocomplete, 'ACCUSATIVE', 'S') },
                { caseName: 'pluralAkkusativDE', word: GermanWords.getCaseGermanWord(null, GermanWordsList, nounToAutocomplete, 'ACCUSATIVE', 'P') },
                { caseName: 'singularGenitivDE', word: GermanWords.getCaseGermanWord(null, GermanWordsList, nounToAutocomplete, 'GENITIVE', 'S') },
                { caseName: 'pluralGenitivDE', word: GermanWords.getCaseGermanWord(null, GermanWordsList, nounToAutocomplete, 'GENITIVE', 'P') },
                { caseName: 'singularDativDE', word: GermanWords.getCaseGermanWord(null, GermanWordsList, nounToAutocomplete, 'DATIVE', 'S') },
                { caseName: 'pluralDativDE', word: GermanWords.getCaseGermanWord(null, GermanWordsList, nounToAutocomplete, 'DATIVE', 'P') },
            ],
        };
        res.status(200).json({ foundNoun: true, nounData: nounResponse });
    } else {
        res.status(200).json({ foundNoun: false });
    }
});

// ===========================================================================
// ENDPOINTS — Estonian (external API)
// ===========================================================================

// @desc    Get Estonian verb info by infinitive-ma form
// @route   GET /api/autocompleteTranslations/estonian/verb/:infinitiveMaVerb
// @access  Private
const getVerbEE = asyncHandler(async (req: any, res: any) => {
    if (!req.params.infinitiveMaVerb) {
        res.status(400);
        throw new Error('Missing infinitive-ma query');
    }
    if (!req.user) {
        res.status(401);
        throw new Error('User not found');
    }

    const searchInEnglish = req.query.searchInEnglish === 'true';
    let searchURL = `${EESTI_API_URL}/${req.params.infinitiveMaVerb}`;
    if (searchInEnglish) searchURL += '?lg=en';

    getDataFromAPI(searchURL)
        .then((data) => res.status(200).json(data))
        .catch((error) => console.error('Error in Estonian API request:', error));
});

// @desc    Get Estonian noun info by singular-nominative form
// @route   GET /api/autocompleteTranslations/estonian/noun/:singularNominativeNoun
// @access  Private
const getNounEE = asyncHandler(async (req: any, res: any) => {
    if (!req.params.singularNominativeNoun) {
        res.status(400);
        throw new Error('Missing infinitive-ma query');
    }
    if (!req.user) {
        res.status(401);
        throw new Error('User not found');
    }

    const searchInEnglish = req.query.searchInEnglish === 'true';
    let searchURL = `${EESTI_API_URL}/${req.params.singularNominativeNoun}`;
    if (searchInEnglish) searchURL += '?lg=en';

    getDataFromAPI(searchURL)
        .then((data) => res.status(200).json(data))
        .catch((error) => console.error('Error in Estonian API request:', error));
});

// @desc    Get Estonian adjective info
// @route   GET /api/autocompleteTranslations/estonian/adjective/:singularAdjective
// @access  Private
const getAdjectiveEE = asyncHandler(async (req: any, res: any) => {
    if (!req.params.singularAdjective) {
        res.status(400);
        throw new Error('Missing adjective query');
    }
    if (!req.user) {
        res.status(401);
        throw new Error('User not found');
    }

    const searchInEnglish = req.query.searchInEnglish === 'true';
    let searchURL = `${EESTI_API_URL}/${req.params.singularAdjective}`;
    if (searchInEnglish) searchURL += '?lg=en';

    getDataFromAPI(searchURL)
        .then((data) => res.status(200).json(data))
        .catch((error) => console.error('Error in Estonian API request:', error));
});

// ===========================================================================
// EXPORTS
// ===========================================================================

module.exports = {
    getVerbEN,
    getVerbES,
    getNounGenderES,
    getVerbDE,
    getNounDE,
    getVerbEE,
    getNounEE,
    getAdjectiveEE,
};
