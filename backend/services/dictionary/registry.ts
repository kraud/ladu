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

export const LANGUAGES = ['English', 'Spanish', 'German', 'Estonian'] as const;
export const PARTS_OF_SPEECH = [
    'Noun', 'Verb', 'Adjective', 'Adverb', 'Preposition', 'Conjunction', 'Pronoun', 'Interjection', 'Proper noun', 'Numerals',
] as const;

type Language = (typeof LANGUAGES)[number];
type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

const REGISTRY: Partial<Record<Language, Partial<Record<PartOfSpeech, DictionaryAdapter>>>> = {
    English: { Verb: generators.englishVerb },
    Spanish: { Verb: generators.spanishVerb, Noun: generators.spanishNoun },
    // Slice B2: the local lexicon first, the library as a `partial` fallback.
    German: {
        Verb: lexiconFirst(lexiconAdapter('German', 'Verb'), generators.germanVerb),
        Noun: lexiconFirst(lexiconAdapter('German', 'Noun'), generators.germanNoun),
    },
    Estonian: { Verb: eki.estonianVerb, Noun: eki.estonianNoun, Adjective: eki.estonianAdjective },
};

export function findAdapter(language: string, partOfSpeech: string): DictionaryAdapter | undefined {
    return REGISTRY[language as Language]?.[partOfSpeech as PartOfSpeech];
}
