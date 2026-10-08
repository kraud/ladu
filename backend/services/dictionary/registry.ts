/**
 * The only place that knows which (language, part of speech) pairs have a dictionary, and
 * which adapter serves each. Keys use the app's own values (Lang and PartOfSpeech in
 * frontend/src/ts/enums.ts), so neither side needs a mapping table.
 *
 * Later slices add adapters here (the local lexicon first, then these as the fallback);
 * the route and the response shape do not change.
 */

import type { DictionaryAdapter } from './types';
const generators: typeof import('./generators') = require('./generators');
const eki: typeof import('./eki') = require('./eki');

export const LANGUAGES = ['English', 'Spanish', 'German', 'Estonian'] as const;
export const PARTS_OF_SPEECH = [
    'Noun', 'Verb', 'Adjective', 'Adverb', 'Preposition', 'Conjunction', 'Pronoun', 'Interjection', 'Proper noun', 'Numerals',
] as const;

type Language = (typeof LANGUAGES)[number];
type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

const REGISTRY: Partial<Record<Language, Partial<Record<PartOfSpeech, DictionaryAdapter>>>> = {
    English: { Verb: generators.englishVerb },
    Spanish: { Verb: generators.spanishVerb, Noun: generators.spanishNoun },
    German: { Verb: generators.germanVerb, Noun: generators.germanNoun },
    Estonian: { Verb: eki.estonianVerb, Noun: eki.estonianNoun, Adjective: eki.estonianAdjective },
};

export function findAdapter(language: string, partOfSpeech: string): DictionaryAdapter | undefined {
    return REGISTRY[language as Language]?.[partOfSpeech as PartOfSpeech];
}
