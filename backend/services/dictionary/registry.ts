/**
 * The only place that knows which (language, part of speech) pairs have a dictionary, and
 * which adapter serves each. Keys use the app's own values (Lang and PartOfSpeech in
 * frontend/src/ts/enums.ts), so neither side needs a mapping table.
 *
 * Slice B2 put the local lexicon in front of the German libraries (`lexiconFirst`); Slices C1,
 * C2 and D do the same for the other languages. The route and the response shape do not change.
 */

import type { DictionaryAdapter } from './types';
const generators: typeof import('./generators') = require('./generators');
const eki: typeof import('./eki') = require('./eki');
const { lexiconAdapter, lexiconFirst }: typeof import('./lexicon') = require('./lexicon');
const { toCases }: typeof import('./types') = require('./types');
const { pairParts }: typeof import('../../lib/lexicon/selectors/functionWords') = require('../../lib/lexicon/selectors/functionWords');

const { LANGUAGE_NAMES }: typeof import('../../lib/languages') = require('../../lib/languages');

export const LANGUAGES = LANGUAGE_NAMES;
export const PARTS_OF_SPEECH = [
    'Noun', 'Verb', 'Adjective', 'Adverb', 'Preposition', 'Conjunction', 'Pronoun', 'Interjection', 'Proper noun', 'Numerals',
] as const;

type Language = import('../../lib/languages').LanguageName;
type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

/**
 * Conjunction lookups (conjunctions-and-prepositions plan, slice 3c). The translation table lists a pair as
 * "weder … noch" (an ellipsis), but the lexicon stores the first word alone. When the lookup finds nothing and the text
 * is a pair, the pair is split by rule: the first part, the "Paired" box and the second part. The answer is
 * `partial` (a rule-based guess, the type is unknown), as with the libraries behind the other lookups.
 */
function withPairSplit(lookup: DictionaryAdapter, code: string): DictionaryAdapter {
    return async (query, options) => {
        const result = await lookup(query, options);
        const parts = pairParts(query);
        if (result.status !== 'not-found' || parts.length !== 2) return result;
        return { status: 'partial', cases: toCases([[`conjunction${code}`, parts[0]], [`correlative${code}`, 'true'], [`secondPart${code}`, parts[1]]]) };
    };
}

/**
 * French pronominal verbs (language-french.md, slice 9b). The French form writes the infinitive of a pronominal verb
 * with its pronoun ("se laver", "s'habiller"), but Wiktionary gives only 257 such verbs an entry of their own
 * ("se souvenir", "s'appeler"); the others live inside the plain entry ("laver"). When "se X" or "s'X" finds nothing, X is
 * looked up. If Wiktionary says X can be reflexive, its forms are returned with the infinitive as typed, "Always
 * reflexive" and the auxiliary être. The answer is `partial` (a rule-based guess). A verb that is not marked reflexive
 * stays not-found: nothing is guessed.
 */
