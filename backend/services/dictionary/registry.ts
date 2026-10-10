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
const { firstEstonianVerb }: typeof import('./translate') = require('./translate');
const { NOT_FOUND }: typeof import('./types') = require('./types');

export const LANGUAGES = ['English', 'Spanish', 'German', 'Estonian'] as const;
export const PARTS_OF_SPEECH = [
    'Noun', 'Verb', 'Adjective', 'Adverb', 'Preposition', 'Conjunction', 'Pronoun', 'Interjection', 'Proper noun', 'Numerals',
] as const;

type Language = (typeof LANGUAGES)[number];
type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

/**
 * Estonian verb, with "Search verb in English" (step F3, D22). The English word first becomes an
 * Estonian verb: from the local translation table (`firstEstonianVerb`), else from Ekilex (the
 * verb in the most meanings, as before F3). Then `lookup` runs on that verb as if the user had
 * typed it: the local lexicon, then Ekilex.
 */
function withSearchInEnglish(lookup: DictionaryAdapter): DictionaryAdapter {
    return async (query, options) => {
        if (!options.searchInEnglish) return lookup(query, options);
        const verb = (await firstEstonianVerb(query)) ?? (await eki.estonianVerbFor(query));
        return verb ? lookup(verb, { ...options, searchInEnglish: false }) : NOT_FOUND;
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
    },
    // Slice C1: the same chain as German.
    Spanish: {
        Verb: lexiconFirst(lexiconAdapter('Spanish', 'Verb'), generators.spanishVerb),
        Noun: lexiconFirst(lexiconAdapter('Spanish', 'Noun'), generators.spanishNoun),
        Adjective: lexiconAdapter('Spanish', 'Adjective'),
        Adverb: lexiconAdapter('Spanish', 'Adverb'),
    },
    // Slice B2: the local lexicon first, the library as a `partial` fallback.
    German: {
        Verb: lexiconFirst(lexiconAdapter('German', 'Verb'), generators.germanVerb),
        Noun: lexiconFirst(lexiconAdapter('German', 'Noun'), generators.germanNoun),
        Adjective: lexiconAdapter('German', 'Adjective'),
        Adverb: lexiconAdapter('German', 'Adverb'),
    },
    // Slice D2: Eesthetic in the lexicon first, then Ekilex — a real dictionary, so its answers stay
    // `found`. Adjectives: Eesthetic has (almost) none, so Ekilex only.
    Estonian: {
        Verb: withSearchInEnglish(lexiconFirst(lexiconAdapter('Estonian', 'Verb'), eki.estonianVerb, { fallbackIs: 'dictionary' })),
        Noun: lexiconFirst(lexiconAdapter('Estonian', 'Noun'), eki.estonianNoun, { fallbackIs: 'dictionary' }),
        Adjective: eki.estonianAdjective,
    },
};

export function findAdapter(language: string, partOfSpeech: string): DictionaryAdapter | undefined {
    return REGISTRY[language as Language]?.[partOfSpeech as PartOfSpeech];
}