const PRONOMINAL_PREFIX = /^(?:se\s+|s['’])/i;
function withPronominalFallback(lookup: DictionaryAdapter): DictionaryAdapter {
    return async (query, options) => {
        const result = await lookup(query, options);
        const typed = query.trim();
        const bare = typed.replace(PRONOMINAL_PREFIX, '');
        if (result.status !== 'not-found' || bare === typed || bare === '') return result;

        const base = await lookup(bare, {});
        const reflexivity = base.cases.find(({ caseName }) => caseName === 'reflexivityFR')?.word;
        if (base.status !== 'found' || reflexivity === undefined || reflexivity === 'Not reflexive') return result;

        const own = new Set(['infinitiveFR', 'reflexivityFR', 'auxVerbFR']);
        const cases = [
            ...toCases([['infinitiveFR', typed], ['reflexivityFR', 'Always reflexive'], ['auxVerbFR', 'être']]),
            ...base.cases.filter(({ caseName }) => !own.has(caseName)),
        ];
        return { status: 'partial', cases };
    };
}

const REGISTRY: Partial<Record<Language, Partial<Record<PartOfSpeech, DictionaryAdapter>>>> = {
    // Slice C2: verbs use the chain; nouns have no library, so the lexicon alone (a miss is not-found).
    English: {
        Verb: lexiconFirst(lexiconAdapter('English', 'Verb'), generators.englishVerb),
        Noun: lexiconAdapter('English', 'Noun'),
        // Slice H2: no library exists for adjectives and adverbs, so the lexicon alone (a miss is not-found).
        Adjective: lexiconAdapter('English', 'Adjective'),
        Adverb: lexiconAdapter('English', 'Adverb'),
        // Slice 3b of the conjunctions-and-prepositions plan: the lexicon alone, like adjectives and adverbs.
        Conjunction: withPairSplit(lexiconAdapter('English', 'Conjunction'), 'EN'),
        Preposition: lexiconAdapter('English', 'Preposition'),
    },
    // Slice C1: the same chain as German.
    Spanish: {
        Verb: lexiconFirst(lexiconAdapter('Spanish', 'Verb'), generators.spanishVerb),
        Noun: lexiconFirst(lexiconAdapter('Spanish', 'Noun'), generators.spanishNoun),
        Adjective: lexiconAdapter('Spanish', 'Adjective'),
        Adverb: lexiconAdapter('Spanish', 'Adverb'),
        Conjunction: withPairSplit(lexiconAdapter('Spanish', 'Conjunction'), 'ES'),
        Preposition: lexiconAdapter('Spanish', 'Preposition'),
    },
    // Slice B2: the local lexicon first, the library as a `partial` fallback.
    German: {
        Verb: lexiconFirst(lexiconAdapter('German', 'Verb'), generators.germanVerb),
        Noun: lexiconFirst(lexiconAdapter('German', 'Noun'), generators.germanNoun),
        Adjective: lexiconAdapter('German', 'Adjective'),
        Adverb: lexiconAdapter('German', 'Adverb'),
        Conjunction: withPairSplit(lexiconAdapter('German', 'Conjunction'), 'DE'),
        Preposition: lexiconAdapter('German', 'Preposition'),
    },
    // French slices 9a and 9b (language-french.md): the lexicon alone, like English nouns: no library exists, so a miss
    // is not-found.
    French: {
        Verb: withPronominalFallback(lexiconAdapter('French', 'Verb')),
        Noun: lexiconAdapter('French', 'Noun'),
        Adjective: lexiconAdapter('French', 'Adjective'),
        Adverb: lexiconAdapter('French', 'Adverb'),
        Conjunction: withPairSplit(lexiconAdapter('French', 'Conjunction'), 'FR'),
        Preposition: lexiconAdapter('French', 'Preposition'),
    },
    // Slice D2: Eesthetic in the lexicon first, then Ekilex — a real dictionary, so its answers stay
    // `found`. Adjectives: Eesthetic has (almost) none, so Ekilex only.
    Estonian: {
        Verb: lexiconFirst(lexiconAdapter('Estonian', 'Verb'), eki.estonianVerb, { fallbackIs: 'dictionary' }),
        Noun: lexiconFirst(lexiconAdapter('Estonian', 'Noun'), eki.estonianNoun, { fallbackIs: 'dictionary' }),
        Adjective: eki.estonianAdjective,
        // Slice H4: Ekilex only, like the adjective (Eesthetic has no adverbs).
        Adverb: eki.estonianAdverb,
        // Slice 3a of the conjunctions-and-prepositions plan: Ekilex only (Eesthetic has no function words).
        Conjunction: withPairSplit(eki.estonianConjunction, 'EE'),
        Preposition: eki.estonianPreposition,
    },
};

export function findAdapter(language: string, partOfSpeech: string): DictionaryAdapter | undefined {
    return REGISTRY[language as Language]?.[partOfSpeech as PartOfSpeech];
}
